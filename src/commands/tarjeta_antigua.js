const { logError } = require('../utils/logger');
const { refundPendingCharge } = require('../services/creditGuard');

module.exports = {
    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        const { userAntiguaData, userState } = state;
        const { extraerConIA_Antigua } = deps;

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        if (data === "gen_antigua") {
            const n1 = Math.floor(100000 + Math.random() * 900000).toString();
            let n2; do { n2 = Math.floor(100000 + Math.random() * 900000).toString(); } while (n1 === n2);
            const exp = Math.floor(10000 + Math.random() * 90000).toString();

            userAntiguaData.set(chatId, { controlAnverso: n1, controlReverso: n2, exp: exp });
            userState.set(chatId, "awaiting_antigua_placa");

            extraerConIA_Antigua(buffer).then(datos => {
                const current = userAntiguaData.get(chatId);
                if (current) current.datosIA = datos;
            }).catch(e => logError('IA-ANTIGUA', '❌', 'Error extracción en segundo plano', e));

            bot.editMessageText(
                `📜 *Generación de Tarjeta Antigua*\n\n` +
                `Introduce la **PLACA** con su guion (ej: \`5053-QS\`):`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(handleEditError);
            return true;
        }
        return false;
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userAntiguaData, userState } = state;
        const { fmtPlaca, extraerConIA_Antigua, generarTarjetaAntigua } = deps;

        if (ustate === "awaiting_antigua_placa" && msg.text) {
            userAntiguaData.get(chatId).placa = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_clase");
            bot.sendMessage(chatId, "🛵 Introduce la **CLASE** (ej: MOTOCICLETA):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_clase" && msg.text) {
            userAntiguaData.get(chatId).clase = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_placa_sede");
            bot.sendMessage(chatId, "📍 Introduce la **PLACA SEDE** (ej: TARAPOTO):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_placa_sede" && msg.text) {
            userAntiguaData.get(chatId).placaSede = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_zona");
            bot.sendMessage(chatId, "🌏 Introduce la **ZONA** (ej: III):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_zona" && msg.text) {
            userAntiguaData.get(chatId).zona = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_sede");
            bot.sendMessage(chatId, "📍 Introduce la **SEDE** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_sede" && msg.text) {
            userAntiguaData.get(chatId).sede = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_reparticion");
            bot.sendMessage(chatId, "📂 Introduce la **REPARTICIÓN** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_reparticion" && msg.text) {
            userAntiguaData.get(chatId).reparticion = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_sede_domicilio");
            bot.sendMessage(chatId, "📍 Introduce la **SEDE DOMICILIO** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_sede_domicilio" && msg.text) {
            userAntiguaData.get(chatId).sedeDomicilio = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_domicilio");
            bot.sendMessage(chatId, "🏠 Introduce la **DIRECCIÓN (DOMICILIO)** (o /skip):", { parse_mode: 'Markdown' });
            return true;
        } else if (ustate === "awaiting_antigua_domicilio" && msg.text) {
            let domicilio = msg.text.trim();
            if (domicilio.startsWith('/skip')) domicilio = "";
            const data = userAntiguaData.get(chatId);
            data.domicilio = domicilio;

            const checkIA = async () => {
                if (!data.datosIA) {
                    const status = await bot.sendMessage(chatId, "⏳ *Esperando que la IA detecte la fecha...*", { parse_mode: 'Markdown' });
                    while (!data.datosIA) { await new Promise(r => setTimeout(r, 1000)); }
                    bot.deleteMessage(chatId, status.message_id).catch(() => { });
                }
                const fechaSugerida = data.datosIA.fechaAsiento || data.datosIA.fechaInferior || "";
                userState.set(chatId, "awaiting_antigua_fecha");
                bot.sendMessage(chatId,
                    `✅ **Datos Registrados.**\n\n` +
                    `📅 **Fecha Detectada:** \`${fechaSugerida}\`\n\n` +
                    `Introduce **LA FECHA** (o escribe /ok para usar la detectada):`,
                    { parse_mode: 'Markdown' }
                );
            };
            checkIA();
            return true;
        } else if (ustate === "awaiting_antigua_fecha" && msg.text) {
            let fecha = msg.text.trim();
            const data = userAntiguaData.get(chatId);
            if (fecha.toLowerCase() === "/ok" && data.datosIA) {
                fecha = data.datosIA.fechaAsiento || data.datosIA.fechaInferior || "";
            }
            data.fecha = fecha;
            userState.delete(chatId);

            bot.sendMessage(chatId, `✨ *Generando Tarjeta Antigua...*`, { parse_mode: 'Markdown' });

            try {
                const datos = data.datosIA || await extraerConIA_Antigua(buffer);
                datos.controlAnverso = data.controlAnverso;
                datos.controlReverso = data.controlReverso;
                datos.titulo = data.exp;
                datos.partida = fecha;
                datos.fechaPropiedad = fecha;
                datos.fechaInferior = fecha;
                datos.zona = data.zona;
                datos.sede = data.sede;
                datos.reparticion = data.reparticion;
                if (data.placa) datos.placa = fmtPlaca(data.placa);
                if (data.clase) datos.clase = data.clase;
                if (data.placaSede) datos.placaSede = data.placaSede;
                if (data.sedeDomicilio) datos.sedeDomicilio = data.sedeDomicilio;
                if (data.domicilio) datos.domicilio = data.domicilio;

                await generarTarjetaAntigua(chatId, datos, buffer);
                userAntiguaData.delete(chatId);
            } catch (e) {
                await refundPendingCharge(state, chatId);
                logError('BOT', '❌', 'Error final en tarjeta antigua', e);
                bot.sendMessage(chatId, `❌ Error: ${e.message}\n_No se descontaron créditos._`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    }
};
