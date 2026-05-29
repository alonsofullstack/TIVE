/**
 * clientes.js
 * Comandos de gestión de clientes y créditos
 *
 * Usuarios:
 *   /register  — registrarse en el sistema
 *   /credits   — ver saldo de créditos
 *
 * Solo admin:
 *   /addcredits <userId|@username> <cantidad>
 *   /removecredits <userId|@username> <cantidad>
 *   /clientes   — lista todos los clientes
 *   /cliente <userId|@username>  — detalle de un cliente
 */

const { logInfo, logError } = require('../utils/logger');
const {
    registerClient, getClient, getAllClients, findClientByRef,
    addCredits, removeCredits, touchClient,
} = require('../services/clientService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function isAdmin(userId, ADMIN_IDS) {
    return ADMIN_IDS.includes(String(userId));
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

function creditBar(n, max = 20) {
    const filled = Math.min(n, max);
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, max - filled));
}

// ── Módulo ────────────────────────────────────────────────────────────────────

module.exports = {
    registerCommands(bot, state, deps) {
        const { ADMIN_IDS } = require('../config');

        // ─────────────────────────────────────────────────────────────────────
        // /register
        // ─────────────────────────────────────────────────────────────────────
        bot.onText(/\/register/, async (msg) => {
            const { id, username, first_name } = msg.from;
            logInfo('CLIENTES', '📝', '/register', { id, username });

            try {
                const result = await registerClient(id, username, first_name);

                if (result.alreadyExists) {
                    const c = result.client;
                    return bot.sendMessage(msg.chat.id,
                        `ℹ️ *Ya estás registrado*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `👤 *Usuario:* ${c.firstName}\n` +
                        `💳 *Créditos:* \`${c.credits}\`\n\n` +
                        `Usa /credits para ver tu saldo en cualquier momento.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                bot.sendMessage(msg.chat.id,
                    `✅ *¡Registro Exitoso!*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 *Nombre:* ${result.client.firstName}\n` +
                    `🆔 *Tu ID:* \`${id}\`\n` +
                    `💳 *Créditos iniciales:* \`0\`\n\n` +
                    `⚠️ _Aún no tienes créditos. Contacta al administrador para que te asigne._\n\n` +
                    `Usa /credits para consultar tu saldo.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (err) {
                logError('CLIENTES', '❌', 'Error en /register', err);
                bot.sendMessage(msg.chat.id, '❌ Error al registrar. Intenta de nuevo.');
            }
        });

        // ─────────────────────────────────────────────────────────────────────
        // /credits
        // ─────────────────────────────────────────────────────────────────────
        bot.onText(/\/credits/, async (msg) => {
            const { id, username, first_name } = msg.from;

            try {
                await touchClient(id, username, first_name);
                const client = await getClient(id);

                if (!client) {
                    return bot.sendMessage(msg.chat.id,
                        `❌ *No estás registrado*\n\n` +
                        `Usa /register para crear tu cuenta.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                const bar = creditBar(client.credits);
                bot.sendMessage(msg.chat.id,
                    `💳 *Tu Saldo de Créditos*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 *Usuario:* ${client.firstName}\n` +
                    `💰 *Créditos disponibles:* \`${client.credits}\`\n` +
                    `📊 \`${bar}\`\n` +
                    `📈 *Total usado:* \`${client.totalUsed}\`\n` +
                    `📅 *Registrado:* ${fmtDate(client.registeredAt)}\n\n` +
                    `_Cada operación consume 1 crédito._\n\n` +
                    `🛒 Recarga con /buy`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🛒 Comprar Créditos', url: 'https://t.me/odinosea' },
                                { text: '🛒 ING. ORION BOT', url: 'https://t.me/odinosea' }
                            ]]
                        }
                    }
                );
            } catch (err) {
                logError('CLIENTES', '❌', 'Error en /credits', err);
                bot.sendMessage(msg.chat.id, '❌ Error consultando saldo. Intenta de nuevo.');
            }
        });

        // ─────────────────────────────────────────────────────────────────────
        // /addcredits <ref> <cantidad>   [solo admin]
        // ─────────────────────────────────────────────────────────────────────
        bot.onText(/\/addcredits(?:\s+(.+))?/, async (msg, match) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) {
                return bot.sendMessage(msg.chat.id, '🚫 Solo el administrador puede usar este comando.');
            }

            const args = (match[1] || '').trim().split(/\s+/);
            if (args.length < 2 || !args[1]) {
                return bot.sendMessage(msg.chat.id,
                    `⚠️ *Uso correcto:*\n\`/addcredits <userId o @username> <cantidad>\`\n\n` +
                    `_Ejemplo: \`/addcredits 123456789 10\`_`,
                    { parse_mode: 'Markdown' }
                );
            }

            const [ref, rawAmt] = args;
            const amount = parseInt(rawAmt, 10);
            if (isNaN(amount) || amount <= 0) {
                return bot.sendMessage(msg.chat.id, '❌ La cantidad debe ser un número entero positivo.');
            }

            try {
                const target = await findClientByRef(ref);
                if (!target) {
                    return bot.sendMessage(msg.chat.id,
                        `❌ Cliente \`${ref}\` no encontrado.\n_Asegúrate de que el usuario se haya registrado con /register._`,
                        { parse_mode: 'Markdown' }
                    );
                }

                const result = await addCredits(target.userId, amount);
                if (!result.ok) return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);

                logInfo('ADMIN', '💳', 'Créditos añadidos', { target: target.userId, amount, newTotal: result.credits });

                bot.sendMessage(msg.chat.id,
                    `✅ *Créditos Asignados*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 *Cliente:* ${target.firstName} (\`${target.userId}\`)\n` +
                    `➕ *Añadidos:* \`+${amount}\`\n` +
                    `💳 *Nuevo saldo:* \`${result.credits}\``,
                    { parse_mode: 'Markdown' }
                );

                // Notificar al cliente
                bot.sendMessage(target.userId,
                    `🎉 *¡Créditos Recibidos!*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `💳 *Créditos añadidos:* \`+${amount}\`\n` +
                    `💰 *Saldo actual:* \`${result.credits}\`\n\n` +
                    `Ya puedes usar el bot. Envía un PDF para comenzar.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});

            } catch (err) {
                logError('ADMIN', '❌', 'Error en /addcredits', err);
                bot.sendMessage(msg.chat.id, '❌ Error al asignar créditos. Intenta de nuevo.');
            }
        });

        // ─────────────────────────────────────────────────────────────────────
        // /removecredits <ref> <cantidad>   [solo admin]
        // ─────────────────────────────────────────────────────────────────────
        bot.onText(/\/removecredits(?:\s+(.+))?/, async (msg, match) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) {
                return bot.sendMessage(msg.chat.id, '🚫 Solo el administrador puede usar este comando.');
            }

            const args = (match[1] || '').trim().split(/\s+/);
            if (args.length < 2 || !args[1]) {
                return bot.sendMessage(msg.chat.id,
                    `⚠️ *Uso correcto:*\n\`/removecredits <userId o @username> <cantidad>\``,
                    { parse_mode: 'Markdown' }
                );
            }

            const [ref, rawAmt] = args;
            const amount = parseInt(rawAmt, 10);
            if (isNaN(amount) || amount <= 0) {
                return bot.sendMessage(msg.chat.id, '❌ La cantidad debe ser un número entero positivo.');
            }

            try {
                const target = await findClientByRef(ref);
                if (!target) {
                    return bot.sendMessage(msg.chat.id,
                        `❌ Cliente \`${ref}\` no encontrado.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                const result = await removeCredits(target.userId, amount);
                if (!result.ok) return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);

                bot.sendMessage(msg.chat.id,
                    `✅ *Créditos Removidos*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 *Cliente:* ${target.firstName} (\`${target.userId}\`)\n` +
                    `➖ *Removidos:* \`-${amount}\`\n` +
                    `💳 *Nuevo saldo:* \`${result.credits}\``,
                    { parse_mode: 'Markdown' }
                );
            } catch (err) {
                logError('ADMIN', '❌', 'Error en /removecredits', err);
                bot.sendMessage(msg.chat.id, '❌ Error al remover créditos. Intenta de nuevo.');
            }
        });

        // ─────────────────────────────────────────────────────────────────────
        // /clientes   [solo admin]
        // ─────────────────────────────────────────────────────────────────────
        bot.onText(/\/clientes/, async (msg) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) {
                return bot.sendMessage(msg.chat.id, '🚫 Solo el administrador puede usar este comando.');
            }

            try {
                const all = await getAllClients();

                if (all.length === 0) {
                    return bot.sendMessage(msg.chat.id,
                        `📋 *Sin clientes registrados aún.*\n_Los usuarios deben usar /register para aparecer aquí._`,
                        { parse_mode: 'Markdown' }
                    );
                }

                const totalCredits = all.reduce((s, c) => s + c.credits, 0);
                const totalUsed    = all.reduce((s, c) => s + c.totalUsed, 0);
                const activos      = all.filter(c => c.credits > 0).length;

                // Construir líneas por cliente
                const clientLines = all.map(c => {
                    const uname  = c.username ? `@${c.username}` : '—';
                    const status = c.credits > 0 ? '🟢' : '🔴';
                    return `${status} *${c.firstName}* (${uname})\n   🆔 \`${c.userId}\` · 💳 \`${c.credits}\` créditos`;
                });

                const header =
                    `👥 *CLIENTES REGISTRADOS* (${all.length})\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🟢 Activos: \`${activos}\` · 🔴 Sin créditos: \`${all.length - activos}\`\n` +
                    `💰 Créditos activos: \`${totalCredits}\` · Usados: \`${totalUsed}\`\n\n`;

                const footer = `\n_Usa /cliente <userId> para ver el detalle._`;

                // Partir en chunks si supera el límite de Telegram (4096 chars)
                const chunks = [];
                let current = header;
                for (const line of clientLines) {
                    if ((current + line + '\n').length > 3900) {
                        chunks.push(current);
                        current = '';
                    }
                    current += line + '\n';
                }
                current += footer;
                chunks.push(current);

                for (const chunk of chunks) {
                    await bot.sendMessage(msg.chat.id, chunk, { parse_mode: 'Markdown' });
                }

            } catch (err) {
                logError('ADMIN', '❌', 'Error en /clientes', err);
                bot.sendMessage(msg.chat.id, '❌ Error consultando clientes. Intenta de nuevo.');
            }
        });

        // ─────────────────────────────────────────────────────────────────────
        // /cliente <ref>   [solo admin]
        // ─────────────────────────────────────────────────────────────────────
        bot.onText(/\/cliente(?:\s+(.+))?/, async (msg, match) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) return;

            const ref = (match[1] || '').trim();
            if (!ref) {
                return bot.sendMessage(msg.chat.id,
                    `⚠️ Uso: \`/cliente <userId o @username>\``,
                    { parse_mode: 'Markdown' }
                );
            }

            try {
                const c = await findClientByRef(ref);
                if (!c) {
                    return bot.sendMessage(msg.chat.id,
                        `❌ Cliente \`${ref}\` no encontrado.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                const uname = c.username ? `@${c.username}` : '—';
                const bar   = creditBar(c.credits);

                bot.sendMessage(msg.chat.id,
                    `👤 *Detalle de Cliente*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📛 *Nombre:* ${c.firstName}\n` +
                    `🔖 *Username:* ${uname}\n` +
                    `🆔 *ID:* \`${c.userId}\`\n` +
                    `💳 *Créditos:* \`${c.credits}\`\n` +
                    `📊 \`${bar}\`\n` +
                    `📈 *Total usado:* \`${c.totalUsed}\`\n` +
                    `📅 *Registrado:* ${fmtDate(c.registeredAt)}\n` +
                    `🕐 *Última actividad:* ${fmtDate(c.lastActivity)}\n\n` +
                    `_Comandos rápidos:_\n` +
                    `\`/addcredits ${c.userId} 10\`\n` +
                    `\`/removecredits ${c.userId} 5\``,
                    { parse_mode: 'Markdown' }
                );
            } catch (err) {
                logError('ADMIN', '❌', 'Error en /cliente', err);
                bot.sendMessage(msg.chat.id, '❌ Error consultando cliente. Intenta de nuevo.');
            }
        });
    }
};
