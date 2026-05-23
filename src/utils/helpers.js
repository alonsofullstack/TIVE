const crypto = require('crypto');
const { logInfo } = require('./logger');

const SEDE_TO_ZONA = {
    'piura': 'I',
    'sullana': 'I',
    'talara': 'I',
    'tumbes': 'I',
    'paita': 'I',
    'chulucanas': 'I',
    
    'chiclayo': 'II',
    'cajamarca': 'II',
    'chachapoyas': 'II',
    'bagua': 'II',
    'jaen': 'II',
    'lambayeque': 'II',
    'jaén': 'II',
    
    'moyobamba': 'III',
    'tarapoto': 'III',
    'taraporo': 'III',
    'juanjui': 'III',
    'juanjuí': 'III',
    'yurimaguas': 'III',
    'rioja': 'III',
    'tocache': 'III',
    
    'iquitos': 'IV',
    
    'trujillo': 'V',
    'chepen': 'V',
    'chepén': 'V',
    'huamachuco': 'V',
    'otuzco': 'V',
    'pacasmayo': 'V',
    
    'pucallpa': 'VI',
    'pucullpa': 'VI',
    
    'huaraz': 'VII',
    'chimbote': 'VII',
    'casma': 'VII',
    'huarmey': 'VII',
    
    'huancayo': 'VIII',
    'huanuco': 'VIII',
    'huánuco': 'VIII',
    'cerro de pasco': 'VIII',
    'tarma': 'VIII',
    'satipo': 'VIII',
    'tingo maria': 'VIII',
    'tingo maría': 'VIII',
    
    'lima': 'IX',
    'callao': 'IX',
    'canete': 'IX',
    'cañete': 'IX',
    'barranca': 'IX',
    'huaral': 'IX',
    'huacho': 'IX',
    
    'cusco': 'X',
    'abancay': 'X',
    'tambopata': 'X',
    'sicuani': 'X',
    'quillabamba': 'X',
    'madre de dios': 'X',
    'puerto maldonado': 'X',
    
    'ica': 'XI',
    'chincha': 'XI',
    'nazca': 'XI',
    'nasca': 'XI',
    'pisco': 'XI',
    'ayacucho': 'XIV',
    'huancavelica': 'XI',
    'puquio': 'XI',
    
    'arequipa': 'XII',
    'camana': 'XII',
    'camaná': 'XII',
    'mollendo': 'XII',
    'islay': 'XII',
    
    'tacna': 'XIII',
    'puno': 'XIII',
    'moquegua': 'XIII',
    'juliaca': 'XIII',
    'ilo': 'XIII'
};

const safe = (t) => t ? String(t).trim() : '';

function normalizarZonaRomana(zonaStr) {
    if (!zonaStr) return '';
    let txt = safe(zonaStr).toUpperCase();
    
    const labels = [
        "ZONA REGISTRAL N°", "ZONA REGISTRAL Nº", "ZONA REGISTRAL N", "ZONA REGISTRAL", "ZONA"
    ];
    labels.forEach(lbl => {
        const regex = new RegExp(`^${lbl}\\s*[:\\-]*\\s*`, 'i');
        txt = txt.replace(regex, '');
    });
    
    txt = txt.replace(/^N[°º*O]?\*?\s*[:\-;\.]*\s*/i, '');
    txt = txt.trim();

    const map = [
        { arabigo: 14, romano: 'XIV' },
        { arabigo: 13, romano: 'XIII' },
        { arabigo: 12, romano: 'XII' },
        { arabigo: 11, romano: 'XI' },
        { arabigo: 10, romano: 'X' },
        { arabigo: 9, romano: 'IX' },
        { arabigo: 8, romano: 'VIII' },
        { arabigo: 7, romano: 'VII' },
        { arabigo: 6, romano: 'VI' },
        { arabigo: 5, romano: 'V' },
        { arabigo: 4, romano: 'IV' },
        { arabigo: 3, romano: 'III' },
        { arabigo: 2, romano: 'II' },
        { arabigo: 1, romano: 'I' }
    ];

    const arabigoMatch = txt.match(/\b\d+\b/);
    if (arabigoMatch) {
        const num = parseInt(arabigoMatch[0], 10);
        const found = map.find(item => item.arabigo === num);
        if (found) return found.romano;
    }

    for (const item of map) {
        if (txt === String(item.arabigo) || txt.includes(` ${item.arabigo}`) || txt.includes(`${item.arabigo} `)) {
            return item.romano;
        }
    }

    for (const item of map) {
        const regRomano = new RegExp(`\\b${item.romano}\\b`, 'i');
        if (regRomano.test(txt)) {
            return item.romano;
        }
    }

    const soloNumeros = txt.replace(/[^\d]/g, '');
    if (soloNumeros) {
        const num = parseInt(soloNumeros, 10);
        const found = map.find(item => item.arabigo === num);
        if (found) return found.romano;
    }

    return txt;
}

