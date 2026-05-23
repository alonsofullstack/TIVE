const zlib = require('zlib');
const { logInfo, logError, logTimer } = require('../utils/logger');
const {
    safe,
    limpiarDua,
    corregirVinPorAño,
    limpiarCategoria,
    limpiarPotencia,
    limpiarVersion,
    fmtPlaca,
    validarPlacaExtraida,
    generarCodigoVerificacion,
    generarFechaHoraTive,
    normalizarTituloDesdeTituloNo
} = require('../utils/helpers');

async function extraerTextoPdfTive(pdfBuffer) {
    try {
        const pdf = require('pdf-parse');
        
        function visualLayoutRender(pageData) {
            return pageData.getTextContent().then(function(textContent) {
                const items = textContent.items.map(item => ({
                    text: item.str,
                    x: item.transform[4],
                    y: item.transform[5]
                }));
                
                const rows = [];
                const threshold = 7; // pixels

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
                        rows.push({
                            y: item.y,
                            items: [item]
                        });
                    }
                }

                rows.sort((a, b) => b.y - a.y);

                for (const row of rows) {
                    row.items.sort((a, b) => a.x - b.x);
                }

                return rows.map(row => row.items.map(item => item.text).join(' ')).join('\n');
            });
        }

        const options = {
            pagerender: visualLayoutRender
        };
        const data = await pdf(pdfBuffer, options);
        return data.text || '';
    } catch (e) {
        logError('TIVE EMBEDDED', '⚠️', 'Error extrayendo texto embebido con pdf-parse — activando fallback básico (raw stream parser)', e);
        try {
            const pdfBytes = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
            const chunks = [];
            const objectRegex = /(\d+)\s+0\s+obj\s*<<(.*?)>>\s*stream\r?\n/gs;
            let match;

            while ((match = objectRegex.exec(pdfBytes.toString('latin1'))) !== null) {
                const dictionary = match[2];
                const start = match.index + match[0].length;
                const end = pdfBytes.indexOf(Buffer.from('endstream'), start);
                if (end < 0) continue;

                const rawStream = pdfBytes.subarray(start, end);
                const trimmedStream = rawStream.toString('latin1').replace(/[\r\n]+$/g, '');
                let dataBuffer = Buffer.from(trimmedStream, 'latin1');

                if (dictionary.includes('/FlateDecode')) {
                    try {
                        dataBuffer = zlib.inflateSync(dataBuffer);
                    } catch (_) {
                        continue;
                    }
                }

                const streamText = dataBuffer.toString('latin1');
                const textRegex = /\((.*?)\)\s*Tj/gs;
                let textMatch;
                while ((textMatch = textRegex.exec(streamText)) !== null) {
                    const text = textMatch[1]
                        .replace(/\\\(/g, '(')
                        .replace(/\\\)/g, ')')
                        .replace(/\\\\/g, '\\');
                    chunks.push(text);
                }
            }
            return chunks.join('\n');
        } catch (innerError) {
            logError('TIVE EMBEDDED', '❌', 'Fallback básico (raw stream parser) falló también — devolviendo texto vacío', innerError);
            return '';
        }
    }
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

function normalizarValorNumerico(valor = '') {
    const limpio = safe(valor).replace(',', '.');
    const match = limpio.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : limpio;
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

    const regexesRuido = [
        /\b(\d\s?\d\s?\d\s?\d)[^A-Z0-9]{1,5}([A-Z])[^A-Z0-9]{0,3}([A-Z])\b/g,
        /\b([A-Z]\s?[A-Z]\s?[A-Z])[^A-Z0-9]{1,5}(\d\s?\d\s?\d)\b/g,
        /\b([A-Z]\s?[A-Z])[^A-Z0-9]{1,5}(\d\s?\d\s?\d\s?\d)\b/g,
        /\b(\d\s?\d\s?\d\s?\d\s?\d)[^A-Z0-9]{1,5}([A-Z])\b/g,
        /\b([A-Z]\s?\d)[^A-Z0-9]{1,5}(\d\s?\d\s?\d\s?\d)\b/g
    ];

    for (const regex of regexesRuido) {
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
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
    return null;
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

function componerTituloCompletar(tituloNo = '', añoTitulo = '') {
    const numero = safe(tituloNo).replace(/\s+/g, '');
    const año = safe(añoTitulo).replace(/\D/g, '');
    if (!numero) return '';

    if (/-/.test(numero)) {
        return normalizarTituloDesdeTituloNo(numero);
    }

    if (/^\d{4}$/.test(año)) {
        return normalizarTituloDesdeTituloNo(`${numero}-${año}`);
    }

    return normalizarTituloDesdeTituloNo(numero);
}

function buscarPrimerValorTive(text, etiquetas = []) {
    for (const etiqueta of etiquetas) {
        const valor = buscarValorTive(text, etiqueta);
        if (valor !== null && valor !== undefined) return valor;
    }
    return '';
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

    datos.vin  = corregirVinPorAño(datos.vin,  datos.añoModelo);
    datos.serie = corregirVinPorAño(datos.serie, datos.añoModelo);

    logInfo(logPrefix, '✅', `Parseo de texto completado`, {
        placa: datos.placa || '(vacía)',
        marca: datos.marca || '(vacía)',
        modelo: datos.modelo || '(vacío)',
        vin: datos.vin || '(vacío)',
        serie: datos.serie || '(vacía)',
        titulo: datos.titulo || '(vacío)',
        sede: datos.sede || '(vacía)',
        camposExtraidos: Object.entries(datos).filter(([, v]) => v).length + '/' + Object.keys(datos).length
    });
    return datos;
}

function completarDatosExtraidosTive(datos = {}, sourceName = '') {
    const prepared = { ...datos };
    prepared.placa = validarPlacaExtraida(prepared.placa || '') || buscarPlacaEnNombreArchivo(sourceName);
    prepared.placaOriginal = prepared.placaOriginal || prepared.placa;
    prepared.codVerif = safe(prepared.codVerif) || generarCodigoVerificacion();
    prepared.fechaFinal = safe(prepared.fechaFinal) || generarFechaHoraTive();
    if (!prepared.tituloNo && prepared.titulo) {
        prepared.tituloNo = normalizarTituloDesdeTituloNo(prepared.titulo);
    }
    if (prepared.cargaUtil && String(prepared.cargaUtil).trim().startsWith('-')) {
        prepared.cargaUtil = '';
    }
    return prepared;
}

async function extraerTiveCompletoConLibreria(pdfBuffer) {
    logInfo('TIVE COMPLETO', '📄', `Extrayendo datos con librería pdf-parse`, { bufferSize: `${pdfBuffer.length} bytes`, bufferSizeKB: `${(pdfBuffer.length / 1024).toFixed(1)} KB` });
    const timer = logTimer('TIVE COMPLETO', 'Extracción con librería pdf-parse');
    const text = await extraerTextoPdfTive(pdfBuffer) || '';
    timer.end(`textLength=${text.length} chars`);
    return extraerDatosTiveDesdeTexto(text, 'TIVE COMPLETO');
}

module.exports = {
    extraerTextoPdfTive,
    normalizarTextoBusqueda,
    truncarValorEnSiguienteEtiqueta,
    limpiarValorTive,
    buscarValorTive,
    normalizarValorNumerico,
    buscarPlacaEnTexto,
    buscarPlacaEnNombreArchivo,
    buscarTituloNumeroTive,
    buscarTituloValorTive,
    componerTituloCompletar,
    buscarPrimerValorTive,
    extraerDatosTiveDesdeTexto,
    completarDatosExtraidosTive,
    extraerTiveCompletoConLibreria
};
