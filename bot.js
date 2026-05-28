const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'canvas') {
        const skia = originalRequire.call(this, 'skia-canvas');
        if (!skia.createCanvas) {
            skia.createCanvas = (width, height) => new skia.Canvas(width, height);
        }
        return skia;
    }
    return originalRequire.apply(this, arguments);
};

process.env.NTBA_FIX_350 = 1;
const TelegramBot = require('node-telegram-bot-api');

const { BOT_TOKEN, ADMIN_IDS, API_KEYS, DOMAIN, isAuthorized } = require('./src/config');
const { logInfo, logError } = require('./src/utils/logger');
const state = require('./src/state');

const helpers = require('./src/utils/helpers');
const pdfParser = require('./src/services/pdfParser');
const ocrService = require('./src/services/ocrService');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Limpieza inicial silenciosa de Webhook
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => { });

const signatureService = require('./src/services/signatureService')(bot);
const cardGenerator = require('./src/services/cardGenerator')(bot);

const deps = {
    isAuthorized,
    extraerConIA: ocrService.extraerConIA,
    generarTIVE: cardGenerator.generarTIVE,
    generarTIVE_FisicaPvc: cardGenerator.generarTIVE,
    extraerTiveCompletoConLibreria: pdfParser.extraerTiveCompletoConLibreria,
    iniciarCapturaFaltantesTiveCompleto: cardGenerator.iniciarCapturaFaltantesTiveCompleto,
    iniciarCapturaFaltantesTiveCompletar: cardGenerator.iniciarCapturaFaltantesTiveCompletar,
    iniciarCapturaFaltantesFisicaPvcCompletar: cardGenerator.iniciarCapturaFaltantesFisicaPvcCompletar,
    finalizarInsercionQR: cardGenerator.finalizarInsercionQR,
    extraerConIA_Antigua: ocrService.extraerConIA_Antigua,
    generarTarjetaAntigua: cardGenerator.generarTarjetaAntigua,
    guardarFirmaPendienteDesdeMensaje: signatureService.guardarFirmaPendienteDesdeMensaje,
    componerTituloCompletar: pdfParser.componerTituloCompletar,
    generarTiveCompleto: cardGenerator.generarTiveCompleto,
    fmtPlaca: helpers.fmtPlaca,
    escapeMarkdown: helpers.escapeMarkdown
};

const registerCommands = require('./src/commands/index');
registerCommands(bot, state, deps);

// Iniciar userbot para consultas al grupo
const { iniciarUserbot } = require('./src/services/userbotService');
iniciarUserbot();

// ── NOTIFICACIÓN AL ADMIN de cada consulta en el grupo ──────────────────────
bot.on('message', (msg) => {
    try {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || 'Sin nombre';
        const text = msg.text || msg.caption || '[archivo/documento]';
        const chatTitle = msg.chat.title || 'Chat privado';
        const chatType = msg.chat.type; // group, supergroup, private

        // Solo notificar si viene de un grupo (no del propio admin)
        if ((chatType === 'group' || chatType === 'supergroup') && !ADMIN_IDS.includes(String(userId))) {
            const notif =
                `👁️ *CONSULTA EN GRUPO*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 *Usuario:* ${username} (\`${userId}\`)\n` +
                `💬 *Grupo:* ${chatTitle}\n` +
                `📝 *Mensaje:* \`${text}\``;

            for (const adminId of ADMIN_IDS) {
                bot.sendMessage(adminId, notif, { parse_mode: 'Markdown' }).catch(() => {});
            }
        }
    } catch (_) {}
});

logInfo('BOT', '🤖', `Bot TIVE IA Online!`, { adminIDs: ADMIN_IDS.length, geminiKeys: API_KEYS.length, domain: DOMAIN });

const gracefulShutdown = () => {
    logInfo('BOT', '🛑', `Señal de apagado recibida — deteniendo polling...`);
    bot.stopPolling()
        .then(() => {
            logInfo('BOT', '✅', `Polling detenido correctamente. Saliendo del proceso.`);
            process.exit(0);
        })
        .catch((err) => {
            logError('BOT', '❌', `Error deteniendo el bot durante apagado`, err);
            process.exit(1);
        });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

bot.on('polling_error', (err) => {
    if (err.message && err.message.includes("409 Conflict")) {
        logError('BOT', '⚠️', `Conflicto 409 detectado — hay otra instancia del bot corriendo. Verifica que solo hay 1 réplica activa.`);
    } else {
        logError('BOT', '❌', `Error de polling de Telegram`, err);
    }
});
