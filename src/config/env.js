require('dotenv').config();

const REQUIRED_VARS = [
  'DATABASE_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'ADMIN_TOKEN',
  'PUBLIC_BASE_URL',
];

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const publicBaseUrl = process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  adminToken: process.env.ADMIN_TOKEN,
  publicBaseUrl,
  smsCooldownMinutes: parseInt(process.env.SMS_COOLDOWN_MINUTES || '30', 10),
  defaultDialTimeoutSeconds: parseInt(process.env.DEFAULT_DIAL_TIMEOUT_SECONDS || '20', 10),
  isProduction: process.env.NODE_ENV === 'production',
};
