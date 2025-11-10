// routes/slack-adrespg.js
const express = require('express');
const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

function createClient() {
  return new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  });
}

// 🔎 Query op basis van postcode + huisnummer
async function queryByPostcode(postcode, huisnummer) {
  const client = createClient();
  await client.connect();

  const result = await client.query(
    `SELECT straatnaam, plaatsnaam, 
            wijkcode || lettercombinatie AS postcode, 
            huisnr, breedtegraad, lengtegraad
     FROM ktb_pcdata
     WHERE (wijkcode || lettercombinatie) = $1 AND huisnr = $2
     LIMIT 1`,
    [postcode.toUpperCase(), huisnummer]
  );

  await client.end();
  return result.rows;
}

// 🔎 Query op basis van straat + plaats + huisnummer
async function queryByStraat(straat, plaats, huisnummer) {
  const client = createClient();
  await client.connect();

  const result = await client.query(
    `SELECT straatnaam, plaatsnaam, 
            wijkcode || lettercombinatie AS postcode, 
            huisnr, breedtegraad, lengtegraad
     FROM ktb_pcdata
     WHERE straatnaam % $1 
       AND plaatsnaam % $2 
       AND huisnr = $3
     ORDER BY similarity(straatnaam, $1) DESC,
              similarity(plaatsnaam, $2) DESC
     LIMIT 1`,
    [straat, plaats, huisnummer]
  );

  await client.end();
  return result.rows;
}

// 🎯 Route: /slack/adrespg
router.post('/adrespg', async (req, res) => {
  const { text, response_url } = req.body;

  if (!text) {
    return res.json({
      response_type: 'ephemeral',
      text: '❌ Gebruik: `/adrespg <straat> <plaats> <huisnummer>` of `/adrespg <postcode> <huisnummer>`'
    });
  }

  const parts = text.trim().split(/\s+/);
  const huisnummer = parts.find(p => /^\d+$/.test(p));

  if (!huisnummer) {
    return res.json({
      response_type: 'ephemeral',
      text: '❌ Voeg ook een huisnummer toe.'
    });
  }

  res.json({
    response_type: 'ephemeral',
    text: `⏳ Even zoeken naar *${text}*...`
  });

  try {
    let rows = [];
    const postcode = parts.find(p => /^[0-9]{4}[A-Z]{2}$/i.test(p));

    if (postcode) {
      rows = await queryByPostcode(postcode, huisnummer);
    } else {
      const zonderNummer = parts.filter(p => !/^\d+$/.test(p));
      const plaats = zonderNummer[zonderNummer.length - 1];
      const straat = zonderNummer.slice(0, -1).join(' ');
      rows = await queryByStraat(straat, plaats, huisnummer);
    }

    if (rows.length === 0) {
      return await axios.post(response_url, {
        response_type: 'ephemeral',
        text: `❌ Geen adres gevonden voor *${text}*`
      });
    }

    const r = rows[0];
    const adres = `${r.straatnaam} ${r.huisnr}, ${r.plaatsnaam} (${r.postcode})`;
    const mapsUrl = (r.breedtegraad && r.lengtegraad)
      ? `https://www.google.com/maps/search/?api=1&query=${r.breedtegraad},${r.lengtegraad}`
      : null;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Adres gevonden:*\n${adres}${mapsUrl ? `\n🌍 <${mapsUrl}|Open in Google Maps>` : ''}`
        }
      }
    ];

    if (mapsUrl && process.env.GOOGLE_MAPS_API_KEY) {
      blocks.push({
        type: 'image',
        image_url: `https://maps.googleapis.com/maps/api/staticmap?center=${r.breedtegraad},${r.lengtegraad}&zoom=17&size=600x300&markers=${r.breedtegraad},${r.lengtegraad}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
        alt_text: `Kaart van ${adres}`
      });
    }

    await axios.post(response_url, {
      response_type: 'in_channel',
      blocks
    });

  } catch (err) {
    console.error('❌ Fout in /adrespg:', err.message);
    await axios.post(response_url, {
      response_type: 'ephemeral',
      text: '❌ Databasefout of API-fout.'
    });
  }
});

module.exports = router;

