const prisma = require('../db/prisma');

function createInProgress({ businessId, callSid, callerNumber, calledNumber }) {
  return prisma.callLog.create({
    data: {
      businessId,
      callSid,
      callerNumber,
      calledNumber,
      dialOutcome: 'in-progress',
    },
  });
}

function findByCallSid(callSid) {
  return prisma.callLog.findUnique({ where: { callSid } });
}

function update(callSid, data) {
  return prisma.callLog.update({ where: { callSid }, data });
}

/**
 * Returns true if this business already sent a text to this caller within
 * the cooldown window, so we don't spam a caller who redials repeatedly.
 */
async function hasRecentText(businessId, callerNumber, cooldownMinutes) {
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  const recent = await prisma.callLog.findFirst({
    where: {
      businessId,
      callerNumber,
      textSent: true,
      textSentAt: { gte: since },
    },
  });
  return Boolean(recent);
}

function listForBusiness(businessId, { take = 50, skip = 0 } = {}) {
  return prisma.callLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });
}

module.exports = {
  createInProgress,
  findByCallSid,
  update,
  hasRecentText,
  listForBusiness,
};
