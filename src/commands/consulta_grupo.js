/**
 * CONSULTA AL GRUPO — reenvía comandos al grupo y devuelve la respuesta
 *
 * Flujo de créditos:
 *   1. Identificar comando y resolver precio
 *   2. Verificar registro + saldo (sin cobrar)
 *   3. Consultar al grupo
 *   4. Cobrar y registrar solo si hay respuesta exitosa
 */

const { logInfo, logError } = require('../utils/logger');
const { consultarEnGrupo, reenviarRespuestas } = require('../services/multiUserbotService');
const { checkCredits, consumeCredits, logQuery } = require('../services/clientService');
const { ADMIN_IDS } = require('../config');
const { categories } = require('./cmds');
const path = require('path');

const CARGA_IMG = path.join(__dirname, '..', '..', 'tarjeta', 'carga.jpg');

// Mapeo dinámico de comandos a precios (desde catálogo /cmds)
const COMMAND_PRICES = {};
for (const catKey in categories) {
    const cat = categories[catKey];
    if (cat && Array.isArray(cat.cmds)) {
        for (const item of cat.cmds) {
            if (item.cmd && typeof item.price === 'number') {
                const matches = item.cmd.match(/\/([a-zA-Z0-9_]+)/g);
                if (matches) {
                    for (const match of matches) {
                        COMMAND_PRICES[match.toLowerCase()] = item.price;
                    }
                }
            }
        }
    }
}

// Precios adicionales para alias del grupo que no están en el catálogo
const EXTRA_PRICES = {
    '/dnis':      1,
    '/dnib':      2,
    '/fab':       30,
    '/movn':      5,
    '/movd':      5,
    '/bitx':      5,
    '/rucn':      3,
    '/rucd':      3,
    '/revtecpdf': 5,
    '/tiv':       20,
    '/c4':        5,
};

// Prioridad máxima — resuelve ambigüedades del catálogo
const PRICE_OVERRIDES = {
    '/const': 30, // Constancia MINSA (médico); estudios también define /const a 15
};

function resolvePrice(matchedCmd) {
    const cmd = matchedCmd.toLowerCase();
    if (PRICE_OVERRIDES[cmd] !== undefined) return PRICE_OVERRIDES[cmd];
    if (COMMAND_PRICES[cmd] !== undefined) return COMMAND_PRICES[cmd];
    if (EXTRA_PRICES[cmd] !== undefined) return EXTRA_PRICES[cmd];
    return 1;
}

// Lista de comandos que se redirigen al grupo
const COMANDOS_GRUPO = [
    // RENIEC (activos que usarán sesión secundaria)
    '/dnis', '/dnib', '/nm', '/fab',
    // RENIEC (otros comandos)
    '/dnim', '/dni', '/dnif', '/dnit', '/dir', '/dnidb', '/dnifdb', '/dnitdb', '/nmdb',
    // TELEFONÍA (activos que usarán sesión secundaria)
    '/movn', '/movd', '/bitx',
    // TELEFONÍA (otros comandos)
    '/telp', '/tel', '/stel', '/cel', '/telpdb', '/claro', '/bitel', '/movistar', '/entel', '/lineas', '/operador',
    // DELITOS
    '/fiscapdf', '/fiscacs', '/fiscanm', '/den', '/denuncias', '/denpla',
    '/rqh', '/rq', '/rqv', '/rqant', '/antpenv', '/antpolv', '/antjudv', '/jne',
    // POLICÍA
    '/pnp',
    // SUNAT (activos que usarán sesión secundaria)
    '/ruc', '/rucn', '/rucd',
    // SUNAT (otros comandos)
    '/sunat', '/consu', '/consumos', '/reptrib', '/tra', '/suel', '/sueld',
    // SUNARP
    '/pro', '/propdf', '/partida',
    // SAT (activos que usarán sesión secundaria)
    '/sat', '/csat',
    // VEHÍCULOS (activos que usarán sesión secundaria)
    '/citv', '/soat', '/hsoat',
    // VEHÍCULOS (otros comandos)
    '/vec', '/pla', '/plat', '/revtec', '/revtecpdf', '/boi',
    '/tive', '/tivep', '/tivev', '/tivevpdf', '/paptrud', '/brevete', '/tiv',
    // GENERADORES (activos que usarán sesión secundaria)
    '/c4', '/dniv',
    // GENERADORES (otros comandos)
    '/c4a', '/c4b', '/c4i', '/dnivel',
    // CERTIFICADOS
    '/antpen', '/antpol', '/antjud',
    // FAMILIARES
    '/ag', '/agv', '/agvp', '/fam', '/her', '/hogar', '/hogardb',
    // FINANCIERO
    '/sentinel', '/financiero', '/sbs', '/sbsv', '/sbsvp',
    // SPAM
    '/spm', '/spm2', '/spm3',
    // SEEKER
    '/seeker', '/sekcel', '/seekerpdf',
    // BAUCHER
    '/yape', '/plin', '/ibk', '/bcp',
    // EXTRAS
    '/meta', '/sunedu', '/sunedupdf', '/cor', '/sis', '/essa2',
    // VIP
    '/facial', '/migra', '/migrace', '/migra2', '/migrace2', '/minedu', '/mtc', '/cerjov', '/ceradu',
    // MUNDIAL
    '/cedula', '/nmv', '/mtel', '/ssn',
    // TEMPORAL
    '/utp', '/dpm',
    // MÉDICO (activos que usarán sesión secundaria)
    '/seg',
    // MÉDICO (otros comandos)
    '/minsa', '/const', '/reminsa', '/cliluz', '/essalud', '/certmed', '/reessalud',
    // ESTUDIOS
    '/notas', '/cadult',
    // MTC
    '/mtcb', '/record',
    // ACTAS
    '/actnac', '/actmat', '/actdef',
];

