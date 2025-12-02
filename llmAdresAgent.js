const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Maak SQL veilig voor analyse
 * - verwijdert ```sql en ```
 * - verwijdert puntkomma
 * - trimt whitespace
 */
function cleanSQL(sql) {
  return sql
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .replace(/;$/g, "")
    .trim();
}

/**
 * Veiligheidscheck:
 * - moet met SELECT beginnen
 * - mag GEEN DDL/DML bevatten
 */
function isSafeSQL(sql) {
  const s = sql.toLowerCase();

  if (!s.startsWith("select")) return false;

  const forbidden = [
    "delete ",
    "update ",
    "insert ",
    "drop ",
    "alter ",
    "create ",
    "truncate ",
    " vacuum ",
    " copy "
  ];

  return !forbidden.some(word => s.includes(word));
}

async function generateAdresSQLFromPrompt(promptText) {
  const system = `
Je bent een SQL-generator voor de tabel ktb_pcdata.
Je MAG ALLEEN select queries maken.
Kolommen:
straatnaam, plaatsnaam, huisnr, huisnummertoevoeging,
wijkcode, lettercombinatie, breedtegraad, lengtegraad.

Gebruik lower() en LIKE '%...%' voor tekstvergelijkingen.
Gebruik geen = bij tekstvelden.
Gebruik altijd LIMIT 20.
`;

  const user = `Zet deze NL-vraag om in SQL: "${promptText}"`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const raw = completion.choices[0].message.content.trim();
  console.log("?? RAW SQL van LLM:", raw);

  const cleaned = cleanSQL(raw);
  console.log("?? CLEAN SQL:", cleaned);

  if (!isSafeSQL(cleaned)) {
    console.log("? Onveilige SQL:", cleaned);
    throw new Error("Onveilige SQL gegenereerd.");
  }

  return cleaned;
}

function formatAdresRowsForSlack(rows) {
  if (!rows || rows.length === 0) {
    return "? Geen adressen gevonden.";
  }

  const r = rows[0];

  const pc = `${r.wijkcode || ""}${r.lettercombinatie || ""}`;
  const adres = `${r.straatnaam} ${r.huisnr}${r.huisnummertoevoeging || ""}, ${r.plaatsnaam}`;

  // Kaartje via Google Static Maps
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  let mapImageUrl = null;

  if (r.breedtegraad && r.lengtegraad && apiKey) {
    mapImageUrl =
      `https://maps.googleapis.com/maps/api/staticmap?center=${r.breedtegraad},${r.lengtegraad}` +
      `&zoom=17&size=600x400&markers=color:red%7C${r.breedtegraad},${r.lengtegraad}` +
      `&key=${apiKey}`;
  }

  if (mapImageUrl) {
    return `? *Adres gevonden:*
${adres} (${pc})

?? <https://www.google.com/maps/search/?api=1&query=${r.breedtegraad},${r.lengtegraad}|Open in Google Maps>

??? *Kaartje:*
${mapImageUrl}`;
  }

  // Zonder kaartje
  return `? *Adres gevonden:*
${adres} (${pc})

?? <https://www.google.com/maps/search/?api=1&query=${r.breedtegraad},${r.lengtegraad}|Open in Google Maps>`;
}

module.exports = {
  generateAdresSQLFromPrompt,
  formatAdresRowsForSlack
};
