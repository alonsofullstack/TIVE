require('dotenv').config();
const path = require('path');
const fs = require('fs');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_ID || "").split(",").map(id => id.trim()).filter(id => id);
const API_KEYS = (process.env.GEMINI_KEYS || "").split(",").map(k => k.trim()).filter(k => k);
let DOMAIN = process.env.DOMAIN_URL || 'http://localhost:4000';
if (DOMAIN.endsWith('/')) DOMAIN = DOMAIN.slice(0, -1);

const QR_X = parseFloat(process.env.QR_X) || 12.2;
const QR_Y = parseFloat(process.env.QR_Y) || 10.2;
const QR_X_ORIGINAL = parseFloat(process.env.QR_X_ORIGINAL) || QR_X; // posición X exclusiva para "Insertar QR en PDF Original"
const QR_Y_ORIGINAL = parseFloat(process.env.QR_Y_ORIGINAL) || QR_Y; // posición Y exclusiva para "Insertar QR en PDF Original"
const QR_SIZE = parseFloat(process.env.QR_SIZE) || 72;
const COMPLETE_TEMPLATE_NAME = 'BASE ELECTRONICA TIVE PDF SIN RELLENO PDF.pdf';
const TIVE_COMPLETO_BODY_CODE = { x: 81, y: 323, width: 80, height: 18 };
const TIVE_COMPLETO_TECH_CODE = { x: 60, y: 17, width: 260, height: 40 };

// Delay entre consultas para evitar límite de spam del puente Telegram (en milisegundos)
// Por defecto 16000ms (16 segundos) para evitar límite de 15 segundos
const QUERY_DELAY = parseInt(process.env.QUERY_DELAY) || 16000;

// Cooldown de antispam por sesión de userbot (en milisegundos)
const USERBOT_COOLDOWNS = {
    primary: parseInt(process.env.USERBOT_COOLDOWN_PRIMARY) || 40000,    // 40s para el grupo
    secondary: parseInt(process.env.USERBOT_COOLDOWN_SECONDARY) || 20000  // 20s para el bot directo
};

// Configuración de múltiples bots de Telegram
const BOT_TOKENS = {
    primary: process.env.TELEGRAM_BOT_TOKEN,
    secondary: process.env.TELEGRAM_BOT_TOKEN_2 || null
};

// Mapeo de comandos a bots específicos
// null = usa bot primario, 'secondary' = usa bot secundario
const COMMAND_BOT_MAPPING = {
    // Comandos que usarán el bot secundario
    'gen_tive_completo': 'secondary',
    'gen_tarjeta_fisica_pvc': 'secondary',
    'gen_antigua': 'secondary',
    'insert_qr_only': 'secondary',
    // Comandos que deben usar el bot primario
    'gen_tive_completar': null,
    'gen_tarjeta_fisica_pvc_completar': null,
    'ask_qr': null
};

// Configuración de múltiples sesiones de userbot para distribuir consultas al grupo
const USERBOT_SESSIONS = {
    primary: process.env.TELEGRAM_SESSION || '',
    secondary: process.env.TELEGRAM_SESSION_2 || ''
};

// Configuración de destinos para cada sesión de userbot
// primary: grupo, secondary: bot directo
const USERBOT_DESTINATIONS = {
    primary: {
        type: 'group',
        id: process.env.GRUPO_CONSULTAS_ID || ''
    },
    secondary: {
        type: 'bot',
        username: process.env.TELEGRAM_BOT_USERNAME_2 || '' // Username del bot para sesión secundario (ej: @MiBot)
    }
};

