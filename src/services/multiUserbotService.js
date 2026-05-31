const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { logInfo, logError } = require('../utils/logger');
const { USERBOT_SESSIONS, QUERY_DELAY, COMMAND_USERBOT_MAPPING, USERBOT_DESTINATIONS } = require('../config');

const API_ID   = 33222502;
const API_HASH = 'b2f2a2532045bb4b928082ab7243d8a6';

const TIMEOUT_MS   = 30000;
const WAIT_MORE_MS = 4000;

const clients = new Map();
const isReady = new Map();
const destinationEntities = new Map(); // Puede ser grupo o bot
const destinationTypes = new Map(); // 'group' o 'bot'
const pendingQueries = new Map();

let currentSessionIndex = 0;

/**
 * Inicializa múltiples sesiones de userbot
 */
async function initializeMultiUserbot() {
    logInfo('MULTI-USERBOT', '🚀', 'Inicializando múltiples sesiones de userbot...');

    const sessions = [
        { key: 'primary', session: USERBOT_SESSIONS.primary, destination: USERBOT_DESTINATIONS.primary },
        { key: 'secondary', session: USERBOT_SESSIONS.secondary, destination: USERBOT_DESTINATIONS.secondary }
    ];

    for (const { key, session, destination } of sessions) {
        if (!session) {
            logInfo('MULTI-USERBOT', '⚠️', `Sesión ${key} no configurada, omitiendo`);
            continue;
        }

        if (!destination || !destination.type) {
            logInfo('MULTI-USERBOT', '⚠️', `Destino para sesión ${key} no configurado, omitiendo`);
            continue;
        }

        try {
            const sessionStr = session.replace(/\\/g, '');
            const client = new TelegramClient(
                new StringSession(sessionStr),
                API_ID,
                API_HASH,
                { connectionRetries: 5, retryDelay: 2000 }
            );

            await client.connect();
            const me = await client.getMe();
            logInfo('MULTI-USERBOT', '👤', `Sesión ${key} autenticada`, { 
                nombre: me.firstName, 
                username: me.username, 
                id: me.id?.toString() 
            });

            clients.set(key, client);
            isReady.set(key, true);
            destinationTypes.set(key, destination.type);

            if (destination.type === 'group') {
                // Resolver grupo
                const grupoIdRaw = destination.id;
                const grupoIdNum = Math.abs(parseInt(grupoIdRaw));

                logInfo('MULTI-USERBOT', '🔍', `Sesión ${key} buscando grupo ID: ${grupoIdRaw}`);
                const dialogs = await client.getDialogs({ limit: 200 });
                const dialog = dialogs.find(d => Math.abs(parseInt(d.id?.toString() || '0')) === grupoIdNum);

                if (dialog) {
                    destinationEntities.set(key, dialog.inputEntity || dialog.entity || dialog.id);
                    logInfo('MULTI-USERBOT', '📌', `Sesión ${key} grupo listo`, { titulo: dialog.title, grupoId: grupoIdRaw });

                    // Agregar event handler para esta sesión
                    client.addEventHandler(async (event) => {
                        try {
                            const msg = event.message;
                            if (!msg) return;
                            const msgChatId = Math.abs(parseInt(msg.chatId?.toString() || msg.peerId?.channelId?.toString() || '0'));
                            if (msgChatId !== grupoIdNum) return;

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
                        } catch (_) {}
                    }, new NewMessage({}));
                } else {
                    logError('MULTI-USERBOT', '❌', `Sesión ${key} grupo no encontrado (ID: ${grupoIdRaw})`);
                    isReady.set(key, false);
                }
            } else if (destination.type === 'bot') {
                // Resolver bot por username
                const botUsername = destination.username.replace('@', '');
                logInfo('MULTI-USERBOT', '🔍', `Sesión ${key} buscando bot: @${botUsername}`);
                
                try {
                    const botEntity = await client.getEntity(botUsername);
                    destinationEntities.set(key, botEntity);
                    logInfo('MULTI-USERBOT', '📌', `Sesión ${key} bot listo`, { username: botUsername });

                    // Agregar event handler para esta sesión (respuestas del bot)
                    client.addEventHandler(async (event) => {
                        try {
                            const msg = event.message;
                            if (!msg) return;
                            const senderId = msg.senderId?.userId?.toString() || msg.senderId?.userId?.toString();
                            const botId = botEntity.id?.toString();
                            
                            // Verificar que el mensaje sea del bot
                            if (senderId !== botId) return;

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
                        } catch (_) {}
                    }, new NewMessage({}));
                } catch (err) {
                    logError('MULTI-USERBOT', '❌', `Sesión ${key} bot no encontrado (@${botUsername})`, err);
                    isReady.set(key, false);
                }
            }

        } catch (err) {
            logError('MULTI-USERBOT', '❌', `Error iniciando sesión ${key}`, err);
            isReady.set(key, false);
        }
    }

    const activeSessions = Array.from(isReady.entries()).filter(([_, ready]) => ready).length;
    logInfo('MULTI-USERBOT', '📊', `Sesiones activas: ${activeSessions}/${sessions.length}`);
}

