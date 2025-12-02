const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");

let fuseStraat = null;
let fusePlaats = null;

function loadFuse() {
  const dataPath = path.join(__dirname, "fuse-adres.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const rows = JSON.parse(raw);

  // Maak afzonderlijke lijsten
  const straatData = rows.map(r => ({
    straatnaam: r.straatnaam
  }));

  const plaatsData = rows.map(r => ({
    plaatsnaam: r.plaatsnaam
  }));

  const commonConfig = {
    includeScore: true,      // nodig voor score
    threshold: 0.45,         // tolerant
    ignoreLocation: true,
    distance: 200,
    minMatchCharLength: 3
  };

  // Gebruik GEEN const — vul de bovenste variabelen!
  fuseStraat = new Fuse(straatData, {
    ...commonConfig,
    keys: ["straatnaam"]
  });

  fusePlaats = new Fuse(plaatsData, {
    ...commonConfig,
    keys: ["plaatsnaam"]
  });

  console.log("🔥 Fuse.js indexen geladen (straat + plaats fuzzy klaar)");
}

function getStraatFuse() {
  if (!fuseStraat) throw new Error("Fuse straat-index niet geladen!");
  return fuseStraat;
}

function getPlaatsFuse() {
  if (!fusePlaats) throw new Error("Fuse plaats-index niet geladen!");
  return fusePlaats;
}

module.exports = {
  loadFuse,
  getStraatFuse,
  getPlaatsFuse
};

