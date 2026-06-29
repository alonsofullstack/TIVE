/**
 * creditGuard.js — reserva atómica de créditos, confirmación y reembolso.
 *
 * Flujo:
 *   1. reserve*  → descuenta créditos (evita race condition)
 *   2. confirm*  → registra en historial (créditos ya descontados)
 *   3. refund*   → devuelve créditos si la operación falló
 */

const { checkCredits, consumeCredits, refundCredits, logQuery } = require('./clientService');
const { getImprentaCost } = require('../pricing');
const { ADMIN_IDS } = require('../config');
const { escapeMarkdown } = require('../utils/helpers');

const OP_NAMES = {
    ask_qr: '🚀 Fotos TIVE PVC',
    use_official: '🚀 Fotos TIVE PVC',
    gen_tive_completo: '🧾 TIVE Completo',
    tive_completo_con_anio: '🧾 TIVE Completo',
    tive_completo_sin_anio: '🧾 TIVE Completo',
    gen_tive_completar: '🧾 TIVE Para Completar',
    tive_completar_con_anio: '🧾 TIVE Para Completar',
    tive_completar_sin_anio: '🧾 TIVE Para Completar',
    gen_tarjeta_fisica_pvc: '💳 Tarjeta Física PVC',
    gen_tarjeta_fisica_pvc_completar: '💳 Tarjeta Física PVC Para Completar',
    gen_antigua: '📜 Tarjeta Antigua',
    insert_qr_only: '🔐 Insertar QR en PDF',
};

/** Solo verificar saldo, sin reservar (menús intermedios). */
const CHECK_ONLY_OPERATIONS = new Set([
    'gen_tive_completo',
    'ask_qr',
]);

/** Reservar créditos al pulsar (descuenta; reembolso si falla). */
const RESERVE_OPERATIONS = new Set([
    'use_official',
    'tive_completo_con_anio',
    'tive_completo_sin_anio',
    'gen_tarjeta_fisica_pvc',
    'gen_antigua',
]);

const VERIFY_OPERATIONS = new Set([...CHECK_ONLY_OPERATIONS, ...RESERVE_OPERATIONS]);

function getOperationCost(operation) {
    if (typeof operation === 'number') return operation;
    return getImprentaCost(operation);
}

function isAdmin(userId) {
    return ADMIN_IDS.includes(String(userId));
}

async function sendCreditError(bot, chatId, result, operation) {
    if (result.error === 'no_registered') {
        await bot.sendMessage(chatId,
            `🚫 *Acceso Denegado*\n━━━━━━━━━━━━━━━━━━━━\n` +
            `Tu ID no está registrado. Ejecuta /register y contacta al administrador.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    if (result.error === 'no_credits') {
        await bot.sendMessage(chatId,
            `💳 *Saldo Insuficiente*\n━━━━━━━━━━━━━━━━━━━━\n` +
            `*${OP_NAMES[operation] || operation}* requiere \`${result.cost}\` crédito(s).\n` +
            `Saldo actual: \`${result.remaining}\``,
            {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🛒 Comprar Créditos', url: 'https://t.me/odinosea' }]] }
            }
        );
        return;
    }
    await bot.sendMessage(chatId, `❌ Error de créditos: ${escapeMarkdown(String(result.error))}`, { parse_mode: 'Markdown' });
}

async function verifyOperationCredits(bot, chatId, userId, operation) {
    if (isAdmin(userId)) return true;
    const cost = getOperationCost(operation);
    const check = await checkCredits(userId, cost);
    if (!check.ok) {
        await sendCreditError(bot, chatId, check, operation);
        return false;
    }
    return true;
}

async function reserveOperationCredits(bot, chatId, userId, operation, state, queryText = null) {
    if (isAdmin(userId)) {
        state.userPendingCharge?.set(chatId, { userId, operation, amount: 0, reserved: false, queryText });
        return true;
    }

    const cost = getOperationCost(operation);
    if (cost <= 0) {
        state.userPendingCharge?.set(chatId, { userId, operation, amount: 0, reserved: false, queryText });
        return true;
    }

    const result = await consumeCredits(userId, cost);
    if (!result.ok) {
        await sendCreditError(bot, chatId, result, operation);
        return false;
    }

    state.userPendingCharge?.set(chatId, {
        userId, operation, amount: cost, reserved: true, queryText,
        remaining: result.remaining,
    });

    if (result.remaining <= 3 && result.remaining > 0) {
        bot.sendMessage(chatId,
            `⚠️ _Saldo bajo: te quedan \`${result.remaining}\` crédito(s)._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }

    return true;
}

async function confirmPendingCharge(bot, chatId, state, operationOverride = null) {
    const pending = state.userPendingCharge?.get(chatId);
    if (!pending) return { ok: true, skipped: true };

    const operation = operationOverride || pending.operation;
    const userId = pending.userId;

    if (!isAdmin(userId) && pending.reserved && pending.amount > 0) {
        logQuery(userId, OP_NAMES[operation] || operation, pending.queryText || null, pending.amount).catch(() => {});
        if (pending.remaining === 0) {
            bot.sendMessage(chatId,
                `⚠️ _Has agotado tu saldo operativo. Contacta a tu proveedor._`,
                { parse_mode: 'Markdown' }
            ).catch(() => {});
        }
    } else if (!isAdmin(userId)) {
        logQuery(userId, OP_NAMES[operation] || operation, pending.queryText || null, 0).catch(() => {});
    } else {
        logQuery(userId, OP_NAMES[operation] || operation, pending.queryText || null, 0).catch(() => {});
    }

    state.userPendingCharge?.delete(chatId);
    return { ok: true };
}

async function refundPendingCharge(state, chatId) {
    const pending = state.userPendingCharge?.get(chatId);
    if (!pending) return;

    if (pending.reserved && pending.amount > 0 && pending.userId) {
        await refundCredits(pending.userId, pending.amount);
    }
    state.userPendingCharge?.delete(chatId);
}

function clearPendingCharge(state, chatId) {
    return refundPendingCharge(state, chatId);
}

/** Alias para cardGenerator — confirma cobro tras generación exitosa. */
async function chargeOnSuccess(bot, chatId, state, operationOverride = null) {
    return confirmPendingCharge(bot, chatId, state, operationOverride);
}

module.exports = {
    OP_NAMES,
    CHECK_ONLY_OPERATIONS,
    RESERVE_OPERATIONS,
    VERIFY_OPERATIONS,
    getOperationCost,
    verifyOperationCredits,
    reserveOperationCredits,
    confirmPendingCharge,
    refundPendingCharge,
    clearPendingCharge,
    chargeOnSuccess,
};