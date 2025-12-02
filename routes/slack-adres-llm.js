// routes/slack-adres-llm.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

// Database
const db = require("../db");

// Fuse loaders
const { getStraatFuse, getPlaatsFuse } = require("../fuse-loader");

// LLM extractor
const { extractAdresDataFromText } = require("../adres-extractor");

// Slack helper
async function sendSlack(url, body) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

router.post("/adres-llm", async (req, res) => {
  const { text: rawText, response_url } = req.body;

  if (!response_url || !rawText) {
    return res.status(400).json({ error: "Geen text of response_url" });
  }

  // Directe ACK naar Slack
  res.json({
    response_type: "ephemeral",
    text: `:mag: Momentje, ik puzzel even op: *${rawText}*...`,
  });

  try {
    //
    // -----------------------------------------------
    // FASE 1 — LLM Extractie
    // -----------------------------------------------
    //
    const extractedData = await extractAdresDataFromText(rawText);
    console.log("?? LLM Extracted:", extractedData);

    if (!extractedData.huisnummer) {
      return sendSlack(response_url, {
        text: `?? Ik kon geen *huisnummer* vinden in: *${rawText}*`,
      });
    }

    //
    // -----------------------------------------------
    // FASE 2 — Fuse.js correctie
    // -----------------------------------------------
    //
    let finalStraat = extractedData.straat || null;
    let finalPlaats = extractedData.plaats || null;

    if (extractedData.straat) {
      const sFuse = getStraatFuse();
      const sRes = sFuse.search(extractedData.straat, { limit: 1 });
      if (sRes.length > 0) {
        finalStraat = sRes[0].item.straatnaam;
        console.log(`?? Fuse straat: ${extractedData.straat} -> ${finalStraat}`);
      }
    }

    if (extractedData.plaats) {
      const pFuse = getPlaatsFuse();
      const pRes = pFuse.search(extractedData.plaats, { limit: 1 });
      if (pRes.length > 0) {
        finalPlaats = pRes[0].item.plaatsnaam;
        console.log(`?? Fuse plaats: ${extractedData.plaats} -> ${finalPlaats}`);
      }
    }

    //
    // -----------------------------------------------
    // FASE 3A — Postcode + huisnummer (snelle route)
    // -----------------------------------------------
    //
    if (extractedData.postcode && extractedData.huisnummer) {
      const sql = `
        SELECT straatnaam,
               huisnr,
               huisnr_bag_toevoeging,
               (wijkcode || lettercombinatie) AS postcode,
               plaatsnaam,
               breedtegraad,
               lengtegraad
        FROM ktb_pcdata
        WHERE wijkcode || lettercombinatie = $1
          AND huisnr = $2
        LIMIT 1;
      `;

      const { rows } = await db.query(sql, [
        extractedData.postcode,
        extractedData.huisnummer,
      ]);

      if (rows.length > 0) {
        const r = rows[0];

        return sendSlack(response_url, {
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:round_pushpin: *Adres gevonden*\n*${r.straatnaam} ${r.huisnr}${
                  r.huisnr_bag_toevoeging || ""
                }*\n${r.postcode} ${r.plaatsnaam}`,
              },
            },
            {
              type: "image",
              image_url: `https://maps.googleapis.com/maps/api/staticmap?center=${r.breedtegraad},${r.lengtegraad}&zoom=17&size=600x300&markers=${r.breedtegraad},${r.lengtegraad}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
              alt_text: `Kaart van ${r.straatnaam}`,
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: ":earth_africa: Open in Google Maps" },
                  url: `https://www.google.com/maps?q=${r.breedtegraad},${r.lengtegraad}`,
                },
              ],
            },
          ],
        });
      }
    }

    //
    // -----------------------------------------------
    // FASE 3B — Straat + huisnummer + plaats
    // -----------------------------------------------
    //
    console.log("?? Fallback search:", {
      straat: finalStraat,
      huisnr: extractedData.huisnummer,
      plaats: finalPlaats,
    });

    const sql2 = `
      SELECT straatnaam,
             huisnr,
             huisnr_bag_toevoeging,
             (wijkcode || lettercombinatie) AS postcode,
             plaatsnaam,
             breedtegraad,
             lengtegraad
      FROM ktb_pcdata
      WHERE LOWER(straatnaam) = LOWER($1)
        AND huisnr = $2
        AND LOWER(plaatsnaam) = LOWER($3)
      LIMIT 1;
    `;

    const { rows } = await db.query(sql2, [
      finalStraat,
      extractedData.huisnummer,
      finalPlaats,
    ]);

    if (rows.length === 0) {
      return sendSlack(response_url, {
        text: `? Geen adres gevonden voor *${finalStraat} ${extractedData.huisnummer} ${finalPlaats}*`,
      });
    }

    const r = rows[0];

    //
    // -----------------------------------------------
    // FASE 4 — Mooie Slack-block output
    // -----------------------------------------------
    //
    const kaartUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${r.breedtegraad},${r.lengtegraad}&zoom=17&size=600x300&markers=color:red%7C${r.breedtegraad},${r.lengtegraad}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const gmaps = `https://www.google.com/maps?q=${r.breedtegraad},${r.lengtegraad}`;

    return sendSlack(response_url, {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:round_pushpin: *Adres gevonden*\n*${r.straatnaam} ${r.huisnr}${
              r.huisnr_bag_toevoeging || ""
            }*\n${r.postcode} ${r.plaatsnaam}`,
          },
        },
        {
          type: "image",
          image_url: kaartUrl,
          alt_text: `Kaart van ${r.straatnaam}`,
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: ":earth_africa: Open in Google Maps" },
              url: gmaps,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("? Fout in adres-LLM:", err);
    sendSlack(response_url, {
      text: `? Er ging iets mis: ${err.message}`,
    });
  }
});

module.exports = router;
