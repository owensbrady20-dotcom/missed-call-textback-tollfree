const crypto = require('crypto');
const env = require('../config/env');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token || !timingSafeEqual(token, env.adminToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = adminAuth;
