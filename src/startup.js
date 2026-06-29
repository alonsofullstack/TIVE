const fs = require('fs');
const { logInfo, logError } = require('./utils/logger');

function validateStartup({ BOT_TOKEN, FONT_PATH, API_KEYS }) {
    const errors = [];

    if (!BOT_TOKEN || BOT_TOKEN.length < 20) {
        errors.push('TELEGRAM_BOT_TOKEN ausente o inválido en .env');
    }

    if (!fs.existsSync(FONT_PATH)) {
        errors.push(`Fuente no encontrada: ${FONT_PATH}`);
    }

    if (errors.length) {
        for (const e of errors) logError('STARTUP', '❌', e);
        throw new Error(`Configuración inválida:\n- ${errors.join('\n- ')}`);
    }

    logInfo('STARTUP', '✅', 'Entorno validado — usando configuración de .env', {
        domain: process.env.DOMAIN_URL || '(default)',
        port: process.env.PORT || '3000',
        db: process.env.DB_HOST ? 'configurada' : 'default local',
        gemini: API_KEYS?.length ? `${API_KEYS.length} key(s)` : 'OCR local',
        userbot: process.env.TELEGRAM_SESSION ? 'configurada' : 'no configurada',
    });

    return true;
}

module.exports = { validateStartup };