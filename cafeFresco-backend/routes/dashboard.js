const express = require('express');
const router = express.Router();
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const Order = require('../models/order')
const { TZ, revenueMatch, now, rangeOf, yearRange } = require('../services/stats');

const viewers = [isAdmin, authorizeRoles("admin", "manager")];

const sumRevenue = async (createdAt) => {
    const [row] = await Order.aggregate([
        { $match: { ...revenueMatch, ...(createdAt ? { createdAt } : {}) } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    return Math.round((row?.total || 0) * 100) / 100;
};

router.get('/earning', ...viewers, async (req, res) => {
    try {
        const [week, month, year] = await Promise.all([
            sumRevenue(rangeOf('week')), sumRevenue(rangeOf('month')), sumRevenue(rangeOf('year'))
        ]);
        res.json({ week, month, year });
    } catch (error) {
        console.error("Error fetching earnings:", error);
        res.status(500).json({ message: "Error fetching earnings" });
    }
});


router.get('/dashboard', ...viewers, async (req, res) => {
    try {
        const [totalEarnings, totalCompletedOrders, totalPendingOrders, totalOrdersThisMonth, totalOrdersThisYear, refundDue] = await Promise.all([
            sumRevenue(),
            Order.countDocuments({ orderStatus: "completed" }),
            Order.countDocuments({ orderStatus: "pending" }),
            Order.countDocuments({ createdAt: rangeOf('month'), orderStatus: { $ne: 'cancelled' } }),
            Order.countDocuments({ createdAt: rangeOf('year'), orderStatus: { $ne: 'cancelled' } }),
            Order.countDocuments({ orderStatus: 'cancelled', paymentStatus: 'paid' }),
        ]);

        res.json({ totalEarnings, totalCompletedOrders, totalPendingOrders, totalOrdersThisMonth, totalOrdersThisYear, refundDue });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ message: "Error fetching dashboard data" });
    }
});

// Completed orders and revenue per month for a year (default: this year)
router.get("/yearly-report", ...viewers, async (req, res) => {
    try {
        const year = Number(req.query.year) || now().year();
        const ordersPerMonth = new Array(12).fill(0);
        const earningsPerMonth = new Array(12).fill(0);

        const rows = await Order.aggregate([
            { $match: { orderStatus: 'completed', createdAt: yearRange(year) } },
            {
                $group: {
                    _id: { $month: { date: "$createdAt", timezone: TZ } },
                    totalOrders: { $sum: 1 },
                    totalEarnings: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
                },
            },
        ]);
        rows.forEach((r) => {
            ordersPerMonth[r._id - 1] = r.totalOrders;
            earningsPerMonth[r._id - 1] = Math.round(r.totalEarnings * 100) / 100;
        });

        res.json([
            { name: "Completed orders", data: ordersPerMonth },
            { name: "Revenue", data: earningsPerMonth },
        ]);
    } catch (error) {
        console.error("Error fetching yearly report:", error);
        res.status(500).json({ message: "Error fetching yearly report" });
    }
});


// Today: latest orders, today's revenue, and revenue per hour (real data, not random)
router.get("/daily-report", ...viewers, async (req, res) => {
    try {
        const today = rangeOf('day');
        const [latestOrders, totalAmount, perHour] = await Promise.all([
            Order.find({ createdAt: today }).sort({ createdAt: -1 }).limit(4).populate("userId", "name email").select('-idempotencyKey'),
            sumRevenue(today),
            Order.aggregate([
                { $match: { ...revenueMatch, createdAt: today } },
                { $group: { _id: { $hour: { date: "$createdAt", timezone: TZ } }, total: { $sum: "$totalAmount" } } },
            ]),
        ]);

        const hourly = new Array(24).fill(0);
        perHour.forEach((h) => { hourly[h._id] = Math.round(h.total * 100) / 100; });

        res.json({ success: true, latestOrders, totalAmount, series: [{ name: 'Revenue', data: hourly }] });
    } catch (error) {
        console.error("Error fetching daily report:", error);
        res.status(500).json({ message: "Error fetching daily report" });
    }
});

// Order counts (not cancelled) per day of this month, or per month of this year
router.get("/order-trend", ...viewers, async (req, res) => {
    try {
        const range = req.query.range === 'year' ? 'year' : 'month';
        const at = now();
        const buckets = range === 'year' ? 12 : at.daysInMonth();
        const data = new Array(buckets).fill(0);

        const rows = await Order.aggregate([
            { $match: { orderStatus: { $ne: 'cancelled' }, createdAt: rangeOf(range, at) } },
            { $group: { _id: range === 'year' ? { $month: { date: '$createdAt', timezone: TZ } } : { $dayOfMonth: { date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
        ]);
        rows.forEach((r) => { data[r._id - 1] = r.count; });

        res.json({ range, total: data.reduce((a, b) => a + b, 0), series: [{ name: 'Orders', data }] });
    } catch (error) {
        console.error("Error fetching order trend:", error);
        res.status(500).json({ message: "Error fetching order trend" });
    }
});


module.exports = router;
