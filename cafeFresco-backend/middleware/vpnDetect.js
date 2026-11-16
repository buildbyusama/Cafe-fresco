const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

// Optional VPN/proxy block on customer signup/login. Enabled with VPN_CHECK=true and VPNAPI_KEY.
// If the VPN API is unreachable we let the request through: an outage must not block every customer.
const vpnDetect = async (req, res, next) => {
    if (process.env.VPN_CHECK !== 'true' || !process.env.VPNAPI_KEY) return next();

    try {
        // req.ip honours 'trust proxy' (one hop); a raw X-Forwarded-For header could be forged by the client
        const userIp = req.ip || req.socket?.remoteAddress || '';

        const isLocalhost = userIp === '::1' || userIp === '127.0.0.1' || userIp.startsWith('::ffff:127.');
        if (isLocalhost) return next();

        const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
        const ip = userIp.replace(/^::ffff:/, '');
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) return next();

        let isVpn = cache.get(ip);
        if (isVpn === undefined) {
            const response = await axios.get(`https://vpnapi.io/api/${ip}`, { params: { key: process.env.VPNAPI_KEY }, timeout: 2000 });
            const s = response.data?.security || {};
            isVpn = Boolean(s.vpn || s.proxy || s.tor);
            cache.set(ip, isVpn, 3600);
        }

        if (isVpn) {
            return res.status(403).json({ vpnBlocked: true, message: "Please turn off your VPN or proxy and try again." });
        }
        next();
    } catch (error) {
        console.error("VPN check unavailable, allowing request:", error.message);
        next();
    }
};

module.exports = vpnDetect;
