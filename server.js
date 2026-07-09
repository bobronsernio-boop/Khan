// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const { createBareServer } = require('@tomphttp/bare-server-node');
const { Scramjet } = require('@mercuryworkshop/scramjet');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// Serve static assets (your homepage and proxy iframe)
app.use(express.static(path.join(__dirname, 'public')));

// Serve Scramjet static files
app.use('/scram/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet')));

// Bare server setup
const bareServer = createBareServer('/bare/', { logErrors: false });

// DuckDuckGo search API endpoint
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json({ results: [] });
  try {
    const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await resp.json();
    const results = [];
    if (data.RelatedTopics) {
      for (const t of data.RelatedTopics) {
        if (t.Result) {
          const match = t.Result.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
          if (match) {
            results.push({
              title: match[2],
              url: match[1].startsWith('http') ? match[1] : `https://${match[1]}`,
              snippet: t.Text || t.Result.replace(/<[^>]+>/g, '')
            });
          }
        }
      }
    }
    res.json({ results, abstract: data.AbstractText || '', heading: data.Heading || '', source: 'duckduckgo' });
  } catch (err) {
    res.json({ results: [], error: err.message });
  }
});

// Main request handler
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// WebSocket upgrade support
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    require('@mercuryworkshop/wisp-js/server').server.routeRequest(req, socket, head);
  } else if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Xena Proxy running on port ${PORT}`);
});