/**
 * Obtiene la sesión apropiada para un comando específico
 * @param {string} comando - Comando para determinar la sesión
 */
function getSessionForCommand(comando) {
    // Extraer el comando base (ej: "/dni 12345678" -> "/dni")
    const comandoBase = comando.split(' ')[0].toLowerCase();
    
    // Verificar si hay un mapeo específico para este comando
    const mappedSession = COMMAND_USERBOT_MAPPING[comandoBase];
    
    if (mappedSession === 'secondary') {
        const sessionKey = 'secondary';
        if (isReady.get(sessionKey)) {
            logInfo('MULTI-USERBOT', '🎯', `Comando "${comandoBase}" enrutado a sesión secundaria`);
            return sessionKey;
        } else {
            logInfo('MULTI-USERBOT', '⚠️', `Sesión secundaria no disponible, usando round-robin`);
        }
    }
    
    // Usar round-robin por defecto
    return getNextSession();
}

/**
 * Obtiene la siguiente sesión disponible (round-robin)
 */
function getNextSession() {
    const activeSessions = Array.from(isReady.entries())
        .filter(([_, ready]) => ready)
        .map(([key, _]) => key);

    if (activeSessions.length === 0) {
        return null;
    }

    const sessionKey = activeSessions[currentSessionIndex % activeSessions.length];
    currentSessionIndex++;
    
    logInfo('MULTI-USERBOT', '🎯', `Usando sesión: ${sessionKey}`, {
        index: currentSessionIndex,
        total: activeSessions.length
    });

    return sessionKey;
}

/**
 * Consulta en el destino (grupo o bot) usando la sesión apropiada para el comando
 * @param {string} comando - Comando a enviar
 */
async function consultarEnGrupo(comando) {
    const sessionKey = getSessionForCommand(comando);
    
    if (!sessionKey) {
        throw new Error('No hay sesiones de userbot disponibles');
    }

    const client = clients.get(sessionKey);
    const destinationEntity = destinationEntities.get(sessionKey);
    const destinationType = destinationTypes.get(sessionKey);

    if (!client || !destinationEntity) {
        throw new Error(`Sesión ${sessionKey} no está conectada o destino no resuelto`);
    }

    const queryKey = `${sessionKey}_${Date.now()}_${Math.random()}`;

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
                    const destName = destinationType === 'bot' ? 'bot' : 'grupo';
                    reject(new Error(`Timeout: el ${destName} no respondió`));
                }
            }
        }, TIMEOUT_MS);

        pendingQueries.set(queryKey, pending);

        try {
            await client.sendMessage(destinationEntity, { message: comando });
            const destName = destinationType === 'bot' ? 'bot' : 'grupo';
            logInfo('MULTI-USERBOT', '📤', `Comando enviado al ${destName} vía sesión ${sessionKey}`, { comando });
        } catch (err) {
            clearTimeout(timeoutTimer);
            pendingQueries.delete(queryKey);
            reject(err);
        }
    });
}

/**
 * Reenvía respuestas usando el bot principal
 */
