const { logInfo, logError } = require('../utils/logger');

module.exports = {
    registerCommands(bot, state, deps) {
        const { isAuthorized } = deps;

        bot.onText(/\/start/, (msg) => {
            logInfo('BOT', '📥', 'Comando /start recibido', { username: msg.from.username || 'sin_username', id: msg.from.id });
            if (!isAuthorized(msg)) return;
            const welcome =
                `✨ *TIVE AI PRO* ✨\n` +
                `━━━━━━━━━━━━━━━━━\n` +
                `Bienvenido al sistema avanzado de generación de tarjetas TIVE.\n\n` +
                `🚀 *Capacidades:*\n` +
                `• Extracción inteligente de datos (Gemini AI)\n` +
                `• Generación de anverso/reverso en alta definición\n` +
                `• QR y Código de barras dinámicos\n` +
                `• Recorte automático de firma original\n\n` +
                `📥 *Para comenzar:* Envía el documento PDF original de SUNARP.`;
            bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' }).catch(err => logError('BOT', '❌', 'Error enviando /start', err));
        });
    },

    async handleDocument(msg, bot, state, deps) {
        const { userPdfs, userPdfNames } = state;
        const { isAuthorized } = deps;
        
        logInfo('BOT', '📄', 'Documento recibido', { name: msg.document.file_name, size: msg.document.file_size });
        if (!isAuthorized(msg)) return;
        const chatId = msg.chat.id;

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        const statusMsg = await bot.sendMessage(chatId, "⏳ *Descargando documento...*", { parse_mode: 'Markdown' });

        try {
            const chunks = [];
            for await (const chunk of bot.getFileStream(msg.document.file_id)) { chunks.push(chunk); }
            userPdfs.set(chatId, Buffer.concat(chunks));
            userPdfNames.set(chatId, msg.document.file_name || '');
            logInfo('BOT', '✅', 'Documento descargado en memoria');

            const menuOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🚀 Generar Fotos TIVE PVC", callback_data: "ask_qr" }],
                        [{ text: "🧾 TIVE COMPLETO", callback_data: "gen_tive_completo" }],
                        [{ text: "🧾 TIVE PARA COMPLETAR", callback_data: "gen_tive_completar" }],
                        [{ text: "💳 TARJETA FISICA PVC", callback_data: "gen_tarjeta_fisica_pvc" }],
                        [{ text: "💳 TARJETA FISICA PVC PARA COMPLETAR", callback_data: "gen_tarjeta_fisica_pvc_completar" }],
                        [{ text: "📜 Generar Tarjeta Antigua", callback_data: "gen_antigua" }],
                        [{ text: "🔐 Insertar QR en PDF Original", callback_data: "insert_qr_only" }]
                    ]
                }
            };

            bot.editMessageText(
                `📄 *Documento Cargado*\n` +
                `━━━━━━━━━━━━━━━━━\n` +
                `• Archivo: \`${msg.document.file_name}\`\n` +
                `• Estado: Ready ✨\n\n` +
                `¿Qué acción deseas realizar con este documento?`,
                { chat_id: chatId, message_id: statusMsg.message_id, ...menuOptions }
            ).catch(handleEditError);
        } catch (e) {
            bot.editMessageText(`❌ *Error al procesar el archivo:* ${e.message}`, { chat_id: chatId, message_id: statusMsg.message_id }).catch(handleEditError);
        }
    }
};
