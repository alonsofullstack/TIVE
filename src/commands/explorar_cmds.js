/**
 * explorar_cmds.js
 * 
 * Comando /explorar_cmds — solo admin
 * 
 * Hace que el userbot entre al grupo, presione cada botón del panel /cmds,
 * capture todos los comandos reales y los reenvíe al admin organizados por categoría.
 * 
 * Uso: /explorar_cmds
 */

const { logInfo, logError } = require('../utils/logger');
const { explorarCmdsGrupo } = require('../services/userbotService');

module.exports = {
    registerCommands(bot, state, deps) {
        const { ADMIN_IDS } = require('../config');

        bot.onText(/\/explorar_cmds/, async (msg) => {
            if (!ADMIN_IDS.includes(String(msg.from.id))) return;

            const chatId = msg.chat.id;
            logInfo('EXPLORAR', '🔍', '/explorar_cmds iniciado', { admin: msg.from.id });

            const status = await bot.sendMessage(chatId,
                `🔍 *Explorando panel de comandos del grupo...*\n` +
                `_Esto puede tardar 1-2 minutos mientras presiono cada botón._`,
                { parse_mode: 'Markdown' }
            );

            try {
                const resultado = await explorarCmdsGrupo();

                bot.deleteMessage(chatId, status.message_id).catch(() => {});

                // ── Sin botones: solo texto ──────────────────────────────────
                if (!resultado.tieneBotones) {
                    const texto = resultado.textos.join('\n\n---\n\n') || '(sin respuesta)';
                    await bot.sendMessage(chatId,
                        `📋 *Respuesta del grupo (sin botones):*\n\n${texto}`,
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }

                // ── Con botones: una categoría por mensaje ───────────────────
                const { botones, resultados } = resultado;

                await bot.sendMessage(chatId,
                    `✅ *Exploración completa*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔘 *Categorías encontradas:* ${botones.length}\n\n` +
                    botones.map(b => `• ${b.nombre.replace(/[\[\]]/g, '').trim()}`).join('\n'),
                    { parse_mode: 'Markdown' }
                );

                // Enviar cada categoría como mensaje separado
                for (const [categoria, textos] of Object.entries(resultados)) {
                    if (textos.length === 0) {
                        await bot.sendMessage(chatId,
                            `📂 *${categoria}*\n_(sin respuesta del grupo)_`,
                            { parse_mode: 'Markdown' }
                        );
                        continue;
                    }

                    for (const texto of textos) {
                        // Enviar el texto tal cual viene del grupo
                        try {
                            await bot.sendMessage(chatId,
                                `📂 *[ ${categoria} ]*\n━━━━━━━━━━━━━━━━━━━━\n${texto}`,
                                { parse_mode: 'Markdown' }
                            );
                        } catch (_) {
                            // Si falla con Markdown (caracteres especiales), enviar sin formato
                            await bot.sendMessage(chatId,
                                `📂 [ ${categoria} ]\n${'─'.repeat(20)}\n${texto}`
                            );
                        }
                    }
                }

                await bot.sendMessage(chatId,
                    `✅ *Exploración finalizada.*\n` +
                    `_Copia los comandos de arriba para actualizar la lista._`,
                    { parse_mode: 'Markdown' }
                );

            } catch (err) {
                logError('EXPLORAR', '❌', 'Error en /explorar_cmds', err);
                bot.deleteMessage(chatId, status.message_id).catch(() => {});
                bot.sendMessage(chatId,
                    `❌ *Error explorando el grupo:*\n\`${err.message}\``,
                    { parse_mode: 'Markdown' }
                );
            }
        });
    }
};
