const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'canvas') {
        const skia = originalRequire.call(this, 'skia-canvas');
        if (!skia.createCanvas) {
            skia.createCanvas = (width, height) => new skia.Canvas(width, height);
        }
        return skia;
    }
    return originalRequire.apply(this, arguments);
};

const fs = require('fs');
const path = require('path');
const pdf2img = require('pdf-img-convert');
const sharp = require('sharp');
const { createWorker, PSM } = require('tesseract.js');

// Helper functions copied exactly from bot.js to see if its extraction pipeline works
const safe = (t) => t ? String(t).trim() : '';

function normalizarTextoBusqueda(texto = '') {
    return safe(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncarValorEnSiguienteEtiqueta(valor = '', etiquetaBusqueda = '') {
    const etiquetaNorm = normalizarTextoBusqueda(etiquetaBusqueda).toLowerCase();
    const etiquetasADerecha = [
        { name: 'placa', regex: /Plac\s*a/i },
        { name: 'fabricacion', regex: /A\s*[ñn]\s*o\s*F/i },
        { name: 'modelo', regex: /A\s*[ñn]\s*o\s*M/i },
        { name: 'version', regex: /V\s*er\s*si[oó]n/i },
        { name: 'cilindros', regex: /Cilindr\s*os/i },
        { name: 'cilindrada', regex: /Cilindr\s*ada/i },
        { name: 'longitud', regex: /Longitud/i },
        { name: 'bruto', regex: /P\s*\.\s*Brut/i },
        { name: 'bruto', regex: /Peso\s*Brut/i },
        { name: 'altura', regex: /Altur/i },
        { name: 'neto', regex: /P\s*\.\s*Net/i },
        { name: 'neto', regex: /Peso\s*Net/i },
        { name: 'ancho', regex: /Ancho/i },
        { name: 'cargautil', regex: /Carga\s*U/i },
        { name: 'cargautil', regex: /Car\s*g\s*a/i },
        { name: 'partida', regex: /Partida/i },
        { name: 'color', regex: /Color/i },
        { name: 'motor', regex: /Motor/i },
        { name: 'ejes', regex: /Ejes/i },
        { name: 'combustible', regex: /Combus/i },
        { name: 'ruedas', regex: /Ruedas/i },
        { name: 'potencia', regex: /Pot/i },
        { name: 'inmatriculacion', regex: /Inmatriculac/i },
        { name: 'propiedad', regex: /Prop/i },
        { name: 'asientos', regex: /Asientos/i },
        { name: 'condicion', regex: /Condic/i },
        { name: 'pasajeros', regex: /Pasajer/i }
    ];
    let limpio = valor;
    const dynamicLabelRegex = /\s+(?![0-9\s]+:)(?=.*[A-Za-zñÑáéíóúÁÉÍÓÚ])([A-Za-zñÑáéíóúÁÉÍÓÚ°º0-9\.\/]{2,}(?:\s+[A-Za-zñÑáéíóúÁÉÍÓÚ°º0-9\.\/]+)*)\s*:(?!\d)/;
    const dynamicMatch = dynamicLabelRegex.exec(limpio);
    if (dynamicMatch) {
        limpio = limpio.substring(0, dynamicMatch.index);
    }
    for (const item of etiquetasADerecha) {
        if (etiquetaNorm.includes(item.name)) continue;
        const match = item.regex.exec(limpio);
        if (match) { limpio = limpio.substring(0, match.index); }
    }
    return limpio.trim();
}

function limpiarValorTive(valor = '', etiqueta = '') {
    let truncado = truncarValorEnSiguienteEtiqueta(valor, etiqueta);
    let limpio = safe(truncado)
        .replace(/\s+/g, ' ')
        .replace(/^[\s:;.,\-–—°º#]+/, '')
        .trim();
    limpio = limpio.replace(/^\d+\s*[:\-–—]\s*/, '').trim();
    const etiquetaNorm = normalizarTextoBusqueda(etiqueta).toLowerCase();
    if (etiquetaNorm.includes('partida')) {
        limpio = limpio.replace(/^registral\s*[:;\-]?\s*/i, '');
    }
    return limpio;
}

function buscarPrimerValorTive(texto = '', etiquetas = []) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const etiqueta of etiquetas) {
        const etiquetaNorm = normalizarTextoBusqueda(etiqueta).toLowerCase();
        for (let i = 0; i < lines.length; i++) {
            const lineNorm = normalizarTextoBusqueda(lines[i]).toLowerCase();
            const idx = lineNorm.indexOf(etiquetaNorm);
            if (idx !== -1) {
                const resto = lines[i].substring(idx + etiqueta.length);
                let valor = limpiarValorTive(resto, etiqueta);
                if (valor) return valor;
                if (lines[i + 1]) {
                    const nextNorm = normalizarTextoBusqueda(lines[i + 1]).toLowerCase();
                    let esOtraEtiqueta = false;
                    const checkEtiquetas = ['placa', 'dua/dam', 'dua', 'dam', 'titulo', 'partida', 'fecha del titulo', 'categoria', 'marca', 'modelo', 'color', 'vin', 'serie', 'motor', 'carroceria', 'potencia', 'form. rod.', 'version', 'combustible', 'asientos', 'pasajeros', 'ruedas', 'ejes', 'cilindros', 'cilindrada', 'longitud', 'ancho', 'altura', 'p. bruto', 'p. neto', 'carga util', 'año modelo', 'año fabricacion'];
                    for (const check of checkEtiquetas) {
                        if (nextNorm.startsWith(check)) { esOtraEtiqueta = true; break; }
                    }
                    if (!esOtraEtiqueta) {
                        valor = limpiarValorTive(lines[i + 1], etiqueta);
                        if (valor) return valor;
                    }
                }
            }
        }
    }
    return '';
}

function fmtPlaca(p = '') {
    let s = safe(p).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length === 6) {
        if (/^\d{4}[A-Z]{2}$/.test(s)) {
            return s.substring(0, 4) + '-' + s.substring(4);
        }
        return s.substring(0, 3) + '-' + s.substring(3);
    }
    return s;
}

function validarPlacaExtraida(placa = '') {
    const p = safe(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (p.length !== 6) return '';
    if (!/[A-Z]/.test(p)) return '';
    return fmtPlaca(p);
}

function buscarPlacaEnTexto(texto = '') {
    const cleanText = texto.toUpperCase();
    const regexesEstandar = [
        /\b([A-Z]{3}-\d{3})\b/g,
        /\b([A-Z]{3}\d{3})\b/g,
        /\b(\d{4}-[A-Z]{2})\b/g,
        /\b(\d{4}[A-Z]{2})\b/g,
        /\b([A-Z]{2}-\d{4})\b/g,
        /\b([A-Z]{2}\d{4})\b/g,
        /\b(\d{5}-[A-Z])\b/g,
        /\b(\d{5}[A-Z])\b/g,
        /\b([A-Z]\d-\d{4})\b/g,
        /\b([A-Z]\d\d{4})\b/g,
        /\b(\d{4}-\d[A-Z])\b/g,
        /\b(\d{4}\d[A-Z])\b/g
    ];
    for (const regex of regexesEstandar) {
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            const placa = fmtPlaca(match[1]);
            if (validarPlacaExtraida(placa)) return placa;
        }
    }
    const regexesRuido = [
        /\b(\d{4})[^A-Z0-9]{1,5}([A-Z])[^A-Z0-9]{0,3}([A-Z])\b/g,
        /\b([A-Z]{3})[^A-Z0-9]{1,5}(\d{3})\b/g,
        /\b([A-Z]{2})[^A-Z0-9]{1,5}(\d{4})\b/g,
        /\b(\d{5})[^A-Z0-9]{1,5}([A-Z])\b/g,
        /\b(\d{4})[^A-Z0-9]{1,5}(\d)[^A-Z0-9]{0,3}([A-Z])\b/g,
        /\b([A-Z]\d)[^A-Z0-9]{1,5}(\d{4})\b/g
    ];
    for (const regex of regexesRuido) {
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            const cleanPart1 = match[1];
            const cleanPart2 = match[2];
            const cleanPart3 = match[3] || '';
            const placaCandidata = cleanPart1 + cleanPart2 + cleanPart3;
            const placa = fmtPlaca(placaCandidata);
            if (validarPlacaExtraida(placa)) return placa;
        }
    }
    return '';
}

