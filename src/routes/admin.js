const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const tenantService = require('../services/tenantService');
const callLogService = require('../services/callLogService');
const { normalizeToE164 } = require('../utils/phone');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(adminAuth);

router.get('/businesses', asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const take = Math.min(parseInt(req.query.take, 10) || 25, 100);
  const skip = parseInt(req.query.skip, 10) || 0;

  const { items, total } = await tenantService.list({ search, take, skip });
  res.json({ items, total, take, skip });
}));

router.get('/businesses/:id', asyncHandler(async (req, res) => {
  const business = await tenantService.get(req.params.id);
  if (!business) return res.status(404).json({ error: 'Not found' });
  res.json(business);
}));

router.post('/businesses', asyncHandler(async (req, res) => {
  const { name, twilioNumber, forwardingNumber, smsTemplate, ownerNotifyNumber } = req.body;

  if (!name || !twilioNumber) {
    return res.status(400).json({ error: 'name and twilioNumber are required' });
  }

  const normalizedTwilioNumber = normalizeToE164(twilioNumber);
  // forwardingNumber is optional: leave it blank when the tenant's real
  // number already conditionally forwards to the Twilio number on
  // no-answer/busy — see the note on Business.forwardingNumber in schema.prisma.
  const normalizedForwardingNumber = forwardingNumber ? normalizeToE164(forwardingNumber) : null;
  const normalizedOwnerNumber = ownerNotifyNumber ? normalizeToE164(ownerNotifyNumber) : null;

  if (!normalizedTwilioNumber) {
    return res.status(400).json({ error: 'twilioNumber must be a valid phone number' });
  }
  if (forwardingNumber && !normalizedForwardingNumber) {
    return res.status(400).json({ error: 'forwardingNumber must be a valid phone number' });
  }
  if (ownerNotifyNumber && !normalizedOwnerNumber) {
    return res.status(400).json({ error: 'ownerNotifyNumber must be a valid phone number' });
  }

  try {
    const business = await tenantService.create({
      name,
      twilioNumber: normalizedTwilioNumber,
      forwardingNumber: normalizedForwardingNumber,
      ownerNotifyNumber: normalizedOwnerNumber,
      ...(smsTemplate ? { smsTemplate } : {}),
    });
    res.status(201).json(business);
  } catch (err) {
    // Onboarding happens routinely at this scale (10-15/month), so a
    // duplicate Twilio number is an expected operator mistake, not an
    // exceptional case — surface it as a clean 409 instead of a raw
    // Prisma unique-constraint error.
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A business with that twilioNumber already exists' });
    }
    throw err;
  }
}));

router.patch('/businesses/:id', asyncHandler(async (req, res) => {
  const allowedFields = [
    'name',
    'forwardingNumber',
    'smsTemplate',
    'ownerNotifyNumber',
    'active',
    'dialTimeoutSeconds',
    'smsCooldownMinutes',
  ];

  const data = {};
  for (const field of allowedFields) {
    if (req.body[field] === undefined) continue;
    if (field === 'forwardingNumber' || field === 'ownerNotifyNumber') {
      const normalized = req.body[field] ? normalizeToE164(req.body[field]) : null;
      if (req.body[field] && !normalized) {
        return res.status(400).json({ error: `${field} must be a valid phone number` });
      }
      data[field] = normalized;
    } else {
      data[field] = req.body[field];
    }
  }

  try {
    const business = await tenantService.update(req.params.id, data);
    res.json(business);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    throw err;
  }
}));

router.get('/businesses/:id/calls', asyncHandler(async (req, res) => {
  const business = await tenantService.get(req.params.id);
  if (!business) return res.status(404).json({ error: 'Not found' });

  const take = Math.min(parseInt(req.query.take, 10) || 50, 200);
  const skip = parseInt(req.query.skip, 10) || 0;

  const calls = await callLogService.listForBusiness(business.id, { take, skip });
  res.json(calls);
}));

module.exports = router;
