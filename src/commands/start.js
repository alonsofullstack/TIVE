const { logInfo, logError } = require('../utils/logger');
const { getClient, touchClient, consumeCredits } = require('../services/clientService');

// ── Operaciones que consumen crédito (callback_data) ─────────────────────────
const PAID_OPERATIONS = new Set([
    'ask_qr',
    'use_official',
    'gen_tive_completo',
    'tive_completo_con_anio',
    'tive_completo_sin_anio',
    'gen_tive_completar',
    'tive_completar_con_anio',
    'tive_completar_sin_anio',
    'gen_tarjeta_fisica_pvc',
    'gen_tarjeta_fisica_pvc_completar',
    'gen_antigua',
    'insert_qr_only',
]);

const OP_NAMES = {
    ask_qr:                           '🚀 Fotos TIVE PVC',
    use_official:                     '🚀 Fotos TIVE PVC',
    gen_tive_completo:                '🧾 TIVE Completo',
    tive_completo_con_anio:           '🧾 TIVE Completo',
    tive_completo_sin_anio:           '🧾 TIVE Completo',
    gen_tive_completar:               '🧾 TIVE Para Completar',
    tive_completar_con_anio:          '🧾 TIVE Para Completar',
    tive_completar_sin_anio:          '🧾 TIVE Para Completar',
    gen_tarjeta_fisica_pvc:           '💳 Tarjeta Física PVC',
    gen_tarjeta_fisica_pvc_completar: '💳 Tarjeta Física PVC Para Completar',
    gen_antigua:                      '📜 Tarjeta Antigua',
    insert_qr_only:                   '🔐 Insertar QR en PDF',
};

/**
 * Verifica créditos antes de ejecutar una operación de pago.
 * Admins siempre pasan. Devuelve true si puede continuar.
 */
