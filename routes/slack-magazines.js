// routes/slack-magazines.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const xml2js = require('xml2js');

// URL van jouw OPDS feed (direct, zonder dashboard-proxy)
const OPDS_URL = "https://blaadjes.voorbij.duckdns.org/opds/new";

router.get('/', async (req, res) => {
  try {
    // 1. OPDS XML ophalen
    const { data: xml } = await axios.get(OPDS_URL, {
      headers: { "Accept": "application/atom+xml" }
    });

    // 2. XML → JSON parsen
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });

    // 3. OPDS entries
    const entries = parsed.feed.entry || [];

    // 4. Map tijdschriften naar simpele JSON
    const mags = entries.map(entry => {
      // ID uit "/opds/cover/<ID>"
      const coverLink = entry.link.find(l => l['$'].rel === "http://opds-spec.org/image");
      const href = coverLink?.['$']?.href || "";
      const id = href.replace("/opds/cover/", "");

      return {
        id,
        title: entry.title || "Onbekende titel",
        cover: `https://blaadjes.voorbij.duckdns.org/cover/${id}/og`,
        link: `https://blaadjes.voorbij.duckdns.org/book/${id}`
      };
    });

    res.json(mags);

  } catch (err) {
    console.error("FOUT in magazines API:", err);
    res.status(500).json({ error: "Kon blaadjes niet laden" });
  }
});

module.exports = router;
