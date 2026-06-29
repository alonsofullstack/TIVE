/**
 * creditGuard.js
 * Verificación de saldo (sin cobrar) y cobro post-éxito para operaciones del bot.
 */

const { checkCredits, consumeCredits, logQuery, CREDIT_COSTS } = require('./clientService');
const { ADMIN_IDS } = require('../config');

const OP_NAMES = {
    ask_qr:                           '🚀 Fotos TIVE PVC',
    use_official:                     '🚀 Fotos TIVE PVC',
    gen_tive_completo:                '🧾 TIVE Completo',
    tive_completo_con_anio:           '🧾 TIVE Completo',
    tive_completo_sin_anio:           '🧾 TIVE Completo',
    gen_tive_completar:               '🧾 TIVE Para Completar',
    tive_completar_con_anio:          '🧾 TIVE Para Completar',
    tive_completar_sin_anio:          '🧾 TIVE Para Completar',
    gen_tarjeta_fisica_pvc:           '💳 Tarjeta Física PVC',
    gen_tarjeta_fisica_pvc_completar: '💳 Tarjeta Física PVC Para Completar',
    gen_antigua:                      '📜 Tarjeta Antigua',
    insert_qr_only:                   '🔐 Insertar QR en PDF',
};

/** Operaciones de imprenta: verificar saldo al pulsar el botón (cobro tras éxito). */
const VERIFY_OPERATIONS = new Set([
    'use_official',
    'tive_completo_con_anio',
    'tive_completo_sin_anio',
    'gen_tarjeta_fisica_pvc',
    'gen_antigua',
]);

function getOperationCost(operation) {
    if (typeof operation === 'number') return operation;
    return CREDIT_COSTS[operation] ?? 1;
}

function isAdmin(userId) {
    return ADMIN_IDS.includes(String(userId));
}

async function verifyOperationCredits(bot, chatId, userId, operation) {
    if (isAdmin(userId)) return true;

    const cost = getOperationCost(operation);
    const check = await checkCredits(userId, cost);

    if (check.error === 'no_registered') {
        await bot.sendMessage(chatId,
            `🚫 *Acceso Denegado*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Tu ID no está registrado en la base de datos de Orion.\n\n` +
            `Ejecuta /register para crear un perfil y contacta a tu administrador para habilitar saldo.`,
            { parse_mode: 'Markdown' }
        );
        return false;
    }

    if (check.error === 'no_credits') {
        await bot.sendMessage(chatId,
            `💳 *Saldo Operativo Insuficiente*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `La herramienta *${OP_NAMES[operation] || operation}* requiere \`${check.cost}\` crédito(s).\n` +
            `Tu saldo actual es de: \`${check.remaining}\`\n\n` +
            `Recarga créditos con el comando /buy o contacta a tu proveedor.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🛒 Comprar Créditos', url: 'https://t.me/odinosea' }
                    ]]
                }
            }
        );
        return false;
    }

    if (!check.ok) {
        await bot.sendMessage(chatId, `❌ Error en el sistema de créditos: ${check.error}`);
        return false;
    }

    return true;
}

async function chargeOperationCredits(bot, chatId, userId, operation) {
    if (isAdmin(userId)) {
        logQuery(userId, OP_NAMES[operation] || operation, null, 0).catch(() => {});
        return { ok: true, skipped: true };
    }

    const cost = getOperationCost(operation);
    if (cost <= 0) {
        logQuery(userId, OP_NAMES[operation] || operation, null, 0).catch(() => {});
        return { ok: true, skipped: true };
    }

    const result = await consumeCredits(userId, operation);

    if (!result.ok) {
        return result;
    }

    logQuery(userId, OP_NAMES[operation] || operation, null, result.cost).catch(() => {});

    if (result.remaining === 0) {
        bot.sendMessage(chatId,
            `⚠️ _Alerta de Sistema: Has agotado tu saldo operativo. Contacta a tu proveedor._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    } else if (result.remaining <= 3) {
        bot.sendMessage(chatId,
            `⚠️ _Alerta de Sistema: Saldo crítico. Te quedan \`${result.remaining}\` crédito(s)._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }

    return result;
}

/**
 * Cobra la operación pendiente guardada en state.userPendingCharge tras generación exitosa.
 */
async function chargeOnSuccess(bot, chatId, state, operationOverride = null) {
    const pending = state.userPendingCharge?.get(chatId);
    const userId = pending?.userId;
    const operation = operationOverride || pending?.operation;

    if (!userId || !operation) return { ok: true, skipped: true };

    const result = await chargeOperationCredits(bot, chatId, userId, operation);
    state.userPendingCharge?.delete(chatId);

    if (!result.ok && !result.skipped) {
        await bot.sendMessage(chatId,
            `⚠️ _El documento se generó pero hubo un error al descontar créditos. Contacta al administrador._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }

    return result;
}

function clearPendingCharge(state, chatId) {
    state.userPendingCharge?.delete(chatId);
}

module.exports = {
    OP_NAMES,
    VERIFY_OPERATIONS,
    getOperationCost,
    verifyOperationCredits,
    chargeOperationCredits,
    chargeOnSuccess,
    clearPendingCharge,
};