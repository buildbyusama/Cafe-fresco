// One definition of revenue and one timezone for every dashboard number (R4)
const moment = require('moment-timezone');

const TZ = process.env.APP_TZ || 'Asia/Karachi';

// Revenue = completed AND paid. Cancelled+paid (refund due) and unpaid COD are excluded.
const revenueMatch = { orderStatus: 'completed', paymentStatus: 'paid' };

const now = () => moment.tz(TZ);

// Half-open range [start, next start) in the shop's timezone
const rangeOf = (unit, at = now()) => {
    const start = at.clone().startOf(unit);
    return { $gte: start.toDate(), $lt: start.clone().add(1, unit).toDate() };
};

const yearRange = (year) => {
    const start = moment.tz({ year: Number(year), month: 0, day: 1 }, TZ);
    return { $gte: start.toDate(), $lt: start.clone().add(1, 'year').toDate() };
};

module.exports = { TZ, revenueMatch, now, rangeOf, yearRange, moment };
