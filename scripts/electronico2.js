#!/usr/bin/env node

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'canvas') {
        const skia = originalRequire.call(this, 'skia-canvas');
        if (!skia.createCanvas) skia.createCanvas = (width, height) => new skia.Canvas(width, height);
        return skia;
    }
    return originalRequire.apply(this, arguments);
};

const fs = require('fs');
const path = require('path');
const { logInfo, logError, logTimer } = require('../src/utils/logger');
const { extraerConIA } = require('../src/services/ocrService');
const electronicoPvcV2 = require('../src/layouts/electronicoPvcV2');

function safeName(value) {
    return String(value || 'archivo').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function usage() {
    console.log('Uso: npm run electronico2 -- "C:\\ruta\\archivo.pdf" [link-qr-opcional]');
}

async function main() {
    const inputArg = process.argv[2];
    const customQr = process.argv[3] || null;
    if (!inputArg) {
        usage();
        process.exitCode = 2;
        return;
    }

    const inputPath = path.resolve(inputArg);
    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
        throw new Error(`No existe el archivo: ${inputPath}`);
    }
    if (path.extname(inputPath).toLowerCase() !== '.pdf') {
        throw new Error(`El archivo debe ser PDF: ${inputPath}`);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(process.cwd(), 'salidas', `electronico2-${stamp}`);
    fs.mkdirSync(outputDir, { recursive: true });
    const logPath = path.join(outputDir, 'proceso.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const originalLog = console.log.bind(console);
    const originalError = console.error.bind(console);
    console.log = (...args) => {
        const line = args.map(String).join(' ');
        originalLog(line);
        logStream.write(`${line}\n`);
    };
    console.error = (...args) => {
        const line = args.map(String).join(' ');
        originalError(line);
        logStream.write(`${line}\n`);
    };

    const fakeChatId = 'LOCAL-ELECTRONICO-2';
    let photoNumber = 0;
    const telegramLocal = {
        async sendPhoto(chatId, data, options = {}, fileOptions = {}) {
            photoNumber += 1;
            const fallback = photoNumber === 1 ? 'anverso.png' : 'reverso.png';
            const filename = safeName(fileOptions.filename || fallback);
            const target = path.join(outputDir, filename);
            fs.writeFileSync(target, Buffer.from(data));
            logInfo('TELEGRAM-LOCAL', '📷', 'sendPhoto simulado', {
                chatId, archivo: target, caption: options.caption || '', bytes: Buffer.byteLength(data)
            });
            return { message_id: photoNumber, chat: { id: chatId }, photo: [{ file_size: Buffer.byteLength(data) }] };
        },
        async sendDocument(chatId, data, options = {}, fileOptions = {}) {
            const filename = safeName(fileOptions.filename || `documento-${Date.now()}.pdf`);
            const target = path.join(outputDir, filename);
            fs.writeFileSync(target, Buffer.from(data));
            logInfo('TELEGRAM-LOCAL', '📎', 'sendDocument simulado', {
                chatId, archivo: target, caption: options.caption || '', bytes: Buffer.byteLength(data)
            });
            return { message_id: Date.now(), chat: { id: chatId }, document: { file_name: filename } };
        },
        async sendMessage(chatId, text) {
            logInfo('TELEGRAM-LOCAL', '💬', 'sendMessage simulado', { chatId, texto: text });
            return { message_id: Date.now(), chat: { id: chatId }, text };
        }
    };

    const timer = logTimer('ELECTRONICO 2 LOCAL', `Proceso completo de ${path.basename(inputPath)}`);
    try {
        const sourceBuffer = fs.readFileSync(inputPath);
        logInfo('BOT', '📄', 'Documento recibido (simulación Telegram)', {
            name: path.basename(inputPath), size: sourceBuffer.length, ruta: inputPath
        });
        logInfo('BOT', '🖱️', 'Botón presionado (simulación Telegram)', {
            boton: 'ask_electronico_pvc_v2', chatId: fakeChatId
        });
        logInfo('BOT', '🏢', 'Link QR seleccionado', {
            tipo: customQr ? 'personalizado' : 'oficial SUNARP', link: customQr || '(generado por el sistema)'
        });

        const datos = await extraerConIA(sourceBuffer, path.basename(inputPath));
        const dataPath = path.join(outputDir, 'datos-extraidos.json');
        fs.writeFileSync(dataPath, JSON.stringify(datos, null, 2));
        logInfo('ELECTRONICO 2 LOCAL', '🧾', 'Datos extraídos guardados', {
            archivo: dataPath,
            placa: datos.placa || '(no detectada)',
            numeroGris: datos.numeroGris || '(no detectado)'
        });

        const generarTIVE = require('../src/services/cardGenerator')(telegramLocal).generarTIVE;
        await generarTIVE(fakeChatId, datos, customQr, sourceBuffer, {
            anv: electronicoPvcV2.plantillas.anverso,
            rev: electronicoPvcV2.plantillas.reverso
        }, {
            anversoLayout: electronicoPvcV2.layout,
            cropTopAnv: electronicoPvcV2.recorte.anverso.top,
            cropBottomAnv: electronicoPvcV2.recorte.anverso.bottom,
            cropLeftAnv: electronicoPvcV2.recorte.anverso.left,
            cropRightAnv: electronicoPvcV2.recorte.anverso.right,
            cropTopRev: electronicoPvcV2.recorte.reverso.top,
            cropBottomRev: electronicoPvcV2.recorte.reverso.bottom,
            cropLeftRev: electronicoPvcV2.recorte.reverso.left,
            cropRightRev: electronicoPvcV2.recorte.reverso.right
        });
        timer.end(`salida=${outputDir}`);
        logInfo('ELECTRONICO 2 LOCAL', '✅', 'Proceso terminado correctamente', { salida: outputDir, log: logPath });
    } finally {
        await new Promise(resolve => logStream.end(resolve));
    }
}

main().catch((err) => {
    logError('ELECTRONICO 2 LOCAL', '❌', 'Proceso fallido', err);
    process.exitCode = 1;
});
