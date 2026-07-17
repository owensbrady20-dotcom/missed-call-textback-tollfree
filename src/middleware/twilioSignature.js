const twilio = require('twilio');
const env = require('../config/env');

/**
 * Validates X-Twilio-Signature against a URL we construct ourselves
 * (PUBLIC_BASE_URL + req.originalUrl) rather than one derived from
 * req.protocol/req.get('host') — behind Railway's proxy those can resolve
 * to http:// even though Twilio signed the https:// URL it actually called,
 * which would make every request fail signature validation.
 */
function twilioSignature(req, res, next) {
  const signature = req.headers['x-twilio-signature'];
  const url = `${env.publicBaseUrl}${req.originalUrl}`;

  const valid = twilio.validateRequest(
    env.twilioAuthToken,
    signature,
    url,
    req.body
  );

  if (!valid) {
    console.warn(`Rejected Twilio webhook with invalid signature: ${url}`);
    return res.status(403).send('Invalid signature');
  }

  next();
}

module.exports = twilioSignature;