async function reenviarRespuestas(bot, chatId, mensajes) {
    const { limpiarTexto, esMensajeUtil } = require('./userbotService');
    const sessionKey = getNextSession();
    const client = clients.get(sessionKey);

    if (!client) {
        throw new Error('No hay sesión de userbot disponible para descargar medios');
    }

    const utiles = mensajes.filter(esMensajeUtil);
    logInfo('MULTI-USERBOT', '📨', `Mensajes a reenviar`, { total: mensajes.length, utiles: utiles.length });

    for (const msg of utiles) {
        try {
            const caption = limpiarTexto(msg.message || '');
            if (msg.photo) {
                const photoBuffer = await client.downloadMedia(msg);
                if (photoBuffer) await bot.sendPhoto(chatId, Buffer.from(photoBuffer), { caption });
            } else if (msg.document) {
                const docBuffer = await client.downloadMedia(msg);
                if (docBuffer) {
                    const fileName = msg.document.attributes?.find(a => a.fileName)?.fileName || 'archivo';
                    const cleanFileName = fileName.replace(/selene/gi, 'ORION');
                    await bot.sendDocument(chatId, Buffer.from(docBuffer), { caption }, { filename: cleanFileName });
                }
            } else if (msg.message) {
                await bot.sendMessage(chatId, limpiarTexto(msg.message));
            }
        } catch (err) {
            logError('MULTI-USERBOT', '❌', 'Error reenviando mensaje', err);
        }
    }
}

/**
 * Obtiene estadísticas de las sesiones
 */
function getSessionStats() {
    return {
        total: clients.size,
        active: Array.from(isReady.values()).filter(v => v).length,
        sessions: Array.from(clients.keys()).map(key => ({
            key,
            ready: isReady.get(key),
            destinationType: destinationTypes.get(key),
            hasDestination: !!destinationEntities.get(key)
        }))
    };
}

/**
 * Explora el panel /cmds del grupo completo:
 *  1. Envía /cmds → captura el mensaje con botones de categorías
 *  2. Click en cada categoría → captura texto de la página 1
 *  3. Navega con → hasta agotar las páginas
 *  4. Devuelve { tieneBotones, botones, categorias: { nombre: [textos] } }
 */
