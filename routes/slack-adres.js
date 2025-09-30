// routes/slack-adres.js
const express = require('express');
const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

async function queryPostgresStraat(straat, plaats, huisnummer) {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  });

  await client.connect();

  const sql = `
    SELECT straatnaam, plaatsnaam, huisnr,
           wijkcode || lettercombinatie AS postcode,
           breedtegraad, lengtegraad
    FROM ktb_pcdata
    WHERE straatnaam % $1
      AND plaatsnaam % $2
      AND huisnr = $3
    ORDER BY similarity(straatnaam, $1) DESC,
             similarity(plaatsnaam, $2) DESC
    LIMIT 1;
  `;

  const result = await client.query(sql, [straat, plaats, huisnummer]);
  await client.end();
  return result.rows;
}

async function queryPostgresPostcode(postcode, huisnummer) {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  });

  await client.connect();

  const sql = `
    SELECT straatnaam, plaatsnaam, huisnr,
           wijkcode || lettercombinatie AS postcode,
           breedtegraad, lengtegraad
    FROM ktb_pcdata
    WHERE (wijkcode || lettercombinatie) = $1
      AND huisnr = $2
    LIMIT 1;
  `;

  const result = await client.query(sql, [postcode.toUpperCase(), huisnummer]);
  await client.end();
  return result.rows;
}

router.post('/adres', async (req, res) => {
  const { text, response_url } = req.body;

  if (!text) {
    return res.json({
      response_type: 'ephemeral',
      text: '❌ Gebruik: `/adres <straat> <plaats> <huisnummer>` of `/adres <postcode> <huisnummer>`'
    });
  }

  const parts = text.trim().split(/\s+/);

  // Huisnummer
  const huisnummer = parts.find(p => /^\d+$/.test(p));
  if (!huisnummer) {
    return res.json({
      response_type: 'ephemeral',
      text: '❌ Geef ook een huisnummer mee.'
    });
  }

  // Postcode?
  const postcode = parts.find(p => /^[0-9]{4}[A-Z]{2}$/i.test(p));

  // Slack moet direct antwoord krijgen
  res.json({
    response_type: 'ephemeral',
    text: `⏳ Even zoeken naar ${text}...`
  });

  try {
    let rows = [];
    if (postcode) {
      console.log(`👉 Parsed: postcode="${postcode}", huisnr="${huisnummer}"`);
      rows = await queryPostgresPostcode(postcode, huisnummer);
    } else {
      const zonderHuisnr = parts.filter(p => !/^\d+$/.test(p));
      const plaats = zonderHuisnr[zonderHuisnr.length - 1];
      const straat = zonderHuisnr.slice(0, -1).join(' ');
      console.log(`👉 Parsed: straat="${straat}", plaats="${plaats}", huisnr="${huisnummer}"`);
      rows = await queryPostgresStraat(straat, plaats, huisnummer);
    }

    if (rows.length === 0) {
      await axios.post(response_url, {
        response_type: 'ephemeral',
        text: `Geen postcode gevonden voor: ${text}`
      });
      return;
    }

    const r = rows[0];
    const adres = `${r.straatnaam} ${r.huisnr}, ${r.plaatsnaam}`;
    const pc = r.postcode || 'onbekend';

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
    const mapsImageUrl = (r.breedtegraad && r.lengtegraad)
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${r.breedtegraad},${r.lengtegraad}&zoom=16&size=600x300&markers=color:red%7C${r.breedtegraad},${r.lengtegraad}&key=${process.env.GOOGLE_MAPS_KEY}`
      : null;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📮 *Postcode gevonden:*\n${adres}\n➡️ ${pc}\n\n🔗 <${mapsUrl}|Open in Google Maps>`
        }
      }
    ];

    if (mapsImageUrl) {
      blocks.push({
        type: 'image',
        image_url: mapsImageUrl,
        alt_text: `Kaart van ${adres}`
      });
    }

    await axios.post(response_url, {
      response_type: 'in_channel',
      blocks
    });

  } catch (err) {
    console.error('❌ Fout in async adres-zoekroute:', err.message);
    await axios.post(response_url, {
      response_type: 'ephemeral',
      text: '❌ Databasefout: ' + err.message
    });
  }
});

module.exports = router;

