const assert = require('node:assert/strict');
const test = require('node:test');

const express = require('express');
const axios = require('axios');
const magazinesRouter = require('../routes/slack-magazines');

const originalAxiosGet = axios.get;
const originalConsoleError = console.error;

function createApp() {
  const app = express();
  app.use(magazinesRouter);
  return app;
}

function request(app, path = '/') {
  return new Promise((resolve, reject) => {
    const headers = {};
    const req = {
      method: 'GET',
      url: path,
      originalUrl: path,
      headers: {}
    };
    const res = {
      statusCode: 200,
      headers,
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return headers[name.toLowerCase()];
      },
      removeHeader(name) {
        delete headers[name.toLowerCase()];
      },
      end(body = '') {
        const text = Buffer.isBuffer(body) ? body.toString('utf8') : body;
        resolve({
          statusCode: this.statusCode,
          headers,
          body: text,
          json: text ? JSON.parse(text) : undefined
        });
      }
    };

    app.handle(req, res, reject);
  });
}

test.afterEach(() => {
  axios.get = originalAxiosGet;
  console.error = originalConsoleError;
});

test('GET / returns magazines from the OPDS feed', async () => {
  const calls = [];
  axios.get = async (url, options) => {
    calls.push({ url, options });
    return {
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>National Geographic</title>
            <link rel="alternate" href="/opds/book/123" />
            <link rel="http://opds-spec.org/image" href="/opds/cover/123" />
          </entry>
          <entry>
            <title>Quest</title>
            <link rel="alternate" href="/opds/book/456" />
            <link rel="http://opds-spec.org/image" href="/opds/cover/456" />
          </entry>
        </feed>`
    };
  };

  const response = await request(createApp());

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.deepEqual(calls, [
    {
      url: 'https://blaadjes.voorbij.duckdns.org/opds/new',
      options: {
        headers: {
          Accept: 'application/atom+xml'
        }
      }
    }
  ]);
  assert.deepEqual(response.json, [
    {
      id: '123',
      title: 'National Geographic',
      cover: 'https://blaadjes.voorbij.duckdns.org/cover/123/og',
      link: 'https://blaadjes.voorbij.duckdns.org/book/123'
    },
    {
      id: '456',
      title: 'Quest',
      cover: 'https://blaadjes.voorbij.duckdns.org/cover/456/og',
      link: 'https://blaadjes.voorbij.duckdns.org/book/456'
    }
  ]);
});

test('GET / returns an empty array when the feed has no entries', async () => {
  axios.get = async () => ({
    data: `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom"></feed>`
  });

  const response = await request(createApp());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json, []);
});

test('GET / falls back when a title or image link is missing', async () => {
  axios.get = async () => ({
    data: `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <link rel="alternate" href="/opds/book/no-cover" />
          <link rel="related" href="/opds/related/no-cover" />
        </entry>
      </feed>`
  });

  const response = await request(createApp());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json, [
    {
      id: '',
      title: 'Onbekende titel',
      cover: 'https://blaadjes.voorbij.duckdns.org/cover//og',
      link: 'https://blaadjes.voorbij.duckdns.org/book/'
    }
  ]);
});

test('GET / returns 500 when the OPDS feed cannot be loaded', async () => {
  const errors = [];
  axios.get = async () => {
    throw new Error('network unavailable');
  };
  console.error = (...args) => {
    errors.push(args);
  };

  const response = await request(createApp());

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json, {
    error: 'Kon blaadjes niet laden'
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], 'FOUT in magazines API:');
  assert.equal(errors[0][1].message, 'network unavailable');
});
