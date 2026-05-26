const { logInfo, logError } = require('../utils/logger');

module.exports = {
    async handleDocument(msg, bot, state, deps) {
        const { isAuthorized, guardarFirmaPendienteDesdeMensaje } = deps;
        const { userState } = state;
        const chatId = msg.chat.id;

        logInfo('FIRMA', '📄', 'Documento de firma recibido', { name: msg.document.file_name, size: msg.document.file_size });
        if (!isAuthorized(msg)) return;

        const currentUstate = userState.get(chatId);
        if (currentUstate === 'awaiting_tive_firma_image') {
            try {
                await guardarFirmaPendienteDesdeMensaje(chatId, msg);
            } catch (e) {
                logError('FIRMA', '❌', 'Error guardando firma', e);
                await bot.sendMessage(chatId, "❌ Error guardando la firma: " + e.message);
            }
        }
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userState, userFirmaPendienteData } = state;
        const { escapeMarkdown, guardarFirmaPendienteDesdeMensaje } = deps;

        if (ustate === "awaiting_tive_firma_name" && msg.text && !msg.text.startsWith('/')) {
            const pending = userFirmaPendienteData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                bot.sendMessage(chatId, "⚠️ No hay una firma pendiente. Vuelve a generar el TIVE.");
                return true;
            }
            pending.firmaNombre = msg.text.trim();
            userFirmaPendienteData.set(chatId, pending);
            userState.set(chatId, "awaiting_tive_firma_image");
            bot.sendMessage(chatId, `📷 Ahora envía la imagen JPG/PNG de la firma para *${escapeMarkdown(pending.firmaNombre)}*.`, { parse_mode: 'Markdown' });
            return true;
        }

        if (ustate === "awaiting_tive_firma_image") {
            if (msg.document) return true; // Handled by handleDocument
            if (msg.photo && msg.photo.length) {
                try {
                    await guardarFirmaPendienteDesdeMensaje(chatId, msg);
                } catch (e) {
                    logError('FIRMA', '❌', 'Error guardando firma', e);
                    await bot.sendMessage(chatId, "❌ Error guardando la firma: " + e.message);
                }
                return true;
            }
            bot.sendMessage(chatId, "📷 Envía la firma como imagen JPG/PNG para guardarla.");
            return true;
        }
        return false;
    }
};
