const ping          = require('./ping');
const start         = require('./start');
const tive_completo = require('./tive_completo');
const tive_completar= require('./tive_completar');
const tarjeta_fisica= require('./tarjeta_fisica');
const tarjeta_antigua=require('./tarjeta_antigua');
const pvc_tive_qr   = require('./pvc_tive_qr');
const insert_qr_original = require('./insert_qr_original');
const firma         = require('./firma');
const consulta_grupo= require('./consulta_grupo');
const cmds          = require('./cmds');
const clientes      = require('./clientes');

const { checkAndConsumeCredits, PAID_OPERATIONS } = require('./start');
const { ADMIN_IDS } = require('../config');

const modules = [
    ping, start, tive_completo, tive_completar, tarjeta_fisica,
    tarjeta_antigua, pvc_tive_qr, insert_qr_original, firma,
    consulta_grupo, cmds, clientes
];

module.exports = function registerCommands(bot, state, deps) {
    const { userPdfs, userState } = state;

    // 1. Registrar escuchadores de comandos
    for (const mod of modules) {
        if (mod.registerCommands) {
            mod.registerCommands(bot, state, deps);
        }
    }

    // 2. Gestionar callback queries (botones inline)
    bot.on('callback_query', async (query) => {
        const chatId    = query.message.chat.id;
        const messageId = query.message.message_id;
        const data      = query.data;
        const userId    = query.from.id;

        const { logInfo } = require('../utils/logger');
        logInfo('BOT', '🖱️', 'Botón presionado', { boton: data, chatId });
        bot.answerCallbackQuery(query.id).catch(() => {});

        // ── Guard de créditos ────────────────────────────────────────────
        // Solo se cobra en la primera acción de cada flujo (las que están en PAID_OPERATIONS)
        if (PAID_OPERATIONS.has(data)) {
            const allowed = await checkAndConsumeCredits(bot, chatId, userId, data, ADMIN_IDS);
            if (!allowed) return;
        }

        const buffer = userPdfs.get(chatId);
        if (!buffer) {
            return bot.sendMessage(chatId, "⚠️ El documento expiró. Por favor, envíalo de nuevo.");
        }

        // Delegar a los módulos de funcionalidades
        for (const mod of modules) {
            if (mod.handleCallback) {
                const handled = await mod.handleCallback(chatId, messageId, data, query, buffer, bot, state, deps);
                if (handled) return;
            }
        }
    });

    // 3. Gestionar subida de documentos (PDF original / imagen de firma)
    bot.on('document', async (msg) => {
        const currentUstate = userState.get(msg.chat.id);
        if (currentUstate === 'awaiting_tive_firma_image') {
            await firma.handleDocument(msg, bot, state, deps);
        } else {
            await start.handleDocument(msg, bot, state, deps);
        }
    });

    // 4. Gestionar transiciones de estados conversacionales
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const currentUstate = userState.get(chatId);
        if (!currentUstate) return;

        const buffer = userPdfs.get(chatId);

        for (const mod of modules) {
            if (mod.handleMessage) {
                const handled = await mod.handleMessage(chatId, currentUstate, msg, buffer, bot, state, deps);
                if (handled) return;
            }
        }
    });
};
