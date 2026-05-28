const { logError } = require('../utils/logger');

module.exports = {
    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        const { extraerConIA, generarTIVE, iniciarCapturaFaltantesFisicaPvcCompletar } = deps;
        const { userPdfNames } = state;

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        if (data === "gen_tarjeta_fisica_pvc") {
            bot.editMessageText(`💳 *Procesando datos localmente...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                await generarTIVE(chatId, datos, null, buffer, { anv: 'TARJETA FISICA ADELANTE.pdf', rev: 'TARJETA FISICA ATRAS.pdf' }, { noQR: true, cropTop: 35, cropBottom: 35, cropLeft: 35, cropRight: 35 });
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
            return true;
        } else if (data === "gen_tarjeta_fisica_pvc_completar") {
            bot.editMessageText(`💳 *Extrayendo datos para TARJETA FISICA PVC PARA COMPLETAR...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                await iniciarCapturaFaltantesFisicaPvcCompletar(chatId, datos, buffer);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
            return true;
        }
        return false;
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userFisicaPvcCompletarData, userState } = state;
        const { fmtPlaca, generarTIVE, componerTituloCompletar } = deps;

        if (ustate === "awaiting_fisica_pvc_completar_field" && msg.text && (!msg.text.startsWith('/') || msg.text.toLowerCase() === '/ok')) {
            const pending = userFisicaPvcCompletarData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                bot.sendMessage(chatId, "⚠️ Se perdió el estado de captura. Vuelve a elegir *TARJETA FISICA PVC PARA COMPLETAR*.", { parse_mode: 'Markdown' });
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
                userFisicaPvcCompletarData.delete(chatId);
                userState.delete(chatId);

                const fullTitle = componerTituloCompletar(pending.datos.tituloNo, pending.datos.añoTitulo);
                if (fullTitle) {
                    pending.datos.titulo = fullTitle;
                    pending.datos.tituloNo = fullTitle;
                }
                
                await bot.sendMessage(chatId, "✅ Datos faltantes completados. Generando *TARJETA FISICA PVC PARA COMPLETAR*...", { parse_mode: 'Markdown' });
                try {
                    await generarTIVE(chatId, pending.datos, null, pending.sourceBuffer, { anv: 'TARJETA FISICA ADELANTE.pdf', rev: 'TARJETA FISICA ATRAS.pdf' }, { noQR: true, cropTop: 35, cropBottom: 35, cropLeft: 35, cropRight: 35 });
                } catch (e) {
                    logError('BOT', '❌', 'Error generando TARJETA FISICA PVC PARA COMPLETAR', e);
                    bot.sendMessage(chatId, "❌ Error: " + e.message);
                }
            } else {
                userFisicaPvcCompletarData.set(chatId, pending);
                const next = pending.missingFields[pending.index];
                await bot.sendMessage(chatId, `✍️ Falta el dato *${next.label}*.\nEnvíalo para continuar.`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    }
};
