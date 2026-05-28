/**
 * USERBOT SERVICE — GramJS
 * Actúa como usuario real en el grupo para hacer consultas
 * y reenviar las respuestas al usuario que consultó en el bot.
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { logInfo, logError } = require('../utils/logger');

const API_ID = 33222502;
const API_HASH = 'b2f2a2532045bb4b928082ab7243d8a6';

// Tiempo máximo esperando respuesta del bot del grupo (ms)
const TIMEOUT_MS = 30000;
// Tiempo mínimo esperando más mensajes tras recibir el primero (ms)
// por si el bot del grupo manda varios mensajes seguidos
const WAIT_MORE_MS = 4000;

let client = null;
let isReady = false;

// Cola de consultas pendientes: Map<messageId_en_grupo, { resolve, timer }>
const pendingQueries = new Map();

async function iniciarUserbot() {
    const sessionStr = process.env.TELEGRAM_SESSION || '';
    if (!sessionStr) {
        logError('USERBOT', '❌', 'No hay TELEGRAM_SESSION en .env — userbot desactivado');
        return;
    }

    try {
        client = new TelegramClient(
            new StringSession(sessionStr),
            API_ID,
            API_HASH,
            { connectionRetries: 5, retryDelay: 2000 }
        );

        await client.connect();
        isReady = true;
        logInfo('USERBOT', '✅', 'Userbot conectado correctamente');

        // Escuchar mensajes nuevos en el grupo de consultas
        const grupoId = parseInt(process.env.GRUPO_CONSULTAS_ID);
        client.addEventHandler(async (event) => {
            const msg = event.message;
            if (!msg || !msg.senderId) return;

            // Buscar si hay alguna consulta pendiente esperando respuesta
            for (const [queryKey, pending] of pendingQueries.entries()) {
                if (pending.resolved) continue;
                pending.messages.push(msg);

                // Reiniciar el timer de "esperar más mensajes"
                if (pending.waitTimer) clearTimeout(pending.waitTimer);
                pending.waitTimer = setTimeout(() => {
                    if (!pending.resolved) {
                        pending.resolved = true;
                        pending.resolve(pending.messages);
                    }
                }, WAIT_MORE_MS);
            }
        }, new NewMessage({ chats: [grupoId] }));

    } catch (err) {
        logError('USERBOT', '❌', 'Error iniciando userbot', err);
        isReady = false;
    }
}

/**
 * Envía un comando al grupo y espera la(s) respuesta(s)
 * @param {string} comando - ej: "/tive ABC123"
 * @returns {Promise<Array>} - array de mensajes recibidos
 */
async function consultarEnGrupo(comando) {
    if (!isReady || !client) {
        throw new Error('Userbot no está conectado');
    }

    const grupoId = parseInt(process.env.GRUPO_CONSULTAS_ID);
    const queryKey = `${Date.now()}_${Math.random()}`;

    return new Promise(async (resolve, reject) => {
        const pending = {
            messages: [],
            resolved: false,
            waitTimer: null,
            resolve: (msgs) => {
                pendingQueries.delete(queryKey);
                resolve(msgs);
            }
        };

        // Timeout máximo
        const timeoutTimer = setTimeout(() => {
            if (!pending.resolved) {
                pending.resolved = true;
                pendingQueries.delete(queryKey);
                if (pending.messages.length > 0) {
                    resolve(pending.messages);
                } else {
                    reject(new Error('Timeout: el bot del grupo no respondió'));
                }
            }
        }, TIMEOUT_MS);

        pendingQueries.set(queryKey, pending);

        try {
            await client.sendMessage(grupoId, { message: comando });
            logInfo('USERBOT', '📤', `Comando enviado al grupo`, { comando });
        } catch (err) {
            clearTimeout(timeoutTimer);
            pendingQueries.delete(queryKey);
            reject(err);
        }
    });
}

/**
 * Reenvía los mensajes recibidos del grupo al usuario en el bot
 * @param {object} bot - instancia del bot de Telegram
 * @param {number} chatId - ID del usuario que consultó
 * @param {Array} mensajes - mensajes recibidos del grupo
 */
async function reenviarRespuestas(bot, chatId, mensajes) {
    const grupoId = parseInt(process.env.GRUPO_CONSULTAS_ID);

    for (const msg of mensajes) {
        try {
            if (msg.photo) {
                // Es una foto
                const photoBuffer = await client.downloadMedia(msg, { outputFile: Buffer });
                await bot.sendPhoto(chatId, photoBuffer, {
                    caption: msg.message || ''
                });
            } else if (msg.document) {
                // Es un documento/archivo
                const docBuffer = await client.downloadMedia(msg, { outputFile: Buffer });
                const fileName = msg.document.attributes?.find(a => a.fileName)?.fileName || 'archivo';
                await bot.sendDocument(chatId, docBuffer, {
                    caption: msg.message || ''
                }, { filename: fileName });
            } else if (msg.message) {
                // Es texto
                await bot.sendMessage(chatId, msg.message);
            }
        } catch (err) {
            logError('USERBOT', '❌', 'Error reenviando mensaje', err);
        }
    }
}

module.exports = { iniciarUserbot, consultarEnGrupo, reenviarRespuestas };
