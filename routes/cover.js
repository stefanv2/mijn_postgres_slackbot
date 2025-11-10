const express = require('express');
const axios = require('axios');

const router = express.Router();

const CALIBRE_WEB = process.env.CALIBRE_WEB_URL || 'http://192.168.2.11:8083';

router.get('/cover/:id/og', async (req, res) => {
  const { id } = req.params;
  const url = `${CALIBRE_WEB}/cover/${id}/og`;

  try {
    const response = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', response.headers['content-type']);
    response.data.pipe(res);
  } catch (err) {
    console.error(`Cover niet gevonden: ${id}`);
    res.status(404).sendFile(__dirname + '/../public/no-cover.png');
  }
});

module.exports = router;

