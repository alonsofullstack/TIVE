/**
 * CONSULTA AL GRUPO — reenvía comandos al grupo y devuelve la respuesta.
 * Créditos: reserva atómica → consulta → confirmar o reembolsar.
 */

const { logInfo, logError } = require('../utils/logger');
const { consultarEnGrupo, reenviarRespuestas } = require('../services/multiUserbotService');
const { consumeCredits, refundCredits, logQuery } = require('../services/clientService');
const { resolveCommandPrice } = require('../pricing');
const { ADMIN_IDS } = require('../config');
const { escapeMarkdown } = require('../utils/helpers');
const { checkRateLimit } = require('../services/rateLimiter');
const path = require('path');

const CARGA_IMG = path.join(__dirname, '..', '..', 'tarjeta', 'carga.jpg');

const COMANDOS_GRUPO = [
    '/dnis', '/dnib', '/nm', '/fab',
    '/dnim', '/dni', '/dnif', '/dnit', '/dir', '/dnidb', '/dnifdb', '/dnitdb', '/nmdb',
    '/movn', '/movd', '/bitx',
    '/telp', '/tel', '/stel', '/cel', '/telpdb', '/claro', '/bitel', '/movistar', '/entel', '/lineas', '/operador',
    '/fiscapdf', '/fiscacs', '/fiscanm', '/den', '/denuncias', '/denpla',
    '/rqh', '/rq', '/rqv', '/rqant', '/antpenv', '/antpolv', '/antjudv', '/jne',
    '/pnp',
    '/ruc', '/rucn', '/rucd',
    '/sunat', '/consu', '/consumos', '/reptrib', '/tra', '/suel', '/sueld',
    '/pro', '/propdf', '/partida',
    '/sat', '/csat',
    '/citv', '/soat', '/hsoat',
    '/vec', '/pla', '/plat', '/revtec', '/revtecpdf', '/boi',
    '/tive', '/tivep', '/tivev', '/tivevpdf', '/paptrud', '/brevete', '/tiv',
    '/c4', '/dniv', '/c4a', '/c4b', '/c4i', '/dnivel',
    '/antpen', '/antpol', '/antjud',
    '/ag', '/agv', '/agvp', '/fam', '/her', '/hogar', '/hogardb',
    '/sentinel', '/financiero', '/sbs', '/sbsv', '/sbsvp',
    '/spm', '/spm2', '/spm3',
    '/seeker', '/sekcel', '/seekerpdf',
    '/yape', '/plin', '/ibk', '/bcp',
    '/meta', '/sunedu', '/sunedupdf', '/cor', '/sis', '/essa2',
    '/facial', '/migra', '/migrace', '/migra2', '/migrace2', '/minedu', '/mtc', '/cerjov', '/ceradu',
    '/cedula', '/nmv', '/mtel', '/ssn',
    '/utp', '/dpm',
    '/seg',
    '/minsa', '/const', '/reminsa', '/cliluz', '/essalud', '/certmed', '/reessalud',
    '/notas', '/cadult', '/mtcb', '/record',
    '/actnac', '/actmat', '/actdef',
];

function matchComando(texto) {
    let matchedCmd = '';
    for (const cmd of COMANDOS_GRUPO) {
        if (texto.toLowerCase().startsWith(cmd.toLowerCase())) {
            if (cmd.length > matchedCmd.length) matchedCmd = cmd.toLowerCase();
        }
    }
    return matchedCmd;
}

function isComandoGrupo(texto) {
    return COMANDOS_GRUPO.some(cmd => texto.toLowerCase().startsWith(cmd.toLowerCase()));
}

