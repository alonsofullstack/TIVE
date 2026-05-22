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

// Load environment variables if any
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const FONT_PATH = path.join(__dirname, '..', 'tarjeta', 'font_bold.ttf');

const safe = (t) => t ? String(t).trim() : '';

// Replicate functions from bot.js
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
        if (match) {
            limpio = limpio.substring(0, match.index);
        }
    }
    return limpio.trim();
}

function limpiarValorTive(valor = '', etiqueta = '') {
    let truncado = truncarValorEnSiguienteEtiqueta(valor, etiqueta);
    let limpio = safe(truncado)
        .replace(/\s+/g, ' ')
        .replace(/^[\s:;.,\-–—°º#]+/, '')
        .trim();

    const etiquetaNorm = normalizarTextoBusqueda(etiqueta).toLowerCase();
    if (!etiquetaNorm.includes('dua') && !etiquetaNorm.includes('dam')) {
        limpio = limpio.replace(/^\d+\s*[:\-–—]\s*/, '').trim();
    }

    if (etiquetaNorm.includes('partida')) {
        limpio = limpio.replace(/^registral\s*[:;\-]?\s*/i, '');
    }
    if (etiquetaNorm.includes('titulo')) {
        limpio = limpio.replace(/^n(?:ro|[°º*o])\*?\s*[:;\-]?\s*/i, '');
        limpio = limpio.replace(/^[*\s:;\-–—°º]+/, '').trim();
    }

    limpio = limpio.replace(/^[\s:;.,\-–—°º#]+/, '').trim();
    return /^[°º:;.,\-–—#\s]*$/.test(limpio) ? '' : limpio;
}

function buscarValorTive(texto, etiqueta) {
    let escaped = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (etiqueta.toLowerCase() === 'modelo') {
        escaped = '(?<!Año\\s+|Ano\\s+|Año\\s*|Ano\\s*)' + escaped;
    }
    
    const wholeWordEscaped = '(?<![A-Za-z0-9ñÑáéíóúÁÉÍÓÚ°º])' + escaped + '(?![A-Za-z0-9ñÑáéíóúÁÉÍÓÚ°º])';
    
    const regex = new RegExp(`${wholeWordEscaped}[^\\S\\r\\n]*:?[^\\S\\r\\n]*([^\\n]+)`, 'i');
    const match = regex.exec(texto);
    if (match) {
        const rawCaptured = match[1].replace(/^[:\s]+/, '');
        if (['carga util', 'carga útil', 'carga'].includes(etiqueta.toLowerCase()) && rawCaptured.startsWith('-')) {
            return '';
        }
        return limpiarValorTive(match[1], etiqueta);
    }

    const labelNormalizado = normalizarTextoBusqueda(etiqueta)
        .toLowerCase()
        .replace(/\s*:\s*$/, '');
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNormalizada = normalizarTextoBusqueda(line).toLowerCase();
        const lineSinDosPuntos = lineNormalizada.replace(/\s*:\s*$/, '');

        if (lineSinDosPuntos === labelNormalizado) {
            const rawCaptured = (lines[i + 1] || '').replace(/^[:\s]+/, '');
            if (['carga util', 'carga útil', 'carga'].includes(etiqueta.toLowerCase()) && rawCaptured.startsWith('-')) {
                return '';
            }
            return limpiarValorTive(lines[i + 1] || '', etiqueta);
        }

        const escapedLabelNormalizado = labelNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wholeWordEscapedLoop = '(?<![A-Za-z0-9ñÑáéíóúÁÉÍÓÚ°º])' + escapedLabelNormalizado + '(?![A-Za-z0-9ñÑáéíóúÁÉÍÓÚ°º])';
        const startsWithLabelPattern = new RegExp('^' + wholeWordEscapedLoop + '(?:\\s+|:|$)', 'i');
        if (startsWithLabelPattern.test(lineNormalizada)) {
            const value = line.slice(Math.min(line.length, etiqueta.length)).replace(/^[:\s]+/, '');
            if (['carga util', 'carga útil', 'carga'].includes(etiqueta.toLowerCase()) && value.startsWith('-')) {
                return '';
            }
            return safe(value) ? limpiarValorTive(value, etiqueta) : limpiarValorTive(lines[i + 1] || '', etiqueta);
        }
    }

    return null;
}

function buscarPrimerValorTive(text, etiquetas = []) {
    for (const etiqueta of etiquetas) {
        const valor = buscarValorTive(text, etiqueta);
        if (valor !== null && valor !== undefined) return valor;
    }
    return '';
}

function normalizarValorNumerico(valor = '') {
    const limpio = safe(valor).replace(',', '.');
    const match = limpio.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : limpio;
}

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

function buscarPlacaEnTexto(texto = '') {
    const cleanText = texto.toUpperCase();
    
    // Primero, busquemos coincidencias exactas o estándar
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
            // Evitar falsos positivos con la etiqueta "DUA/DAM"
            const startIdx = match.index;
            const prefix = cleanText.substring(Math.max(0, startIdx - 15), startIdx);
            if (prefix.includes('DUA') || prefix.includes('DAM')) {
                continue;
            }
            const placa = fmtPlaca(match[1]);
            if (validarPlacaExtraida(placa)) {
                return placa;
            }
        }
    }

    // Si no se encuentra una limpia, busquemos con más tolerancia al ruido OCR
    // (espacios, guiones, paréntesis como en "4379 -D) L" o "1 274-U P")
    const regexesRuido = [
        // 4 dígitos (con espacios opcionales) + 2 letras: e.g. "1 274-U P" o "4379 -D) L"
        /\b(\d\s?\d\s?\d\s?\d)[^A-Z0-9]{1,5}([A-Z])[^A-Z0-9]{0,3}([A-Z])\b/g,
        // 3 letras (con espacios opcionales) + 3 dígitos: e.g. "ABC - 123"
        /\b([A-Z]\s?[A-Z]\s?[A-Z])[^A-Z0-9]{1,5}(\d\s?\d\s?\d)\b/g,
        // 2 letras + 4 dígitos: e.g. "DI - 4898"
        /\b([A-Z]\s?[A-Z])[^A-Z0-9]{1,5}(\d\s?\d\s?\d\s?\d)\b/g,
        // 5 dígitos + 1 letra: e.g. "20677 L"
        /\b(\d\s?\d\s?\d\s?\d\s?\d)[^A-Z0-9]{1,5}([A-Z])\b/g,
        // 1 letra + 1 dígito + 4 dígitos: e.g. "A1 - 2345"
        /\b([A-Z]\s?\d)[^A-Z0-9]{1,5}(\d\s?\d\s?\d\s?\d)\b/g
    ];

    for (const regex of regexesRuido) {
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            // Evitar falsos positivos con la etiqueta "DUA/DAM"
            const startIdx = match.index;
            const prefix = cleanText.substring(Math.max(0, startIdx - 15), startIdx);
            if (prefix.includes('DUA') || prefix.includes('DAM')) {
                continue;
            }
            const cleanPart1 = match[1].replace(/\s+/g, '');
            const cleanPart2 = match[2].replace(/\s+/g, '');
            const cleanPart3 = (match[3] || '').replace(/\s+/g, '');
            const placaCandidata = cleanPart1 + cleanPart2 + cleanPart3;
            const placa = fmtPlaca(placaCandidata);
            if (validarPlacaExtraida(placa)) {
                return placa;
            }
        }
    }

    return '';
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
            const val = safe(lines[i - 1]);
            if (/^\d{4}\s*-\s*\d+$/.test(val) || /^\d+\s*-\s*\d{4}$/.test(val)) {
                return val;
            }
        }
    }
    return '';
}

