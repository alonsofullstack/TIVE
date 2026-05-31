const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input'); // npm install input

const API_ID = 33222502;
const API_HASH = 'b2f2a2532045bb4b928082ab7243d8a6';

async function getSession() {
    console.log('🔑 Obteniendo sesión de Telegram...');
    console.log('📱 Ingresa tu número de teléfono (con código de país, ejemplo: +51999999999)');
    
    const client = new TelegramClient(
        new StringSession(''),
        API_ID,
        API_HASH,
        { connectionRetries: 5, retryDelay: 2000 }
    );

    await client.start({
        phoneNumber: async () => await input.text('Número de teléfono: '),
        password: async () => await input.text('Contraseña 2FA (si tienes): '),
        phoneCode: async () => await input.text('Código de verificación: '),
        onError: (err) => console.error(err),
    });

    const sessionString = client.session.save();
    console.log('\n✅ Sesión generada exitosamente!');
    console.log('\n📋 COPIA ESTA SESIÓN Y AGREGALA A TU ARCHIVO .env:');
    console.log('\n' + sessionString + '\n');
    console.log('📝 Agrega esto a tu .env como TELEGRAM_SESSION_2=...');
    
    await client.disconnect();
}

getSession().catch(console.error);
