const pdf2img = require('pdf-img-convert');
const sharp = require('sharp');
const { createWorker, PSM } = require('tesseract.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { API_KEYS } = require('../config');
const { logInfo, logError, logTimer } = require('../utils/logger');
const {
    extraerTextoPdfTive,
    extraerDatosTiveDesdeTexto,
    completarDatosExtraidosTive
} = require('./pdfParser');

async function extraerTextoOCRDesdePdf(pdfBuffer) {
    logInfo('OCR', '🔎', `Renderizando PDF para OCR (Tesseract)`, { bufferSize: `${pdfBuffer.length} bytes`, bufferSizeKB: `${(pdfBuffer.length / 1024).toFixed(1)} KB`, anchoRender: '2200px', idioma: 'spa' });
    const timerOCR = logTimer('OCR', 'Renderizado PDF → imágenes');
    const images = await pdf2img.convert(pdfBuffer, { width: 2200 });
    if (!images || images.length === 0) {
        throw new Error('No se pudo renderizar el PDF para OCR — pdf2img no devolvió imágenes.');
    }
    timerOCR.end(`páginasRenderizadas=${images.length}`);

    const worker = await createWorker('spa');
    const texts = [];

    try {
        await worker.setParameters({
            tessedit_pageseg_mode: PSM.AUTO,
            preserve_interword_spaces: '1',
        });

        const pagesToRead = Math.min(images.length, 3);
        for (let i = 0; i < pagesToRead; i++) {
            const imageBuffer = Buffer.from(images[i]);
            logInfo('OCR', '📄', `Leyendo página ${i + 1}/${pagesToRead}`, { bufferSize: `${imageBuffer.length} bytes` });

            if (i === 0) {
                logInfo('OCR', '🔎', `Página 1 (Anverso): procesando a ancho completo con filtros (grayscale+normalize+sharpen)`);
                const fullImage = await sharp(imageBuffer)
                    .grayscale()
                    .normalize()
                    .sharpen()
                    .png()
                    .toBuffer();
                const result = await worker.recognize(fullImage);
                texts.push(result.data.text || '');

                logInfo('OCR', '🔎', `Página 1 (Anverso): procesando sin filtros (raw) para capturar texto adicional`);
                const rawImage = await sharp(imageBuffer)
                    .png()
                    .toBuffer();
                const resultRaw = await worker.recognize(rawImage);
                texts.push(resultRaw.data.text || '');
            } else {
                logInfo('OCR', '🔎', `Página ${i + 1} (Reverso): cortando en 3 secciones (top 40%, left 50%, right 50%)`);
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

    const text = texts.join('\n');
    logInfo('OCR', '✅', `Texto OCR obtenido exitosamente`, { caracteres: text.length, paginas: texts.length });
    return text;
}

async function extraerConOCR(pdfBuffer, sourceName = '') {
    logInfo('OCR', '🧾', `Iniciando extracción local por texto embebido / OCR (Gemini omitido)`, { bufferSize: `${pdfBuffer.length} bytes`, sourceName: sourceName || '(sin nombre)' });

    const embeddedText = await extraerTextoPdfTive(pdfBuffer) || '';
    if (embeddedText.trim()) {
        const datosDesdeTexto = completarDatosExtraidosTive(extraerDatosTiveDesdeTexto(embeddedText, 'OCR/TEXTO', sourceName), sourceName);
        if (datosDesdeTexto.placa || datosDesdeTexto.marca || datosDesdeTexto.serie || datosDesdeTexto.vin) {
            logInfo('OCR', '✅', `Extracción desde texto embebido exitosa (sin necesidad de OCR visual)`, {
                placa: datosDesdeTexto.placa || '(vacía)',
                marca: datosDesdeTexto.marca || '(vacía)',
                serie: datosDesdeTexto.serie || '(vacía)',
                vin: datosDesdeTexto.vin || '(vacío)',
                textoLength: embeddedText.length
            });
            return datosDesdeTexto;
        }
    }

    const ocrText = await extraerTextoOCRDesdePdf(pdfBuffer);
    logInfo('OCR', '📝', `Texto OCR preview (primeros 2500 chars):\n${ocrText.slice(0, 2500)}`);
    const datosOCR = completarDatosExtraidosTive(extraerDatosTiveDesdeTexto(ocrText, 'OCR', sourceName), sourceName);
    if (datosOCR.placa || datosOCR.marca || datosOCR.serie || datosOCR.vin) {
        logInfo('OCR', '✅', `Extracción OCR visual exitosa`, {
            placa: datosOCR.placa || '(vacía)',
            marca: datosOCR.marca || '(vacía)',
            serie: datosOCR.serie || '(vacía)',
            vin: datosOCR.vin || '(vacío)',
            camposExtraidos: Object.entries(datosOCR).filter(([, v]) => v).length
        });
        logInfo('OCR', '📊', `Datos completos extraídos por OCR:\n${JSON.stringify(datosOCR, null, 2)}`);
        return datosOCR;
    }

    throw new Error("No se pudo extraer información con IA ni OCR. Asegúrate de que el PDF sea un documento TIVE legible de SUNARP.");
}

async function extraerConIA(pdfBuffer, sourceName = '') {
    logInfo('OCR', '🧾', `Iniciando extracción con Gemini AI (multimodal)`, { keysDisponibles: API_KEYS.length, bufferSize: `${pdfBuffer.length} bytes`, sourceName: sourceName || '(sin nombre)' });
    
    if (API_KEYS.length > 0) {
        for (const key of API_KEYS) {
            try {
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
                
                const prompt = `Analiza este documento TIVE (Tarjeta de Identificación Vehicular Electrónica). 
                Extrae TODOS los datos técnicos y registrales.
                Devuelve estrictamente un objeto JSON con estas llaves exactas:
                {
                  "codVerif": "",
                  "fechaFinal": "",
                  "zona": "",
                  "sede": "",
                  "partida": "",
                  "dua": "",
                  "titulo": "",
                  "fechaTitulo": "",
                  "categoria": "",
                  "marca": "",
                  "modelo": "",
                  "color": "",
                  "vin": "",
                  "serie": "",
                  "motor": "",
                  "carroceria": "",
                  "potencia": "",
                  "formRod": "",
                  "combustible": "",
                  "asientos": "",
                  "pasajeros": "",
                  "ruedas": "",
                  "ejes": "",
                  "placa": "",
                  "añoFabricacion": "",
                  "cilindros": "",
                  "longitud": "",
                  "altura": "",
                  "ancho": "",
                  "cilindrada": "",
                  "pBruto": "",
                  "pNeto": "",
                  "cargaUtil": "",
                  "version": "",
                  "añoModelo": "",
                  "tituloNo": ""
                }
                
                IMPORTANTE:
                - Usa solo valores encontrados en el documento. No inventes datos.
                - No incluyas unidades de medida (como kg, m, mt, etc.) en los campos numéricos como pesos y dimensiones.
                - El código de verificación es un código numérico (generalmente de 4 a 9 dígitos).
                - La fechaFinal suele ser la fecha y hora que aparece debajo del código de verificación o al final del documento.
                - Asegúrate de extraer la Placa correctamente con su formato (por ejemplo: ABC-123 o 1234-AB).`;

                const result = await model.generateContent([
                    { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
                    { text: prompt }
                ]);
                
                const responseText = result.response.text().replace(/```json|```/g, "").trim();
                const parsedData = JSON.parse(responseText);
                
                // Normalizar/completar los datos mediante la función del pdfParser
                const datosCompletos = completarDatosExtraidosTive(parsedData, sourceName);
                
                if (datosCompletos.placa || datosCompletos.marca || datosCompletos.serie || datosCompletos.vin) {
                    logInfo('OCR', '✅', `Extracción con Gemini AI exitosa`, {
                        placa: datosCompletos.placa || '(vacía)',
                        marca: datosCompletos.marca || '(vacía)',
                        vin: datosCompletos.vin || '(vacío)',
                        camposExtraidos: Object.entries(datosCompletos).filter(([, v]) => v).length
                    });
                    logInfo('OCR', '📊', `Datos completos extraídos por Gemini AI:\n${JSON.stringify(datosCompletos, null, 2)}`);
                    return datosCompletos;
                } else {
                    logInfo('OCR', '⚠️', `Gemini AI devolvió objeto pero sin datos críticos (placa, marca, serie, vin). Activando fallback.`);
                }
            } catch (e) {
                logError('OCR', '⚠️', `Error al extraer con Gemini AI (intentando con siguiente clave o fallback)`, e);
            }
        }
    } else {
        logInfo('OCR', '⚠️', `No hay claves de Gemini configuradas.`);
    }
    
    logInfo('OCR', '🔄', `Activando fallback a extracción local por texto embebido / OCR (Tesseract)...`);
    return await extraerConOCR(pdfBuffer, sourceName);
}

async function extraerConIA_Antigua(pdfBuffer) {
    logInfo('IA-ANTIGUA', '🧠', `Iniciando extracción de documento antiguo con Gemini AI`, { keysDisponibles: API_KEYS.length, bufferSize: `${pdfBuffer.length} bytes`, bufferSizeKB: `${(pdfBuffer.length / 1024).toFixed(1)} KB` });
    if (API_KEYS.length === 0) throw new Error("Llaves API no configuradas.");

    for (const key of API_KEYS) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `Analiza este documento de Inscripción de Vehículo de SUNARP y extrae TODOS los datos técnicos y registrales.
            Devuelve estrictamente un objeto JSON con estos campos:
            {
              "controlAnverso": "", "zona": "", "sede": "", "reparticion": "", "placa": "", "titulo": "", "partida": "",
              "apPaterno": "", "apPaterno2": "", "apMaterno": "", "apMaterno2": "", "nombres": "", "nombres2": "",
              "domicilio": "", "fechaPropiedad": "", "fechaInferior": "", "fechaAsiento": "",
              "controlReverso": "", "clase": "", "marca": "", "añoFab": "", "modelo": "", "combustible": "",
              "carroceria": "", "ejes": "", "color": "", "cilindros": "", "motor": "", "ruedas": "", "serie": "",
              "pasajeros": "", "asientos": "", "pesoSeco": "", "pesoBruto": "", "longitud": "", "altura": "", "ancho": "", "cargaUtil": ""
            }
            IMPORTANTE: 
            - El Título Nro se mapea a "titulo". 
            - La Partida se mapea a "partida".
            - Busca específicamente la "Fecha Asiento" (suele estar al final) y ponla en "fechaAsiento".
            - Si hay dos propietarios (Persona Natural), sepáralos. 
            - Extrae Zona y Sede del recibo o encabezado si es posible.
            - No incluyas unidades de medida (tn, mt) en los campos de peso o dimensiones.`;

            const result = await model.generateContent([{ inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } }, { text: prompt }]);
            const rawText = result.response.text();
            const parsedData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
            logInfo('IA-ANTIGUA', '✅', `Extracción exitosa con Gemini AI`, {
                placa: parsedData.placa || '(vacía)',
                clase: parsedData.clase || '(vacía)',
                marca: parsedData.marca || '(vacía)',
                motor: parsedData.motor || '(vacío)',
                fechaAsiento: parsedData.fechaAsiento || '(vacía)',
                camposExtraidos: Object.entries(parsedData).filter(([, v]) => v).length
            });
            logInfo('IA-ANTIGUA', '📊', `Datos completos extraídos por IA:\n${JSON.stringify(parsedData, null, 2)}`);
            return parsedData;
        } catch (e) { logError('IA-ANTIGUA', '⚠️', `Error con key de Gemini (intentando siguiente)`, e); }
    }
    throw new Error("No se pudo extraer información del documento antiguo.");
}

module.exports = {
    extraerTextoOCRDesdePdf,
    extraerConOCR,
    extraerConIA,
    extraerConIA_Antigua
};
