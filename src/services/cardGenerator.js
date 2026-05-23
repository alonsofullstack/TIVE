const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const pdf2img = require('pdf-img-convert');
const sharp = require('sharp');
const zlib = require('zlib');

const config = require('../config');
const {
    DOMAIN, QR_X, QR_Y, QR_SIZE, COMPLETE_TEMPLATE_NAME,
    TIVE_COMPLETO_BODY_CODE, TIVE_COMPLETO_TECH_CODE,
    uploadDir, FONT_BYTES
} = config;

const { logInfo, logError, logTimer } = require('../utils/logger');
const {
    safe,
    obtenerZonaNormalizada,
    limpiarPotencia,
    fmtPlaca,
    validarPlacaExtraida,
    limpiarEtiquetaRegistral,
    generarCodigoVerificacion,
    generarFechaHoraTive,
    generarHashVerificacion,
    escapeMarkdown
} = require('../utils/helpers');

const state = require('../state');
const {
    userState, userTiveCompletoData, userTiveCompletarData
} = state;

const C128_PATTERNS = { '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10001101100', '4': '10001100110', '5': '10110001100', '6': '10110000110', '7': '10110110000', '8': '10110011011', '9': '11001011000', 'A': '11000101100', 'B': '11000100110', 'C': '11011000100', 'D': '11011000010', 'E': '11011011000', 'F': '11011001101', 'G': '11011011011', 'H': '11001101101', 'I': '11001101111', 'J': '11011110110', 'K': '11011111011', 'L': '11110110110', 'M': '11110110111', 'N': '11110111101', 'O': '11110111111', 'P': '11001101101', 'Q': '11001101111', 'R': '11011110110', 'S': '11011111011', 'T': '11110110110', 'U': '11110110111', 'V': '11110111101', 'W': '11110111111', 'X': '11001101101', 'Y': '11001101111', 'Z': '11011110110', '-': '11000111010', '.': '11011011110', ' ': '11011011011', ':': '11011111010' };

const TIVE_COMPLETO_FIELDS = [
    { key: 'codigo_de_verificacion', dataKey: 'codVerif', x: 231, y: 615, dx: -7.3, dy: -10.3, size: 8, bold: false },
    { key: 'fecha', dataKey: 'fechaFinal', x: 180.8, y: 579.5, dx: -13, dy: 1, size: 8, bold: false },
    { key: 'zona_registral', dataKey: 'zonaLimpia', x: 144.0, y: 482.0, dx: -16, dy: 6, size: 9, bold: true },
    { key: 'sede_registral', dataKey: 'sedeLimpia', x: 141.0, y: 467.0, dx: -22.5, dy: 6.5, size: 9, bold: true },
    { key: 'parda_registral', dataKey: 'partida', x: 120.9, y: 452.9, dx: -6, dy: -5.5, size: 8, bold: false },
    { key: 'duadam', dataKey: 'dua', x: 103.1, y: 438, dx: -10.5, dy: -7, size: 8, bold: false },
    { key: 'titulo', dataKey: 'titulo', x: 89.3, y: 422.3, dx: -13, dy: -7, size: 8, bold: false },
    { key: 'fecha_del_titulo', dataKey: 'fechaTitulo', x: 126.3, y: 406.6, dx: -14.5, dy: -7, size: 8, bold: false },
    { key: 'categoria', dataKey: 'categoria', x: 105.1, y: 274.4, dx: -16, dy: -6.5, size: 8, bold: false },
    { key: 'marca', dataKey: 'marca', x: 89.9, y: 261.1, dx: -8, dy: -7, size: 8, bold: false },
    { key: 'modelo', dataKey: 'modelo', x: 96.8, y: 246.8, dx: -12.5, dy: -6, size: 8, bold: false },
    { key: 'color', dataKey: 'color', x: 88.4, y: 233.2, dx: -12, dy: -6, size: 8, bold: false },
    { key: 'numero_de_vin', dataKey: 'vin', x: 120.5, y: 220.2, dx: -8.5, dy: -7, size: 8, bold: false },
    { key: 'numero_de_serie', dataKey: 'serie', x: 128.3, y: 206.2, dx: -11, dy: -7, size: 8, bold: false },
    { key: 'numero_motor', dataKey: 'motor', x: 118, y: 191.9, dx: -11, dy: -7, size: 8, bold: false },
    { key: 'carroceria', dataKey: 'carroceria', x: 104.5, y: 178.6, dx: -8.5, dy: -7, size: 8, bold: false },
    { key: 'potencia', dataKey: 'potencia', x: 99.6, y: 164, dx: -10, dy: -7, size: 8, bold: false },
    { key: 'form_rod', dataKey: 'formRod', x: 107.6, y: 150.7, dx: -10, dy: -6, size: 8, bold: false },
    { key: 'combusble', dataKey: 'combustible', x: 108.6, y: 138.4, dx: -6.5, dy: -8, size: 8, bold: false },
    { key: 'asientos', dataKey: 'asientos', x: 104.1, y: 108.5, dx: -7, dy: -4, size: 8, bold: false },
    { key: 'pasajeros', dataKey: 'pasajeros', x: 103.1, y: 96.4, dx: -7, dy: -6, size: 8, bold: false },
    { key: 'ruedas', dataKey: 'ruedas', x: 103.9, y: 67, dx: -7.5, dy: -4, size: 8, bold: false },
    { key: 'ejes', dataKey: 'ejes', x: 103.5, y: 81.8, dx: -7, dy: -5, size: 8, bold: false },
    { key: 'placa', dataKey: 'placa', x: 317.9, y: 406.9, dx: -6, dy: -6, size: 25, bold: true },
    { key: 'año_fabricacion', dataKey: 'añoFabricacion', x: 392.6, y: 272.6, dx: -9, dy: -6, size: 8, bold: false },
    { key: 'cilindros', dataKey: 'cilindros', x: 208.6, y: 114.2, dx: 7, dy: -9, size: 8, bold: false },
    { key: 'longitud', dataKey: 'longitud', x: 213.9, y: 100.2, dx: 2, dy: -8, size: 8, bold: false },
    { key: 'altura', dataKey: 'altura', x: 213.9, y: 86.2, dx: 2, dy: -8.5, size: 8, bold: false },
    { key: 'ancho', dataKey: 'ancho', x: 212.6, y: 71.6, dx: 3.5, dy: -8, size: 8, bold: false },
    { key: 'cilindro', dataKey: 'cilindrada', x: 333.9, y: 109.6, dx: 24, dy: -5, size: 8, bold: false },
    { key: 'p_bruto', dataKey: 'pBruto', x: 326.6, y: 97.6, dx: 32, dy: -6, size: 8, bold: false },
    { key: 'campo_30', dataKey: 'pNeto', x: 329.9, y: 82.9, dx: 29, dy: -4, size: 8, bold: false },
    { key: 'campo_31', dataKey: 'cargaUtil', x: 322.6, y: 71.6, dx: 37, dy: -6, size: 8, bold: false },
    { key: 'version', dataKey: 'version', x: 273.4, y: 155.9, dx: -6.5, dy: -8, size: 8, bold: false },
    { key: 'año_modelo', dataKey: 'añoModelo', x: 392.6, y: 259.1, dx: -2.5, dy: -3, size: 8, bold: false },
    { key: 'titulo_numero', dataKey: 'tituloNo', x: 190.6, y: 590.2, dx: -13, dy: 2.5, size: 8, bold: false },
];