function obtenerZonaNormalizada(zonaInput = '', sedeInput = '') {
    const cleanSede = safe(sedeInput).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    if (cleanSede) {
        for (const [key, value] of Object.entries(SEDE_TO_ZONA)) {
            const keyClean = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (cleanSede === keyClean || cleanSede.includes(keyClean) || keyClean.includes(cleanSede)) {
                logInfo('ZONA', '📌', `Zona asignada automáticamente por Sede`, { sedeInput, keyCoincidente: key, zonaRomana: value });
                return value;
            }
        }
    }

    return normalizarZonaRomana(zonaInput);
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

    if (/^[LMNOP]\d$/i.test(limpio)) {
        return limpio;
    }

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

const fmtPlaca = (p) => {
    if (!p) return "";
    let normalized = p.trim().toUpperCase();

    // Normalize all dash types to standard hyphen
    normalized = normalized.replace(/[–—]/g, '-');

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

function validarPlacaExtraida(valor = '') {
    const placa = fmtPlaca(valor);
    const clean = placa.replace(/[^A-Z0-9]/gi, '');
    return clean.length === 6 ? placa : '';
}

function limpiarEtiquetaRegistral(valor = '') {
    let limpio = safe(valor);
    const labelsToRemove = [
        "ZONA REGISTRAL N°", "ZONA REGISTRAL Nº", "ZONA REGISTRAL N", "ZONA REGISTRAL",
        "SEDE REGISTRAL -", "SEDE REGISTRAL-", "SEDE REGISTRAL", "SEDE"
    ];
    labelsToRemove.forEach(label => {
        const regex = new RegExp(`^${label}\\s*[:\\-]*\\s*`, 'i');
        limpio = limpio.replace(regex, '');
    });
    return limpio.trim();
}

function generarCodigoVerificacion() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generarFechaHoraTive(date = new Date()) {
    const parts = new Intl.DateTimeFormat('es-PE', {
        timeZone: process.env.TIVE_TIMEZONE || 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.day}/${byType.month}/${byType.year} ${byType.hour}:${byType.minute}:${byType.second}`;
}

function generarHashVerificacion(sourceBuffer, datos) {
    const hash = crypto.createHash('sha256');
    if (sourceBuffer) {
        hash.update(sourceBuffer);
    } else {
        hash.update(JSON.stringify(datos));
    }
    return hash.digest('hex').toUpperCase();
}

const escapeMarkdown = (text) => {
    return text.replace(/[_*`\[]/g, '\\$&');
};

function normalizarTituloDesdeTituloNo(tituloNo = '') {
    const raw = safe(tituloNo).trim();
    if (!raw) return '';
    const extractedMatch = raw.match(/\b(\d{3,}-\d{3,})\b/) || raw.match(/(\d+-\d+)/);
    const limpio = extractedMatch ? extractedMatch[1] : raw.replace(/\s+/g, '');
    if (!limpio) return '';
    const dateNumberMatch = limpio.match(/^(\d{4})-(\d+)$/);
    if (dateNumberMatch) {
        return `${dateNumberMatch[2]}-${dateNumberMatch[1]}`;
    }
    const match = limpio.match(/^(\d+)-(\d+)$/);
    if (!match) return limpio;
    return `${match[1]}-${match[2]}`;
}

module.exports = {
    SEDE_TO_ZONA,
    safe,
    normalizarZonaRomana,
    obtenerZonaNormalizada,
    limpiarPotencia,
    limpiarDua,
    corregirVinPorAño,
    limpiarCategoria,
    limpiarVersion,
    fmtPlaca,
    validarPlacaExtraida,
    limpiarEtiquetaRegistral,
    generarCodigoVerificacion,
    generarFechaHoraTive,
    generarHashVerificacion,
    escapeMarkdown,
    normalizarTituloDesdeTituloNo
};
