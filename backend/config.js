// backend/config.js
require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || "loki",
    ADMIN_PHONE: process.env.ADMIN_PHONE || "9024244434",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "loki00",
    JWT_SECRET: process.env.JWT_SECRET || "super_secret_ludo_jwt_key_2026_x89f72b9a!",
    FAST2SMS_KEY: process.env.FAST2SMS_KEY || "YOUR_FAST2SMS_API_KEY",
    NODE_ENV: process.env.NODE_ENV || "development"
};
