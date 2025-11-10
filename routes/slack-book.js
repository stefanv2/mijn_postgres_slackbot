// routes/slack-book.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// ✅ Config uit .env
const CALIBRE_DB = process.env.CALIBRE_DB_PATH || '/books/metadata.db';
// Web (dashboard) en Slack hebben elk hun eigen publieke URL
//const PUBLIC_URL_WEB   = process.env.PUBLIC_URL_WEB   || 'http://localhost:3001';
const PUBLIC_URL_WEB   = process.env.PUBLIC_URL_WEB || 'https://voorbij.duckdns.org';
const PUBLIC_URL_SLACK = process.env.PUBLIC_URL_SLACK || 'https://voorbij.duckdns.org';
//const PUBLIC_URL_SLACK = process.env.PUBLIC_URL_SLACK || 'https://melissa-untheatrical-prewillingly.ngrok-free.dev';

// 👇 Kleine helper
function shorten(text, words = 40) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').split(/\s+/).slice(0, words).join(' ') + '...';
}

/* --------------------------------------------------------------------- */
/*  Gemeenschappelijke DB helper                                         */
/* --------------------------------------------------------------------- */
function runBooksQuery(mode, searchTerm, limit) {
  return new Promise((resolve, reject) => {
    let sql = '';
    let params = [];

    if (mode === 'new') {
      sql = `
        SELECT b.id, b.title, a.name AS author, c.text AS description
        FROM books b
        LEFT JOIN authors a ON b.author_sort = a.sort
        LEFT JOIN comments c ON c.book = b.id
        WHERE c.text IS NOT NULL AND c.text != ''
        ORDER BY b.timestamp DESC
        LIMIT ?;
      `;
      params = [limit];
    } else if (mode === 'search') {
      sql = `
        SELECT DISTINCT b.id, b.title, a.name AS author, c.text AS description
        FROM books b
        LEFT JOIN authors a ON b.author_sort = a.sort
        LEFT JOIN comments c ON c.book = b.id
        LEFT JOIN books_tags_link bl ON b.id = bl.book
        LEFT JOIN tags t ON bl.tag = t.id
        WHERE c.text IS NOT NULL
          AND (
            LOWER(b.title)  LIKE '%' || LOWER(?) || '%'
            OR LOWER(a.name) LIKE '%' || LOWER(?) || '%'
            OR LOWER(t.name) LIKE '%' || LOWER(?) || '%'
          )
        ORDER BY RANDOM()
        LIMIT ?;
      `;
      params = [searchTerm, searchTerm, searchTerm, limit];
    } else {
      // 'random' of default
      sql = `
        SELECT b.id, b.title, a.name AS author, c.text AS description
        FROM books b
        LEFT JOIN authors a ON b.author_sort = a.sort
        LEFT JOIN comments c ON c.book = b.id
        WHERE c.text IS NOT NULL AND c.text != ''
        ORDER BY RANDOM()
        LIMIT ?;
      `;
      params = [limit];
    }

    const db = new sqlite3.Database(CALIBRE_DB, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/* --------------------------------------------------------------------- */
/* ✅ 1) API voor Webpagina → JSON data voor GET /slack/api/books        */
/* --------------------------------------------------------------------- */
/*
  Voorbeelden:
  GET /slack/api/books                 -> random (3)
  GET /slack/api/books?query=random    -> random (3)
  GET /slack/api/books?query=new       -> nieuwste (3)
  GET /slack/api/books?query=thriller  -> search (3)
*/
router.get('/api/books', async (req, res) => {
  try {
    // CORS headers (handig als app.use(cors()) niet universeel staat)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Vary', 'Origin');

    const qRaw = (req.query.query || '').trim().toLowerCase();
    let mode = 'random';
    let needle = '';

    if (!qRaw || qRaw === 'random') {
      mode = 'random';
      // Zorg dat random niet cached wordt door de browser/proxy
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    } else if (qRaw === 'new') {
      mode = 'new';
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    } else {
      mode = 'search';
      needle = qRaw;
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    }

    // Voor het web tonen we 3 boeken (past mooier in je grid)
    const rows = await runBooksQuery(mode, needle, 4);

    const payload = rows.map(r => ({
      id: r.id,
      title: r.title,
      author: r.author,
      description: shorten(r.description),
      cover: `${PUBLIC_URL_WEB}/cover/${r.id}/og`,
      link:  `${PUBLIC_URL_WEB}/book/${r.id}`
    }));

    return res.json(payload);
  } catch (err) {
    console.error('❌ /slack/api/books error:', err.message);
    return res.status(500).json({ error: 'Databasefout' });
  }
});

/* --------------------------------------------------------------------- */
/* ✅ 2) Slack /book endpoint - blijft zoals je gewend bent               */
/* --------------------------------------------------------------------- */
/*
  /book new         -> nieuwste 3
  /book thriller    -> zoekt in titel/auteur/tag, random 3
  /book             -> random 3
*/
router.post('/book', async (req, res) => {
  try {
    const { text, response_url } = req.body;

    if (!response_url) {
      return res.status(400).json({ error: 'Missing response_url in Slack request' });
    }

    // Directe ACK naar Slack
    res.json({
      response_type: 'ephemeral',
      text: `📚 Zoeken naar *${text || 'random'}*...`
    });

    const q = (text || '').trim().toLowerCase();
    let mode = 'random';
    let needle = '';

    if (!q) {
      mode = 'random';
    } else if (q === 'new') {
      mode = 'new';
    } else {
      mode = 'search';
      needle = q;
    }

    const rows = await runBooksQuery(mode, needle, 4);

    if (!rows || rows.length === 0) {
      await axios.post(response_url, {
        response_type: 'ephemeral',
        text: '❌ Geen boeken gevonden.'
      });
      return;
    }

    const blocks = [];
    for (const row of rows) {
      const title = row.title || 'Onbekende titel';
      const author = row.author || 'Onbekende auteur';
      const desc = shorten(row.description);
      const coverUrl = `${PUBLIC_URL_SLACK}/cover/${row.id}/og`;
      const linkUrl  = `${PUBLIC_URL_SLACK}/book/${row.id}`;

      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📚 *${title}*\n_${author}_\n\n${desc}`
          }
        },
        {
          type: 'image',
          image_url: coverUrl,
          alt_text: title
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `🔗 <${linkUrl}|Bekijk in Calibre-Web>` }
          ]
        },
        { type: 'divider' }
      );
    }

    await axios.post(response_url, {
      response_type: 'in_channel',
      blocks
    });
  } catch (error) {
    console.error('❌ /book Slack error:', error.message);
    // Slack heeft al een ACK gekregen; optioneel: stuur nog een foutmelding na
  }
});

module.exports = router;

