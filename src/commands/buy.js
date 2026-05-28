/**
 * buy.js
 * Comando /buy — Muestra los planes de créditos disponibles
 * y redirige al bot de pagos ING. ORION BOT (@odinosea)
 */

const { logInfo } = require('../utils/logger');

// URL del bot de pagos
const PAYMENT_BOT_URL  = 'https://t.me/odinosea';
const PAYMENT_BOT_NAME = 'ING. ORION BOT';

// ── Planes disponibles ────────────────────────────────────────────────────────
const PLANES = [
    {
        id:       'plan_64',
        emoji:    '⭐',
        nombre:   'Plan Estándar',
        precio:   64,
        creditos: 1400,
        bono:     150,
        total:    1550,
        badge:    'POPULAR',
    },
];

// ── Generador de mensaje ──────────────────────────────────────────────────────
function buildBuyMessage() {
    let text =
        `🛒 *COMPRAR CRÉDITOS — ORION BOT*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💬 _Elige el plan que mejor se adapte a ti y contacta al operador de pagos para completar tu recarga._\n\n`;

    for (const plan of PLANES) {
        text +=
            `${plan.emoji} *${plan.nombre}*` +
            (plan.badge ? ` — \`${plan.badge}\`` : '') + `\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Precio:* \`S/ ${plan.precio}.00\`\n` +
            `💳 *Créditos base:* \`${plan.creditos.toLocaleString()}\`\n` +
            `🎁 *Bono adicional:* \`+${plan.bono}\` créditos\n` +
            `✅ *Total créditos:* \`${plan.total.toLocaleString()}\`\n\n`;
    }

    text +=
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📲 *¿Cómo comprar?*\n` +
        `1️⃣ Toca el botón de abajo para ir al operador de pagos\n` +
        `2️⃣ Indica el plan que deseas y realiza el pago\n` +
        `3️⃣ ¡Listo! Tus créditos serán cargados automáticamente\n\n` +
        `🤖 *Bot de pagos:* ${PAYMENT_BOT_NAME}`;

    return text;
}

function buildBuyKeyboard() {
    const rows = [];

    // Un botón por plan
    for (const plan of PLANES) {
        rows.push([
            {
                text: `${plan.emoji} ${plan.nombre} — S/ ${plan.precio} → ${plan.total.toLocaleString()} créditos`,
                url: PAYMENT_BOT_URL,
            }
        ]);
    }

    // Botón directo al bot de pagos
    rows.push([
        { text: `💬 Contactar a ${PAYMENT_BOT_NAME}`, url: PAYMENT_BOT_URL }
    ]);

    return rows;
}

// ── Módulo ────────────────────────────────────────────────────────────────────
module.exports = {
    PAYMENT_BOT_URL,
    PAYMENT_BOT_NAME,
    PLANES,

    registerCommands(bot, state, deps) {
        bot.onText(/\/buy/, async (msg) => {
            logInfo('BUY', '🛒', 'Comando /buy recibido', { id: msg.from.id });

            try {
                await bot.sendMessage(msg.chat.id, buildBuyMessage(), {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: buildBuyKeyboard(),
                    },
                });
            } catch (err) {
                bot.sendMessage(msg.chat.id, '❌ Error mostrando los planes. Intenta de nuevo.');
            }
        });
    },
};
