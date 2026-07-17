const express = require('express');
const twilio = require('twilio');
const twilioSignature = require('../middleware/twilioSignature');
const tenantService = require('../services/tenantService');
const callLogService = require('../services/callLogService');
const smsService = require('../services/smsService');
const env = require('../config/env');

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

const MISSED_OUTCOMES = new Set(['no-answer', 'busy', 'failed', 'canceled']);

// Shared by both the immediate (no forwardingNumber) and Dial-timeout paths
// below, so cooldown/send/logging logic isn't duplicated between them.
async function sendMissedCallText(business, callLog) {
  const inCooldown = await callLogService.hasRecentText(
    business.id,
    callLog.callerNumber,
    business.smsCooldownMinutes
  );

  if (inCooldown) {
    await callLogService.update(callLog.callSid, { smsSkipReason: 'cooldown' });
    return;
  }

  try {
    await smsService.sendMissedCallText(business, callLog.callerNumber);
    const ownerResult = await smsService.notifyOwner(business, callLog.callerNumber);
    await callLogService.update(callLog.callSid, {
      textSent: true,
      textSentAt: new Date(),
      ownerNotified: Boolean(ownerResult),
    });
  } catch (err) {
    console.error(`Failed to send missed-call text for CallSid ${callLog.callSid}:`, err);
    await callLogService.update(callLog.callSid, { smsSkipReason: 'send_failed' });
  }
}

// Twilio expects a valid TwiML response no matter what happens on our end —
// an unhandled error here must still hang up gracefully, not crash the
// process (which would take down every tenant's phone line) or return a
// non-TwiML body that confuses Twilio mid-call.
router.post('/voice', twilioSignature, async (req, res) => {
  const { To, From, CallSid } = req.body;
  const twiml = new VoiceResponse();

  try {
    const business = await tenantService.findByTwilioNumber(To);

    if (!business || !business.active) {
      twiml.reject();
      return res.type('text/xml').send(twiml.toString());
    }

    const callLog = await callLogService.createInProgress({
      businessId: business.id,
      callSid: CallSid,
      callerNumber: From,
      calledNumber: To,
    });

    if (!business.forwardingNumber) {
      // This tenant's real published number already forwards to us on
      // no-answer/busy at the carrier level, so the carrier has already
      // established the call was missed. Redialing here would just ring
      // the same line a second time — text back immediately instead.
      await callLogService.update(CallSid, { dialOutcome: 'no-answer' });
      await sendMissedCallText(business, callLog);
      twiml.say("Sorry we missed your call. We just sent you a text.");
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const dial = twiml.dial({
      timeout: business.dialTimeoutSeconds,
      action: `${env.publicBaseUrl}/voice/status`,
      method: 'POST',
    });
    dial.number(business.forwardingNumber);

    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error(`Error handling /voice for CallSid ${CallSid}:`, err);
    const fallback = new VoiceResponse();
    fallback.reject();
    res.type('text/xml').send(fallback.toString());
  }
});

router.post('/voice/status', twilioSignature, async (req, res) => {
  const { CallSid, DialCallStatus } = req.body;
  const twiml = new VoiceResponse();

  try {
    const callLog = await callLogService.findByCallSid(CallSid);

    if (!callLog) {
      console.warn(`No CallLog found for CallSid ${CallSid} in /voice/status`);
      return res.type('text/xml').send(twiml.toString());
    }

    await callLogService.update(CallSid, { dialOutcome: DialCallStatus });

    if (MISSED_OUTCOMES.has(DialCallStatus)) {
      const business = await tenantService.get(callLog.businessId);
      await sendMissedCallText(business, callLog);
    }

    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    // The call has already ended by the time Twilio hits this callback, so
    // there's nothing left to instruct — just respond safely and log.
    console.error(`Error handling /voice/status for CallSid ${CallSid}:`, err);
    res.type('text/xml').send(new VoiceResponse().toString());
  }
});

module.exports = router;
