const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

// Routers
const slackAdresRoutes = require('./routes/slack-adres');   // voor /adres
const slackPostcodeRoutes = require('./routes/slack-postcode'); // voor /postcode

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Routes koppelen
app.use('/slack', slackAdresRoutes);
app.use('/slack', slackPostcodeRoutes);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`🚀 Postgres Slack server gestart op poort ${PORT}`);
});