async function reservarConsulta(bot, chatId, userId, matchedCmd, price, texto) {
    if (ADMIN_IDS.includes(String(userId))) {
        return { ok: true, isAdmin: true, amount: 0 };
    }

    const amount = price > 0 ? price : 1;
    const result = await consumeCredits(userId, amount);

    if (!result.ok) {
        if (result.error === 'no_registered') {
            await bot.sendMessage(chatId,
                `🚫 *Acceso Denegado*\nNo estás registrado. Usa /register.`,
                { parse_mode: 'Markdown' }
            );
        } else if (result.error === 'no_credits') {
            await bot.sendMessage(chatId,
                `💳 *Saldo Insuficiente*\n` +
                `*${matchedCmd}* requiere \`${result.cost}\` crédito(s).\n` +
                `Saldo: \`${result.remaining}\``,
                { parse_mode: 'Markdown' }
            );
        } else {
            await bot.sendMessage(chatId, `❌ Error de créditos: ${escapeMarkdown(String(result.error))}`, { parse_mode: 'Markdown' });
        }
        return { ok: false };
    }

    return { ok: true, amount, remaining: result.remaining, texto };
}

async function confirmarConsulta(bot, chatId, userId, matchedCmd, texto, amount, remaining) {
    if (ADMIN_IDS.includes(String(userId))) {
        logQuery(userId, matchedCmd, texto, 0).catch(() => {});
        return;
    }
    logQuery(userId, matchedCmd, texto, amount).catch(() => {});
    if (remaining === 0) {
        bot.sendMessage(chatId, `⚠️ _Saldo agotado. Contacta a tu proveedor._`, { parse_mode: 'Markdown' }).catch(() => {});
    } else if (remaining <= 3) {
        bot.sendMessage(chatId, `⚠️ _Saldo bajo: \`${remaining}\` crédito(s)._`, { parse_mode: 'Markdown' }).catch(() => {});
    }
}

async function handleConsultaMessage(msg, bot, state) {
    if (!msg.text) return false;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const texto = msg.text.trim();

    if (!isComandoGrupo(texto)) return false;

    if (!checkRateLimit(userId, 'consulta')) {
        await bot.sendMessage(chatId, '⏱️ Espera un momento antes de otra consulta.', { parse_mode: 'Markdown' });
        return true;
    }

    const matchedCmd = matchComando(texto);
    const price = resolveCommandPrice(matchedCmd);

    logInfo('CONSULTA', '🔍', `Consulta al grupo`, { chatId, comando: texto, precio: price });

    const reserva = await reservarConsulta(bot, chatId, userId, matchedCmd, price, texto);
    if (!reserva.ok) return true;

    const procesando = await bot.sendPhoto(chatId, CARGA_IMG, {
        caption: `⏳ *Procesando tu solicitud...*`,
        parse_mode: 'Markdown'
    });

    try {
        const resultado = await consultarEnGrupo(texto);
        const respuestas = resultado.messages;
        const sessionKey = resultado.sessionKey;

        if (respuestas.length === 0) {
            if (!reserva.isAdmin && reserva.amount > 0) {
                await refundCredits(userId, reserva.amount);
            }
            await bot.sendMessage(chatId,
                `⚠️ No se recibió respuesta del grupo.\n_Créditos reembolsados._`,
                { parse_mode: 'Markdown' }
            );
            return true;
        }

        logInfo('CONSULTA', '✅', `Respuestas recibidas`, { cantidad: respuestas.length, sessionKey });
        await reenviarRespuestas(bot, chatId, respuestas, sessionKey);
        await confirmarConsulta(bot, chatId, userId, matchedCmd, texto, reserva.amount, reserva.remaining);

    } catch (err) {
        if (!reserva.isAdmin && reserva.amount > 0) {
            await refundCredits(userId, reserva.amount);
        }
        logError('CONSULTA', '❌', 'Error en consulta al grupo', err);
        await bot.sendMessage(chatId,
            `❌ Error: ${escapeMarkdown(err.message)}\n_Créditos reembolsados._`,
            { parse_mode: 'Markdown' }
        );
    } finally {
        bot.deleteMessage(chatId, procesando.message_id).catch(() => {});
    }

    return true;
}

module.exports = {
    COMANDOS_GRUPO,
    handleConsultaMessage,
    registerCommands() {},
};