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
// Tiempo esperando más mensajes tras recibir el primero (ms)
const WAIT_MORE_MS = 4000;

let client = null;
let isReady = false;
let grupoEntityId = null; // ID numérico del grupo para enviar mensajes

const pendingQueries = new Map();

async function iniciarUserbot() {
    const sessionStr = (process.env.TELEGRAM_SESSION || '').replace(/\\/g, '');
    if (!sessionStr) {
        logError('USERBOT', '❌', 'No hay TELEGRAM_SESSION en .env — userbot desactivado');
        return;
    }
    logInfo('USERBOT', '🔑', `Sesión cargada`, { longitud: sessionStr.length });

    try {
        client = new TelegramClient(
            new StringSession(sessionStr),
            API_ID,
            API_HASH,
            { connectionRetries: 5, retryDelay: 2000 }
        );

        await client.connect();

        const me = await client.getMe();
        logInfo('USERBOT', '👤', `Autenticado como`, { nombre: me.firstName, username: me.username, id: me.id?.toString() });

        isReady = true;
        logInfo('USERBOT', '✅', 'Userbot conectado correctamente');

        // Resolver el grupo buscando en diálogos
        const grupoIdRaw = process.env.GRUPO_CONSULTAS_ID; // -1003854880657
        const grupoIdNum = Math.abs(parseInt(grupoIdRaw));

        logInfo('USERBOT', '🔍', `Buscando grupo ID: ${grupoIdRaw}`);
        const dialogs = await client.getDialogs({ limit: 200 });
        const dialog = dialogs.find(d => {
            const dId = Math.abs(parseInt(d.id?.toString() || '0'));
            return dId === grupoIdNum;
        });

        if (!dialog) {
            logError('USERBOT', '❌', `Grupo no encontrado. IDs disponibles:`);
            dialogs.filter(d => d.isGroup || d.isChannel).forEach(d =>
                logInfo('USERBOT', '📋', `${d.title} → ${d.id}`)
            );
            return;
        }

        grupoEntityId = dialog.inputEntity || dialog.entity || dialog.id;
        logInfo('USERBOT', '📌', `Grupo listo`, { titulo: dialog.title });

        // Escuchar mensajes del grupo — sin filtro de chat para evitar el crash
        client.addEventHandler(async (event) => {
            try {
                const msg = event.message;
                if (!msg) return;

                // Verificar que el mensaje viene del grupo correcto
                const msgChatId = Math.abs(parseInt(msg.chatId?.toString() || msg.peerId?.channelId?.toString() || '0'));
                if (msgChatId !== grupoIdNum) return;

                // Distribuir a consultas pendientes
                for (const [, pending] of pendingQueries.entries()) {
                    if (pending.resolved) continue;
                    pending.messages.push(msg);

                    if (pending.waitTimer) clearTimeout(pending.waitTimer);
                    pending.waitTimer = setTimeout(() => {
                        if (!pending.resolved) {
                            pending.resolved = true;
                            pending.resolve(pending.messages);
                        }
                    }, WAIT_MORE_MS);
                }
            } catch (e) {
                // ignorar errores en el handler
            }
        }, new NewMessage({})); // sin filtro de chats para evitar el crash

    } catch (err) {
        logError('USERBOT', '❌', 'Error iniciando userbot', err);
        isReady = false;
        logInfo('USERBOT', '🔄', 'Reintentando en 30 segundos...');
        setTimeout(() => iniciarUserbot(), 30000);
    }
}

async function consultarEnGrupo(comando) {
    if (!isReady || !client || !grupoEntityId) {
        throw new Error('Userbot no está conectado o grupo no resuelto');
    }

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
            await client.sendMessage(grupoEntityId, { message: comando });
            logInfo('USERBOT', '📤', `Comando enviado al grupo`, { comando });
        } catch (err) {
            clearTimeout(timeoutTimer);
            pendingQueries.delete(queryKey);
            reject(err);
        }
    });
}

/**
 * Limpia y rebrandea el texto del bot Selene → Orion Bot
 */
function limpiarTexto(texto) {
    if (!texto) return texto;

    return texto
        // Reemplazar marca Selene por Orion
        .replace(/\[#SELENE_BOT\]/gi, '[#ORION_BOT]')
        .replace(/#SELENE_BOT/gi, '#ORION_BOT')
        .replace(/SELENE BOT/gi, 'ORION BOT')
        .replace(/SELENE/gi, 'ORION')
        // Ocultar líneas de créditos y usuario
        .replace(/CREDITOS\s*[=⇒➾►:→]+.*(\n|$)/gi, '')
        .replace(/CRÉDITOS\s*[=⇒➾►:→]+.*(\n|$)/gi, '')
        .replace(/USUARIO\s*[=⇒➾►:→]+.*(\n|$)/gi, '')
        .replace(/\[\s*⚡\s*\]\s*ESTADO DE CUENTA.*?(\n\n|\n(?=[A-Z]))/gis, '')
        // Limpiar líneas vacías dobles al final
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Filtra mensajes que no son útiles para reenviar al usuario
 * (mensajes de bienvenida, procesando, etc.)
 */
function esMensajeUtil(msg) {
    const texto = (msg.message || '').toLowerCase();

    // Ignorar mensajes de "procesando" o "bienvenido"
    const ignorar = [
        'estamos procesando',
        'un momento por favor',
        'bienvenido',
        'procesando tu solicitud',
        '[ ⏳ ]',
        '[ 🔄 ]',
    ];

    for (const frase of ignorar) {
        if (texto.includes(frase.toLowerCase())) return false;
    }

    // Si es solo una foto sin texto útil (bienvenida de Selene), ignorar
    if (msg.photo && !texto) return false;
    if (msg.photo && ignorar.some(f => texto.includes(f.toLowerCase()))) return false;

    return true;
}

async function reenviarRespuestas(bot, chatId, mensajes) {
    // Filtrar solo mensajes útiles
    const utiles = mensajes.filter(esMensajeUtil);
    logInfo('USERBOT', '📨', `Mensajes a reenviar`, { total: mensajes.length, utiles: utiles.length });

    for (const msg of utiles) {
        try {
            const caption = limpiarTexto(msg.message || '');

            if (msg.photo) {
                const photoBuffer = await client.downloadMedia(msg);
                if (photoBuffer) {
                    await bot.sendPhoto(chatId, Buffer.from(photoBuffer), { caption });
                }
            } else if (msg.document) {
                const docBuffer = await client.downloadMedia(msg);
                if (docBuffer) {
                    const fileName = msg.document.attributes?.find(a => a.fileName)?.fileName || 'archivo';
                    // Renombrar archivo quitando referencia a Selene
                    const cleanFileName = fileName.replace(/selene/gi, 'ORION');
                    await bot.sendDocument(chatId, Buffer.from(docBuffer), { caption }, { filename: cleanFileName });
                }
            } else if (msg.message) {
                await bot.sendMessage(chatId, limpiarTexto(msg.message));
            }
        } catch (err) {
            logError('USERBOT', '❌', 'Error reenviando mensaje', err);
        }
    }
}

module.exports = { iniciarUserbot, consultarEnGrupo, reenviarRespuestas };