// Mapeo de comandos de consulta a sesiones de userbot específicas
// null = usa sesión primaria (round-robin), 'secondary' = usa sesión secundaria
const COMMAND_USERBOT_MAPPING = {
    // Comandos RENIEC que usarán la sesión secundario (solo los activos)
    '/dnis': 'secondary',  // DNI V2 - ON
    '/dnib': 'secondary',  // DNI V3 - ON
    '/nm': 'secondary',    // NOMBRES V1 - ON
    '/fab': 'secondary',   // FACIAL - ON
    // Comandos TELEFONÍA que usarán la sesión secundario (solo los activos)
    '/movn': 'secondary',  // MOVISTAR - ON
    '/movd': 'secondary',  // DATA MOVISTAR - ON
    '/bitx': 'secondary',  // BITEL V3 - ON
    // Comandos GENERADORES que usarán la sesión secundario (solo los activos)
    '/c4': 'secondary',    // C4 AZUL V1 - ON
    '/dniv': 'secondary',  // DNI VIRTUAL AZUL - ON
    // Comandos SALUD que usarán la sesión secundario (solo los activos)
    '/seg': 'secondary',   // SALUD SEGUROS - ON
    // Comandos VEHÍCULOS que usarán la sesión secundario (solo los activos)
    '/citv': 'secondary',  // REVISION TECNICA - ON
    '/soat': 'secondary',  // SOAT - ON
    '/hsoat': 'secondary', // HISTORIAL SOAT - ON
    // Comandos SUNAT que usarán la sesión secundario (solo los activos)
    '/ruc': 'secondary',   // SUNAT RUC V1 - ON
    '/rucn': 'secondary',  // RUC X RAZON - ON
    '/rucd': 'secondary',  // RUC X DN - ON
    // Comandos SAT que usarán la sesión secundario (solo los activos)
    '/sat': 'secondary',   // SAT PAPELETAS - ON
    '/csat': 'secondary',  // SAT CAPTURAS - ON
    // Comandos ESTUDIOS que usarán la sesión secundario
    '/notas': 'secondary',
    '/const': 'secondary',
    '/cadult': 'secondary',
    // Comandos MTC que usarán la sesión secundario
    '/mtcb': 'secondary',
    '/record': 'secondary',
    // Nota: /citv ya está mapeado a 'secondary' en la sección de Vehículos
    // Comandos que usarán la sesión primaria (round-robin por defecto)
    '/dni': null,          // DNI V1 - OFF
    '/dnim': null,
    '/dnif': null,
    '/dnit': null,
    '/sunat': null,
    '/vec': null,
    '/pla': null,
    '/tive': null,
    '/tiv': 'secondary',
    '/telp': null,
    '/tel': null,
    '/cel': null,
    '/pnp': null,
    '/den': null,
    '/rq': null,
    '/bit': null,          // BITEL V1 - OFF
    '/bitel': null,        // BITEL V2 - OFF
    '/c4a': null,          // C4 otros - OFF
    '/c4b': null,          // C4 otros - OFF
    '/c4i': null           // C4 otros - OFF
};

const uploadDir = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const FONT_PATH = path.join(__dirname, '..', 'tarjeta', 'font_bold.ttf');
const FONT_BYTES = fs.readFileSync(FONT_PATH);

// El acceso al bot es abierto — el control real lo maneja el sistema de créditos.
// Los admins tienen créditos ilimitados; los demás necesitan registro y créditos asignados.
const isAuthorized = (_msg) => true;

module.exports = {
    BOT_TOKEN, ADMIN_IDS, API_KEYS, DOMAIN, QR_X, QR_Y, QR_X_ORIGINAL, QR_Y_ORIGINAL, QR_SIZE,
    COMPLETE_TEMPLATE_NAME, TIVE_COMPLETO_BODY_CODE, TIVE_COMPLETO_TECH_CODE,
    uploadDir, FONT_PATH, FONT_BYTES, isAuthorized, QUERY_DELAY, USERBOT_COOLDOWNS,
    BOT_TOKENS, COMMAND_BOT_MAPPING, USERBOT_SESSIONS, USERBOT_DESTINATIONS, COMMAND_USERBOT_MAPPING
};
