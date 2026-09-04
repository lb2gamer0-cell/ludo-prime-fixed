// backend/db.js
// ==========================================================================
// SECTION 1: SECURE PERSISTENT DATABASE ENGINE (ATOMIC STORAGE)
// ==========================================================================
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'ludo_database.json');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    const initialSchema = {
        users: {},
        wallets: {},
        transactions: [],
        otpDailyLimits: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2), 'utf-8');
}

function readDB() {
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('[DB Read Error]:', err);
        return { users: {}, wallets: {}, transactions: [], otpDailyLimits: {} };
    }
}

function writeDBSync(data) {
    try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tempFile, DB_FILE);
        return true;
    } catch (err) {
        console.error('[DB Sync Write Error]:', err);
        return false;
    }
}

// ✅ AUTO-CLEANUP: Expired OTPs ko har 5 minute remove karo
setInterval(() => {
    const db = readDB();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    
    // Clean old OTP records (24 hours se purane)
    for (const mobile in db.otpDailyLimits) {
        if (db.otpDailyLimits[mobile].date !== today) {
            delete db.otpDailyLimits[mobile];
        }
    }
    
    writeDBSync(db);
}, 5 * 60 * 1000);

function findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const db = readDB();
    const cleanId = identifier.toString().trim().toLowerCase();

    for (const key in db.users) {
        const u = db.users[key];
        if (
            (u.mobile && u.mobile.toLowerCase() === cleanId) ||
            (u.username && u.username.toLowerCase() === cleanId) ||
            (u.id && u.id.toLowerCase() === cleanId)
        ) {
            return u;
        }
    }
    return null;
}

function saveUserRecord(userData, isWalletInternal = false) {
    const db = readDB();
    const key = userData.mobile || userData.username || userData.id;
    if (!key) return false;

    const existing = db.users[key] || {};

    let finalCoins = existing.coins ?? 2500;
    let finalDiamonds = existing.diamonds ?? 50;

    if (isWalletInternal) {
        if (userData.coins !== undefined) finalCoins = Number(userData.coins);
        if (userData.diamonds !== undefined) finalDiamonds = Number(userData.diamonds);
    }

    db.users[key] = {
        ...existing,
        ...userData,
        coins: finalCoins,
        diamonds: finalDiamonds,
        updatedAt: Date.now()
    };

    return writeDBSync(db);
}

function getUserWalletBalance(identifier) {
    const user = findUserByIdentifier(identifier);
    if (!user) return { coins: 2500, diamonds: 50 };
    return {
        coins: Number(user.coins ?? 2500),
        diamonds: Number(user.diamonds ?? 50)
    };
}

function checkAndRecordDailyOtp(mobile) {
    const db = readDB();
    if (!db.otpDailyLimits) db.otpDailyLimits = {};

    const today = new Date().toISOString().split('T')[0];
    const record = db.otpDailyLimits[mobile] || { count: 0, date: today };

    if (record.date !== today) {
        record.count = 0;
        record.date = today;
    }

    if (record.count >= 5) {
        return { allowed: false, count: record.count };
    }

    record.count += 1;
    db.otpDailyLimits[mobile] = record;
    writeDBSync(db);
    return { allowed: true, count: record.count };
}

module.exports = {
    readDB,
    writeDBSync,
    findUserByIdentifier,
    saveUserRecord,
    getUserWalletBalance,
    checkAndRecordDailyOtp
};
