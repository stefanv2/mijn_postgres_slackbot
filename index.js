const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');   // ✅ nieuw toegevoegd
require('dotenv').config();

const slackAdresPgRoutes = require('./routes/slack-adrespg');
const slackPostcodeRoutes = require('./routes/slack-postcode');
const slackBookRoutes = require('./routes/slack-book');
const coverRoutes = require('./routes/cover');
const comicsSqlRoutes = require('./routes/comics_sql');

const app = express();

// ✅ Sta verzoeken toe vanuit elke browser / frontend
app.use(cors()); // of specifieker: app.use(cors({ origin: "http://192.168.2.11:8090" }));
app.use('/kavita_covers', express.static('/kavita'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Routes
app.use('/slack', slackPostcodeRoutes);
app.use('/slack', slackBookRoutes);
app.use('/slack', slackAdresPgRoutes);
app.use('/', coverRoutes);
app.use('/slack/api', comicsSqlRoutes);

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Postgres Slack server gestart op poort ${PORT}`);
});

