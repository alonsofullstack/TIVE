/**
 * cmds.js
 * Cuando el usuario escribe /cmds o /menu:
 *  1. Envía /cmds al grupo real y reenvía la respuesta (comandos del grupo)
 *  2. Agrega al final los comandos propios de este bot
 */

const { logInfo, logError } = require('../utils/logger');
const { consultarEnGrupo, reenviarRespuestas } = require('../services/userbotService');

module.exports = {
    registerCommands(bot, state, deps) {
        bot.on('message', async (msg) => {
            if (!msg.text) return;
            const texto = msg.text.trim().toLowerCase();
            if (
                texto !== '/cmds' &&
                texto !== '/menu' &&
                !texto.startsWith('/cmds ') &&
                !texto.startsWith('/menu ')
            ) return;

            const chatId = msg.chat.id;
            logInfo('BOT', '📋', 'Comando /cmds recibido', { id: msg.from.id });

            // ── 1. Obtener comandos del grupo en tiempo real ─────────────────
            const procesando = await bot.sendMessage(chatId,
                '⏳ _Cargando lista de comandos..._',
                { parse_mode: 'Markdown' }
            );

            try {
                const respuestas = await consultarEnGrupo('/cmds');
                bot.deleteMessage(chatId, procesando.message_id).catch(() => {});

                if (respuestas && respuestas.length > 0) {
                    await reenviarRespuestas(bot, chatId, respuestas);
                }
            } catch (err) {
                logError('BOT', '❌', 'Error obteniendo /cmds del grupo', err);
                bot.deleteMessage(chatId, procesando.message_id).catch(() => {});
                // Si el grupo no responde, no bloqueamos — igual mostramos los propios
            }

            // ── 2. Comandos propios de este bot ──────────────────────────────
            const propios =
                `\n🤖 *TIVE AI PRO — COMANDOS PROPIOS*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

                `👤 *MI CUENTA*\n` +
                `\`/start\` — Bienvenida y estado de cuenta\n` +
                `\`/register\` — Registrarte _(hazlo primero)_\n` +
                `\`/credits\` — Ver tu saldo de créditos\n\n` +

                `📄 *TARJETAS* _(sube un PDF de SUNARP primero)_\n` +
                `  🚀 *Fotos TIVE PVC* — QR personalizado u oficial\n` +
                `  🧾 *TIVE Completo* — PDF listo para imprimir\n` +
                `  🧾 *TIVE Para Completar* — Plantilla con campos en blanco\n` +
                `  💳 *Tarjeta Física PVC* — Imágenes recortadas para PVC\n` +
                `  💳 *Tarjeta Física PVC Para Completar*\n` +
                `  📜 *Tarjeta Antigua* — Flujo manual con datos extra\n` +
                `  🔐 *Insertar QR en PDF Original*\n\n` +

                `🛠️ *ADMIN*\n` +
                `\`/clientes\` — Lista de clientes\n` +
                `\`/cliente <id o @user>\` — Detalle de cliente\n` +
                `\`/addcredits <id> <n>\` — Asignar créditos\n` +
                `\`/removecredits <id> <n>\` — Quitar créditos\n\n` +

                `🏓 \`/ping\` — Verificar que el bot está activo\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `_Cada operación consume 1 crédito_`;

            bot.sendMessage(chatId, propios, { parse_mode: 'Markdown' }).catch(() => {});
        });
    }
};
