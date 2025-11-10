const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const router = express.Router();

const { KAVITA_URL, KAVITA_API_KEY, KAVITA_LIBRARY_ID } = process.env;

router.get('/comics', async (req, res) => {
  try {
    const url = `${KAVITA_URL}/api/Series?libraryId=${KAVITA_LIBRARY_ID}`;
    console.log(`🌍 Ophalen uit Kavita: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${KAVITA_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log(`📡 Status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error('⚠️ Kavita fout terug:', errText);
      return res.status(500).json({ error: 'Kavita API fout' });
    }

    const data = await response.json();
    const comics = data.map(item => ({
      id: item.id,
      title: item.name,
      author: item.sortName || '',
      description: item.localizedSeriesName || '',
      cover: item.coverImagePath ? `${KAVITA_URL}${item.coverImagePath}` : null
    }));

    res.json(comics);

  } catch (err) {
    console.error('💥 /comics error:', err);
    res.status(500).json({ error: 'Interne server fout' });
  }
});

module.exports = router;

