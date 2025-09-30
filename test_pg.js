const { Client } = require('pg');

const client = new Client({
  host: '192.168.2.11',   // jouw pg-container
  port: 4321,             // pgAdmin4 poort (maar let op: vaak is Postgres default 5432)
  user: 'postman',
  password: 'Tulpen123_',
  database: 'postcode'
});

(async () => {
  try {
    await client.connect();
    console.log('✅ Verbinding geslaagd!');

    const res = await client.query('SELECT COUNT(*) FROM ktb_pcdata;');
    console.log('Aantal rijen in ktb_pcdata:', res.rows[0].count);

    await client.end();
  } catch (err) {
    console.error('❌ Fout bij verbinden/query:', err);
  }
})();