function limpiarDua(valor = '') {
    let limpio = safe(valor).trim();
    if (!limpio) return '';
    const matchBasura = limpio.match(/^\d{1,4}[-–—\s]+((20|19)\d{2}[-–—].+)$/);
    if (matchBasura) return matchBasura[1].trim();
    const matchSinGuion = limpio.match(/^\d{1,4}((20|19)\d{2}-.+)$/);
    if (matchSinGuion) return matchSinGuion[1].trim();
    return limpio;
}

function corregirVinPorAño(valor = '', añoModelo = '') {
    let limpio = safe(valor).trim().toUpperCase();
    if (limpio.length === 18 && String(añoModelo).trim() === '2025') {
        const fixed = limpio.replace(/^(.{9})[5S][0-9S](.{7})$/, '$1S$2');
        if (fixed.length === 17) limpio = fixed;
    }
    if (limpio.length === 17 && String(añoModelo).trim() === '2025') {
        if (limpio[9] === '5') {
            limpio = limpio.substring(0, 9) + 'S' + limpio.substring(10);
        }
    }
    return limpio;
}

function limpiarPotencia(valor = '') {
    let limpio = safe(valor).trim();
    if (!limpio) return '';
    limpio = limpio.replace(/\s+/g, ' ');
    const regexDistorsion = /(\d+[\.,]\d+)\s*(?:\(0|\(O|\(o|\(|©|®|@)\s*(\d+)/i;
    const matchDistorsion = limpio.match(regexDistorsion);
    if (matchDistorsion) {
        let potencia = matchDistorsion[1];
        let rpm = matchDistorsion[2];
        if (rpm.startsWith('0') && rpm.length > 1) {
            rpm = rpm.substring(1);
        }
        return `${potencia}@${rpm}`;
    }
    if (limpio.includes('@')) {
        let [potencia, rpm] = limpio.split('@');
        potencia = (potencia || '').trim();
        rpm = (rpm || '').trim()
            .replace(/\s*KW\/RPM\s*$/i, '')
            .replace(/\s*KW\s*$/i, '')
            .replace(/\s*RPM\s*$/i, '')
            .trim();
        return `${potencia}@${rpm}`;
    }
    limpio = limpio
        .replace(/\s*KW\/RPM\s*$/i, '')
        .replace(/\s*KW\s*$/i, '')
        .replace(/\s*RPM\s*$/i, '')
        .trim();
    return limpio;
}

// Exactly the extraerTextoOCRDesdePdf function currently in bot.js
async function extraerTextoOCRDesdePdf(pdfBuffer) {
    const images = await pdf2img.convert(pdfBuffer, { width: 2200 });
    const worker = await createWorker('spa');
    const texts = [];
    try {
        await worker.setParameters({
            tessedit_pageseg_mode: PSM.AUTO,
            preserve_interword_spaces: '1',
        });
        const pagesToRead = Math.min(images.length, 3);
        for (let i = 0; i < pagesToRead; i++) {
            console.log(`[OCR] 📄 Leyendo página ${i + 1}/${pagesToRead}...`);
            const imageBuffer = Buffer.from(images[i]);
            const sharpImg = sharp(imageBuffer);
            const metadata = await sharpImg.metadata();
            const width = metadata.width || 2200;
            const height = metadata.height || 1550;
            const halfWidth = Math.floor(width / 2);
            
            const topHeight = Math.floor(height * 0.40);
            const bottomHeight = height - topHeight;

            console.log(`[OCR] 🔎 Cortando sección superior (full-width)...`);
            const topImage = await sharp(imageBuffer)
                .extract({ left: 0, top: 0, width: width, height: topHeight })
                .grayscale()
                .normalize()
                .sharpen()
                .png()
                .toBuffer();

            console.log(`[OCR] 🔎 Cortando columna izquierda inferior...`);
            const leftImage = await sharp(imageBuffer)
                .extract({ left: 0, top: topHeight, width: halfWidth, height: bottomHeight })
                .grayscale()
                .normalize()
                .sharpen()
                .png()
                .toBuffer();

            console.log(`[OCR] 🔎 Cortando columna derecha inferior...`);
            const rightImage = await sharp(imageBuffer)
                .extract({ left: halfWidth, top: topHeight, width: width - halfWidth, height: bottomHeight })
                .grayscale()
                .normalize()
                .sharpen()
                .png()
                .toBuffer();

            const resultTop = await worker.recognize(topImage);
            const resultLeft = await worker.recognize(leftImage);
            const resultRight = await worker.recognize(rightImage);

            const pageText = (resultTop.data.text || '') + '\n' + (resultLeft.data.text || '') + '\n' + (resultRight.data.text || '');
            texts.push(pageText);
        }
    } finally {
        await worker.terminate().catch(() => { });
    }
    return texts.join('\n');
}

function extraerDatosTiveDesdeTexto(text) {
    const cleanText = text.toUpperCase();
    const placa =
        validarPlacaExtraida(buscarPrimerValorTive(cleanText, ['Placa :', 'Placa'])) ||
        validarPlacaExtraida(buscarPlacaEnTexto(cleanText));
    const datos = {
        dua: limpiarDua(buscarPrimerValorTive(cleanText, ['DUA/DAM', 'DUA', 'DAM'])),
        añoModelo: buscarPrimerValorTive(cleanText, ['Año Modelo', 'Año Mod.', 'Modelo Año', 'Modelo/Año']),
        vin: buscarPrimerValorTive(cleanText, ['Número de VIN', 'Numero de VIN', 'VIN', 'Nro. VIN']),
        serie: buscarPrimerValorTive(cleanText, ['Número de Serie', 'Numero de Serie', 'Serie', 'Nro. Serie']),
        potencia: limpiarPotencia(buscarPrimerValorTive(cleanText, ['Potencia Motor', 'Pot. Motor', 'Potencia', 'Pot.'])),
        placa
    };
    datos.vin  = corregirVinPorAño(datos.vin,  datos.añoModelo);
    datos.serie = corregirVinPorAño(datos.serie, datos.añoModelo);
    return datos;
}

async function main() {
    const pdfPath = path.join(__dirname, '..', 'DOC-20260322-WA0125.pdf');
    console.log('Reading PDF:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const ocrText = await extraerTextoOCRDesdePdf(pdfBuffer);
    console.log('--- PARSED DATA USING CURRENT BOT.JS OCR FUNCTION ---');
    console.log(JSON.stringify(extraerDatosTiveDesdeTexto(ocrText), null, 2));
}

main().catch(console.error);
