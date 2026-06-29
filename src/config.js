require('dotenv').config();
const path = require('path');
const fs = require('fs');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_ID || "").split(",").map(id => id.trim()).filter(id => id);
const API_KEYS = (process.env.GEMINI_KEYS || "").split(",").map(k => k.trim()).filter(k => k);

// Respeta .env tal cual — PORT y DOMAIN_URL del usuario tienen prioridad absoluta
const PORT = parseInt(process.env.PORT || '4000', 10);
let DOMAIN = process.env.DOMAIN_URL || `http://localhost:${PORT}`;
if (DOMAIN.endsWith('/')) DOMAIN = DOMAIN.slice(0, -1);

const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || '33222502', 10);
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || 'b2f2a2532045bb4b928082ab7243d8a6';

const QR_X = parseFloat(process.env.QR_X) || 12.2;
const QR_Y = parseFloat(process.env.QR_Y) || 10.2;
const QR_X_ORIGINAL = parseFloat(process.env.QR_X_ORIGINAL) || QR_X;
const QR_Y_ORIGINAL = parseFloat(process.env.QR_Y_ORIGINAL) || QR_Y;
const QR_SIZE = parseFloat(process.env.QR_SIZE) || 72;
const COMPLETE_TEMPLATE_NAME = 'BASE ELECTRONICA TIVE PDF SIN RELLENO PDF.pdf';
const TIVE_COMPLETO_BODY_CODE = { x: 81, y: 323, width: 80, height: 18 };
const TIVE_COMPLETO_TECH_CODE = { x: 60, y: 17, width: 260, height: 40 };

const QUERY_DELAY = parseInt(process.env.QUERY_DELAY) || 16000;

const USERBOT_COOLDOWNS = {
    primary: parseInt(process.env.USERBOT_COOLDOWN_PRIMARY) || 40000,
    secondary: parseInt(process.env.USERBOT_COOLDOWN_SECONDARY) || 20000
};

const BOT_TOKENS = {
    primary: process.env.TELEGRAM_BOT_TOKEN,
    secondary: process.env.TELEGRAM_BOT_TOKEN_2 || null
};

const COMMAND_BOT_MAPPING = {
    'gen_tive_completo': 'secondary',
    'gen_tarjeta_fisica_pvc': 'secondary',
    'gen_antigua': 'secondary',
    'insert_qr_only': 'secondary',
    'gen_tive_completar': null,
    'gen_tarjeta_fisica_pvc_completar': null,
    'ask_qr': null
};

const USERBOT_SESSIONS = {
    primary: process.env.TELEGRAM_SESSION || '',
    secondary: process.env.TELEGRAM_SESSION_2 || ''
};

const USERBOT_DESTINATIONS = {
    primary: {
        type: 'group',
        id: process.env.GRUPO_CONSULTAS_ID || ''
    },
    secondary: {
        type: 'bot',
        username: process.env.TELEGRAM_BOT_USERNAME_2 || ''
    }
};

const COMMAND_USERBOT_MAPPING = {
    '/dnis': 'secondary', '/dnib': 'secondary', '/nm': 'secondary', '/fab': 'secondary',
    '/movn': 'secondary', '/movd': 'secondary', '/bitx': 'secondary',
    '/c4': 'secondary', '/dniv': 'secondary',
    '/seg': 'secondary',
    '/citv': 'secondary', '/soat': 'secondary', '/hsoat': 'secondary',
    '/ruc': 'secondary', '/rucn': 'secondary', '/rucd': 'secondary',
    '/sat': 'secondary', '/csat': 'secondary',
    '/notas': 'secondary', '/const': 'secondary', '/cadult': 'secondary',
    '/mtcb': 'secondary', '/record': 'secondary',
    '/tiv': 'secondary',
    '/dni': null, '/dnim': null, '/dnif': null, '/dnit': null,
    '/sunat': null, '/vec': null, '/pla': null, '/tive': null,
    '/telp': null, '/tel': null, '/cel': null, '/pnp': null,
    '/den': null, '/rq': null, '/bit': null, '/bitel': null,
    '/c4a': null, '/c4b': null, '/c4i': null
};

const MAX_PDF_BYTES = parseInt(process.env.MAX_PDF_BYTES || String(15 * 1024 * 1024), 10);

const uploadDir = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const FONT_PATH = path.join(__dirname, '..', 'tarjeta', 'font_bold.ttf');

function loadFontBytes() {
    return fs.readFileSync(FONT_PATH);
}

module.exports = {
    BOT_TOKEN, ADMIN_IDS, API_KEYS, DOMAIN, PORT, QR_X, QR_Y, QR_X_ORIGINAL, QR_Y_ORIGINAL, QR_SIZE,
    COMPLETE_TEMPLATE_NAME, TIVE_COMPLETO_BODY_CODE, TIVE_COMPLETO_TECH_CODE,
    uploadDir, FONT_PATH, loadFontBytes,
    QUERY_DELAY, USERBOT_COOLDOWNS, TELEGRAM_API_ID, TELEGRAM_API_HASH,
    BOT_TOKENS, COMMAND_BOT_MAPPING, USERBOT_SESSIONS, USERBOT_DESTINATIONS, COMMAND_USERBOT_MAPPING,
    MAX_PDF_BYTES,
};