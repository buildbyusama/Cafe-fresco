const mongoose = require('mongoose');
const dns = require('node:dns/promises');

// Optional: custom DNS for mongodb+srv lookups on networks that block SRV records
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));

mongoose.set('strictPopulate', false);


const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URI);
        require('../utils/logger').logger.info('MongoDB connected');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;
