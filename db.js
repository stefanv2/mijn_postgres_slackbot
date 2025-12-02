const { Pool } = require('pg');

module.exports = new Pool({
  host: 'pg-container',
  port: 5432,                 // <-- JUIST
  user: 'postman',
  password: 'Tulpen123_',
  database: 'postcode'
});
