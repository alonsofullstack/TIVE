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
const { initDB } = require('./src/services/clientService');
const state = require('./src/state');

const helpers = require('./src/utils/helpers');
const pdfParser = require('./src/services/pdfParser');
const ocrService = require('./src/services/ocrService');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── Interceptor Global de Baneos ─────────────────────────────────────────────
const { isClientBanned } = require('./src/services/clientService');

const originalOn = bot.on.bind(bot);
bot.on = function(event, listener) {
    if (['message', 'callback_query', 'document'].includes(event)) {
        const wrappedListener = async function(...args) {
            const eventData = args[0];
            const fromUser = event === 'callback_query' ? eventData?.from : eventData?.from;
            const chatId = event === 'callback_query' ? eventData?.message?.chat?.id : eventData?.chat?.id;

            if (fromUser && fromUser.id) {
                const isBanned = await isClientBanned(fromUser.id);
                if (isBanned) {
                    const isPrivate = event === 'callback_query'
                        ? (eventData?.message?.chat?.type === 'private')
                        : (eventData?.chat?.type === 'private');
                    if (isPrivate) {
                        bot.sendMessage(chatId, "🚫 *Acceso Denegado*\nTu usuario ha sido suspendido del sistema.", { parse_mode: 'Markdown' }).catch(() => {});
                    }
                    return; // Detener ejecución
                }
            }
            return listener.apply(this, args);
        };
        return originalOn(event, wrappedListener);
    }
    return originalOn(event, listener);
};

const originalOnText = bot.onText.bind(bot);
bot.onText = function(regexp, listener) {
    const wrappedListener = async function(msg, match) {
        if (msg && msg.from && msg.from.id) {
            const isBanned = await isClientBanned(msg.from.id);
            if (isBanned) {
                if (msg.chat && msg.chat.type === 'private') {
                    bot.sendMessage(msg.chat.id, "🚫 *Acceso Denegado*\nTu usuario ha sido suspendido del sistema.", { parse_mode: 'Markdown' }).catch(() => {});
                }
                return; // Detener ejecución
            }
        }
        return listener.apply(this, arguments);
    };
    return originalOnText(regexp, wrappedListener);
};

// Limpieza inicial silenciosa de Webhook
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => { });

// Inicializar tabla de clientes en MySQL
initDB()
    .then(() => logInfo('DB', '✅', 'Base de datos MySQL conectada y lista'))
    .catch((err) => logError('DB', '❌', 'Error conectando a MySQL — el sistema de créditos no funcionará', err));

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

// Iniciar multi-userbot para consultas al grupo
const { initializeMultiUserbot } = require('./src/services/multiUserbotService');
initializeMultiUserbot()
    .then(() => logInfo('BOT', '✅', 'Multi-userbot iniciado correctamente'))
    .catch((err) => logError('BOT', '❌', 'Multi-userbot falló al iniciar', err));


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
