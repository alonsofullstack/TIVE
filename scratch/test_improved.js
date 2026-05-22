const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

function safe(val) {
    return val ? String(val).trim() : '';
}

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
    
    // First, apply generic label-like pattern truncation:
    // Matches " Word :" or " Word:" ensuring it's not a time like 11:26:23 (contains letters and colon not followed by digit)
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

    // Strip leading number prefix like "1 :", "2 -", "3:"
    limpio = limpio.replace(/^\d+\s*[:\-–—]\s*/, '').trim();

    const etiquetaNorm = normalizarTextoBusqueda(etiqueta).toLowerCase();
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
    
    // Whole word Spanish boundary lookaround
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

    return null; // Return null if not found
}

function buscarTituloNumeroTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        if (normalizarTextoBusqueda(lines[i]).toLowerCase() === 'titulo nro' && i > 0) {
            // Validate that it looks like a title number (YYYY-NNNNNN or similar)
            const val = safe(lines[i - 1]);
            if (/^\d{4}\s*-\s*\d+$/.test(val) || /^\d+\s*-\s*\d{4}$/.test(val)) {
                return val;
            }
        }
    }
    return null;
}

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

function buscarTituloValorTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
        const normalized = normalizarTextoBusqueda(line).toLowerCase();
        if (normalized.startsWith('titulo ') && normalized !== 'titulo nro') {
            const match = line.match(/\b(\d{4})-(\d{3,})\b/) || line.match(/\b(\d{3,})-(\d{4})\b/);
            if (match) return match[0];
            return safe(line.split(/\s+/, 2)[1]);
        }
    }
    return '';
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

function extraerDatos(text) {
    let cleanText = (text || '')
        .replace(/\0/g, '')
        .replace(/Aino/g, 'Año')
        .replace(/aino/g, 'año')
        .replace(/Parda/g, 'Partida')
        .replace(/parda/g, 'partida')
        .replace(/Regisirader/g, 'Registrador')
        .replace(/regisirader/g, 'registrador')
        .replace(/Scde/g, 'Sede')
        .replace(/scde/g, 'sede');
        
    console.log("=== HONDA CLEAN TEXT ===");
    console.log(cleanText);
    console.log("========================");

    // fechaTitulo: only capture valid date/time format, not random words
    const _fechaTituloRaw = buscarPrimerValorTive(cleanText, ['Fecha']);
    const _fechaTituloMatch = (_fechaTituloRaw || '').match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/);
    const fechaTitulo = _fechaTituloMatch ? _fechaTituloMatch[1].trim() : '';

    const _tituloDesdeEtiqueta = buscarPrimerValorTive(cleanText, ['Título', 'Titulo']);
    const rawTituloNumeroTive = buscarTituloNumeroTive(cleanText);
    
    console.log(`[DEBUG TITLE] _tituloDesdeEtiqueta: "${_tituloDesdeEtiqueta}", rawTituloNumeroTive: "${rawTituloNumeroTive}"`);

    // Validate title format: must look like a real title (has digits and hyphens)
    let validatedTitulo = '';
    const rawTitulo = rawTituloNumeroTive || _tituloDesdeEtiqueta;
    if (rawTitulo && /\d+/.test(rawTitulo)) {
        validatedTitulo = normalizarTituloDesdeTituloNo(rawTitulo);
        console.log(`[DEBUG TITLE] validatedTitulo: "${validatedTitulo}"`);
    }
    
    const tituloNo = validatedTitulo;
    const tituloNormalizado = tituloNo;

    return {
        codVerif: (buscarPrimerValorTive(cleanText, ['Código de Verificación']) || '').replace(/[^\d]/g, ''),
        fechaFinal: fechaTitulo,
        zona: buscarPrimerValorTive(cleanText, ['Zona Registral', 'Zona']),
        sede: buscarPrimerValorTive(cleanText, ['Sede Registral', 'Sede']),
        partida: buscarPrimerValorTive(cleanText, ['Partida Registral', 'Partida']),
        dua: buscarPrimerValorTive(cleanText, ['DUA/DAM', 'DUA', 'DAM']),
        titulo: tituloNormalizado || buscarTituloValorTive(cleanText),
        fechaTitulo: fechaTitulo ? fechaTitulo.split(/\s+/)[0] : '',
        categoria: buscarPrimerValorTive(cleanText, ['Categoría', 'Categoria']),
        marca: buscarPrimerValorTive(cleanText, ['Marca']),
        modelo: buscarPrimerValorTive(cleanText, ['Modelo']),
        color: buscarPrimerValorTive(cleanText, ['Color 1', 'Color', 'Color 2', 'Color 3']),
        vin: buscarPrimerValorTive(cleanText, ['Nro. VIN', 'N° VIN', 'No VIN', 'VIN']),
        serie: buscarPrimerValorTive(cleanText, ['Nro. Serie', 'N° Serie', 'No Serie', 'Serie']),
        motor: buscarPrimerValorTive(cleanText, ['Nro. Motor', 'N° Motor', 'No Motor', 'Motor']),
        carroceria: buscarPrimerValorTive(cleanText, ['Tipo Carroceria', 'Tipo Carrocería', 'Carroceria', 'Carrocería']),
        potencia: buscarPrimerValorTive(cleanText, ['Potencia Motor', 'Pot. Motor', 'Potencia', 'Pot.']),
        formRod: buscarPrimerValorTive(cleanText, ['Formula Rodante', 'Fórmula Rodante', 'Form. Rod.', 'Form. Rodan.', 'Formula Rodan.']),
        combustible: buscarPrimerValorTive(cleanText, ['Tipo Combustible', 'Tipo Combus', 'Combustible', 'Combus']),
        asientos: buscarPrimerValorTive(cleanText, ['Nro. Asientos', 'N° Asientos', 'No Asientos', 'Asientos']),
        pasajeros: buscarPrimerValorTive(cleanText, ['Nro. Pasajeros', 'N° Pasajeros', 'No Pasajeros', 'Pasajeros', 'N° Pasajer.', 'Nro. Pasajer.', 'Pasajer.']),
        ruedas: buscarPrimerValorTive(cleanText, ['Nro. Ruedas', 'N° Ruedas', 'No Ruedas', 'Ruedas']),
        ejes: buscarPrimerValorTive(cleanText, ['Nro. Ejes', 'N° Ejes', 'No Ejes', 'Ejes']),
        añoFabricacion: buscarPrimerValorTive(cleanText, ['Año Fabricación', 'Ano Fabricacion', 'Año Fab', 'Ano Fab']),
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
        version: buscarPrimerValorTive(cleanText, ['Nro. Version', 'Nro. Versión', 'Versión', 'Version', 'N° Versión', 'N° Version']),
        añoModelo: buscarPrimerValorTive(cleanText, ['Año Modelo', 'Ano Modelo', 'Año Mod', 'Ano Mod']),
        tituloNo,
    };
}