async function checkAndConsumeCredits(bot, chatId, userId, operation, ADMIN_IDS) {
    if (ADMIN_IDS.includes(String(userId))) return true;
    if (!PAID_OPERATIONS.has(operation)) return true;

    const result = await consumeCredits(userId, operation);

    if (result.error === 'no_registered') {
        await bot.sendMessage(chatId,
            `🚫 *Acceso Denegado*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `No estás registrado en el sistema.\n\n` +
            `Usa /register para crear tu cuenta y luego contacta al administrador para obtener créditos.`,
            { parse_mode: 'Markdown' }
        );
        return false;
    }

    if (result.error === 'no_credits') {
        await bot.sendMessage(chatId,
            `💳 *Sin Créditos Suficientes*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `La operación *${OP_NAMES[operation] || operation}* requiere \`${result.cost}\` crédito(s).\n` +
            `Tu saldo actual: \`${result.remaining}\`\n\n` +
            `Contacta al administrador para recargar tu cuenta.`,
            { parse_mode: 'Markdown' }
        );
        return false;
    }

    if (!result.ok) {
        await bot.sendMessage(chatId, `❌ Error verificando créditos: ${result.error}`);
        return false;
    }

    // Aviso de saldo bajo
    if (result.remaining === 0) {
        bot.sendMessage(chatId,
            `⚠️ _Has usado tu último crédito. Contacta al administrador para recargar._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    } else if (result.remaining <= 3) {
        bot.sendMessage(chatId,
            `⚠️ _Saldo bajo: te quedan \`${result.remaining}\` crédito(s). Recarga pronto._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }

    return true;
}

module.exports = {
    checkAndConsumeCredits,
    PAID_OPERATIONS,

    registerCommands(bot, state, deps) {
        const { isAuthorized } = deps;
        const { ADMIN_IDS } = require('../config');

        bot.onText(/\/start/, async (msg) => {
            const { id, username, first_name } = msg.from;
            logInfo('BOT', '📥', 'Comando /start recibido', { username: username || 'sin_username', id });
            if (!isAuthorized(msg)) return;

            const isAdminUser = ADMIN_IDS.includes(String(id));

            try {
                await touchClient(id, username, first_name);
                const client = await getClient(id);

                let creditsLine = '';
                if (isAdminUser) {
                    creditsLine = `👑 *Modo:* Administrador _(sin límite de créditos)_\n`;
                } else if (!client) {
                    creditsLine =
                        `⚠️ *Estado:* No registrado\n` +
                        `👉 Usa /register para crear tu cuenta.\n`;
                } else {
                    creditsLine = `💳 *Créditos disponibles:* \`${client.credits}\`\n`;
                }

                const welcome =
                    `✨ *TIVE AI PRO* ✨\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `👋 Hola, *${first_name || 'usuario'}*\n` +
                    creditsLine +
                    `\n` +
                    `🚀 *Capacidades del sistema:*\n` +
                    `• Extracción inteligente de datos _(Gemini AI)_\n` +
                    `• Generación de anverso/reverso en alta definición\n` +
                    `• QR y código de barras dinámicos\n` +
                    `• Recorte automático de firma original\n` +
                    `• Tarjeta física PVC y tarjeta antigua\n\n` +
                    `📥 *Para comenzar:* Envía el PDF original de SUNARP.\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📋 /cmds — Ver todos los comandos\n` +
                    `💳 /credits — Consultar tu saldo`;

                bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' })
                    .catch(err => logError('BOT', '❌', 'Error enviando /start', err));

            } catch (err) {
                logError('BOT', '❌', 'Error en /start', err);
                bot.sendMessage(msg.chat.id, '✨ *TIVE AI PRO* — Bot activo. Usa /register para comenzar.', { parse_mode: 'Markdown' });
            }
        });
    },

    async handleDocument(msg, bot, state, deps) {
        const { userPdfs, userPdfNames } = state;
        const { isAuthorized } = deps;
        const { ADMIN_IDS } = require('../config');

        logInfo('BOT', '📄', 'Documento recibido', { name: msg.document.file_name, size: msg.document.file_size });
        if (!isAuthorized(msg)) return;

        const chatId      = msg.chat.id;
        const userId      = msg.from.id;
        const isAdminUser = ADMIN_IDS.includes(String(userId));

        // Verificar registro y créditos antes de descargar
        if (!isAdminUser) {
            try {
                const client = await getClient(userId);
                if (!client) {
                    return bot.sendMessage(chatId,
                        `🚫 *Acceso Denegado*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `No estás registrado en el sistema.\n\n` +
                        `Usa /register para crear tu cuenta y luego contacta al administrador para obtener créditos.`,
                        { parse_mode: 'Markdown' }
                    );
                }
                if (client.credits <= 0) {
                    return bot.sendMessage(chatId,
                        `💳 *Sin Créditos*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `No tienes créditos disponibles.\n` +
                        `Saldo actual: \`0\`\n\n` +
                        `Contacta al administrador para recargar tu cuenta.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } catch (err) {
                logError('BOT', '❌', 'Error verificando cliente en handleDocument', err);
                return bot.sendMessage(chatId, '❌ Error verificando tu cuenta. Intenta de nuevo.');
            }
        }

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

            // Saldo en el menú
            let creditInfo = `👑 _Admin — sin límite_`;
            if (!isAdminUser) {
                try {
                    const client = await getClient(userId);
                    creditInfo = `💳 _Créditos disponibles: \`${client ? client.credits : 0}\`_`;
                } catch (_) {}
            }

            const menuOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🚀 Generar Fotos TIVE PVC",                  callback_data: "ask_qr" }],
                        [{ text: "🧾 TIVE Completo",                            callback_data: "gen_tive_completo" }],
                        [{ text: "🧾 TIVE Para Completar",                      callback_data: "gen_tive_completar" }],
                        [{ text: "💳 Tarjeta Física PVC",                       callback_data: "gen_tarjeta_fisica_pvc" }],
                        [{ text: "💳 Tarjeta Física PVC Para Completar",        callback_data: "gen_tarjeta_fisica_pvc_completar" }],
                        [{ text: "📜 Tarjeta Antigua",                          callback_data: "gen_antigua" }],
                        [{ text: "🔐 Insertar QR en PDF Original",              callback_data: "insert_qr_only" }]
                    ]
                }
            };

            bot.editMessageText(
                `📄 *Documento Cargado*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📁 *Archivo:* \`${msg.document.file_name}\`\n` +
                `✅ *Estado:* Listo para procesar\n` +
                `${creditInfo}\n\n` +
                `¿Qué acción deseas realizar?`,
                { chat_id: chatId, message_id: statusMsg.message_id, ...menuOptions }
            ).catch(handleEditError);

        } catch (e) {
            bot.editMessageText(`❌ *Error al procesar el archivo:* ${e.message}`, {
                chat_id: chatId, message_id: statusMsg.message_id
            }).catch(handleEditError);
        }
    }
};
