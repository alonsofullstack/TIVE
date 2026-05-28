/**
 * Lista todos los grupos/chats del userbot para encontrar el ID correcto
 * Uso: node listar_grupos.js
 */
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const API_ID = 33222502;
const API_HASH = 'b2f2a2532045bb4b928082ab7243d8a6';

(async () => {
    const sessionStr = (process.env.TELEGRAM_SESSION || '').replace(/\\/g, '');
    const client = new TelegramClient(new StringSession(sessionStr), API_ID, API_HASH, { connectionRetries: 3 });
    await client.connect();

    console.log('\n📋 TODOS TUS GRUPOS Y CANALES:\n');
    const dialogs = await client.getDialogs({ limit: 200 });
    dialogs.forEach(d => {
        const tipo = d.isChannel ? 'CANAL' : d.isGroup ? 'GRUPO' : 'PRIVADO';
        if (tipo !== 'PRIVADO') {
            console.log(`[${tipo}] ID: ${d.id} | Título: ${d.title}`);
        }
    });

    await client.disconnect();
    process.exit(0);
})();
