const prisma = require('../db/prisma');

function findByTwilioNumber(twilioNumber) {
  return prisma.business.findUnique({ where: { twilioNumber } });
}

/**
 * Paginated + searchable list for the admin table — at 10-15 new tenants a
 * month an unbounded, unfiltered table gets unwieldy within a year, so this
 * always takes take/skip and an optional name/number search rather than
 * returning everything.
 */
async function list({ search = '', take = 25, skip = 0 } = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { twilioNumber: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.business.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.business.count({ where }),
  ]);

  return { items, total };
}

function get(id) {
  return prisma.business.findUnique({ where: { id } });
}

function create(data) {
  return prisma.business.create({ data });
}

function update(id, data) {
  return prisma.business.update({ where: { id }, data });
}

module.exports = { findByTwilioNumber, list, get, create, update };
