const TelegramBot = require('node-telegram-bot-api');
const { logInfo, logError } = require('../utils/logger');
const { BOT_TOKENS, COMMAND_BOT_MAPPING } = require('../config');

/**
 * Servicio para manejar múltiples bots de Telegram
 * Distribuye comandos entre diferentes bots para evitar límites de spam
 */

const bots = new Map();
const botStatus = new Map();

/**
 * Inicializa múltiples bots de Telegram
 */
async function initializeBots() {
    logInfo('MULTI-BOT', '🚀', 'Inicializando múltiples bots...');

    // Bot primario
    if (BOT_TOKENS.primary) {
        try {
            const primaryBot = new TelegramBot(BOT_TOKENS.primary, { polling: true });
            await primaryBot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});
            
            bots.set('primary', primaryBot);
            botStatus.set('primary', { connected: true, token: BOT_TOKENS.primary.substring(0, 10) + '...' });
            logInfo('MULTI-BOT', '✅', 'Bot primario inicializado');
        } catch (err) {
            logError('MULTI-BOT', '❌', 'Error inicializando bot primario', err);
            botStatus.set('primary', { connected: false, error: err.message });
        }
    }

    // Bot secundario
    if (BOT_TOKENS.secondary) {
        try {
            const secondaryBot = new TelegramBot(BOT_TOKENS.secondary, { polling: true });
            await secondaryBot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});
            
            bots.set('secondary', secondaryBot);
            botStatus.set('secondary', { connected: true, token: BOT_TOKENS.secondary.substring(0, 10) + '...' });
            logInfo('MULTI-BOT', '✅', 'Bot secundario inicializado');
        } catch (err) {
            logError('MULTI-BOT', '❌', 'Error inicializando bot secundario', err);
            botStatus.set('secondary', { connected: false, error: err.message });
        }
    }

    logInfo('MULTI-BOT', '📊', `Bots inicializados: ${bots.size}/2`);
}

/**
 * Obtiene el bot apropiado para un comando específico
 * @param {string} command - Comando o callback_data
 * @returns {TelegramBot} - Instancia del bot a usar
 */
function getBotForCommand(command) {
    const botKey = COMMAND_BOT_MAPPING[command] || 'primary';
    
    // Si el bot solicitado no está disponible, usar el primario
    if (!bots.has(botKey) || !botStatus.get(botKey)?.connected) {
        logInfo('MULTI-BOT', '⚠️', `Bot ${botKey} no disponible, usando primario`, { command });
        return bots.get('primary');
    }
    
    logInfo('MULTI-BOT', '🎯', `Comando "${command}" enrutado a bot ${botKey}`);
    return bots.get(botKey);
}

/**
 * Obtiene el bot primario (para compatibilidad)
 */
function getPrimaryBot() {
    return bots.get('primary');
}

/**
 * Obtiene el bot secundario
 */
function getSecondaryBot() {
    return bots.get('secondary');
}

/**
 * Obtiene todos los bots disponibles
 */
function getAllBots() {
    return bots;
}

/**
 * Obtiene el estado de todos los bots
 */
function getBotStatus() {
    return Object.fromEntries(botStatus);
}

/**
 * Envía un mensaje usando el bot apropiado
 * @param {string} command - Comando para determinar el bot
 * @param {number} chatId - ID del chat
 * @param {string} text - Texto del mensaje
 * @param {Object} options - Opciones adicionales
 */
async function sendMessage(command, chatId, text, options = {}) {
    const bot = getBotForCommand(command);
    return bot.sendMessage(chatId, text, options);
}

/**
 * Envía un documento usando el bot apropiado
 * @param {string} command - Comando para determinar el bot
 * @param {number} chatId - ID del chat
 * @param {Buffer} document - Documento a enviar
 * @param {Object} options - Opciones adicionales
 * @param {Object} fileOptions - Opciones de archivo
 */
async function sendDocument(command, chatId, document, options = {}, fileOptions = {}) {
    const bot = getBotForCommand(command);
    return bot.sendDocument(chatId, document, options, fileOptions);
}

/**
 * Envía una foto usando el bot apropiado
 * @param {string} command - Comando para determinar el bot
 * @param {number} chatId - ID del chat
 * @param {Buffer} photo - Foto a enviar
 * @param {Object} options - Opciones adicionales
 */
async function sendPhoto(command, chatId, photo, options = {}) {
    const bot = getBotForCommand(command);
    return bot.sendPhoto(chatId, photo, options);
}

/**
 * Edita un mensaje usando el bot apropiado
 * @param {string} command - Comando para determinar el bot
 * @param {Object} options - Opciones de edición
 */
async function editMessageText(command, options) {
    const bot = getBotForCommand(command);
    return bot.editMessageText(options);
}

/**
 * Responde a un callback query usando el bot apropiado
 * @param {string} command - Comando para determinar el bot
 * @param {string} callbackQueryId - ID del callback query
 */
async function answerCallbackQuery(command, callbackQueryId) {
    const bot = getBotForCommand(command);
    return bot.answerCallbackQuery(callbackQueryId).catch(() => {});
}

/**
 * Detiene todos los bots
 */
async function stopAllBots() {
    logInfo('MULTI-BOT', '🛑', 'Deteniendo todos los bots...');
    
    for (const [key, bot] of bots.entries()) {
        try {
            await bot.stopPolling();
            logInfo('MULTI-BOT', '✅', `Bot ${key} detenido`);
        } catch (err) {
            logError('MULTI-BOT', '❌', `Error deteniendo bot ${key}`, err);
        }
    }
}

module.exports = {
    initializeBots,
    getBotForCommand,
    getPrimaryBot,
    getSecondaryBot,
    getAllBots,
    getBotStatus,
    sendMessage,
    sendDocument,
    sendPhoto,
    editMessageText,
    answerCallbackQuery,
    stopAllBots
};
