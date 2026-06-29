const { logError } = require('../utils/logger');
const { verifyOperationCredits, clearPendingCharge } = require('../services/creditGuard');

module.exports = {
    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        const { userState, userPdfNames } = state;
        const { extraerConIA, generarTIVE } = deps;

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        if (data === "ask_qr" || data === "qr") {
            userState.set(chatId, "awaiting_qr");
            bot.editMessageText(`🔗 *Configuración QR*\nEscribe el link personalizado o elige el oficial:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "🏢 Usar Link Oficial SUNARP", callback_data: "use_official" }]]
                }
            }).catch(handleEditError);
            return true;
        } else if (data === "use_official") {
            bot.editMessageText(`🧾 *Procesando datos localmente...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                await generarTIVE(chatId, datos, null, buffer);
            } catch (e) {
                clearPendingCharge(state, chatId);
                bot.sendMessage(chatId, `❌ Error: ${e.message}\n_No se descontaron créditos._`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userState, userPdfNames } = state;
        const { extraerConIA, generarTIVE, escapeMarkdown } = deps;

        if (ustate === "awaiting_qr" && msg.text && !msg.text.startsWith('/')) {
            const customLink = msg.text;
            const userId = msg.from.id;

            const allowed = await verifyOperationCredits(bot, chatId, userId, 'ask_qr');
            if (!allowed) return true;

            state.userPendingCharge.set(chatId, { userId, operation: 'ask_qr' });
            userState.delete(chatId);
            bot.sendMessage(chatId, `🧾 Procesando datos localmente...`);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                if (!datos.placa) bot.sendMessage(chatId, "⚠️ Advertencia: No se detectó placa.");
                await generarTIVE(chatId, datos, customLink, buffer);
            } catch (e) {
                clearPendingCharge(state, chatId);
                logError('BOT', '❌', 'Error en flujo custom', e);
                bot.sendMessage(chatId, `❌ Error: ${escapeMarkdown(e.message)}\n_No se descontaron créditos._`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    }
};
