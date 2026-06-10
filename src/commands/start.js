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
]);

// Solo administradores (no consume créditos)
const ADMIN_ONLY_OPERATIONS = new Set([
    'insert_qr_only',
    'gen_tive_completar',
    'tive_completar_con_anio',
    'tive_completar_sin_anio',
    'gen_tarjeta_fisica_pvc_completar',
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
            `Tu ID no está registrado en la base de datos de Orion.\n\n` +
            `Ejecuta /register para crear un perfil y contacta a tu administrador para habilitar saldo.`,
            { parse_mode: 'Markdown' }
        );
        return false;
    }

    if (result.error === 'no_credits') {
        await bot.sendMessage(chatId,
            `💳 *Saldo Operativo Insuficiente*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `La herramienta *${OP_NAMES[operation] || operation}* requiere \`${result.cost}\` crédito(s).\n` +
            `Tu saldo actual es de: \`${result.remaining}\`\n\n` +
            `Recarga créditos con el comando /buy o contacta a tu proveedor.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🛒 Comprar Créditos', url: 'https://t.me/odinosea' }
                    ]]
                }
            }
        );
        return false;
    }

    if (!result.ok) {
        await bot.sendMessage(chatId, `❌ Error en el sistema de créditos: ${result.error}`);
        return false;
    }

    // Notificar al admin de la operación de imprenta pagada
    try {
        getClient(userId).then(client => {
            const clientName = client ? client.firstName : 'Usuario';
            const clientUname = client && client.username ? `@${client.username}` : 'sin_username';
            const opName = OP_NAMES[operation] || operation;
            const notifText =
                `🖨️ *NUEVA OPERACIÓN DE IMPRENTA*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 *Usuario:* ${clientName} (${clientUname}) (\`${userId}\`)\n` +
                `⚙️ *Herramienta:* \`${opName}\`\n` +
                `💳 *Costo:* \`${result.cost}\` crédito(s) | *Saldo restante:* \`${result.remaining}\``;

            for (const adminId of ADMIN_IDS) {
                bot.sendMessage(adminId, notifText, { parse_mode: 'Markdown' }).catch(() => {});
            }
        }).catch(() => {});
    } catch (_) {}

    // Aviso de saldo bajo
    if (result.remaining === 0) {
        bot.sendMessage(chatId,
            `⚠️ _Alerta de Sistema: Has agotado tu saldo operativo. Contacta a tu proveedor._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    } else if (result.remaining <= 3) {
        bot.sendMessage(chatId,
            `⚠️ _Alerta de Sistema: Saldo crítico. Te quedan \`${result.remaining}\` crédito(s)._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }

    return true;
}

module.exports = {
    checkAndConsumeCredits,
    PAID_OPERATIONS,
    ADMIN_ONLY_OPERATIONS,

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
                        `Tu ID no está registrado en la base de datos de Orion.\n\n` +
                        `Ejecuta /register para crear un perfil y contacta a tu administrador para habilitar saldo.`,
                        { parse_mode: 'Markdown' }
                    );
                }
                if (client.credits <= 0) {
                    return bot.sendMessage(chatId,
                        `💳 *Saldo Operativo Agotado*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `No tienes saldo disponible para procesar este documento.\n` +
                        `Saldo actual: \`0\`\n\n` +
                        `Contacta a tu proveedor para adquirir más créditos.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } catch (err) {
                logError('BOT', '❌', 'Error verificando cliente en handleDocument', err);
                return bot.sendMessage(chatId, '❌ Error conectando con la base de datos. Reintenta en unos momentos.');
            }
        }

        const handleEditError = (err) => {
            if (err && err.message && err.message.includes("message is not modified")) return;
            logError('BOT', '❌', 'Error editMessageText', err);
        };

        const statusMsg = await bot.sendMessage(chatId, "⏳ *Estableciendo conexión y procesando documento...*", { parse_mode: 'Markdown' });

        try {
            const chunks = [];
            for await (const chunk of bot.getFileStream(msg.document.file_id)) { chunks.push(chunk); }
            userPdfs.set(chatId, Buffer.concat(chunks));
            userPdfNames.set(chatId, msg.document.file_name || '');
            logInfo('BOT', '✅', 'Documento descargado en memoria');

            // Saldo en el menú
            let creditInfo = `👑 _Nivel ROOT — Sin restricciones_`;
            if (!isAdminUser) {
                try {
                    const client = await getClient(userId);
                    creditInfo = `💳 _Saldo Operativo: \`${client ? client.credits : 0}\` créditos_`;
                } catch (_) {}
            }

            // Menú PDF — filas siempre como [[botón], ...] (requerido por Telegram)
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
