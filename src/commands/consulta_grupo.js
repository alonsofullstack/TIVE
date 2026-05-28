/**
 * CONSULTA AL GRUPO — reenvía comandos al grupo y devuelve la respuesta
 * 
 * Uso: cualquier comando que empiece con / y tenga parámetros
 * Ejemplo: /tive ABC123 → se manda al grupo → respuesta se reenvía al usuario
 */

const { logInfo, logError } = require('../utils/logger');
const { consultarEnGrupo, reenviarRespuestas } = require('../services/userbotService');
const { consumeCredits } = require('../services/clientService');
const { ADMIN_IDS } = require('../config');
const path = require('path');

const CARGA_IMG = path.join(__dirname, '..', '..', 'tarjeta', 'carga.jpg');

// Lista de comandos que se redirigen al grupo
// Agrega o quita según los que tenga el grupo
const COMANDOS_GRUPO = [
    '/fiscanm', '/nm', '/den', '/denuncias', '/denpla',
    '/rqh', '/rq', '/rqv', '/antpolv', '/antjudv', '/jne',
    '/sunat', '/consu', '/reptrib', '/tra', '/suel', '/sueld',
    '/pla', '/revtec', '/revtecpdf', '/hsoat', '/soat',
    '/tive', '/tivep', '/brevete', '/paptrud',
    '/antpen', '/antpol', '/antjud', '/sentinel',
    '/financiero', '/sbs', '/sbsv', '/sbsvp', '/seeker',
    '/sekcel', '/seekerpdf', '/meta', '/sunedu', '/sunedupdf',
    '/cor', '/sis', '/facial', '/migra', '/migrace', '/migra2',
    '/mtc', '/cerjov', '/utp', '/dpm', '/actnac', '/actmat', '/actdef'
];

module.exports = {
    registerCommands(bot, state, deps) {
        bot.on('message', async (msg) => {
            if (!msg.text) return;
            const chatId = msg.chat.id;
            const texto = msg.text.trim();

            // Verificar si el mensaje empieza con algún comando del grupo
            const esComandoGrupo = COMANDOS_GRUPO.some(cmd =>
                texto.toLowerCase().startsWith(cmd.toLowerCase())
            );
            if (!esComandoGrupo) return;

            logInfo('CONSULTA', '🔍', `Consulta al grupo`, { chatId, comando: texto });

            // ── Guard de créditos ────────────────────────────────────────
            if (!ADMIN_IDS.includes(String(msg.from.id))) {
                const credit = consumeCredits(msg.from.id, 'consulta_grupo');
                if (credit.error === 'no_registered') {
                    return bot.sendMessage(chatId,
                        `🚫 *Acceso Denegado*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `No estás registrado. Usa /register para crear tu cuenta.`,
                        { parse_mode: 'Markdown' }
                    );
                }
                if (credit.error === 'no_credits') {
                    return bot.sendMessage(chatId,
                        `💳 *Sin Créditos*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `No tienes créditos para realizar consultas.\n` +
                        `Saldo actual: \`0\`\n\n` +
                        `Contacta al administrador para recargar.`,
                        { parse_mode: 'Markdown' }
                    );
                }
                if (credit.ok && credit.remaining <= 3 && credit.remaining > 0) {
                    bot.sendMessage(chatId,
                        `⚠️ _Saldo bajo: te quedan \`${credit.remaining}\` crédito(s)._`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                }
            }

            const procesando = await bot.sendPhoto(chatId, CARGA_IMG, {
                caption: `⏳ *Procesando tu solicitud...*`,
                parse_mode: 'Markdown'
            });

            try {
                const respuestas = await consultarEnGrupo(texto);

                if (respuestas.length === 0) {
                    await bot.sendMessage(chatId, '⚠️ No se recibió respuesta del grupo.');
                    return;
                }

                logInfo('CONSULTA', '✅', `Respuestas recibidas`, { cantidad: respuestas.length });
                await reenviarRespuestas(bot, chatId, respuestas);

            } catch (err) {
                logError('CONSULTA', '❌', 'Error en consulta al grupo', err);
                await bot.sendMessage(chatId,
                    `❌ Error al consultar: ${err.message}`
                );
            } finally {
                // Borrar el mensaje "Consultando..."
                bot.deleteMessage(chatId, procesando.message_id).catch(() => {});
            }
        });
    }
};
