const express = require('express');
const { Client } = require('pg');
require('dotenv').config();

const router = express.Router();

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
           huisnr, huisnr_bag_letter, huisnr_bag_toevoeging,
           breedtegraad, lengtegraad
    FROM ktb_pcdata
    WHERE wijkcode || lettercombinatie = $1
      AND huisnr = $2
    LIMIT 5;
  `;
  const result = await client.query(sql, [postcode, huisnr]);
  await client.end();

  return result.rows;
}

router.post('/postcode', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.json({ text: '❌ Gebruik: `/postcode <postcode> <huisnummer>`' });
  }

  const parts = text.trim().split(/\s+/);
  const postcode = parts[0];
  const huisnr = parts[1] ? parseInt(parts[1], 10) : null;

  const resultaten = await queryPostgres(postcode, huisnr);

  if (resultaten.length === 0) {
    return res.json({ text: `Geen adres gevonden voor: ${text}` });
  }

  const item = resultaten[0];
  let huisnrText = item.huisnr ? item.huisnr.toString() : '';
  if (item.huisnr_bag_letter) huisnrText += item.huisnr_bag_letter;
  if (item.huisnr_bag_toevoeging) huisnrText += item.huisnr_bag_toevoeging;

  const adres = `${item.straatnaam} ${huisnrText}, ${item.plaatsnaam} (${item.postcode})`;

  return res.json({ text: `📍 ${adres}` });
});

module.exports = router;

