// Simula exactamente el texto OCR que obtuvimos de los logs del bot
// para verificar los 3 fixes sin necesidad de procesar el PDF de nuevo.

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
        { name: 'placa',      regex: /Plac\s*a/i },
        { name: 'fabricacion',regex: /Año\s*F/i },
        { name: 'fabricacion',regex: /Ano\s*F/i },
        { name: 'modelo',     regex: /Año\s*M/i },
        { name: 'modelo',     regex: /Ano\s*M/i },
        { name: 'version',    regex: /V\s*er\s*sión/i },
        { name: 'version',    regex: /V\s*er\s*sion/i },
        { name: 'cilindros',  regex: /Cilindr\s*os/i },
        { name: 'cilindrada', regex: /Cilindr\s*ada/i },
        { name: 'longitud',   regex: /Longitud/i },
        { name: 'bruto',      regex: /P\s*\.\s*Brut/i },
        { name: 'bruto',      regex: /Peso\s*Brut/i },
        { name: 'altura',     regex: /Altur/i },
        { name: 'neto',       regex: /P\s*\.\s*Net/i },
        { name: 'neto',       regex: /Peso\s*Net/i },
        { name: 'ancho',      regex: /Ancho/i },
        { name: 'cargautil',  regex: /Carga\s*U/i },
        { name: 'cargautil',  regex: /Car\s*g\s*a/i }
    ];
    let limpio = valor;
    for (const item of etiquetasADerecha) {
        if (etiquetaNorm.includes(item.name)) continue;
        const match = item.regex.exec(limpio);
        if (match) limpio = limpio.substring(0, match.index);
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
    if (etiquetaNorm.includes('partida')) {
        limpio = limpio.replace(/^registral\s*[:;\-]?\s*/i, '');
    }
    if (etiquetaNorm.includes('titulo')) {
        // FIX: manejar N*, N°, No que anteceden al número del título
        limpio = limpio.replace(/^n[°º*o]?\*?\s*[:;\-]?\s*/i, '');
        // Limpiar cualquier asterisco o símbolo residual al inicio
        limpio = limpio.replace(/^[*\s:;\-–—°º]+/, '').trim();
    }

    limpio = limpio.replace(/^[\s:;.,\-–—°º#]+/, '').trim();
    return /^[°º:;.,\-–—#\s]*$/.test(limpio) ? '' : limpio;
}

function buscarValorTive(texto, etiqueta) {
    let escaped = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}[^\\S\\r\\n]*:?[^\\S\\r\\n]*([^\\n]+)`, 'i');
    const match = regex.exec(texto);
    if (match) return limpiarValorTive(match[1], etiqueta);
    return '';
}

function normalizarTituloDesdeTituloNo(tituloNo = '') {
    const raw = safe(tituloNo).trim();
    if (!raw) return '';
    // Extraer solo el patrón numérico NNNNN-NNNNN (descarta ruido OCR lateral)
    const extractedMatch = raw.match(/\b(\d{3,}-\d{3,})\b/);
    const limpio = extractedMatch ? extractedMatch[1] : raw.replace(/\s+/g, '');
    if (!limpio) return '';
    // YYYY-NNNNNN → NNNNNN-YYYY
    const dateNumberMatch = limpio.match(/^(\d{4})-(\d+)$/);
    if (dateNumberMatch) return `${dateNumberMatch[2]}-${dateNumberMatch[1]}`;
    // NNNNNN-YYYY o NNNN-NNNN → devolver tal cual
    const match = limpio.match(/^(\d+)-(\d+)$/);
    if (!match) return limpio;
    return `${match[1]}-${match[2]}`;
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

// ---- TEXTO OCR REAL CAPTURADO EN LOGS ----
const ocrText = `Código de Verificación: 50648854 e
Título N* : 2191370-2025                                  su na rp E

Fecha : 25/07/2025 10:54:06                        de te Degiovies TNNGOS

REPÚBLICA DEL PERÚ
SUPERINTENDENCIA NACIONAL DE LOS REGISTROS PÚBLICOS

TARJETA DE IDENTIFICACIÓN VEHICULAR ELECTRÓNICA
ZONA REGISTRAL N' III

SEDE REGISTRAL - TARAPOTO

Partida Registral : 60824782                                          Placa N*
DUA/DAM : 118-2025-10-024322-169

Título : 2025-2191370                                          7NA | -YQ

Fecha del Título : 25/07/2025
Condición : NUEVO

Datos del Vehículo

Categoria : L5

Marca : WANXIN

Modelo : WX150-A

Color: NEGRO

Número de VIN : LDAPAK108SGD11229
Número de Serie : LDAPAK108SGD11229
Número de Motor : WX162FMJ225J11229
Carrocería : TRIMOTO PASAJEROS
Potencia : 11,80(07500 KW/RPM

Form. Rod. : 3X1

Combustible : GASOLINA

Asientos : 3         Cilindros : 1
Pasajeros : 2         Longitud : 2.90
Ruedas : 3           Altura : 1.70
Ejes : 2         Ancho : 1.33

Año Modelo : 2025

Versión : SINVERSION

Cilindrada : 0.149
P. Bruto : 0.517
P. Neto: 0.117
Carga Util : 0.400
`;

// ---- APLICAR LOS FIXES ----

// FIX 1: codVerif — solo dígitos
const codVerifRaw = buscarValorTive(ocrText, 'Código de Verificación');
const codVerif = (codVerifRaw || '').replace(/[^\d]/g, '');

// FIX 2: fechaFinal — truncar al timestamp real
const _fechaTituloRaw = buscarValorTive(ocrText, 'Fecha');
const _fechaTituloMatch = (_fechaTituloRaw || '').match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/);
const fechaFinal = _fechaTituloMatch ? _fechaTituloMatch[1].trim() : (_fechaTituloRaw || '').split(/\s{2,}/)[0].trim();

// FIX 3: titulo — extraer con buscarValorTive sobre la etiqueta 'Título' y normalizar
const _tituloDesdeEtiqueta = buscarValorTive(ocrText, 'Título') || buscarValorTive(ocrText, 'Titulo');
const tituloNo = normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(ocrText)) ||
                 normalizarTituloDesdeTituloNo(_tituloDesdeEtiqueta);
const titulo = tituloNo || buscarTituloValorTive(ocrText);

// ---- RESULTADOS ----
console.log('╔══════════════════════════════════════════╗');
console.log('║         VERIFICACIÓN DE LOS 3 FIXES       ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log('── FIX 1: Código de Verificación ──');
console.log(`   Raw OCR      : "${codVerifRaw}"`);
console.log(`   Después fix  : "${codVerif}"`);
console.log(`   ✅ Correcto  : ${codVerif === '50648854' ? 'SÍ' : '❌ NO — esperado 50648854'}`);
console.log('');
console.log('── FIX 2: Fecha Final ──');
console.log(`   Raw OCR      : "${_fechaTituloRaw}"`);
console.log(`   Después fix  : "${fechaFinal}"`);
console.log(`   ✅ Correcto  : ${fechaFinal === '25/07/2025 10:54:06' ? 'SÍ' : '❌ NO — esperado 25/07/2025 10:54:06'}`);
console.log('');
console.log('── FIX 3: Título ──');
console.log(`   _tituloDesdeEtiqueta : "${_tituloDesdeEtiqueta}"`);
console.log(`   Después normalizar   : "${tituloNo}"`);
console.log(`   titulo final         : "${titulo}"`);
console.log(`   ✅ Correcto  : ${titulo === '2191370-2025' ? 'SÍ' : '❌ NO — esperado 2191370-2025'}`);
