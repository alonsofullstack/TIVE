const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// Replicate functions from bot.js
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
        { name: 'cargautil', regex: /Car\s*g\s*a/i }
    ];
    
    let limpio = valor;
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
    if (etiquetaNorm.includes('partida')) {
        limpio = limpio.replace(/^registral\s*[:;\-]?\s*/i, '');
    }
    if (etiquetaNorm.includes('titulo')) {
        limpio = limpio.replace(/^n[°º*o]?\*?\s*[:;\-]?\s*/i, '');
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

function buscarTituloNumeroTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        if (normalizarTextoBusqueda(lines[i]).toLowerCase() === 'titulo nro' && i > 0) {
            return safe(lines[i - 1]);
        }
    }
    return '';
}

function normalizarTituloDesdeTituloNo(tituloNo = '') {
    const raw = safe(tituloNo).trim();
    if (!raw) return '';
    const extractedMatch = raw.match(/\b(\d{3,}-\d{3,})\b/);
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
            return safe(line.split(/\s+/, 2)[1]);
        }
    }
    return '';
}

function buscarPrimerValorTive(text, etiquetas = []) {
    for (const etiqueta of etiquetas) {
        const valor = buscarValorTive(text, etiqueta);
        if (valor) return valor;
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
        
    const _fechaTituloRaw = buscarValorTive(cleanText, 'Fecha');
    const _fechaTituloMatch = (_fechaTituloRaw || '').match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/);
    const fechaTitulo = _fechaTituloMatch ? _fechaTituloMatch[1].trim() : (_fechaTituloRaw || '').split(/\s{2,}/)[0].trim();

    const _tituloDesdeEtiqueta = buscarValorTive(cleanText, 'Título') || buscarValorTive(cleanText, 'Titulo');
    const tituloNo = normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(cleanText)) ||
                     normalizarTituloDesdeTituloNo(_tituloDesdeEtiqueta);
    const tituloNormalizado = tituloNo;

    return {
        codVerif: (buscarValorTive(cleanText, 'Código de Verificación') || '').replace(/[^\d]/g, ''),
        fechaFinal: fechaTitulo,
        zona: buscarValorTive(cleanText, 'Zona Registral') || buscarValorTive(cleanText, 'Zona'),
        sede: buscarValorTive(cleanText, 'Sede Registral') || buscarValorTive(cleanText, 'Sede'),
        partida: buscarValorTive(cleanText, 'Partida Registral') || buscarValorTive(cleanText, 'Partida'),
        dua: buscarValorTive(cleanText, 'DUA/DAM') || buscarValorTive(cleanText, 'DUA') || buscarValorTive(cleanText, 'DAM'),
        titulo: tituloNormalizado || buscarTituloValorTive(cleanText),
        fechaTitulo: fechaTitulo ? fechaTitulo.split(/\s+/)[0] : '',
        categoria: buscarValorTive(cleanText, 'Categoría') || buscarValorTive(cleanText, 'Categoria'),
        marca: buscarValorTive(cleanText, 'Marca'),
        modelo: buscarValorTive(cleanText, 'Modelo'),
        color: buscarValorTive(cleanText, 'Color'),
        vin: buscarPrimerValorTive(cleanText, ['Nro. VIN', 'N° VIN', 'No VIN', 'VIN']),
        serie: buscarPrimerValorTive(cleanText, ['Nro. Serie', 'N° Serie', 'No Serie', 'Serie']),
        motor: buscarPrimerValorTive(cleanText, ['Nro. Motor', 'N° Motor', 'No Motor', 'Motor']),
        carroceria: buscarPrimerValorTive(cleanText, ['Tipo Carroceria', 'Tipo Carrocería', 'Carroceria', 'Carrocería']),
        potencia: buscarValorTive(cleanText, 'Potencia Motor') || buscarValorTive(cleanText, 'Potencia'),
        asientos: buscarPrimerValorTive(cleanText, ['Nro. Asientos', 'N° Asientos', 'No Asientos', 'Asientos']),
        ruedas: buscarPrimerValorTive(cleanText, ['Nro. Ruedas', 'N° Ruedas', 'No Ruedas', 'Ruedas']),
        ejes: buscarPrimerValorTive(cleanText, ['Nro. Ejes', 'N° Ejes', 'No Ejes', 'Ejes']),
        longitud: normalizarValorNumerico(buscarValorTive(cleanText, 'Longitud')),
        altura: normalizarValorNumerico(buscarValorTive(cleanText, 'Altura')),
        ancho: normalizarValorNumerico(buscarValorTive(cleanText, 'Ancho')),
        cilindrada: normalizarValorNumerico(buscarValorTive(cleanText, 'Cilindrada')),
        pBruto: normalizarValorNumerico(buscarValorTive(cleanText, 'Peso Bruto')),
        pNeto: normalizarValorNumerico(buscarValorTive(cleanText, 'Peso Neto')),
        cargaUtil: normalizarValorNumerico(buscarValorTive(cleanText, 'Carga Util')),
        version: buscarValorTive(cleanText, 'Nro. Version') || buscarValorTive(cleanText, 'Nro. Versión') || buscarValorTive(cleanText, 'Versión'),
        añoModelo: buscarValorTive(cleanText, 'Año Modelo') || buscarValorTive(cleanText, 'Ano Modelo'),
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

    console.log("=== ORIGINAL EXTRACTION RESULTS ===");
    console.log("BOCHO DIEGO:", extraerDatos(bochoText));
    console.log("HONDA CB125F:", extraerDatos(hondaText));
}

run().catch(console.error);
