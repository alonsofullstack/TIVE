/**
 * SCRIPT DE AUTENTICACIÓN — correr UNA SOLA VEZ
 * Genera el archivo de sesión para el userbot
 * 
 * Uso: node generar_sesion.js
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const API_ID = 33222502;
const API_HASH = 'b2f2a2532045bb4b928082ab7243d8a6';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pregunta = (texto) => new Promise(resolve => rl.question(texto, resolve));

(async () => {
    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 5 });

    await client.start({
        phoneNumber: async () => await pregunta('📱 Tu número de teléfono (con código de país, ej: +51999999999): '),
        password: async () => await pregunta('🔐 Contraseña 2FA (si tienes, si no presiona Enter): '),
        phoneCode: async () => await pregunta('📩 Código que llegó a tu Telegram: '),
        onError: (err) => console.error('❌ Error:', err),
    });

    const sessionString = client.session.save();
    console.log('\n✅ SESIÓN GENERADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Copia esta línea y pégala en tu .env como:');
    console.log(`TELEGRAM_SESSION=${sessionString}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await client.disconnect();
    rl.close();
    process.exit(0);
})();
