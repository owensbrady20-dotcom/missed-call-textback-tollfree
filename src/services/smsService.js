const twilio = require('twilio');
const env = require('../config/env');

const client = twilio(env.twilioAccountSid, env.twilioAuthToken);

async function sendMissedCallText(business, callerNumber) {
  return client.messages.create({
    from: business.twilioNumber,
    to: callerNumber,
    body: business.smsTemplate,
  });
}

async function notifyOwner(business, callerNumber) {
  if (!business.ownerNotifyNumber) return null;
  return client.messages.create({
    from: business.twilioNumber,
    to: business.ownerNotifyNumber,
    body: `You missed a call from ${callerNumber}. An auto text-back was sent.`,
  });
}

module.exports = { sendMissedCallText, notifyOwner };
