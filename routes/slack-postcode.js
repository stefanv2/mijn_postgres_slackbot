// routes/slack-postcode.js
const express = require('express');
const { Client } = require('pg');
require('dotenv').config();

const router = express.Router();

// ⭐ 1. Database query functie verandert niet
async function queryPostgres(postcode, huisnr) {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  });

  await client.connect();

  const sql = `
    SELECT straatnaam, plaatsnaam,
           wijkcode || lettercombinatie AS postcode,
           huisnr, breedtegraad, lengtegraad
    FROM ktb_pcdata
    WHERE (wijkcode || lettercombinatie) = $1
      AND huisnr = $2
    LIMIT 1;
  `;
  const result = await client.query(sql, [postcode.toUpperCase(), huisnr]);
  await client.end();
  return result.rows;
}

// ⭐ 2. Slack endpoint blijft exact hetzelfde
router.post('/postcode', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.json({ text: '❓ Gebruik: `/postcode <postcode> <huisnummer>`' });
    }

    const parts = text.trim().split(/\s+/);
    const postcode = parts[0];
    const huisnr = parts[1] ? parseInt(parts[1], 10) : null;

    if (!postcode || !huisnr) {
      return res.json({ text: '⚠️ Voorbeeld: `/postcode 2014SL 203`' });
    }

    const rows = await queryPostgres(postcode, huisnr);
    if (rows.length === 0) {
      return res.json({ text: `❌ Geen adres gevonden voor ${text}` });
    }

    const r = rows[0];
    return res.json({
      text: `✅ ${r.straatnaam} ${r.huisnr}, ${r.plaatsnaam} (${r.postcode})`
    });

  } catch (err) {
    console.error('❌ Error in /postcode:', err);
    return res.status(500).json({ text: '❌ Er ging iets mis met de database.' });
  }
});

// ⭐ 3. Extra API voor website: /api/postcode?pc=2014SL&nr=203
router.get('/api/postcode', async (req, res) => {
  try {
    const { pc, nr } = req.query;
    if (!pc || !nr) {
      return res.status(400).json({ error: 'pc en nr zijn verplicht. Voorbeeld: ?pc=2014SL&nr=203' });
    }

    console.log(`🌍 GET /api/postcode -> pc=${pc}, nr=${nr}`);

    const rows = await queryPostgres(pc, parseInt(nr, 10));
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Geen adres gevonden' });
    }

    const r = rows[0];
    res.json({
      straat: r.straatnaam,
      huisnummer: r.huisnr,
      plaats: r.plaatsnaam,
      postcode: r.postcode,
      lat: r.breedtegraad,
      lon: r.lengtegraad
    });

  } catch (err) {
    console.error('❌ Fout in GET /api/postcode:', err);
    res.status(500).json({ error: 'Interne serverfout' });
  }
});

module.exports = router;