function matchComando(texto) {
    let matchedCmd = '';
    for (const cmd of COMANDOS_GRUPO) {
        if (texto.toLowerCase().startsWith(cmd.toLowerCase())) {
            if (cmd.length > matchedCmd.length) {
                matchedCmd = cmd.toLowerCase();
            }
        }
    }
    return matchedCmd;
}

async function verificarAcceso(bot, chatId, userId, matchedCmd, price) {
    if (ADMIN_IDS.includes(String(userId))) {
        return { ok: true, isAdmin: true };
    }

    const amountRequired = price > 0 ? price : 1;
    const check = await checkCredits(userId, amountRequired);

    if (check.error === 'no_registered') {
        await bot.sendMessage(chatId,
            `🚫 *Acceso Denegado*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `No estás registrado. Usa /register para crear tu cuenta.`,
            { parse_mode: 'Markdown' }
        );
        return { ok: false };
    }

    if (check.error === 'no_credits') {
        await bot.sendMessage(chatId,
            `💳 *Saldo Operativo Insuficiente*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `La consulta *${matchedCmd}* requiere \`${check.cost}\` crédito(s).\n` +
            `Tu saldo actual es de: \`${check.remaining}\`\n\n` +
            `Recarga créditos con el comando /buy o contacta a tu proveedor.`,
            { parse_mode: 'Markdown' }
        );
        return { ok: false };
    }

    if (!check.ok) {
        await bot.sendMessage(chatId, `❌ Error verificando créditos: ${check.error}`);
        return { ok: false };
    }

    return { ok: true, isAdmin: false, remaining: check.remaining };
}

async function cobrarConsultaExitosa(bot, chatId, userId, matchedCmd, texto, price) {
    if (ADMIN_IDS.includes(String(userId))) {
        logQuery(userId, matchedCmd || 'consulta', texto, 0).catch(() => {});
        return;
    }

    if (price <= 0) {
        logQuery(userId, matchedCmd || 'consulta', texto, 0).catch(() => {});
        return;
    }

    const credit = await consumeCredits(userId, price);

    if (!credit.ok) {
        logError('CONSULTA', '⚠️', 'Respuesta entregada pero falló el cobro de créditos', {
            userId, comando: matchedCmd, error: credit.error
        });
        await bot.sendMessage(chatId,
            `⚠️ _La consulta se completó pero hubo un error al descontar créditos. Contacta al administrador._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
        return;
    }

    logQuery(userId, matchedCmd || 'consulta', texto, credit.cost).catch(() => {});

    if (credit.remaining === 0) {
        bot.sendMessage(chatId,
            `⚠️ _Alerta de Sistema: Has agotado tu saldo operativo. Contacta a tu proveedor._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    } else if (credit.remaining <= 3) {
        bot.sendMessage(chatId,
            `⚠️ _Saldo bajo: te quedan \`${credit.remaining}\` crédito(s)._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }
}

module.exports = {
    registerCommands(bot, state, deps) {
        bot.on('message', async (msg) => {
            if (!msg.text) return;
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const texto = msg.text.trim();

            const esComandoGrupo = COMANDOS_GRUPO.some(cmd =>
                texto.toLowerCase().startsWith(cmd.toLowerCase())
            );
            if (!esComandoGrupo) return;

            const matchedCmd = matchComando(texto);
            const price = resolvePrice(matchedCmd);

            logInfo('CONSULTA', '🔍', `Consulta al grupo`, { chatId, comando: texto, precio: price });

            const acceso = await verificarAcceso(bot, chatId, userId, matchedCmd, price);
            if (!acceso.ok) return;

            const procesando = await bot.sendPhoto(chatId, CARGA_IMG, {
                caption: `⏳ *Procesando tu solicitud...*`,
                parse_mode: 'Markdown'
            });

            try {
                const resultado = await consultarEnGrupo(texto);
                const respuestas = resultado.messages;
                const sessionKey = resultado.sessionKey;

                if (respuestas.length === 0) {
                    await bot.sendMessage(chatId,
                        `⚠️ No se recibió respuesta del grupo.\n` +
                        `_No se descontaron créditos._`,
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }

                logInfo('CONSULTA', '✅', `Respuestas recibidas`, { cantidad: respuestas.length, sessionKey });
                await reenviarRespuestas(bot, chatId, respuestas, sessionKey);
                await cobrarConsultaExitosa(bot, chatId, userId, matchedCmd, texto, price);

            } catch (err) {
                logError('CONSULTA', '❌', 'Error en consulta al grupo', err);
                await bot.sendMessage(chatId,
                    `❌ Error al consultar: ${err.message}\n` +
                    `_No se descontaron créditos._`,
                    { parse_mode: 'Markdown' }
                );
            } finally {
                bot.deleteMessage(chatId, procesando.message_id).catch(() => {});
            }
        });
    }
};