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
    uploadDir, FONT_PATH, FONT_BYTES, isAuthorized, QUERY_DELAY
};