async function explorarCmdsGrupo() {
    const sessionKey = getNextSession();
    
    if (!sessionKey) {
        throw new Error('No hay sesiones de userbot disponibles');
    }

    const client = clients.get(sessionKey);
    const grupoEntityId = grupoEntityIds.get(sessionKey);

    if (!client || !grupoEntityId) {
        throw new Error(`Sesión ${sessionKey} no está conectada o grupo no resuelto`);
    }

    const grupoIdNum = Math.abs(parseInt(process.env.GRUPO_CONSULTAS_ID));
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── Paso 1: Enviar /cmds ─────────────────────────────────────────────────
    logInfo('EXPLORAR', '📤', `Enviando /cmds al grupo vía sesión ${sessionKey}...`);
    
    function _esperarMensajesGrupo(grupoIdNum, timeoutMs, waitMoreMs) {
        return new Promise((resolve) => {
            const mensajes = [];
            let waitTimer = null;
            let timeoutTimer = null;

            const finish = () => {
                clearTimeout(timeoutTimer);
                if (waitTimer) clearTimeout(waitTimer);
                client.removeEventHandler(handler);
                resolve(mensajes);
            };

            const handler = async (event) => {
                const msg = event.message;
                if (!msg) return;
                const msgChatId = Math.abs(parseInt(msg.chatId?.toString() || msg.peerId?.channelId?.toString() || '0'));
                if (msgChatId !== grupoIdNum) return;
                mensajes.push(msg);
                if (waitTimer) clearTimeout(waitTimer);
                waitTimer = setTimeout(finish, waitMoreMs);
            };

            timeoutTimer = setTimeout(finish, timeoutMs);
            client.addEventHandler(handler, new NewMessage({}));
        });
    }

    async function _clickBoton(msgId, botonData, grupoIdNum) {
        const { functions } = require('telegram/tl');
        const promesa = _esperarMensajesGrupo(grupoIdNum, 12000, 2500);
        try {
            await client.invoke(
                new functions.messages.GetBotCallbackAnswerRequest({
                    peer: grupoEntityId,
                    msgId: msgId,
                    data: botonData,
                })
            );
        } catch (err) {
            logError('EXPLORAR', '❌', 'Error invocando callback', err);
        }
        return promesa;
    }

    const promesa1 = _esperarMensajesGrupo(grupoIdNum, 20000, 4000);
    await client.sendMessage(grupoEntityId, { message: '/cmds' });
    const mensajesInicio = await promesa1;

    if (mensajesInicio.length === 0) throw new Error('El grupo no respondió a /cmds');

    const mensajePrincipal = mensajesInicio.find(m => m.replyMarkup?.rows?.length > 0);
    if (!mensajePrincipal) {
        return {
            tieneBotones: false,
            textos: mensajesInicio.map(m => m.message || '').filter(Boolean),
        };
    }

    // Extraer botones de categoría (ignorar navegación)
    const IGNORAR_BTN = ['regresar', 'comprar', 'menu', 'volver', 'inicio'];
    const botonesCategorias = [];
    for (const row of mensajePrincipal.replyMarkup.rows) {
        for (const btn of row.buttons) {
            const nombre = (btn.text || '').replace(/[\[\]]/g, '').trim();
            const esNav = IGNORAR_BTN.some(ig => nombre.toLowerCase().includes(ig));
            if (!esNav && btn.data) {
                botonesCategorias.push({ nombre, data: btn.data });
            }
        }
    }

    logInfo('EXPLORAR', '🔘', `Categorías a explorar: ${botonesCategorias.length}`);

    // ── Paso 2: Click en cada categoría + navegar páginas ───────────────────
    const categorias = {};

    for (const boton of botonesCategorias) {
        const nombre = boton.nombre;
        logInfo('EXPLORAR', '🖱️', `Explorando: "${nombre}"`);
        const textosTotales = [];

        try {
            // Click en la categoría
            const respuestas = await _clickBoton(mensajePrincipal.id, boton.data, grupoIdNum);
            await sleep(800);

            // El bot puede editar el mensaje principal o enviar uno nuevo
            let msgActual = respuestas.find(m => m.message && m.message.length > 10) || null;

            if (!msgActual) {
                logInfo('EXPLORAR', '⚠️', `"${nombre}" sin mensaje nuevo (posible edición)`);
                categorias[nombre] = [];
                await sleep(2000);
                continue;
            }

            if (msgActual.message) textosTotales.push(msgActual.message);

            // ── Navegar páginas con → ────────────────────────────────────────
            const MAX_PAGINAS = 15;
            let pagina = 1;

            while (pagina < MAX_PAGINAS) {
                const markup = msgActual.replyMarkup;
                if (!markup?.rows) break;

                // Buscar botón de siguiente página
                let btnSig = null;
                for (const row of markup.rows) {
                    for (const btn of row.buttons) {
                        const t = (btn.text || '').trim();
                        if ((t === '→' || t === '▶️' || t === '>') && btn.data) {
                            btnSig = btn;
                            break;
                        }
                    }
                    if (btnSig) break;
                }

                if (!btnSig) break; // No hay más páginas

                logInfo('EXPLORAR', '➡️', `"${nombre}" → página ${pagina + 1}`);
                await sleep(1500);

                const respPag = await _clickBoton(msgActual.id, btnSig.data, grupoIdNum);
                await sleep(600);

                const msgPag = respPag.find(m => m.message && m.message.length > 10);
                if (!msgPag) break;
                if (textosTotales.includes(msgPag.message)) break; // Evitar loop

                textosTotales.push(msgPag.message);
                msgActual = msgPag;
                pagina++;
            }

            categorias[nombre] = textosTotales;
            logInfo('EXPLORAR', '✅', `"${nombre}" → ${textosTotales.length} página(s)`);

        } catch (err) {
            logError('EXPLORAR', '❌', `Error en "${nombre}"`, err);
            categorias[nombre] = [];
        }

        await sleep(2500);
    }

    return { tieneBotones: true, botones: botonesCategorias, categorias };
}

module.exports = {
    initializeMultiUserbot,
    consultarEnGrupo,
    reenviarRespuestas,
    explorarCmdsGrupo,
    getSessionStats
};
