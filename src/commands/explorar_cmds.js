/**
 * explorar_cmds.js
 * 
 * /explorar_cmds — solo admin
 * 
 * Hace que el userbot entre al grupo, presione cada botón del panel /cmds,
 * navega todas las páginas de cada categoría y reenvía el contenido real al admin.
 */

const { logInfo, logError } = require('../utils/logger');
const { explorarCmdsGrupo } = require('../services/multiUserbotService');

module.exports = {
    registerCommands(bot, state, deps) {
        const { ADMIN_IDS } = require('../config');

        bot.onText(/\/explorar_cmds/, async (msg) => {
            if (!ADMIN_IDS.includes(String(msg.from.id))) return;

            const chatId = msg.chat.id;
            logInfo('EXPLORAR', '🔍', '/explorar_cmds iniciado', { admin: msg.from.id });

            const status = await bot.sendMessage(chatId,
                `🔍 *Explorando panel de comandos del grupo...*\n` +
                `_Presionando cada categoría y navegando páginas._\n` +
                `_Puede tardar 2-3 minutos._`,
                { parse_mode: 'Markdown' }
            );

            try {
                const resultado = await explorarCmdsGrupo();
                bot.deleteMessage(chatId, status.message_id).catch(() => {});

                // ── Sin botones ──────────────────────────────────────────────
                if (!resultado.tieneBotones) {
                    const texto = resultado.textos.join('\n\n') || '(sin respuesta)';
                    await bot.sendMessage(chatId, `📋 *Respuesta del grupo:*\n\n${texto}`, { parse_mode: 'Markdown' });
                    return;
                }

                const { botones, categorias } = resultado;

                // Resumen de categorías encontradas
                await bot.sendMessage(chatId,
                    `✅ *Exploración completa*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔘 *Categorías:* ${botones.length}\n\n` +
                    botones.map(b => `• ${b.nombre}`).join('\n'),
                    { parse_mode: 'Markdown' }
                );

                // Enviar cada categoría con todas sus páginas
                for (const [categoria, paginas] of Object.entries(categorias)) {
                    if (paginas.length === 0) {
                        await bot.sendMessage(chatId,
                            `📂 *${categoria}*\n_(sin respuesta del grupo)_`,
                            { parse_mode: 'Markdown' }
                        ).catch(() => {});
                        continue;
                    }

                    for (let i = 0; i < paginas.length; i++) {
                        const paginaLabel = paginas.length > 1 ? ` — Página ${i + 1}/${paginas.length}` : '';
                        const header = `📂 *${categoria}*${paginaLabel}\n${'━'.repeat(20)}\n`;
                        const contenido = paginas[i];

                        try {
                            await bot.sendMessage(chatId, header + contenido, { parse_mode: 'Markdown' });
                        } catch (_) {
                            // Fallback sin Markdown si hay caracteres especiales
                            await bot.sendMessage(chatId, `📂 ${categoria}${paginaLabel}\n${'─'.repeat(20)}\n${contenido}`).catch(() => {});
                        }
                    }
                }

                await bot.sendMessage(chatId,
                    `✅ *Exploración finalizada.*\n_Todos los comandos del grupo están arriba._`,
                    { parse_mode: 'Markdown' }
                );

            } catch (err) {
                logError('EXPLORAR', '❌', 'Error en /explorar_cmds', err);
                bot.deleteMessage(chatId, status.message_id).catch(() => {});
                bot.sendMessage(chatId,
                    `❌ *Error:* \`${err.message}\``,
                    { parse_mode: 'Markdown' }
                );
            }
        });
    }
};
