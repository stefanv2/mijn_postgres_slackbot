// Bestandsnaam: llm-adres-extractor.js
const OpenAI = require("openai");

// Zorg dat je .env correct geladen is in je index.js
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function extractAdresDataFromText(rawText) {
const systemPrompt = `
Je bent een slimme assistent die adresgegevens uit Nederlandse zinnen haalt.
Je taak is NIET om te corrigeren of te zoeken, maar puur om te begrijpen wat de gebruiker bedoelt.

Regels:
1. Haal de straatnaam, de plaatsnaam en het huisnummer uit de invoer.
2. Als een deel ontbreekt, zet het op null.
3. Het huisnummer moet een integer (getal) zijn.
4. Je output MOET uitsluitend geldige JSON zijn, zonder markdown opmaak eromheen.
5. Als gebruiker een postcode + huisnummer geeft (bijv "2014SL 203" of "1095KN 24"),
   vul dan:
   - "postcode": "<gevonden postcode>"
   - "huisnummer": <integer>
   - "straat": null
   - "plaats": null
6. Als de gebruiker straat + huisnummer + plaats geeft, vul geen postcode in.
7. De postcode moet altijd in hoofdletters worden teruggegeven.

Voorbeeld output formaat:
{
  "straat": "Voorbeeldstraat",
  "plaats": "Amsterdam",
  "huisnummer": 123,
  "postcode": null
}
`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Of het model dat je gebruikt
      temperature: 0, // Laag houden voor consistente JSON output
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText }
      ],
       response_format: { type: "json_object" } // Forceer JSON modus (als je model dit ondersteunt)
    });

    const content = response.choices[0].message.content.trim();
    
    // Parse de tekst output naar een echt JSON object
    const jsonData = JSON.parse(content);
    
    console.log("?? LLM Extracted Data:", jsonData);
    return jsonData;

  } catch (err) {
    console.error("? Fout bij LLM extractie:", err.message);
    // Gooi de fout door zodat de route handler hem kan vangen
    throw new Error("Kon adresgegevens niet uit de tekst halen.");
  }
}

module.exports = { extractAdresDataFromText };
