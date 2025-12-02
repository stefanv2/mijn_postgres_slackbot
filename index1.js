// index.js

// =======================================================
// 1. IMPORTS & MODULE VEREISTEN (Moeten Boven Aan staan!)
// =======================================================
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Functies voor de fuzzy search
const { loadFuse, getFuse } = require("./fuse-loader"); 

// Importeer alle routes
const slackAdresPgRoutes = require('./routes/slack-adrespg');
const slackPostcodeRoutes = require('./routes/slack-postcode');
const slackBookRoutes = require('./routes/slack-book');
const coverRoutes = require('./routes/cover');
const comicsSqlRoutes = require('./routes/comics_sql');
const slackAdresLlmRoutes = require('./routes/slack-adres-llm');

// =======================================================
// 2. GLOBALE CONFIGURATIE & FUSE LADEN
// =======================================================

// 🔥 Fuse index in het geheugen laden (MOET vóór de test komen)
loadFuse(); 

// =======================================================
// 3. LOKALE FUZZY TEST (NIEUWE STRAAT/PLAATS PIPELINE)
// =======================================================

const { getStraatFuse, getPlaatsFuse } = require("./fuse-loader");

function testFuzzySearch(input) {
  console.log("\n--- LOKALE FUZZY TEST ---");

  const fuseStraat = getStraatFuse();
  const fusePlaats = getPlaatsFuse();

  const tokens = input.split(/\s+/).filter(t => t.length > 0);

  // Heuristiek: eerste woord is straat, laatste woord is plaats
  const straatZoek = tokens[0];
  const plaatsZoek = tokens[tokens.length - 1];

  console.log("Input:", input);
  console.log("Straatzoek:", straatZoek);
  console.log("Plaatszoek:", plaatsZoek);

  // Fuzzy straatmatch
  const straatHits = fuseStraat.search(straatZoek);
  if (straatHits.length === 0) {
    console.log("? Geen fuzzy STRAAT match");
  } else {
    console.log(`? Beste straatmatch: ${straatHits[0].item.straatnaam} (score: ${straatHits[0].score.toFixed(3)})`);
  }

  // Fuzzy plaatsmatch
  const plaatsHits = fusePlaats.search(plaatsZoek);
  if (plaatsHits.length === 0) {
    console.log("? Geen fuzzy PLAATS match");
  } else {
    console.log(`? Beste plaatsmatch: ${plaatsHits[0].item.plaatsnaam} (score: ${plaatsHits[0].score.toFixed(3)})`);
  }

  console.log("-------------------------\n");
}

// ?? Testcases
testFuzzySearch("oktoberstraat 61 almere");
testFuzzySearch("lutulastraan 20 haarlem");
// =======================================================
// 4. EXPRESS SERVER INITIALISATIE
// =======================================================

const app = express();

// ✅ Sta verzoeken toe vanuit elke browser / frontend
app.use(cors()); 
app.use('/kavita_covers', express.static('/kavita'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Routes toevoegen
app.use('/slack', slackPostcodeRoutes);
app.use('/slack', slackBookRoutes);
app.use('/slack', slackAdresPgRoutes);
app.use('/slack', slackAdresLlmRoutes);
app.use('/', coverRoutes);
app.use('/slack/api', comicsSqlRoutes);

// Server starten
const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Postgres Slack server gestart op poort ${PORT}`);
});