const TIVE_COMPLETO_REQUIRED_FIELDS = [
    { key: 'zona', label: 'ZONA REGISTRAL' },
    { key: 'sede', label: 'SEDE REGISTRAL' },
    { key: 'partida', label: 'PARTIDA REGISTRAL' },
    { key: 'dua', label: 'DUA/DAM' },
    { key: 'titulo', label: 'TÍTULO' },
    { key: 'fechaTitulo', label: 'FECHA DEL TÍTULO' },
    { key: 'placa', label: 'PLACA' },
    { key: 'categoria', label: 'CATEGORÍA' },
    { key: 'marca', label: 'MARCA' },
    { key: 'modelo', label: 'MODELO' },
    { key: 'color', label: 'COLOR' },
    { key: 'vin', label: 'VIN' },
    { key: 'serie', label: 'NÚMERO DE SERIE' },
    { key: 'motor', label: 'NÚMERO DE MOTOR' },
    { key: 'añoFabricacion', label: 'AÑO DE FABRICACIÓN' },
    { key: 'añoModelo', label: 'AÑO DE MODELO' },
    { key: 'potencia', label: 'POTENCIA' },
    { key: 'formRod', label: 'FÓRMULA RODANTE' },
    { key: 'combustible', label: 'TIPO COMBUSTIBLE' },
    { key: 'pasajeros', label: 'NRO. PASAJEROS' },
    { key: 'cargaUtil', label: 'CARGA ÚTIL' },
    { key: 'version', label: 'VERSIÓN' },
    { key: 'tituloNo', label: 'TÍTULO N° (solo número o completo)' },
];

function drawRealBarcode(page, text, x, y, width, height) {
    const startCode = '11010010000'; const stopCode = '1100011101011';
    let pattern = startCode;
    for (let char of (text || '').toUpperCase()) { pattern += C128_PATTERNS[char] || '11011011011'; }
    pattern += stopCode;
    const moduleWidth = width / pattern.length;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') { page.drawRectangle({ x: x + (i * moduleWidth), y, width: moduleWidth, height, color: rgb(0, 0, 0) }); }
    }
}

function getTemplatePath(name) {
    const p = [
        path.join(__dirname, '..', '..', 'tarjeta', name),
        path.join(__dirname, '..', '..', name),
        path.join(process.cwd(), 'tarjeta', name),
        path.join(process.cwd(), name)
    ];
    logInfo('TEMPLATE', '🔍', `Buscando plantilla: "${name}"`, { rutasCandidatas: p.length });
    for (const pathFound of p) {
        if (fs.existsSync(pathFound)) {
            logInfo('TEMPLATE', '✅', `Plantilla encontrada exitosamente`, { nombre: name, ruta: pathFound });
            return pathFound;
        }
    }
    throw new Error(`No se encontró la plantilla ${name}. Rutas revisadas: ${p.join(', ')}`);
}

