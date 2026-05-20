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
const sharp = require('sharp');
const pdf2img = require('pdf-img-convert');
const { createWorker, PSM } = require('tesseract.js');

const safe = (t) => t ? String(t).trim() : '';

const fmtPlaca = (p) => {
    if (!p) return "";
    let normalized = p.trim().toUpperCase();
    if (normalized.includes("-")) {
        let parts = normalized.split("-");
        let alnumOnly = normalized.replace(/[^A-Z0-9]/g, "");
        if (alnumOnly.length === 6 && parts.length === 2) {
            return normalized;
        }
    }
    let clean = normalized.replace(/[^A-Z0-9]/gi, "");
    if (clean.length === 6) {
        if (/^\d{4}/.test(clean)) return `${clean.substring(0, 4)}-${clean.substring(4)}`;
        return `${clean.substring(0, 3)}-${clean.substring(3)}`;
    }
    return clean;
};

function normalizarTextoBusqueda(texto = '') {
    return safe(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function limpiarValorTive(valor = '', etiqueta = '') {
    let limpio = safe(valor)
        .replace(/\s+/g, ' ')
        .replace(/^[\s:;.,\-–—°º#]+/, '')
        .trim();

    const etiquetaNorm = normalizarTextoBusqueda(etiqueta).toLowerCase();
    if (etiquetaNorm.includes('partida')) {
        limpio = limpio.replace(/^registral\s*[:;\-]?\s*/i, '');
    }
    if (etiquetaNorm.includes('titulo')) {
        limpio = limpio.replace(/^n[°ºo]?\s*[:;\-]?\s*/i, '');
    }

    limpio = limpio.replace(/^[\s:;.,\-–—°º#]+/, '').trim();
    return /^[°º:;.,\-–—#\s]*$/.test(limpio) ? '' : limpio;
}

function buscarValorTive(texto, etiqueta) {
    const escaped = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}[^\\S\\r\\n]*:?[^\\S\\r\\n]*([^\\n]+)`, 'i');
    const match = regex.exec(texto);
    if (match) return limpiarValorTive(match[1], etiqueta);

    const labelNormalizado = normalizarTextoBusqueda(etiqueta)
        .toLowerCase()
        .replace(/\s*:\s*$/, '');
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNormalizada = normalizarTextoBusqueda(line).toLowerCase();
        const lineSinDosPuntos = lineNormalizada.replace(/\s*:\s*$/, '');

        if (lineSinDosPuntos === labelNormalizado) {
            return limpiarValorTive(lines[i + 1] || '', etiqueta);
        }

        if (lineNormalizada.startsWith(`${labelNormalizado} `) || lineNormalizada.startsWith(`${labelNormalizado}:`)) {
            const value = line.slice(Math.min(line.length, etiqueta.length)).replace(/^[:\s]+/, '');
            if (safe(value)) return limpiarValorTive(value, etiqueta);
            return limpiarValorTive(lines[i + 1] || '', etiqueta);
        }
    }
    return '';
}

function normalizarValorNumerico(valor = '') {
    const limpio = safe(valor).replace(',', '.');
    const match = limpio.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : limpio;
}

function buscarPlacaEnTexto(texto = '') {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        const normalized = normalizarTextoBusqueda(lines[i]).toLowerCase();
        if (!normalized.includes('placa')) continue;
        const nearby = [lines[i], lines[i + 1] || '', lines[i - 1] || ''].join(' ');
        const match = nearby.toUpperCase().match(/\b([A-Z0-9]{3}-?[A-Z0-9]{3}|\d{4}-?[A-Z0-9]{2})\b/);
        if (match) return fmtPlaca(match[1]);
    }
    const looseMatch = texto.toUpperCase().match(/\b([A-Z]{1,3}\d{3}[A-Z0-9]{0,2}|\d{4}[A-Z0-9]{2}|[A-Z0-9]{3}-[A-Z0-9]{3})\b/);
    return looseMatch ? fmtPlaca(looseMatch[1]) : '';
}

function buscarPlacaEnNombreArchivo(fileName = '') {
    const normalized = safe(fileName).toUpperCase();
    const match = normalized.match(/(?:^|[^A-Z0-9])([A-Z0-9]{3}-?[A-Z0-9]{3}|\d{4}-?[A-Z0-9]{2})(?=$|[^A-Z0-9])/);
    return match ? fmtPlaca(match[1]) : '';
}

function validarPlacaExtraida(valor = '') {
    const placa = fmtPlaca(valor);
    const clean = placa.replace(/[^A-Z0-9]/gi, '');
    return clean.length === 6 ? placa : '';
}

function buscarTituloNumeroTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        if (normalizarTextoBusqueda(lines[i]).toLowerCase() === 'titulo nro' && i > 0) {
            return safe(lines[i - 1]);
        }
    }
    return '';
}

function buscarTituloValorTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
        const normalized = normalizarTextoBusqueda(line).toLowerCase();
        if (normalized.startsWith('titulo ') && normalized !== 'titulo nro') {
            return safe(line.split(/\s+/, 2)[1]);
        }
    }
    return '';
}

function normalizarTituloDesdeTituloNo(tituloNo = '') {
    const limpio = safe(tituloNo).replace(/\s+/g, '');
    if (!limpio) return '';
    const dateNumberMatch = limpio.match(/^(\d{4})-(\d+)$/);
    if (dateNumberMatch) {
        return `${dateNumberMatch[2]}-${dateNumberMatch[1]}`;
    }
    const match = limpio.match(/^(\d+)-(\d+)$/);
    if (!match) return limpio;
    return `${match[1]}-${match[2]}`;
}

function buscarPrimerValorTive(text, etiquetas = []) {
    for (const etiqueta of etiquetas) {
        const valor = buscarValorTive(text, etiqueta);
        if (valor) return valor;
    }
    return '';
}

function extraerDatosTiveDesdeTexto(text, logPrefix = 'TIVE TEXTO', sourceName = '') {
    let cleanText = (text || '')
        .replace(/Aino/g, 'Año')
        .replace(/aino/g, 'año')
        .replace(/Parda/g, 'Partida')
        .replace(/parda/g, 'partida')
        .replace(/Regisirader/g, 'Registrador')
        .replace(/regisirader/g, 'registrador')
        .replace(/Scde/g, 'Sede')
        .replace(/scde/g, 'sede');

    const fechaTitulo = buscarValorTive(cleanText, 'Fecha');
    const tituloNo = normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(cleanText));
    const tituloNormalizado = tituloNo || normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(cleanText));
    const placa = validarPlacaExtraida(
        buscarPrimerValorTive(cleanText, ['Placa :', 'Placa']) ||
        buscarPlacaEnTexto(cleanText) ||
        buscarPlacaEnNombreArchivo(sourceName)
    );
    return {
        codVerif: '',
        fechaFinal: fechaTitulo,
        zona: buscarValorTive(cleanText, 'Zona Registral') || buscarValorTive(cleanText, 'Zona'),
        sede: buscarValorTive(cleanText, 'Sede Registral') || buscarValorTive(cleanText, 'Sede'),
        partida: buscarValorTive(cleanText, 'Partida'),
        dua: buscarValorTive(cleanText, 'DUA/DAM') || buscarValorTive(cleanText, 'DUA') || buscarValorTive(cleanText, 'DAM'),
        titulo: tituloNormalizado || buscarTituloValorTive(cleanText),
        fechaTitulo: fechaTitulo ? fechaTitulo.split(/\s+/)[0] : '',
        categoria: buscarValorTive(cleanText, 'Categoria'),
        marca: buscarValorTive(cleanText, 'Marca'),
        modelo: buscarValorTive(cleanText, 'Modelo'),
        color: buscarValorTive(cleanText, 'Color'),
        vin: buscarPrimerValorTive(cleanText, ['Nro. VIN', 'N° VIN', 'No VIN', 'VIN']),
        serie: buscarPrimerValorTive(cleanText, ['Nro. Serie', 'N° Serie', 'No Serie', 'Serie']),
        motor: buscarPrimerValorTive(cleanText, ['Nro. Motor', 'N° Motor', 'No Motor', 'Motor']),
        carroceria: buscarPrimerValorTive(cleanText, ['Tipo Carroceria', 'Tipo Carrocería', 'Carroceria', 'Carrocería']),
        potencia: buscarValorTive(cleanText, 'Potencia Motor'),
        formRod: buscarValorTive(cleanText, 'Formula Rodante') || buscarValorTive(cleanText, 'Fórmula Rodante'),
        combustible: buscarValorTive(cleanText, 'Tipo Combustible'),
        asientos: buscarPrimerValorTive(cleanText, ['Nro. Asientos', 'N° Asientos', 'No Asientos', 'Asientos']),
        pasajeros: buscarPrimerValorTive(cleanText, ['Nro. Pasajeros', 'N° Pasajeros', 'No Pasajeros', 'Pasajeros']),
        ruedas: buscarPrimerValorTive(cleanText, ['Nro. Ruedas', 'N° Ruedas', 'No Ruedas', 'Ruedas']),
        ejes: buscarPrimerValorTive(cleanText, ['Nro. Ejes', 'N° Ejes', 'No Ejes', 'Ejes']),
        placa,
        placaOriginal: placa,
        añoFabricacion: buscarValorTive(cleanText, 'Año Fabricación') || buscarValorTive(cleanText, 'Ano Fabricacion'),
        cilindros: buscarPrimerValorTive(cleanText, ['Nro. Cilindros', 'N° Cilindros', 'No Cilindros', 'Cilindros']),
        longitud: normalizarValorNumerico(buscarValorTive(cleanText, 'Longitud')),
        altura: normalizarValorNumerico(buscarValorTive(cleanText, 'Altura')),
        ancho: normalizarValorNumerico(buscarValorTive(cleanText, 'Ancho')),
        cilindrada: normalizarValorNumerico(buscarValorTive(cleanText, 'Cilindrada')),
        pBruto: normalizarValorNumerico(buscarValorTive(cleanText, 'Peso Bruto')),
        pNeto: normalizarValorNumerico(buscarValorTive(cleanText, 'Peso Neto')),
        cargaUtil: normalizarValorNumerico(buscarValorTive(cleanText, 'Carga Util')),
        version: buscarValorTive(cleanText, 'Nro. Version') || buscarValorTive(cleanText, 'Nro. Versión'),
        añoModelo: buscarValorTive(cleanText, 'Año Modelo') || buscarValorTive(cleanText, 'Ano Modelo'),
        tituloNo,
    };
}

async function extraerTextoOCRDesdePdf(pdfBuffer) {
    console.log(`[TEST-OCR] 🔎 Renderizando PDF para OCR (${pdfBuffer.length} bytes)...`);
    const images = await pdf2img.convert(pdfBuffer, { width: 2200 });
    if (!images || images.length === 0) {
        throw new Error('No se pudo renderizar el PDF para OCR.');
    }

    const worker = await createWorker('spa');
    const texts = [];

    try {
        await worker.setParameters({
            tessedit_pageseg_mode: PSM.AUTO,
            preserve_interword_spaces: '1',
        });

        const pagesToRead = Math.min(images.length, 3);
        for (let i = 0; i < pagesToRead; i++) {
            console.log(`[TEST-OCR] 📄 Leyendo página ${i + 1}/${pagesToRead}...`);
            const imageBuffer = Buffer.from(images[i]);
            const sharpImg = sharp(imageBuffer);
            const metadata = await sharpImg.metadata();
            const width = metadata.width || 2200;
            const height = metadata.height || 1550;
            const halfWidth = Math.floor(width / 2);

            const topHeight = Math.floor(height * 0.40);
            const bottomHeight = height - topHeight;

            console.log(`[TEST-OCR] 🔎 Cortando sección superior (full-width)...`);
            const topImage = await sharp(imageBuffer)
                .extract({ left: 0, top: 0, width: width, height: topHeight })
                .grayscale()
                .normalize()
                .sharpen()
                .png()
                .toBuffer();

            console.log(`[TEST-OCR] 🔎 Cortando columna izquierda inferior...`);
            const leftImage = await sharp(imageBuffer)
                .extract({ left: 0, top: topHeight, width: halfWidth, height: bottomHeight })
                .grayscale()
                .normalize()
                .sharpen()
                .png()
                .toBuffer();

            console.log(`[TEST-OCR] 🔎 Cortando columna derecha inferior...`);
            const rightImage = await sharp(imageBuffer)
                .extract({ left: halfWidth, top: topHeight, width: width - halfWidth, height: bottomHeight })
                .grayscale()
                .normalize()
                .sharpen()
                .png()
                .toBuffer();

            console.log(`[TEST-OCR] 📄 Ejecutando OCR en sección superior...`);
            const resultTop = await worker.recognize(topImage);

            console.log(`[TEST-OCR] 📄 Ejecutando OCR en columna izquierda inferior...`);
            const resultLeft = await worker.recognize(leftImage);
            
            console.log(`[TEST-OCR] 📄 Ejecutando OCR en columna derecha inferior...`);
            const resultRight = await worker.recognize(rightImage);

            const pageText = (resultTop.data.text || '') + '\n' + (resultLeft.data.text || '') + '\n' + (resultRight.data.text || '');
            texts.push(pageText);
        }
    } finally {
        await worker.terminate().catch(() => { });
    }

    const text = texts.join('\n');
    return text;
}

async function test() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("No existe el PDF de prueba en:", pdfPath);
        process.exit(1);
    }

    console.log("🚀 Iniciando prueba de OCR local en:", pdfPath);
    try {
        const buffer = fs.readFileSync(pdfPath);
        const ocrText = await extraerTextoOCRDesdePdf(buffer);
        console.log("\n📝 --- TEXTO OCR OBTENIDO (PREVIEW) ---");
        console.log(ocrText.slice(0, 1500));
        console.log("---------------------------------------\n");

        const datos = extraerDatosTiveDesdeTexto(ocrText, 'TEST-OCR', 'TIVE_7061XS.pdf');
        console.log("📊 --- DATOS FINALES EXTRAÍDOS POR EL OCR LOCAL ---");
        console.log(JSON.stringify(datos, null, 2));
        console.log("---------------------------------------------------\n");
    } catch (e) {
        console.error("❌ Error en prueba:", e);
    }
}

test();
