const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const router = express.Router();

const CALIBRE_DB = process.env.CALIBRE_DB_PATH || '/books/metadata.db';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:8083';

function shorten(text, words = 40) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').split(/\s+/).slice(0, words).join(' ') + '...';
}

router.post('/book', async (req, res) => {
  console.log('?? Incoming request body:', req.body);
  const { text, response_url } = req.body;
  console.log('?? Incoming response_url =', response_url);

  const query = (text || '').trim().toLowerCase();

  if (!response_url) {
    return res.status(400).json({ error: 'Missing response_url' });
  }

  res.json({
    response_type: 'ephemeral',
    text: `:book: Even zoeken naar *${query || 'random'}*...`
  });

  const db = new sqlite3.Database(CALIBRE_DB, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('? Fout bij openen Calibre DB:', err.message);
    } else {
      console.log('?? Open Calibre DB:', CALIBRE_DB);
    }
  });

  let sql = '';
  let params = [];

  if (query === 'new') {
    sql = `
      SELECT DISTINCT b.id, b.title, a.name AS author, c.text AS description, b.path
      FROM books b
      LEFT JOIN authors a ON b.author_sort = a.sort
      LEFT JOIN comments c ON c.book = b.id
      WHERE c.text IS NOT NULL AND c.text != ''
      ORDER BY b.timestamp DESC
      LIMIT 3;
    `;
 } else if (query) {
  sql = `
    SELECT DISTINCT b.id, b.title, a.name AS author, c.text AS description, b.path
    FROM books b
    LEFT JOIN books_tags_link bl ON b.id = bl.book
    LEFT JOIN tags t ON bl.tag = t.id
    LEFT JOIN authors a ON b.author_sort = a.sort
    LEFT JOIN comments c ON c.book = b.id
    WHERE c.text IS NOT NULL
      AND c.text != ''
      AND (
        LOWER(b.title) LIKE '%' || LOWER(?) || '%' OR
        LOWER(a.name) LIKE '%' || LOWER(?) || '%' OR
        LOWER(t.name) LIKE '%' || LOWER(?) || '%'
      )
    ORDER BY RANDOM()
    LIMIT 3;
  `;
  params = [query, query, query];
} else {
    sql = `
      SELECT DISTINCT b.id, b.title, a.name AS author, c.text AS description, b.path
      FROM books b
      LEFT JOIN authors a ON b.author_sort = a.sort
      LEFT JOIN comments c ON c.book = b.id
      WHERE c.text IS NOT NULL AND c.text != ''
      ORDER BY RANDOM()
      LIMIT 3;
    `;
  }

  db.all(sql, params, async (err, rows) => {
    if (err || !rows || rows.length === 0) {
      console.error('? SQL-fout of geen resultaten:', err);
      await axios.post(response_url, {
        response_type: 'ephemeral',
        text: '?? Geen boeken gevonden.'
      });
      db.close();
      return;
    }

    console.log(`?? Verzenden naar Slack, aantal rijen: ${rows.length}`);
    const blocks = [];

    for (const row of rows) {
      const title = row.title || 'Onbekende titel';
      const author = row.author || 'Onbekende auteur';
      const desc = shorten(row.description || 'Geen beschrijving beschikbaar');
      const coverUrl = `${PUBLIC_URL}/cover/${row.id}/og`;
      const bookUrl = `${PUBLIC_URL}/book/${row.id}`;

      console.log(`??? Cover voor ${title}: ${coverUrl}`);

      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:books: *${title}*\n_${author}_\n\n${desc}`
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
            {
              type: 'mrkdwn',
              text: `:link: <${bookUrl}|Bekijk in Calibre-Web>`
            }
          ]
        },
        {
          type: 'divider'
        }
      );
    }

    try {
      await axios.post(response_url, {
        response_type: 'in_channel',
        blocks
      });
    } catch (e) {
      console.error('? Fout bij verzenden naar Slack:', e.message);
    } finally {
      db.close();
    }
  });
});

module.exports = router;
