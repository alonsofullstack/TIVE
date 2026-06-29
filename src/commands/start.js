const { logInfo, logError } = require('../utils/logger');
const { getClient, touchClient } = require('../services/clientService');
const {
    verifyOperationCredits,
    getOperationCost,
} = require('../services/creditGuard');

// Solo administradores (no consume créditos)
const ADMIN_ONLY_OPERATIONS = new Set([
    'insert_qr_only',
    'gen_tive_completar',
    'tive_completar_con_anio',
    'tive_completar_sin_anio',
    'gen_tarjeta_fisica_pvc_completar',
]);

module.exports = {
    ADMIN_ONLY_OPERATIONS,

    registerCommands(bot, state, deps) {
        const { ADMIN_IDS } = require('../config');

        bot.onText(/\/start/, async (msg) => {
            const { id, username, first_name } = msg.from;
            logInfo('BOT', '📥', 'Comando /start recibido', { username: username || 'sin_username', id });

            const isAdminUser = ADMIN_IDS.includes(String(id));

            try {
                await touchClient(id, username, first_name);
                const client = await getClient(id);

                let creditsLine = '';
                if (isAdminUser) {
                    creditsLine = `👑 *Nivel de Acceso:* ROOT (Administrador)\n` +
                                  `♾️ *Saldo Operativo:* Ilimitado\n`;
                } else if (!client) {
                    creditsLine =
                        `⚠️ *Estado:* Acceso Restringido\n` +
                        `👉 Ejecuta /register para inicializar tu perfil.\n`;
                } else {
                    creditsLine = `💳 *Saldo Operativo:* \`${client.credits}\` créditos\n`;
                }

                const welcome =
                    `🌌 *SISTEMA ORION BOT v2.0* 🌌\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `👋 Bienvenido operador, *${first_name || 'usuario'}*\n\n` +
                    `${creditsLine}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚡ *¿Qué herramienta necesitas hoy?*\n\n` +
                    `🪪 *MÓDULO DE CONSULTAS* — DNI, Placa, RUC, y más\n` +
                    `   _Ejecuta el comando directo, ej:_ \`/dni 44443333\`\n\n` +
                    `🖨️ *MÓDULO DE IMPRENTA* — Procesamiento Inteligente\n` +
                    `   _Sube un documento PDF para habilitar las opciones_\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📋 /cmds — Catálogo de herramientas\n` +
                    `💳 /credits — Estado de cuenta\n` +
                    `🛒 /buy — Comprar créditos\n` +
                    `📥 /register — Alta en el sistema`;

                bot.sendMessage(msg.chat.id, welcome, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🛒 Comprar Créditos — ING. ORION BOT', url: 'https://t.me/odinosea' }
                        ]]
                    }
                })
                    .catch(err => logError('BOT', '❌', 'Error enviando /start', err));

            } catch (err) {
                logError('BOT', '❌', 'Error en /start', err);
                bot.sendMessage(msg.chat.id, 
                    `🌌 *SISTEMA ORION BOT v2.0* 🌌\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `👋 Bienvenido operador, *${first_name || 'usuario'}*\n\n` +
                    `📋 /cmds — Catálogo de herramientas\n` +
                    `📥 /register — Alta en el sistema`,
                    { parse_mode: 'Markdown' });
            }
        });
    },

    async handleDocument(msg, bot, state, deps) {
        const { userPdfNames, setUserPdf } = state;
        const { ADMIN_IDS, MAX_PDF_BYTES } = require('../config');

        logInfo('BOT', '📄', 'Documento recibido', { name: msg.document.file_name, size: msg.document.file_size });

        if (msg.document.file_size && msg.document.file_size > MAX_PDF_BYTES) {
            return bot.sendMessage(msg.chat.id,
                `❌ El archivo excede el límite de ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB.`,
                { parse_mode: 'Markdown' }
            );
        }

        const chatId      = msg.chat.id;
        const userId      = msg.from.id;
        const isAdminUser = ADMIN_IDS.includes(String(userId));

        if (!isAdminUser) {
            const minCost = getOperationCost('gen_tive_completo');
            const allowed = await verifyOperationCredits(bot, chatId, userId, minCost);
            if (!allowed) return;
        }

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        const statusMsg = await bot.sendMessage(chatId, "⏳ *Estableciendo conexión y procesando documento...*", { parse_mode: 'Markdown' });

        try {
            const chunks = [];
            for await (const chunk of bot.getFileStream(msg.document.file_id)) { chunks.push(chunk); }
            setUserPdf(chatId, Buffer.concat(chunks), msg.document.file_name || '');
            logInfo('BOT', '✅', 'Documento descargado en memoria');

            let creditInfo = `👑 _Nivel ROOT — Sin restricciones_`;
            if (!isAdminUser) {
                try {
                    const client = await getClient(userId);
                    creditInfo = `💳 _Saldo Operativo: \`${client ? client.credits : 0}\` créditos_`;
                } catch (_) {}
            }

            const menuKeyboard = [
                [{ text: "🚀 Generar Fotos TIVE PVC", callback_data: "ask_qr" }],
                [{ text: "🧾 TIVE Completo",           callback_data: "gen_tive_completo" }],
                ...(isAdminUser ? [
                    [{ text: "🧾 TIVE Para Completar",                callback_data: "gen_tive_completar" }],
                    [{ text: "💳 Tarjeta Física PVC Para Completar", callback_data: "gen_tarjeta_fisica_pvc_completar" }],
                ] : []),
                [{ text: "💳 Tarjeta Física PVC",      callback_data: "gen_tarjeta_fisica_pvc" }],
                [{ text: "📜 Tarjeta Antigua",         callback_data: "gen_antigua" }],
                ...(isAdminUser ? [
                    [{ text: "🔐 Insertar QR en PDF",  callback_data: "insert_qr_only" }],
                ] : []),
            ];

            const menuOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: menuKeyboard
                }
            };

            bot.editMessageText(
                `📄 *Documento Analizado con Éxito*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📁 *Archivo:* \`${msg.document.file_name}\`\n` +
                `✅ *Estado:* En caché de memoria\n` +
                `${creditInfo}\n\n` +
                `Seleccione un procedimiento de impresión a ejecutar:`,
                { chat_id: chatId, message_id: statusMsg.message_id, ...menuOptions }
            ).catch(handleEditError);

        } catch (e) {
            bot.editMessageText(`❌ *Falla en el motor de procesamiento:* ${e.message}`, {
                chat_id: chatId, message_id: statusMsg.message_id
            }).catch(handleEditError);
        }
    }
};