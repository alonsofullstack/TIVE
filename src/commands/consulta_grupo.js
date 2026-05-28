/**
 * CONSULTA AL GRUPO — reenvía comandos al grupo y devuelve la respuesta
 * 
 * Uso: cualquier comando que empiece con / y tenga parámetros
 * Ejemplo: /tive ABC123 → se manda al grupo → respuesta se reenvía al usuario
 */

const { logInfo, logError } = require('../utils/logger');
const { consultarEnGrupo, reenviarRespuestas } = require('../services/userbotService');

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

            const procesando = await bot.sendMessage(chatId,
                `⏳ Consultando... espera un momento.`
            );

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
