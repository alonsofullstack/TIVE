const crypto = require('crypto');

module.exports = {
    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        const { finalizarInsercionQR } = deps;
        const { ADMIN_IDS } = require('../config');

        if (data === "insert_qr_only") {
            // Verificar que sea administrador
            if (!ADMIN_IDS.includes(String(query.from.id))) {
                bot.editMessageText(
                    `🚫 *Acceso Denegado*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `Esta opción está reservada exclusivamente para administradores.`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                ).catch(() => {});
                return true;
            }
            const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
            await finalizarInsercionQR(chatId, buffer, "CERTIFICADO", hash, messageId);
            return true;
        }
        return false;
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userState } = state;
        const { finalizarInsercionQR } = deps;

        if (ustate === "awaiting_plate_for_qr") {
            const plate = msg.text.toUpperCase().trim();
            userState.delete(chatId);

            bot.sendMessage(chatId, `⏳ Generando PDF con QR para la placa *${plate}*...`, { parse_mode: 'Markdown' });
            try {
                const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
                await finalizarInsercionQR(chatId, buffer, plate, hash);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
            return true;
        }
        return false;
    }
};
