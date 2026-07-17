const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const voiceRoutes = require('./routes/voice');
const adminRoutes = require('./routes/admin');

const app = express();

// Railway (and most PaaS hosts) sit behind a reverse proxy that sets
// X-Forwarded-For; without this, express-rate-limit throws on every request
// since it can't safely determine the real client IP.
app.set('trust proxy', 1);

app.use(helmet());

// Twilio posts application/x-www-form-urlencoded; signature validation needs
// the raw parsed body exactly as express.urlencoded produces it.
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.use('/', voiceRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Served as external files (not inlined in admin.html) so they run under
// helmet's default Content-Security-Policy, which blocks inline <script>
// tags (script-src 'self') — an inline script would silently fail to
// execute in the browser, with no visible error beyond dead event handlers.
app.get('/admin.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.js'));
});

app.get('/admin.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.css'));
});

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/admin', adminLimiter, adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
