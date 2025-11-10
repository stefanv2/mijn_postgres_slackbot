const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();

// DB in de container via volume: /home/stefan/kavita-config -> /kavita
const DB_PATH = '/kavita/kavita.db';

router.get('/comics', (req, res) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Kan database niet openen:', err);
      return res.status(500).json({ error: 'Kan Kavita database niet openen' });
    }
  });

  const sql = `
    SELECT
      s.Id            AS id,
      s.Name          AS title,
      s.SortName      AS author,
      s.CoverImage    AS cover,
      s.LibraryId     AS library_id,
      s.LocalizedName AS localized
    FROM Series s
    ORDER BY s.Name
    LIMIT 50;
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('❌ Fout in SQL query:', err);
      return res.status(500).json({ error: 'SQL fout in Kavita database' });
    }

    // CoverImage in Kavita wijst meestal naar iets als: metadata/series/123/cover.jpg
    // We serveren dat via /kavita_covers/...
    const comics = rows.map(row => ({
      id: row.id,
      title: row.title,
      author: row.author || 'Onbekend',
      description: row.localized || '',
      cover: row.cover ? `/kavita_covers/${row.cover}` : null
    }));

    res.json(comics);
  });

  db.close();
});

module.exports = router;

