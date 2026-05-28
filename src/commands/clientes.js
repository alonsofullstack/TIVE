/**
 * clientes.js
 * Comandos de gestión de clientes y créditos
 *
 * Usuarios:
 *   /register  — registrarse en el sistema
 *   /credits   — ver saldo de créditos
 *   /start     — bienvenida con saldo (reemplaza al start original)
 *
 * Solo admin:
 *   /addcredits <userId|@username> <cantidad>
 *   /removecredits <userId|@username> <cantidad>
 *   /clientes   — lista todos los clientes
 *   /cliente <userId>  — detalle de un cliente
 */

const { logInfo, logError } = require('../utils/logger');
const {
    registerClient, getClient, getAllClients,
    addCredits, removeCredits, touchClient, CREDIT_COSTS,
} = require('../services/clientService');

// ── Helpers ─────────────────────────────────────────────────────────────────

function isAdmin(userId, ADMIN_IDS) {
    return ADMIN_IDS.includes(String(userId));
}

/** Busca un cliente por userId numérico o por @username */
function findClientByRef(ref, allClients) {
    const clean = ref.replace(/^@/, '').toLowerCase();
    // Primero intenta por ID numérico
    const byId = allClients.find(c => c.userId === clean);
    if (byId) return byId;
    // Luego por username
    return allClients.find(c => c.username && c.username.toLowerCase() === clean) || null;
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

function creditBar(n, max = 20) {
    const filled = Math.min(n, max);
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, max - filled));
}

// ── Módulo ───────────────────────────────────────────────────────────────────