function normalizarTituloDesdeTituloNo(value = '') {
    const compact = safe(value).replace(/\s+/g, '');
    const match = compact.match(/^(\d{4})-(\d+)$/) || compact.match(/^(\d+)-(\d{4})$/);
    if (!match) return compact;
    const p1 = match[1];
    const p2 = match[2];
    if (p1.length === 4) return `${p2}-${p1}`;
    return `${p1}-${p2}`;
}

function buscarTituloValorTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        const norm = normalizarTextoBusqueda(lines[i]).toLowerCase();
        if (norm.startsWith('titulo')) {
            const match = lines[i].match(/\b(\d{7,8}-\d{4}|\d{4}-\d{7,8})\b/);
            if (match) return normalizarTituloDesdeTituloNo(match[1]);
            if (lines[i + 1]) {
                const nextMatch = lines[i + 1].match(/\b(\d{7,8}-\d{4}|\d{4}-\d{7,8})\b/);
                if (nextMatch) return normalizarTituloDesdeTituloNo(nextMatch[1]);
            }
        }
    }
    return '';
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

function limpiarDua(valor = '') {
    let limpio = safe(valor).trim();
    if (!limpio) return '';
    // Solo normalizar espacios y guiones, preservando el prefijo completo de la aduana (ej: 118-)
    limpio = limpio.replace(/\s+/g, '').replace(/[–—]/g, '-');
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

function limpiarCategoria(valor = '') {
    let limpio = safe(valor).trim().toUpperCase();
    if (!limpio) return '';
    if (/^[LMNOP]\d$/i.test(limpio)) return limpio;
    let temp = limpio.replace(/^[|I1Lli!íì]/i, '1');
    if (temp.length === 2 && temp.startsWith('1')) {
        const rest = temp.substring(1);
        if (rest === '1' || rest === 'I' || rest === 'L') return 'L1';
        if (rest === '2' || rest === 'Z') return 'L2';
        if (rest === '3' || rest === 'E' || rest === 'e') return 'L3';
        if (rest === '4' || rest === 'A') return 'L4';
        if (rest === '5' || rest === 'S') return 'L5';
    }
    if (limpio.startsWith('L')) {
        const rest = limpio.substring(1);
        if (rest === 'E' || rest === '3') return 'L3';
        if (rest === 'S' || rest === '5') return 'L5';
        if (rest === 'Z' || rest === '2') return 'L2';
        if (rest === 'A' || rest === '4') return 'L4';
        if (rest === 'I' || rest === '1') return 'L1';
    }
    return limpio;
}

function limpiarVersion(valor = '') {
    let limpio = safe(valor).trim().toUpperCase();
    if (!limpio) return '';
    limpio = limpio.replace(/(DISC|DRUM|SPOKE)\s+(?:8\s*:|8\b|B\s*:|B\b)\s+(DRUM|DISC|SPOKE)/g, '$1 & $2');
    return limpio;
}

function extraerDatosTiveDesdeTexto(text, logPrefix = 'TIVE TEXTO', sourceName = '') {
    let cleanText = (text || '')
        .replace(/\0/g, '')
        .replace(/Aino/g, 'Año')
        .replace(/aino/g, 'año')
        .replace(/Parda/g, 'Partida')
        .replace(/parda/g, 'partida')
        .replace(/Regisirader/g, 'Registrador')
        .replace(/regisirader/g, 'registrador')
        .replace(/Scde/g, 'Sede')
        .replace(/scde/g, 'sede')
        .replace(/Códig\s*o\s*de\s*V\s*erific\s*ación/gi, 'Código de Verificación')
        .replace(/F\s*echa/gi, 'Fecha')
        .replace(/Z\s*ONA\s*RE\s*GIS\s*TRAL/gi, 'Zona Registral')
        .replace(/SEDE\s*RE\s*GIS\s*TRAL/gi, 'Sede Registral')
        .replace(/P\s*ar\s*da\s*R\s*egis\s*tr\s*al/gi, 'Partida Registral')
        .replace(/Plac\s*a/gi, 'Placa')
        .replace(/DU\s*A\/D\s*AM/gi, 'DUA/DAM')
        .replace(/T\s*ítulo/gi, 'Título')
        .replace(/F\s*echa\s*del\s*T\s*itulo/gi, 'Fecha del Titulo')
        .replace(/Ca\s*t\s*eg\s*or\s*ía/gi, 'Categoría')
        .replace(/Año\s*F\s*abric/gi, 'Año Fabricación')
        .replace(/Mar\s*c\s*a/gi, 'Marca')
        .replace(/Año\s*Modelo/gi, 'Año Modelo')
        .replace(/Númer\s*o\s*de\s*VIN/gi, 'VIN')
        .replace(/Númer\s*o\s*de\s*Serie/gi, 'Serie')
        .replace(/Númer\s*o\s*Mot\s*or/gi, 'Motor')
        .replace(/Carr\s*o\s*cería/gi, 'Carrocería')
        .replace(/P\s*ot\s*encia/gi, 'Potencia')
        .replace(/F\s*orm\.\s*R\s*od\./gi, 'Formula Rodante')
        .replace(/V\s*er\s*sión/gi, 'Versión')
        .replace(/Combus\s*ble/gi, 'Combustible')
        .replace(/Asien\s*t\s*os/gi, 'Asientos')
        .replace(/Cilindr\s*os/gi, 'Cilindros')
        .replace(/Cilindr\s*ada/gi, 'Cilindrada')
        .replace(/P\s*asajer\s*os/gi, 'Pasajeros')
        .replace(/P\s*\.\s*B\s*r\s*u\s*t\s*o/gi, 'Peso Bruto')
        .replace(/P\s*\.\s*N\s*e\s*t\s*o/gi, 'Peso Neto')
        .replace(/Altur\s*a/gi, 'Altura')
        .replace(/Car\s*g\s*a\s*U\s*l/gi, 'Carga Util');

    const _fechaTituloRaw = buscarPrimerValorTive(cleanText, ['Fecha']);
    const _fechaTituloMatch = (_fechaTituloRaw || '').match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/);
    const fechaTitulo = _fechaTituloMatch ? _fechaTituloMatch[1].trim() : '';

    const _tituloDesdeEtiqueta = buscarPrimerValorTive(cleanText, ['Título', 'Titulo']);
    const rawTituloNumeroTive = buscarTituloNumeroTive(cleanText);
    
    let validatedTitulo = '';
    const rawTitulo = rawTituloNumeroTive || _tituloDesdeEtiqueta;
    if (rawTitulo && /\d+/.test(rawTitulo)) {
        validatedTitulo = normalizarTituloDesdeTituloNo(rawTitulo);
    }
    
    const tituloNo = validatedTitulo;
    const tituloNormalizado = tituloNo;
    // Cada fallback se valida individualmente
    const placa =
        validarPlacaExtraida(buscarPrimerValorTive(cleanText, ['Placa :', 'Placa'])) ||
        validarPlacaExtraida(buscarPlacaEnTexto(cleanText)) ||
        validarPlacaExtraida(buscarPlacaEnNombreArchivo(sourceName));
    const datos = {
        codVerif: (buscarPrimerValorTive(cleanText, ['Código de Verificación', 'Codigo de Verificacion']) || '').replace(/[^\d]/g, ''),
        fechaFinal: fechaTitulo,
        zona: buscarPrimerValorTive(cleanText, ['Zona Registral', 'Zona']),
        sede: buscarPrimerValorTive(cleanText, ['Sede Registral', 'Sede']),
        partida: buscarPrimerValorTive(cleanText, ['Partida Registral', 'Partida']),
        dua: limpiarDua(buscarPrimerValorTive(cleanText, ['DUA/DAM', 'DUA', 'DAM'])),
        titulo: tituloNormalizado || buscarTituloValorTive(cleanText),
        fechaTitulo: fechaTitulo ? fechaTitulo.split(/\s+/)[0] : '',
        categoria: limpiarCategoria(buscarPrimerValorTive(cleanText, ['Categoría', 'Categoria'])),
        marca: buscarPrimerValorTive(cleanText, ['Marca']),
        modelo: buscarPrimerValorTive(cleanText, ['Modelo']),
        color: buscarPrimerValorTive(cleanText, ['Color 1', 'Color', 'Color 2', 'Color 3']),
        vin: buscarPrimerValorTive(cleanText, ['Nro. VIN', 'N° VIN', 'No VIN', 'VIN']),
        serie: buscarPrimerValorTive(cleanText, ['Nro. Serie', 'N° Serie', 'No Serie', 'Serie']),
        motor: buscarPrimerValorTive(cleanText, ['Nro. Motor', 'N° Motor', 'No Motor', 'Motor']),
        carroceria: (() => {
            const _c = buscarPrimerValorTive(cleanText, ['Tipo Carroceria', 'Tipo Carrocería', 'Carroceria', 'Carrocería']);
            return (_c || '').replace(/\s+(DE\s+)?(PASAJEROS|CARGA|MIXTO|ESCOLAR)$/i, '').trim();
        })(),
        potencia: limpiarPotencia(buscarPrimerValorTive(cleanText, ['Potencia Motor', 'Pot. Motor', 'Potencia', 'Pot.'])),
        formRod: buscarPrimerValorTive(cleanText, ['Formula Rodante', 'Fórmula Rodante', 'Form. Rod.', 'Form. Rodan.', 'Formula Rodan.']),
        combustible: buscarPrimerValorTive(cleanText, ['Tipo Combustible', 'Tipo Combus', 'Combustible', 'Combus']),
        asientos: buscarPrimerValorTive(cleanText, ['Nro. Asientos', 'N° Asientos', 'No Asientos', 'Asientos']),
        pasajeros: buscarPrimerValorTive(cleanText, ['Nro. Pasajeros', 'N° Pasajeros', 'No Pasajeros', 'Pasajeros', 'N° Pasajer.', 'Nro. Pasajer.', 'Pasajer.']),
        ruedas: buscarPrimerValorTive(cleanText, ['Nro. Ruedas', 'N° Ruedas', 'No Ruedas', 'Ruedas']),
        ejes: buscarPrimerValorTive(cleanText, ['Nro. Ejes', 'N° Ejes', 'No Ejes', 'Ejes']),
        placa,
        placaOriginal: placa,
        añoFabricacion: buscarPrimerValorTive(cleanText, ['Año Fabricación', 'Ano Fabricacion', 'Año Fab', 'Ano Fab']),
        cilindros: buscarPrimerValorTive(cleanText, ['Nro. Cilindros', 'N° Cilindros', 'No Cilindros', 'Cilindros']),
        longitud: normalizarValorNumerico(buscarPrimerValorTive(cleanText, ['Longitud'])),
        altura: normalizarValorNumerico(buscarPrimerValorTive(cleanText, ['Altura'])),
        ancho: normalizarValorNumerico(buscarPrimerValorTive(cleanText, ['Ancho'])),
        cilindrada: normalizarValorNumerico(buscarPrimerValorTive(cleanText, ['Cilindrada'])),
        pBruto: normalizarValorNumerico(buscarPrimerValorTive(cleanText, ['Peso Bruto'])),
        pNeto: normalizarValorNumerico(buscarPrimerValorTive(cleanText, ['Peso Neto'])),
        cargaUtil: (() => {
            const raw = buscarPrimerValorTive(cleanText, ['Carga Util', 'Carga Útil', 'Carga']);
            return (raw && raw.trim().startsWith('-')) ? '' : normalizarValorNumerico(raw);
        })(),
        version: limpiarVersion(buscarPrimerValorTive(cleanText, ['Nro. Version', 'Nro. Versión', 'Versión', 'Version', 'N° Versión', 'N° Version'])),
        añoModelo: buscarPrimerValorTive(cleanText, ['Año Modelo', 'Ano Modelo', 'Año Mod', 'Ano Mod']),
        tituloNo,
    };
    datos.vin   = corregirVinPorAño(datos.vin,   datos.añoModelo);
    datos.serie = corregirVinPorAño(datos.serie, datos.añoModelo);
    return datos;
}

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
            
            if (i === 0) {
                // Página 1 (Anverso): Procesar completo para evitar cortar la Placa
                console.log(`[OCR] 🔎 Procesando Página 1 a ancho completo (procesada)...`);
                const fullImage = await sharp(imageBuffer)
                    .grayscale()
                    .normalize()
                    .sharpen()
                    .png()
                    .toBuffer();
                const result = await worker.recognize(fullImage);
                texts.push(result.data.text || '');

                console.log(`[OCR] 🔎 Procesando Página 1 a ancho completo (raw)...`);
                const rawImage = await sharp(imageBuffer)
                    .png()
                    .toBuffer();
                const resultRaw = await worker.recognize(rawImage);
                console.log('--- OCR RAW PAGE 1 (RAW) ---');
                console.log(resultRaw.data.text);
                console.log('----------------------------');
                // Append both to ensure we capture all text
                texts.push(resultRaw.data.text || '');
            } else {
                // Páginas siguientes (Reverso): Cortar en columnas para evitar mezclar datos de especificaciones
                console.log(`[OCR] 🔎 Cortando Página ${i + 1} en secciones...`);
                const sharpImg = sharp(imageBuffer);
                const metadata = await sharpImg.metadata();
                const width = metadata.width || 2200;
                const height = metadata.height || 1550;
                const halfWidth = Math.floor(width / 2);
                const topHeight = Math.floor(height * 0.40);
                const bottomHeight = height - topHeight;

                const topImage = await sharp(imageBuffer)
                    .extract({ left: 0, top: 0, width: width, height: topHeight })
                    .grayscale()
                    .normalize()
                    .sharpen()
                    .png()
                    .toBuffer();

                const leftImage = await sharp(imageBuffer)
                    .extract({ left: 0, top: topHeight, width: halfWidth, height: bottomHeight })
                    .grayscale()
                    .normalize()
                    .sharpen()
                    .png()
                    .toBuffer();

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
        }
    } finally {
        await worker.terminate().catch(() => { });
    }

    return texts.join('\n');
}

async function main() {
    const pdfPath = path.join(__dirname, '..', 'DOC-20260322-WA0125.pdf');
    console.log('Reading PDF:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    console.log('Running OCR extraction...');
    const ocrText = await extraerTextoOCRDesdePdf(pdfBuffer);
    console.log('--- OCR RAW TEXT ---');
    console.log(ocrText);
    console.log('--------------------');
    
    const parsedData = extraerDatosTiveDesdeTexto(ocrText, 'TEST', 'DOC-20260322-WA0125.pdf');
    console.log('--- PARSED DATA ---');
    console.log(JSON.stringify(parsedData, null, 2));
    console.log('--------------------');
}

main().catch(console.error);
