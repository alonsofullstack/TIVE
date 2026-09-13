const { logError } = require('../utils/logger');
const { reserveOperationCredits, refundPendingCharge } = require('../services/creditGuard');
const electronicoPvcV2 = require('../layouts/electronicoPvcV2');

const fotosTivePvcV2 = {
    templates: { anv: 'TARJETA FISICA ADELANTE 2.pdf', rev: 'atrasxd.pdf' },
    options: {
        anversoLayout: 'fotosV2',
        cropTopAnv: 0,
        cropBottomAnv: 0,
        cropLeftAnv: 0,
        cropRightAnv: 0
    }
};

const electronicoPvcV2Generacion = {
    templates: {
        anv: electronicoPvcV2.plantillas.anverso,
        rev: electronicoPvcV2.plantillas.reverso
    },
    options: {
        anversoLayout: electronicoPvcV2.layout,
        cropTopAnv: electronicoPvcV2.recorte.anverso.top,
        cropBottomAnv: electronicoPvcV2.recorte.anverso.bottom,
        cropLeftAnv: electronicoPvcV2.recorte.anverso.left,
        cropRightAnv: electronicoPvcV2.recorte.anverso.right,
        cropTopRev: electronicoPvcV2.recorte.reverso.top,
        cropBottomRev: electronicoPvcV2.recorte.reverso.bottom,
        cropLeftRev: electronicoPvcV2.recorte.reverso.left,
        cropRightRev: electronicoPvcV2.recorte.reverso.right
    }
};

function configuracionGeneracion(isElectronicoV2) {
    return isElectronicoV2 ? electronicoPvcV2Generacion : fotosTivePvcV2;
}

module.exports = {
    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        const { userState, userPdfNames } = state;
        const { extraerConIA, generarTIVE } = deps;

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        if (data === "ask_qr" || data === "qr" || data === "ask_electronico_pvc_v2") {
            const isElectronicoV2 = data === "ask_electronico_pvc_v2";
            userState.set(chatId, isElectronicoV2 ? "awaiting_electronico_pvc_v2_qr" : "awaiting_qr");
            bot.editMessageText(`🔗 *Configuración QR*\nEscribe el link personalizado o elige el oficial:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{
                        text: "🏢 Usar Link Oficial SUNARP",
                        callback_data: isElectronicoV2 ? "use_official_electronico_pvc_v2" : "use_official"
                    }]]
                }
            }).catch(handleEditError);
            return true;
        } else if (data === "use_official" || data === "use_official_electronico_pvc_v2") {
            const isElectronicoV2 = data === "use_official_electronico_pvc_v2";
            bot.editMessageText(`🧾 *Procesando datos localmente...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                const generacion = configuracionGeneracion(isElectronicoV2);
                await generarTIVE(chatId, datos, null, buffer, generacion.templates, generacion.options);
            } catch (e) {
                await refundPendingCharge(state, chatId);
                bot.sendMessage(chatId, `❌ Error: ${e.message}\n_No se descontaron créditos._`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    },

    async handleMessage(chatId, ustate, msg, buffer, bot, state, deps) {
        const { userState, userPdfNames } = state;
        const { extraerConIA, generarTIVE, escapeMarkdown } = deps;

        if ((ustate === "awaiting_qr" || ustate === "awaiting_electronico_pvc_v2_qr") && msg.text && !msg.text.startsWith('/')) {
            const customLink = msg.text;
            const userId = msg.from.id;
            const isElectronicoV2 = ustate === "awaiting_electronico_pvc_v2_qr";

            const allowed = await reserveOperationCredits(bot, chatId, userId, isElectronicoV2 ? 'ask_electronico_pvc_v2' : 'ask_qr', state);
            if (!allowed) return true;
            userState.delete(chatId);
            bot.sendMessage(chatId, `🧾 Procesando datos localmente...`);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                if (!datos.placa) bot.sendMessage(chatId, "⚠️ Advertencia: No se detectó placa.");
                const generacion = configuracionGeneracion(isElectronicoV2);
                await generarTIVE(chatId, datos, customLink, buffer, generacion.templates, generacion.options);
            } catch (e) {
                await refundPendingCharge(state, chatId);
                logError('BOT', '❌', 'Error en flujo custom', e);
                bot.sendMessage(chatId, `❌ Error: ${escapeMarkdown(e.message)}\n_No se descontaron créditos._`, { parse_mode: 'Markdown' });
            }
            return true;
        }
        return false;
    }
};
