// db.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'pg-container',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postcode',
  user: process.env.PGUSER || 'postman',
  password: process.env.PGPASSWORD || '',
  ssl: /^(true|1)$/i.test(process.env.PGSSL || 'false')
});

pool.on('error', (err) => {
  console.error('PG pool error', err);
  process.exit(1);
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

module.exports = { query, pool };