async function run() {
    const pdf = require('pdf-parse');
    
    function visualLayoutRender(pageData) {
        return pageData.getTextContent().then(function(textContent) {
            const items = textContent.items.map(item => ({
                text: item.str,
                x: item.transform[4],
                y: item.transform[5]
            }));
            const rows = [];
            const threshold = 7;
            for (const item of items) {
                if (!item.text.trim()) continue;
                let foundRow = false;
                for (const row of rows) {
                    if (Math.abs(row.y - item.y) <= threshold) {
                        row.items.push(item);
                        foundRow = true;
                        break;
                    }
                }
                if (!foundRow) {
                    rows.push({ y: item.y, items: [item] });
                }
            }
            rows.sort((a, b) => b.y - a.y);
            for (const row of rows) {
                row.items.sort((a, b) => a.x - b.x);
            }
            return rows.map(row => row.items.map(item => item.text).join(' ')).join('\n');
        });
    }

    const options = { pagerender: visualLayoutRender };
    
    const bochoPath = path.join(__dirname, '..', 'tivetest', 'tivecompleto', 'BOCHO DIEGO.pdf');
    const bochoText = (await pdf(fs.readFileSync(bochoPath), options)).text;
    
    const hondaPath = path.join(__dirname, '..', 'tivetest', 'tivecompleto', '7bdb5663-3cdd-43bd-9e23-a3d8b989d834.pdf');
    const hondaText = (await pdf(fs.readFileSync(hondaPath), options)).text;

    console.log("=== FINAL IMPROVED EXTRACTION RESULTS ===");
    console.log("BOCHO DIEGO:", extraerDatos(bochoText));
    console.log("HONDA CB125F:", extraerDatos(hondaText));
}

run().catch(console.error);
