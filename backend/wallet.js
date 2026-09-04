// backend/wallet.js
// ==========================================================================
// SECTION 1: SERVER-AUTHORITATIVE WALLET ENGINE & REWARDS (OPTIMIZED)
// ==========================================================================
const db = require('./db');

// ✅ GLOBAL LOCK MECHANISM - Race condition prevent karne ke liye
const walletLocks = new Map();

async function acquireWalletLock(userId, maxWait = 5000) {
    const startTime = Date.now();
    while (walletLocks.get(userId)) {
        if (Date.now() - startTime > maxWait) {
            throw new Error('Wallet lock timeout');
        }
        await new Promise(r => setTimeout(r, 10));
    }
    walletLocks.set(userId, true);
}

function releaseWalletLock(userId) {
    walletLocks.delete(userId);
}

function checkBalance(identifier, requiredCoins) {
    const wallet = db.getUserWalletBalance(identifier);
    return wallet.coins >= Number(requiredCoins);
}

// ✅ OPTIMIZED: Lock ke saath safe deduction
async function deductMatchEntryFee(identifier, betAmount, roomCode) {
    const userId = identifier.toString().trim();
    
    try {
        await acquireWalletLock(userId);
        
        let user = db.findUserByIdentifier(userId);
        const bet = Math.abs(Number(betAmount)) || 100;

        if (!user) {
            user = {
                id: userId,
                username: userId,
                coins: 2500,
                diamonds: 50
            };
        }

        const currentCoins = Number(user.coins ?? 2500);
        if (currentCoins < bet) {
            return { success: false, message: 'Insufficient balance on server.' };
        }

        user.coins = currentCoins - bet;
        db.saveUserRecord(user, true);

        const database = db.readDB();
        database.transactions.push({
            type: 'BET_DEDUCTION',
            userId: user.username || identifier,
            amount: bet,
            roomCode: roomCode || 'SOLO',
            timestamp: Date.now()
        });
        db.writeDBSync(database);

        return { success: true, newBalance: user.coins };
    } finally {
        releaseWalletLock(userId);
    }
}

// ✅ OPTIMIZED: Lock ke saath safe credit
async function creditWinnerPot(identifier, totalPrize, roomCode) {
    const userId = identifier.toString().trim();
    
    try {
        await acquireWalletLock(userId);
        
        let user = db.findUserByIdentifier(userId);
        const prize = Math.abs(Number(totalPrize)) || 0;

        if (!user) {
            user = {
                id: userId,
                username: userId,
                coins: 2500,
                diamonds: 50
            };
        }

        user.coins = Number(user.coins ?? 2500) + prize;
        db.saveUserRecord(user, true);

        const database = db.readDB();
        database.transactions.push({
            type: 'WINNER_PRIZE_CREDIT',
            userId: user.username || identifier,
            amount: prize,
            roomCode: roomCode || 'SOLO',
            timestamp: Date.now()
        });
        db.writeDBSync(database);

        return { success: true, newBalance: user.coins };
    } finally {
        releaseWalletLock(userId);
    }
}

function adminModifyWallet(targetQuery, type, amount) {
    let user = db.findUserByIdentifier(targetQuery);
    if (!user) return { success: false, message: 'Target user not found.' };

    const numAmount = Number(amount);
    if (isNaN(numAmount)) return { success: false, message: 'Invalid amount.' };

    if (type === 'coins') {
        user.coins = Math.max(0, Number(user.coins || 0) + numAmount);
    } else if (type === 'diamonds') {
        user.diamonds = Math.max(0, Number(user.diamonds || 0) + numAmount);
    }

    db.saveUserRecord(user, true);
    return { success: true, user };
}

module.exports = {
    checkBalance,
    deductMatchEntryFee,
    creditWinnerPot,
    adminModifyWallet,
    acquireWalletLock,
    releaseWalletLock
};