function valorCompleto(datos, dataKey) {
    const value = datos[dataKey];
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function valorPdf417(datos, dataKey) {
    return valorCompleto(datos, dataKey)
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function formatearPdf417TiveCompleto(datos) {
    const zona = valorPdf417(datos, 'zonaLimpia') || valorPdf417(datos, 'zona');
    const sede = valorPdf417(datos, 'sedeLimpia') || valorPdf417(datos, 'sede');
    const placa = valorPdf417(datos, 'placa');
    const partida = valorPdf417(datos, 'partida');
    const dua = valorPdf417(datos, 'dua');
    const titulo = valorPdf417(datos, 'titulo');
    const fechaTitulo = valorPdf417(datos, 'fechaTitulo');
    const estado = valorPdf417(datos, 'estado') || 'NUEVO';
    const codVerif = valorPdf417(datos, 'codVerif');
    const marca = valorPdf417(datos, 'marca');
    const motor = valorPdf417(datos, 'motor');
    const vin = valorPdf417(datos, 'vin');
    const serie = valorPdf417(datos, 'serie');

    return [
        `!ZONA REGISTRAL N ${zona}!SEDE REGISTRAL`,
        `- ${sede.padEnd(22)}!${placa} !`,
        `${partida}!${dua}!`,
        `${titulo}!${fechaTitulo}!`,
        `${estado.padEnd(22)}!    !${codVerif}!`,
        `${marca.padEnd(22)}!`,
        `${motor.padEnd(22)}!`,
        `${vin.padEnd(22)}!`,
        serie,
    ].join('\n');
}

function placaRequiereConfirmacion(valor = '') {
    const original = safe(valor);
    if (!original) return true;
    // Normalize all dash types to standard hyphen before checking
    const normalized = original.replace(/[–—]/g, '-');
    return !normalized.includes('-');
}

async function aplicarSeguridadOCR(pdfBuffer, width = 2000) {
    logInfo('OCR SECURITY', '🔒', `Aplicando seguridad tipo OCR (aplanado de PDF a imágenes)`, { bufferSize: `${pdfBuffer.length} bytes`, anchoRender: `${width}px` });
    const timer = logTimer('OCR SECURITY', 'Aplanado OCR');
    try {
        const images = await pdf2img.convert(pdfBuffer, { width: width });
        const securedPdf = await PDFDocument.create();

        for (let i = 0; i < images.length; i++) {
            const imgBuffer = Buffer.from(images[i]);
            const embeddedImg = await securedPdf.embedPng(imgBuffer);
            const { width: imgW, height: imgH } = embeddedImg.scale(1);
            const page = securedPdf.addPage([imgW, imgH]);
            page.drawImage(embeddedImg, { x: 0, y: 0, width: imgW, height: imgH });
        }

        return await securedPdf.save();
    } catch (e) {
        logError('OCR SECURITY', '❌', `Error aplicando seguridad OCR — usando PDF original sin aplanar como fallback`, e);
        return pdfBuffer;
    }
}

function prepararDatosTiveCompleto(datos) {
    const prepared = { ...datos };
    prepared.placaOriginal = safe(prepared.placaOriginal || prepared.placa);
    prepared.placa = fmtPlaca(prepared.placa || '');
    prepared.codVerif = safe(prepared.codVerif) || generarCodigoVerificacion();
    prepared.fechaFinal = safe(prepared.fechaFinal) || generarFechaHoraTive();
    prepared.añoFabricacion = safe(prepared.añoFabricacion);
    prepared.añoModelo = safe(prepared.añoModelo);
    prepared.potencia = limpiarPotencia(prepared.potencia || '');
    if (prepared.cargaUtil && String(prepared.cargaUtil).trim().startsWith('-')) {
        prepared.cargaUtil = '';
    }
    return prepared;
}

function obtenerCamposFaltantesTiveCompleto(datos) {
    return TIVE_COMPLETO_REQUIRED_FIELDS.filter(field => {
        if (field.key === 'placa') return placaRequiereConfirmacion(datos.placaOriginal);
        const val = safe(datos[field.key]);
        if (field.key === 'dua' && (val === '0' || !val.includes('-'))) return true;
        return !val;
    });
}

function obtenerCamposFaltantesTiveCompletar(datos) {
    const standardFields = TIVE_COMPLETO_REQUIRED_FIELDS.filter(field => {
        if (['añoFabricacion', 'añoModelo', 'fechaTitulo', 'titulo', 'tituloNo', 'añoTitulo'].includes(field.key)) {
            return false;
        }
        if (field.key === 'placa') return placaRequiereConfirmacion(datos.placaOriginal);
        const val = safe(datos[field.key]);
        if (field.key === 'dua' && (val === '0' || !val.includes('-'))) return true;
        return !val;
    });

    const forcedFields = [
        { key: 'añoFabricacion', label: 'AÑO DE FABRICACIÓN' },
        { key: 'añoModelo', label: 'AÑO DE MODELO' },
        { key: 'añoTitulo', label: 'AÑO DE TÍTULO' },
        { key: 'fechaTitulo', label: 'FECHA DE TÍTULO' },
        { key: 'tituloNo', label: 'TÍTULO N° (solo número o completo)' }
    ];

    return [...forcedFields, ...standardFields];
}

module.exports = function(bot) {

    async function generarTarjetaAntigua(chatId, datos, originalBuffer = null) {
        logInfo('ANTIGUA', '🎨', `Generando tarjeta de inscripción antigua`, { placa: datos.placa, zona: datos.zona || '?', sede: datos.sede || '?', tieneBufferOriginal: !!originalBuffer });
        const templatePath = getTemplatePath('placaplantilla.pdf');
        const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));

        pdfDoc.setTitle(`CERTIFICADO DE IDENTIFICACIÓN VEHICULAR - ${datos.placa}`);
        pdfDoc.setAuthor('SUNARP - Sistema TIVE');
        pdfDoc.registerFontkit(fontkit);

        const fontB = await pdfDoc.embedFont(FONT_BYTES);
        const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const fontSerifNorm = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const fontFina = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontArialBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const page = pdfDoc.getPages()[0];
        const { height } = page.getSize();
        const gris = rgb(0.2, 0.2, 0.2);

        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

        const draw = (text, x, y, size = 7, color = gris, customFont = fontSerif, forceUpper = true) => {
            if (!text) return;
            const txt = forceUpper ? String(text).toUpperCase() : String(text);
            page.drawText(txt, { x, y: height - y, size, font: customFont, color });
            page.drawText(txt, { x: x + 0.2, y: height - y, size, font: customFont, color });
        };

        const drawSeg = (txt, x, y, s1 = 12, s2 = 12, size = 7, color = gris, font = fontSerif) => {
            if (!txt) return;
            draw(txt, x, y, size, color, font);
        };

        draw(datos.zona, 269, 139, 9);
        draw(datos.sede, 225, 147.6, 8);
        draw(datos.reparticion, 169, 164, 8);
        draw(datos.placaSede, 90, 176, 8.5);
        draw(datos.placa, 80, 195, 18.5);
        drawSeg(datos.partida, 233, 195, 11, 10, 8);
        draw(datos.apPaterno, 105, 235, 8);
        draw(datos.apPaterno2, 189, 235, 8);
        draw(datos.apMaterno, 105, 245, 8);
        draw(datos.apMaterno2, 189, 245, 8);
        draw(datos.nombres, 105, 257, 8);
        draw(datos.nombres2, 185, 258, 8);
        draw(datos.domicilio, 68, 283, 7.2);
        draw(datos.sedeDomicilio, 105, 269, 7.5);
        drawSeg(datos.fechaPropiedad, 126, 296, 10, 11, 9.5);
        drawSeg(datos.fechaInferior, 210, 365, 15, 14, 10.5, gris);

        const drawTec = (text, x, y, size = 11) => {
            if (!text) return;
            let finalX = x;
            if (String(text).toUpperCase().includes("MT") || String(text).toUpperCase().includes("TN")) {
                finalX -= 7;
            }
            draw(text, finalX, y, size);
        };

        draw(datos.clase, 323, 149, 10);
        draw(datos.marca, 420, 149, 11);
        draw(datos.añoFab, 510, 145, 11);
        draw(datos.modelo, 337, 173, 11);
        draw(datos.combustible, 485, 176, 11);
        draw(datos.carroceria, 337, 198, 11);
        draw(datos.ejes, 535, 198, 11);
        draw(datos.color, 337, 220, 11);
        draw(datos.cilindros, 531, 245, 11);
        draw(datos.motor, 335, 243, 11);
        draw(datos.ruedas, 531, 268, 11);
        draw(datos.serie, 335, 267, 11);
        draw(datos.pasajeros, 345, 292, 11);
        draw(datos.asientos, 395, 292, 11);
        drawTec(datos.pesoSeco, 447, 292, 11);
        drawTec(datos.pesoBruto, 500, 292, 11);
        drawTec(datos.longitud, 335, 319, 11);
        drawTec(datos.altura, 385, 319, 11);
        drawTec(datos.ancho, 447, 319, 11);
        drawTec(datos.cargaUtil, 500, 319, 11);

        draw(datos.zona, 436, 357.5, 4.3, gris, fontArialBold);
        draw(capitalize(datos.sede), 455, 357.5, 4.3, gris, fontArialBold, false);

        const pdfBytes = await pdfDoc.save();
        const fileName = `Tarjeta_Antigua_${(datos.placa || 'DOC').toUpperCase()}.pdf`;
        await bot.sendDocument(chatId, Buffer.from(pdfBytes), { caption: "✅ Tarjeta Antigua Generada con Éxito" }, { filename: fileName });
    }

    async function generarTIVE(chatId, datos, qrCustomLink = null, originalBuffer = null) {
        if (!safe(datos.placa)) {
            throw new Error("No se detectó la placa. El OCR no pudo leerla; envía un PDF más nítido o usa el nombre del archivo con la placa, por ejemplo TIVE_7061XS.pdf.");
        }

        let zonaLimpia = obtenerZonaNormalizada(datos.zona, datos.sede);
        let sedeLimpia = safe(datos.sede);

        const labelsToRemove = [
            "SEDE REGISTRAL -", "SEDE REGISTRAL-", "SEDE REGISTRAL", "SEDE"
        ];
        labelsToRemove.forEach(label => {
            const regex = new RegExp(`^${label}\\s*[:\\-]*\\s*`, 'i');
            sedeLimpia = sedeLimpia.replace(regex, '');
        });

        logInfo('TIVE', '🎨', `Generando tarjeta PVC (anverso + reverso)`, {
            placa: safe(datos.placa),
            titulo: safe(datos.titulo),
            sede: sedeLimpia,
            zona: zonaLimpia,
            tieneQRCustom: !!qrCustomLink,
            tieneBufferOriginal: !!originalBuffer
        });
        const gris = rgb(0.6, 0.6, 0.6);
        const negro = rgb(0, 0, 0);

        const pdfAnt = await PDFDocument.load(fs.readFileSync(getTemplatePath('adelantexd.pdf')));
        pdfAnt.registerFontkit(fontkit);
        const fontBAnt = await pdfAnt.embedFont(FONT_BYTES);
        const pageA = pdfAnt.getPages()[0];
        const { height: hA } = pageA.getSize();
        pageA.drawText(zonaLimpia, { x: 58, y: hA - 55.5, size: 5.2, font: fontBAnt, color: gris });
        pageA.drawText(sedeLimpia, { x: 53, y: hA - 63.5, size: 5.2, font: fontBAnt, color: gris });
        pageA.drawText(safe(datos.partida), { x: 65, y: hA - 75, size: 6.8, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.dua), { x: 50, y: hA - 89, size: 6.8, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.titulo), { x: 34.5, y: hA - 104, size: 6.8, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.fechaTitulo), { x: 62, y: hA - 117, size: 6.8, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.placa), { x: 159, y: hA - 115, size: 17.9, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.codVerif), { x: 213, y: hA - 142, size: 4.5, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.tituloNo), { x: 183, y: hA - 149.5, size: 4.5, font: fontBAnt, color: negro });
        pageA.drawText(safe(datos.fechaFinal), { x: 177, y: hA - 158, size: 4.5, font: fontBAnt, color: negro });

        const barImgAnv = await bwipjs.toBuffer({
            bcid: 'code128',
            text: safe(datos.placa),
            scale: 4,
            height: 15,
            includetext: false,
        });
        const pngBarAnv = await pdfAnt.embedPng(barImgAnv);
        pageA.drawImage(pngBarAnv, { x: 10, y: hA - 168, width: 82, height: 18 });

        const DOMAIN_URL = process.env.DOMAIN_URL || 'http://localhost:3000';
        const finalQR = qrCustomLink || `${DOMAIN_URL}/servicio/verCertificado/Tive/TIVE-${safe(datos.placa).toUpperCase()}`;
        const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL(finalQR, { margin: 1 }));
        pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });

        const pdfRev = await PDFDocument.load(fs.readFileSync(getTemplatePath('atrasxd.pdf')));
        pdfRev.registerFontkit(fontkit);
        const fontBRev = await pdfRev.embedFont(FONT_BYTES);
        const pageR = pdfRev.getPages()[0];
        const { height: hR, width: wR } = pageR.getSize();
        const dR = (t, x, y, size = 4.5) => pageR.drawText(safe(t), { x, y: hR - y, size, font: fontBRev, color: negro });
        dR(datos.categoria, 37, 40.5); dR(datos.marca, 37, 47.5); dR(datos.modelo, 37, 54.5);
        dR(datos.color, 37, 61.5); dR(datos.vin, 59, 69.5); dR(datos.serie, 59, 76.5);
        dR(datos.motor, 61, 83.5); dR(datos.carroceria, 59, 90.5); dR(datos.potencia, 45, 97.5);
        dR(datos.formRod, 45, 104.5); dR(datos.combustible, 48, 111.5);
        dR(datos.añoModelo, 225, 39); dR(datos.version, 148, 100);
        dR(datos.asientos, 45, 122); dR(datos.pasajeros, 45, 129);
        dR(datos.ruedas, 45, 134.9); dR(datos.ejes, 45, 141.9);
        dR(datos.cilindros, 115, 121); dR(datos.longitud, 115, 127.8);
        dR(datos.altura, 115, 134.6); dR(datos.ancho, 115, 141.4);
        dR(datos.cilindrada, 203, 121); dR(datos.pBruto, 203, 127.8);
        dR(datos.pNeto, 203, 134.6); dR(datos.cargaUtil, 203, 142);

        const barText = formatearPdf417TiveCompleto({
            ...datos,
            zonaLimpia,
            sedeLimpia,
        });
        const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 }));
        pageR.drawImage(barImg, { x: (wR / 2) - (246 / 2), y: 5, width: 170, height: 22 });

        if (originalBuffer) {
            try {
                const images = await pdf2img.convert(originalBuffer, { width: 2000 });
                if (images && images.length > 0) {
                    const imgBuffer = Buffer.from(images[0]);
                    const metadata = await sharp(imgBuffer).metadata();
                    const scale = 2000 / 612;

                    let left = Math.round(403.05 * scale);
                    let top = Math.round(790 * scale);
                    let width = Math.round(140 * scale);
                    let height = Math.round(60 * scale);

                    left = Math.max(0, Math.min(left, metadata.width - 1));
                    top = Math.max(0, Math.min(top, metadata.height - 1));
                    width = Math.min(width, metadata.width - left);
                    height = Math.min(height, metadata.height - top);

                    if (width > 0 && height > 0) {
                        const sigCrop = await sharp(imgBuffer)
                            .extract({ left, top, width, height })
                            .png()
                            .toBuffer();

                        const sigImg = await pdfRev.embedPng(sigCrop);
                        pageR.drawImage(sigImg, { x: 184, y: 4, width: 55, height: 24 });
                    }
                }
            } catch (e) { logError('TIVE', '⚠️', `Error recortando firma del PDF original para incrustar en reverso`, e); }
        }

        const bufA = await pdfAnt.save();
        const bufR = await pdfRev.save();

        try {
            const imgA = await pdf2img.convert(bufA, { width: 1200 });
            const imgR = await pdf2img.convert(bufR, { width: 1200 });

            const cropPx = 35;
            const recortarParaTelegram = async (bufferImg, extraRight = 0, extraLeft = 0) => {
                const buffer = Buffer.from(bufferImg);
                const metadata = await sharp(buffer).metadata();

                const left = cropPx + extraLeft;
                const top = cropPx;
                const right = cropPx + extraRight;
                const bottom = cropPx;

                const finalW = metadata.width - left - right;
                const finalH = metadata.height - top - bottom;

                if (finalW > 0 && finalH > 0) {
                    return await sharp(buffer)
                        .extract({ left, top, width: finalW, height: finalH })
                        .toBuffer();
                }
                return buffer;
            };

            logInfo('TIVE', '✂️', `Aplicando recorte asimétrico para Telegram`, { cropPx, extraRightAnv: 30, extraRightRev: 25, extraLeftRev: 25 });
            const finalImgA = await recortarParaTelegram(imgA[0], 30, 0);
            const finalImgR = await recortarParaTelegram(imgR[0], 25, 25);

            logInfo('TIVE', '📤', `Enviando imágenes PNG al usuario`, { chatId, anversoSize: `${finalImgA.length} bytes`, reversoSize: `${finalImgR.length} bytes` });

            await bot.sendPhoto(chatId, finalImgA, { caption: `✅ Anverso (Recortado)` }, { filename: 'anverso.png', contentType: 'image/png' });
            await bot.sendPhoto(chatId, finalImgR, { caption: `✅ Reverso (Recortado)` }, { filename: 'reverso.png', contentType: 'image/png' });

            logInfo('TIVE', '✅', `Imágenes PVC enviadas exitosamente al chat`, { chatId, placa: safe(datos.placa) });
        } catch (e) {
            logError('TIVE', '❌', `Error enviando fotos PNG al chat ${chatId} — activando fallback a PDF`, e);
            logInfo('TIVE', '📤', `Enviando respaldo en PDF (aplanado OCR)`, { chatId, placa: safe(datos.placa) });
            const securedBufA = await aplicarSeguridadOCR(Buffer.from(bufA));
            const securedBufR = await aplicarSeguridadOCR(Buffer.from(bufR));
            await bot.sendDocument(chatId, Buffer.from(securedBufA), { caption: "Anverso (PDF)" }, { filename: `anv_${safe(datos.placa)}.pdf` });
            await bot.sendDocument(chatId, Buffer.from(securedBufR), { caption: "Reverso (PDF)" }, { filename: `rev_${safe(datos.placa)}.pdf` });
        }
    }

    async function generarTiveCompleto(chatId, datos, qrCustomLink = null, verificationHash = null, firmaPathOverride = null) {
        const timerCompleto = logTimer('TIVE COMPLETO', `Generación PDF completo para ${safe(datos.placa)}`);
        logInfo('TIVE COMPLETO', '🎨', `Generando PDF completo`, {
            placa: safe(datos.placa),
            tieneQRCustom: !!qrCustomLink,
            tieneHash: !!verificationHash,
            tieneFirmaOverride: !!firmaPathOverride
        });

        const templatePath = getTemplatePath(COMPLETE_TEMPLATE_NAME);
        const templateBytes = fs.readFileSync(templatePath);
        const templateDoc = await PDFDocument.load(templateBytes);
        templateDoc.registerFontkit(fontkit);
        const page = templateDoc.getPages()[0];
        const { width, height } = page.getSize();

        const fontRegular = await templateDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await templateDoc.embedFont(StandardFonts.HelveticaBold);
        const negro = rgb(0, 0, 0);
        const gris = rgb(0.6, 0.6, 0.6);

        const baseDatos = prepararDatosTiveCompleto(datos);
        if (!baseDatos.añoFabricacion && baseDatos.añoModelo) {
            baseDatos.añoFabricacion = baseDatos.añoModelo;
        }
        if (!baseDatos.añoModelo && baseDatos.añoFabricacion) {
            baseDatos.añoModelo = baseDatos.añoFabricacion;
        }
        const datosCompletos = {
            ...baseDatos,
            zonaLimpia: obtenerZonaNormalizada(baseDatos.zona, baseDatos.sede),
            sedeLimpia: limpiarEtiquetaRegistral(baseDatos.sede),
        };
        const pdfDisplayName = `TIVE_${safe(datosCompletos.placa) || 'DOC'}`;
        templateDoc.setTitle(pdfDisplayName);
        templateDoc.setSubject('Tarjeta de Identificacion Vehicular Electronica');
        templateDoc.setAuthor('SUNARP');
        templateDoc.setCreator('TIVE');
        templateDoc.setProducer('TIVE');

        const drawnFields = [];
        for (const field of TIVE_COMPLETO_FIELDS) {
            const value = valorCompleto(datosCompletos, field.dataKey);
            if (!value) continue;
            page.drawText(value, {
                x: field.x + field.dx,
                y: field.y + field.dy,
                size: field.size,
                font: field.bold ? fontBold : fontRegular,
                color: ['zona_registral', 'sede_registral'].includes(field.key.trim()) ? gris : negro,
            });
            drawnFields.push(`${field.dataKey}=${value}`);
        }
        logInfo('TIVE COMPLETO', '🖨️', `Campos impresos en PDF (${drawnFields.length}/${TIVE_COMPLETO_FIELDS.length})`, `${drawnFields.join(' | ')}`);

        const qrHeaderText = safe(datosCompletos.placa) || 'SIN-PLACA';
        const hash = verificationHash || generarHashVerificacion(null, datosCompletos);
        const finalQRLink = qrCustomLink || `${DOMAIN}/servicio/verCertificado/Tive/${hash}`;
        const qrHeaderImg = await templateDoc.embedPng(await QRCode.toDataURL(finalQRLink, {
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
        }));
        const headerW = QR_SIZE;
        const headerH = headerW;
        const headerX = (QR_X / 100) * width;
        const headerY = height - ((QR_Y / 97) * height) - headerW;
        page.drawImage(qrHeaderImg, { x: headerX, y: headerY, width: headerW, height: headerH });

        const plateBarcodeImg = await templateDoc.embedPng(await bwipjs.toBuffer({
            bcid: 'code128',
            text: qrHeaderText,
            scale: 4,
            height: 12,
            includetext: false,
            backgroundcolor: 'FFFFFF',
        }));
        page.drawImage(plateBarcodeImg, TIVE_COMPLETO_BODY_CODE);

        const pdf417Text = formatearPdf417TiveCompleto(datosCompletos);
        const pdf417Img = await templateDoc.embedPng(await bwipjs.toBuffer({
            bcid: 'pdf417',
            text: pdf417Text,
            scale: 1,
            height: 16,
            includetext: false,
            backgroundcolor: 'FFFFFF',
            paddingwidth: 0,
            paddingheight: 0,
        }));
        page.drawImage(pdf417Img, TIVE_COMPLETO_TECH_CODE);

        try {
            const sedeInput = datosCompletos.sedeLimpia || datosCompletos.sede;
            const signatureService = require('./signatureService')(bot);
            const firmaPath = firmaPathOverride || signatureService.buscarArchivoFirma(sedeInput);
            
            if (!firmaPath || !fs.existsSync(firmaPath)) {
                await signatureService.pedirFirmaFaltanteTive(chatId, sedeInput, datos, qrCustomLink, verificationHash);
                return;
            }
            if (firmaPath && fs.existsSync(firmaPath)) {
                const signatureImgBytes = fs.readFileSync(firmaPath);
                let embeddedImg;
                if (firmaPath.toLowerCase().endsWith('.png')) {
                    embeddedImg = await templateDoc.embedPng(signatureImgBytes);
                } else {
                    embeddedImg = await templateDoc.embedJpg(signatureImgBytes);
                }

                page.drawImage(embeddedImg, {
                    x: 330,
                    y: 9,
                    width: 100,
                    height: 50
                });
                logInfo('TIVE COMPLETO', '✍️', `Firma de la sede incrustada exitosamente en el PDF`, { sede: sedeInput, firmaPath, posicion: 'x=330, y=9, w=100, h=50' });
            }
        } catch (err) {
            logError('TIVE COMPLETO', '❌', `Error incrustando firma de la sede en el PDF`, err);
        }

        const outBytes = await templateDoc.save();
        const securedBytes = Buffer.from(outBytes);

        const finalPath = path.join(uploadDir, `${hash}.pdf`);
        fs.writeFileSync(finalPath, Buffer.from(securedBytes));
        logInfo('TIVE COMPLETO', '✅', `PDF verificable guardado exitosamente`, {
            ruta: finalPath,
            hash: hash.substring(0, 16) + '...',
            tamaño: `${securedBytes.length} bytes`,
            tamañoKB: `${(securedBytes.length / 1024).toFixed(1)} KB`,
            placa: safe(datosCompletos.placa)
        });
        timerCompleto.end(`hash=${hash.substring(0, 16)}...`);

        const fileName = `${pdfDisplayName}.pdf`;
        await bot.sendDocument(chatId, Buffer.from(securedBytes), {
            caption:
                `✅ TIVE COMPLETO generado para ${qrHeaderText}\n\n` +
                `🔐 Hash: \`${hash}\`\n` +
                `🌐 Link: \`${finalQRLink}\``,
            parse_mode: 'Markdown'
        }, { filename: fileName });
    }

    async function finalizarInsercionQR(chatId, buffer, placa, hash, messageId = null) {
        const pdfDoc = await PDFDocument.load(buffer);
        const page = pdfDoc.getPages()[0];
        const { width, height } = page.getSize();
        logInfo('QR', '📐', `PDF original cargado`, { ancho: width, alto: height, paginas: pdfDoc.getPageCount() });

        const qrUrl = `${DOMAIN}/servicio/verCertificado/Tive/${hash}`;
        const qrImg = await pdfDoc.embedPng(await QRCode.toDataURL(qrUrl, {
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
        }));

        const qrSize = QR_SIZE;
        const posX = (QR_X / 100) * width;
        const posY = height - ((QR_Y / 100) * height) - qrSize;

        logInfo('QR', '📍', `Pegando QR en PDF`, { posX: posX.toFixed(2), posY: posY.toFixed(2), qrSize, qrUrl: qrUrl.substring(0, 60) + '...' });

        page.drawImage(qrImg, { x: posX, y: posY, width: qrSize, height: qrSize });

        const pdfBytes = await pdfDoc.save();

        const finalFileName = `${hash}.pdf`;
        const finalPath = path.join(uploadDir, finalFileName);
        fs.writeFileSync(finalPath, Buffer.from(pdfBytes));
        logInfo('QR', '✅', `Certificado con QR guardado exitosamente`, { ruta: finalPath, tamaño: `${pdfBytes.length} bytes`, hash: hash.substring(0, 16) + '...' });

        const fileName = `Certificado-Tive-${hash.substring(0, 8)}.pdf`;

        await bot.sendDocument(chatId, Buffer.from(pdfBytes), {
            caption:
                `✨ *¡DOCUMENTO VERIFICADO EXITOSAMENTE!* ✨\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📂 *Archivo:* \`${placa}\`\n` +
                `🔐 *Hash de Seguridad:* \n\`${hash.substring(0, 32)}\`\n\`${hash.substring(32)}\`\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🌐 *Link de verificación:*\n\`${qrUrl}\`\n\n` +
                `📱 _El código QR ha sido insertado en el documento para validación inmediata._`,
            parse_mode: 'Markdown'
        }, { filename: fileName });

        if (messageId) bot.deleteMessage(chatId, messageId).catch(() => { });
    }

    async function iniciarCapturaFaltantesTiveCompleto(chatId, datos, sourceBuffer = null) {
        const prepared = prepararDatosTiveCompleto(datos);
        const sourceHash = generarHashVerificacion(sourceBuffer, prepared);
        const missingFields = obtenerCamposFaltantesTiveCompleto(prepared);

        if (missingFields.length === 0) {
            userTiveCompletoData.delete(chatId);
            userState.delete(chatId);
            await generarTiveCompleto(chatId, prepared, null, sourceHash);
            return;
        }

        userTiveCompletoData.set(chatId, { datos: prepared, missingFields, index: 0, sourceHash });
        userState.set(chatId, 'awaiting_tive_completo_field');
        const current = missingFields[0];
        await bot.sendMessage(chatId, `✍️ Falta el dato *${current.label}*.\nEnvíalo ahora para continuar con *TIVE COMPLETO*.`, {
            parse_mode: 'Markdown'
        });
    }

    async function iniciarCapturaFaltantesTiveCompletar(chatId, datos, sourceBuffer = null) {
        const prepared = prepararDatosTiveCompleto(datos);
        const sourceHash = generarHashVerificacion(sourceBuffer, prepared);
        const missingFields = obtenerCamposFaltantesTiveCompletar(prepared);

        if (missingFields.length === 0) {
            userTiveCompletarData.delete(chatId);
            userState.delete(chatId);
            await generarTiveCompleto(chatId, prepared, null, sourceHash);
            return;
        }

        userTiveCompletarData.set(chatId, { datos: prepared, missingFields, index: 0, sourceHash });
        userState.set(chatId, 'awaiting_tive_completar_field');
        const current = missingFields[0];
        await bot.sendMessage(chatId, `✍️ Falta el dato *${current.label}*.\nEnvíalo ahora para continuar con *TIVE PARA COMPLETAR*.`, {
            parse_mode: 'Markdown'
        });
    }

    return {
        generarTarjetaAntigua,
        generarTIVE,
        generarTiveCompleto,
        finalizarInsercionQR,
        iniciarCapturaFaltantesTiveCompleto,
        iniciarCapturaFaltantesTiveCompletar
    };
};
