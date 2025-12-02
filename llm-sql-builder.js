const OpenAI = require("openai");

// OpenAI key via .env
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isDangerous(sql) {
  const forbidden = [
    "delete ",
    "update ",
    "insert ",
    "alter ",
    "drop ",
    "truncate ",
    "create ",
    "merge ",
    "grant ",
    "revoke ",
    "commit",
    "rollback"
  ];

  const lower = sql.toLowerCase();
  return forbidden.some(f => lower.includes(f));
}

async function generateSqlSafely(naturalText) {

  const prompt = `
Je bent een SQL-engine die ALLEEN geldige, veilige SELECT-queries maakt voor PostgreSQL.
Je werkt met deze tabel: ktb_pcdata.

Gebruik ALLEEN de volgende kolommen (niet zelf verzinnen!):
- straatnaam (character varying(80))
- plaatsnaam (character varying(80))
- huisnr (integer)
- huisnr_bag_letter (character varying(1))
- huisnr_bag_toevoeging (character varying(4))
- wijkcode (character varying(4))  // ?? Toegevoegd/Aangepast
- lettercombinatie (character varying(2)) // ?? Toegevoegd/Aangepast
LET OP: postcode is GEEN kolom. De postcode moet worden opgebouwd als:
- (wijkcode || lettercombinatie) AS postcode
- breedtegraad (numeric)
- lengtegraad (numeric)
- perceelid (bigint)

Regels:
- ALLEEN SELECT maken.
- NOOIT DELETE, UPDATE, INSERT, ALTER, DROP.
- NOOIT Markdown, geen \`\`\`sql blokken.
- Gebruik exact de kolomnamen hierboven.
- Gebruik NOOIT LOWER() op huisnr (integer!).
- Gebruik huisnr = <nummer> (geen LIKE op huisnr).
- Voor straatnaam en plaatsnaam mag je LOWER() gebruiken.
- Als huisnummer ontbreekt, laat huisnr weg.
- Zet ALTIJD "LIMIT 20" onderaan.
- Retourneer ALLEEN de SQL-query, geen uitleg, geen commentaar.

Gebruikersinput:
"${naturalText}"
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "Genereer alleen een veilige SELECT query voor PostgreSQL."},
      { role: "user", content: prompt }
    ]
  });

  let sql = response.choices[0].message.content.trim();

  // SQL opschonen (Markdown & onzin verwijderen)
  sql = sql.replace(/```/g, "");
  sql = sql.replace(/^sql/gi, "");
  sql = sql.trim();

  // SELECT verplicht
  if (!sql.toLowerCase().startsWith("select")) {
    throw new Error("LLM genereerde geen SELECT query");
  }

  // Verboden trefwoorden checken
  if (isDangerous(sql)) {
    throw new Error("Gevaarlijke SQL gedetecteerd: " + sql);
  }

  return sql;
}

module.exports = { generateSqlSafely };

