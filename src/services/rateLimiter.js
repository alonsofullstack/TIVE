const { logInfo } = require('../utils/logger');
const { ADMIN_IDS } = require('../config');

const COOLDOWN_MS = parseInt(process.env.USER_RATE_LIMIT_MS || '2000', 10);
const lastAction = new Map();

function checkRateLimit(userId, action = 'default') {
    if (ADMIN_IDS.includes(String(userId))) return true;

    const key = `${userId}:${action}`;
    const now = Date.now();
    const prev = lastAction.get(key) || 0;

    if (now - prev < COOLDOWN_MS) {
        logInfo('RATE', '⏱️', 'Usuario en cooldown', { userId, action, waitMs: COOLDOWN_MS - (now - prev) });
        return false;
    }

    lastAction.set(key, now);
    return true;
}

module.exports = { checkRateLimit, COOLDOWN_MS };