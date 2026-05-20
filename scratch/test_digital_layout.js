const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

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

function truncarValorEnSiguienteEtiqueta(valor = '', etiquetaBusqueda = '') {
    const etiquetaNorm = normalizarTextoBusqueda(etiquetaBusqueda).toLowerCase();
    
    const etiquetasADerecha = [
        { name: 'placa', regex: /Plac\s*a/i },
        { name: 'fabricacion', regex: /Año\s*F/i },
        { name: 'fabricacion', regex: /Ano\s*F/i },
        { name: 'modelo', regex: /Año\s*M/i },
        { name: 'modelo', regex: /Ano\s*M/i },
        { name: 'version', regex: /V\s*er\s*sión/i },
        { name: 'version', regex: /V\s*er\s*sion/i },
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
        limpio = limpio.replace(/^n[°ºo]?\s*[:;\-]?\s*/i, '');
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
        .replace(/\0/g, '')
        .replace(/Aino/g, 'Año')
        .replace(/aino/g, 'año')
        .replace(/Parda/g, 'Partida')
        .replace(/parda/g, 'partida')
        .replace(/Regisirader/g, 'Registrador')
        .replace(/regisirader/g, 'registrador')
        .replace(/Scde/g, 'Sede')
        .replace(/scde/g, 'sede')
        // Reparar espaciado de letras por kerning en PDFs digitales
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

    const fechaTitulo = buscarValorTive(cleanText, 'Fecha');
    const tituloNo = normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(cleanText));
    const tituloNormalizado = tituloNo || normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(cleanText));
    const placa = validarPlacaExtraida(
        buscarPrimerValorTive(cleanText, ['Placa :', 'Placa']) ||
        buscarPlacaEnTexto(cleanText) ||
        buscarPlacaEnNombreArchivo(sourceName)
    );
    const datos = {
        codVerif: buscarValorTive(cleanText, 'Código de Verificación'),
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
        formRod: buscarValorTive(cleanText, 'Formula Rodante') || buscarValorTive(cleanText, 'Fórmula Rodante'),
        combustible: buscarValorTive(cleanText, 'Tipo Combustible') || buscarValorTive(cleanText, 'Combustible'),
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
        version: buscarValorTive(cleanText, 'Nro. Version') || buscarValorTive(cleanText, 'Nro. Versión') || buscarValorTive(cleanText, 'Versión'),
        añoModelo: buscarValorTive(cleanText, 'Año Modelo') || buscarValorTive(cleanText, 'Ano Modelo'),
        tituloNo,
    };

    console.log(`[${logPrefix}] ✅ Parseo de texto listo. Placa encontrada: ${datos.placa || '(vacía)'}`);
    return datos;
}

async function extraerTextoPdfTive(pdfBuffer) {
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
}

async function run() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF not found:", pdfPath);
        process.exit(1);
    }
    
    console.log("🚀 Cargando PDF digital:", pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    const text = await extraerTextoPdfTive(buffer);
    
    // Print the clean text for debug
    console.log("\n📝 --- CLEAN TEXT (ALL) ---");
    console.log(text);
    console.log("---------------------------\n");

    const line = text.split('\n').find(l => l.includes('P ar'));
    if (line) {
        console.log(`Line: "${line}"`);
        for (let i = 0; i < line.length; i++) {
            console.log(`Char at ${i}: '${line[i]}' (code: ${line.charCodeAt(i)})`);
        }
    }

    const parsed = extraerDatosTiveDesdeTexto(text, 'TEST-DIGITAL');
    console.log("\n📊 --- DATOS EXTRAÍDOS ---");
    console.log(JSON.stringify(parsed, null, 2));
}

run().catch(console.error);
