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
    // RENIEC
    '/dnim', '/dni', '/dnif', '/dnit', '/nm', '/dir', '/dnidb', '/dnifdb', '/dnitdb', '/nmdb',
    // TELEFONÍA
    '/telp', '/tel', '/stel', '/cel', '/telpdb', '/claro', '/bitel', '/movistar', '/entel', '/lineas', '/operador',
    // DELITOS
    '/fiscapdf', '/fiscacs', '/fiscanm', '/den', '/denuncias', '/denpla',
    '/rqh', '/rq', '/rqv', '/rqant', '/antpenv', '/antpolv', '/antjudv', '/jne',
    // POLICÍA
    '/pnp',
    // SUNAT
    '/ruc', '/sunat', '/consu', '/consumos', '/reptrib', '/tra', '/suel', '/sueld',
    // SUNARP
    '/pro', '/propdf', '/partida',
    // VEHÍCULOS
    '/vec', '/pla', '/plat', '/revtec', '/revtecpdf', '/boi',
    '/hsoat', '/soat', '/tive', '/tivep', '/tivev', '/tivevpdf', '/paptrud', '/brevete',
    // GENERADORES
    '/c4a', '/c4b', '/c4i', '/dniv', '/dnivel',
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
    // MÉDICO
    '/minsa', '/const', '/reminsa', '/cliluz', '/essalud', '/certmed', '/reessalud',
    // ACTAS
    '/actnac', '/actmat', '/actdef',
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
