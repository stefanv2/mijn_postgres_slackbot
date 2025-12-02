const db = require("../db");
const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");

async function buildFuseIndex() {
  console.log("📌 Fuse.js adres-index wordt opgebouwd...");

  // Simpele, snelle dataset: straatnaam + plaatsnaam
  const sql = `
    SELECT DISTINCT straatnaam, plaatsnaam
    FROM ktb_pcdata
    WHERE straatnaam IS NOT NULL AND plaatsnaam IS NOT NULL
  `;

  const { rows } = await db.query(sql);

  console.log(`📌 ${rows.length} unieke straat/plaats combinaties geladen.`);

  // Maak direct een Fuse instantie — geen toJSON meer!
  const fuse = new Fuse(rows, {
    keys: ["straatnaam", "plaatsnaam"],
    threshold: 0.3
  });

  // Bewaar de ruwe data zelf — Fuse v6 kan zijn eigen index bouwen bij load
  const outputPath = path.join(__dirname, "../fuse-adres.json");
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));

  console.log("✅ fuse-adres.json opgeslagen (Fuse v6 data)");
  console.log("ℹ️ Geen toJSON gebruikt — Fuse v6 bouwt index in geheugen");
  process.exit(0);
}

buildFuseIndex().catch(err => {
  console.error("❌ Fout:", err);
  process.exit(1);
});

