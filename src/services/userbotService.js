/**
 * USERBOT SERVICE — GramJS
 * Actúa como usuario real en el grupo para hacer consultas
 * y reenviar las respuestas al usuario que consultó en el bot.
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { logInfo, logError } = require('../utils/logger');

const { TELEGRAM_API_ID, TELEGRAM_API_HASH } = require('../config');
const API_ID   = TELEGRAM_API_ID;
const API_HASH = TELEGRAM_API_HASH;

const TIMEOUT_MS   = 30000;
const WAIT_MORE_MS = 4000;

let client        = null;
let isReady       = false;
let grupoEntityId = null;

const pendingQueries = new Map();

// ── Inicialización ────────────────────────────────────────────────────────────

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

        const grupoIdRaw = process.env.GRUPO_CONSULTAS_ID;
        const grupoIdNum = Math.abs(parseInt(grupoIdRaw));

        logInfo('USERBOT', '🔍', `Buscando grupo ID: ${grupoIdRaw}`);
        const dialogs = await client.getDialogs({ limit: 200 });
        const dialog  = dialogs.find(d => Math.abs(parseInt(d.id?.toString() || '0')) === grupoIdNum);

        if (!dialog) {
            logError('USERBOT', '❌', `Grupo no encontrado. IDs disponibles:`);
            dialogs.filter(d => d.isGroup || d.isChannel).forEach(d =>
                logInfo('USERBOT', '📋', `${d.title} → ${d.id}`)
            );
            return;
        }

        grupoEntityId = dialog.inputEntity || dialog.entity || dialog.id;
        logInfo('USERBOT', '📌', `Grupo listo`, { titulo: dialog.title });

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

    } catch (err) {
        logError('USERBOT', '❌', 'Error iniciando userbot', err);
        isReady = false;
        logInfo('USERBOT', '🔄', 'Reintentando en 30 segundos...');
        setTimeout(() => iniciarUserbot(), 30000);
    }
}

// ── Consulta normal al grupo ──────────────────────────────────────────────────

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

// ── Helpers de texto ──────────────────────────────────────────────────────────

function limpiarTexto(texto) {
    if (!texto) return texto;
    return texto
        .replace(/\[#SELENE_BOT\]/gi, '[#ORION_BOT]')
        .replace(/#SELENE_BOT/gi, '#ORION_BOT')
        .replace(/SELENE BOT/gi, 'ORION BOT')
        .replace(/SELENE/gi, 'ORION')
        .replace(/CREDITOS\s*.+(\n|$)/gi, '')
        .replace(/CRÉDITOS\s*.+(\n|$)/gi, '')
        .replace(/USUARIO\s*.+(\n|$)/gi, '')
        .replace(/\[\s*⚡\s*\]\s*ESTADO DE CUENTA[\s\S]*?(\n\n|$)/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function esMensajeUtil(msg) {
    const texto = (msg.message || '').toLowerCase();
    const ignorar = [
        'estamos procesando', 'un momento por favor', 'bienvenido',
        'procesando tu solicitud', '[ ⏳ ]', '[ 🔄 ]',
    ];
    for (const frase of ignorar) {
        if (texto.includes(frase.toLowerCase())) return false;
    }
    if (msg.photo && !texto) return false;
    if (msg.photo && ignorar.some(f => texto.includes(f.toLowerCase()))) return false;
    return true;
}

async function reenviarRespuestas(bot, chatId, mensajes) {
    const utiles = mensajes.filter(esMensajeUtil);
    logInfo('USERBOT', '📨', `Mensajes a reenviar`, { total: mensajes.length, utiles: utiles.length });

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
            logError('USERBOT', '❌', 'Error reenviando mensaje', err);
        }
    }
}

// ── Exploración del panel /cmds ───────────────────────────────────────────────

/**
 * Espera mensajes nuevos del grupo durante timeoutMs.
 * Reinicia el timer waitMoreMs cada vez que llega un mensaje.
 */
function _esperarMensajesGrupo(grupoIdNum, timeoutMs, waitMoreMs) {
    return new Promise((resolve) => {
        const mensajes  = [];
        let waitTimer   = null;
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

/**
 * Hace click en un botón inline (callback) y espera la respuesta.
 */
async function _clickBoton(msgId, botonData, grupoIdNum) {
    const { functions } = require('telegram/tl');
    const promesa = _esperarMensajesGrupo(grupoIdNum, 12000, 2500);
    try {
        await client.invoke(
            new functions.messages.GetBotCallbackAnswerRequest({
                peer:  grupoEntityId,
                msgId: msgId,
                data:  botonData,
            })
        );
    } catch (err) {
        logError('EXPLORAR', '❌', 'Error invocando callback', err);
    }
    return promesa;
}

/**
 * Explora el panel /cmds del grupo completo:
 *  1. Envía /cmds → captura el mensaje con botones de categorías
 *  2. Click en cada categoría → captura texto de la página 1
 *  3. Navega con → hasta agotar las páginas
 *  4. Devuelve { tieneBotones, botones, categorias: { nombre: [textos] } }
 */
async function explorarCmdsGrupo() {
    if (!isReady || !client || !grupoEntityId) {
        throw new Error('Userbot no está conectado o grupo no resuelto');
    }

    const grupoIdNum = Math.abs(parseInt(process.env.GRUPO_CONSULTAS_ID));
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── Paso 1: Enviar /cmds ─────────────────────────────────────────────────
    logInfo('EXPLORAR', '📤', 'Enviando /cmds al grupo...');
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
            const esNav  = IGNORAR_BTN.some(ig => nombre.toLowerCase().includes(ig));
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
            // Buscamos el mensaje con contenido (texto + posibles botones de paginación)
            let msgActual = respuestas.find(m => m.message && m.message.length > 10) || null;

            if (!msgActual) {
                // El bot editó el mensaje original — intentar obtenerlo
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

module.exports = { iniciarUserbot, consultarEnGrupo, reenviarRespuestas, explorarCmdsGrupo };