module.exports = {
    registerCommands(bot, state, deps) {
        const { ADMIN_IDS } = require('../config');

        // ────────────────────────────────────────────────────────────────────
        // /register
        // ────────────────────────────────────────────────────────────────────
        bot.onText(/\/register/, (msg) => {
            const { id, username, first_name } = msg.from;
            logInfo('CLIENTES', '📝', '/register', { id, username });

            const result = registerClient(id, username, first_name);

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
                `✅ *¡Registro exitoso!*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 *Nombre:* ${result.client.firstName}\n` +
                `🆔 *Tu ID:* \`${id}\`\n` +
                `💳 *Créditos iniciales:* \`0\`\n\n` +
                `⚠️ _Aún no tienes créditos. Contacta al administrador para que te asigne._\n\n` +
                `Usa /credits para consultar tu saldo.`,
                { parse_mode: 'Markdown' }
            );
        });

        // ────────────────────────────────────────────────────────────────────
        // /credits
        // ────────────────────────────────────────────────────────────────────
        bot.onText(/\/credits/, (msg) => {
            const { id, username, first_name } = msg.from;
            touchClient(id, username, first_name);
            const client = getClient(id);

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
                `_Cada operación consume 1 crédito._`,
                { parse_mode: 'Markdown' }
            );
        });

        // ────────────────────────────────────────────────────────────────────
        // /addcredits <ref> <cantidad>   [solo admin]
        // ────────────────────────────────────────────────────────────────────
        bot.onText(/\/addcredits(?:\s+(.+))?/, (msg, match) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) {
                return bot.sendMessage(msg.chat.id, '🚫 Solo el administrador puede usar este comando.');
            }

            const args = (match[1] || '').trim().split(/\s+/);
            if (args.length < 2) {
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

            const all = getAllClients();
            const target = findClientByRef(ref, all);
            if (!target) {
                return bot.sendMessage(msg.chat.id,
                    `❌ Cliente \`${ref}\` no encontrado.\n_Asegúrate de que el usuario se haya registrado con /register._`,
                    { parse_mode: 'Markdown' }
                );
            }

            const result = addCredits(target.userId, amount);
            if (!result.ok) return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);

            logInfo('ADMIN', '💳', `Créditos añadidos`, { target: target.userId, amount, newTotal: result.credits });

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
            ).catch(() => {}); // El usuario puede no haber iniciado el bot
        });

        // ────────────────────────────────────────────────────────────────────
        // /removecredits <ref> <cantidad>   [solo admin]
        // ────────────────────────────────────────────────────────────────────
        bot.onText(/\/removecredits(?:\s+(.+))?/, (msg, match) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) {
                return bot.sendMessage(msg.chat.id, '🚫 Solo el administrador puede usar este comando.');
            }

            const args = (match[1] || '').trim().split(/\s+/);
            if (args.length < 2) {
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

            const all = getAllClients();
            const target = findClientByRef(ref, all);
            if (!target) {
                return bot.sendMessage(msg.chat.id, `❌ Cliente \`${ref}\` no encontrado.`, { parse_mode: 'Markdown' });
            }

            const result = removeCredits(target.userId, amount);
            if (!result.ok) return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);

            bot.sendMessage(msg.chat.id,
                `✅ *Créditos Removidos*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 *Cliente:* ${target.firstName} (\`${target.userId}\`)\n` +
                `➖ *Removidos:* \`-${amount}\`\n` +
                `💳 *Nuevo saldo:* \`${result.credits}\``,
                { parse_mode: 'Markdown' }
            );
        });

        // ────────────────────────────────────────────────────────────────────
        // /clientes   [solo admin]
        // ────────────────────────────────────────────────────────────────────
        bot.onText(/\/clientes/, (msg) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) {
                return bot.sendMessage(msg.chat.id, '🚫 Solo el administrador puede usar este comando.');
            }

            const all = getAllClients();
            if (all.length === 0) {
                return bot.sendMessage(msg.chat.id,
                    `📋 *Sin clientes registrados aún.*\n_Los usuarios deben usar /register para aparecer aquí._`,
                    { parse_mode: 'Markdown' }
                );
            }

            // Ordenar: más créditos primero
            all.sort((a, b) => b.credits - a.credits);

            const totalCredits = all.reduce((s, c) => s + c.credits, 0);
            const totalUsed    = all.reduce((s, c) => s + c.totalUsed, 0);

            let lines = `👥 *CLIENTES REGISTRADOS* (${all.length})\n`;
            lines += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            lines += `📊 Total créditos activos: \`${totalCredits}\` | Usados: \`${totalUsed}\`\n\n`;

            for (const c of all) {
                const uname = c.username ? `@${c.username}` : '—';
                const status = c.credits > 0 ? '🟢' : '🔴';
                lines += `${status} *${c.firstName}* (${uname})\n`;
                lines += `   🆔 \`${c.userId}\` · 💳 \`${c.credits}\` créditos\n`;
            }

            lines += `\n_Usa /cliente <userId> para ver el detalle._`;

            // Telegram tiene límite de 4096 chars; si hay muchos clientes, partir
            if (lines.length > 4000) {
                const chunks = [];
                const clientLines = all.map(c => {
                    const uname = c.username ? `@${c.username}` : '—';
                    const status = c.credits > 0 ? '🟢' : '🔴';
                    return `${status} *${c.firstName}* (${uname}) · \`${c.userId}\` · 💳 \`${c.credits}\``;
                });
                let chunk = `👥 *CLIENTES* (${all.length}) — Total créditos: \`${totalCredits}\`\n━━━━━━━━━━━━━━━━━━━━\n`;
                for (const line of clientLines) {
                    if ((chunk + line).length > 3900) {
                        chunks.push(chunk);
                        chunk = '';
                    }
                    chunk += line + '\n';
                }
                if (chunk) chunks.push(chunk);
                for (const ch of chunks) {
                    bot.sendMessage(msg.chat.id, ch, { parse_mode: 'Markdown' });
                }
                return;
            }

            bot.sendMessage(msg.chat.id, lines, { parse_mode: 'Markdown' });
        });

        // ────────────────────────────────────────────────────────────────────
        // /cliente <userId>   [solo admin]
        // ────────────────────────────────────────────────────────────────────
        bot.onText(/\/cliente(?:\s+(.+))?/, (msg, match) => {
            if (!isAdmin(msg.from.id, ADMIN_IDS)) return;

            const ref = (match[1] || '').trim();
            if (!ref) {
                return bot.sendMessage(msg.chat.id,
                    `⚠️ Uso: \`/cliente <userId o @username>\``,
                    { parse_mode: 'Markdown' }
                );
            }

            const all = getAllClients();
            const c = findClientByRef(ref, all);
            if (!c) {
                return bot.sendMessage(msg.chat.id, `❌ Cliente \`${ref}\` no encontrado.`, { parse_mode: 'Markdown' });
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
        });
    }
};
