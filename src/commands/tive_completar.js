const { logError } = require('../utils/logger');

module.exports = {
    registerCommands(bot, state, deps) {
        const { isAuthorized } = deps;

        bot.onText(/\/tive_completar/, (msg) => {
            if (!isAuthorized(msg)) return;
            bot.sendMessage(msg.chat.id, "💡 Para usar *TIVE PARA COMPLETAR*, primero sube un archivo PDF de SUNARP y presiona el botón correspondiente en el menú.", { parse_mode: 'Markdown' });
        });
    },

    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        const { extraerTiveCompletoConLibreria, iniciarCapturaFaltantesTiveCompletar } = deps;
        
        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        if (data === "gen_tive_completar") {
            bot.editMessageText(
                `❓ *¿Deseas incluir el Año de Fabricación en el PDF?*\n\n` +
                `Si eliges *NO*, se usará la plantilla sin este campo y se omitirá en la generación.`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "✅ SÍ, incluir Año", callback_data: "tive_completar_con_anio" },
                                { text: "❌ NO, omitir Año", callback_data: "tive_completar_sin_anio" }
                            ]
                        ]
                    }
                }
            ).catch(handleEditError);
            return true;
        } else if (data === "tive_completar_con_anio" || data === "tive_completar_sin_anio") {
            const sinAnio = data.includes("sin_anio");
            bot.editMessageText(`📄 *Extrayendo datos para TIVE PARA COMPLETAR...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerTiveCompletoConLibreria(buffer);
                datos.sinAnioFabricacion = sinAnio;
                await iniciarCapturaFaltantesTiveCompletar(chatId, datos, buffer);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
            return true;
        }
        return false;
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userTiveCompletarData, userState } = state;
        const { fmtPlaca, generarTiveCompleto, componerTituloCompletar } = deps;

        if (ustate === "awaiting_tive_completar_field" && msg.text && (!msg.text.startsWith('/') || msg.text.toLowerCase() === '/ok')) {
            const pending = userTiveCompletarData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                bot.sendMessage(chatId, "⚠️ Se perdió el estado de captura. Vuelve a elegir *TIVE PARA COMPLETAR*.", { parse_mode: 'Markdown' });
                return true;
            }
            const current = pending.missingFields[pending.index];
            const rawValue = msg.text.trim();

            if (current.key === 'placa') {
                const respuesta = rawValue.toLowerCase().replace(/^\//,'');
                const esConfirmacion = ['si', 'sí', 'si', 'ok', 'si.', 'sí.', 'yes', 'y'].includes(respuesta);
                if (esConfirmacion && (pending.datos.placaOriginal || pending.datos.placa)) {
                    const placaDetectada = fmtPlaca(pending.datos.placaOriginal || pending.datos.placa);
                    pending.datos.placa = placaDetectada;
                    pending.datos.placaOriginal = pending.datos.placaOriginal || pending.datos.placa;
                } else {
                    pending.datos.placa = fmtPlaca(rawValue);
                    pending.datos.placaOriginal = rawValue;
                }
            } else {
                pending.datos[current.key] = rawValue;
            }

            pending.index += 1;

            if (pending.index >= pending.missingFields.length) {
                userTiveCompletarData.delete(chatId);
                userState.delete(chatId);

                const fullTitle = componerTituloCompletar(pending.datos.tituloNo, pending.datos.añoTitulo);
                if (fullTitle) {
                    pending.datos.titulo = fullTitle;
                    pending.datos.tituloNo = fullTitle;
                }
                
                await bot.sendMessage(chatId, "✅ Datos faltantes completados. Generando *TIVE PARA COMPLETAR*...", { parse_mode: 'Markdown' });
                try {
                    await generarTiveCompleto(chatId, pending.datos, null, pending.sourceHash);
                } catch (e) {
                    logError('BOT', '❌', 'Error generando TIVE PARA COMPLETAR', e);
                    bot.sendMessage(chatId, "❌ Error: " + e.message);
                }
            } else {
                userTiveCompletarData.set(chatId, pending);
                const next = pending.missingFields[pending.index];
                await bot.sendMessage(chatId, `✍️ Falta el dato *${next.label}*.\nEnvíalo para continuar.`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    }
};
