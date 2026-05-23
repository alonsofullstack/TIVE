const fs = require('fs');
const path = require('path');
const ocrService = require('../src/services/ocrService');
const { logInfo } = require('../src/utils/logger');

// Load env variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runTestCase(useKeys, name) {
    const pdfPath = path.join(__dirname, '..', 'tarjeta', 'adelantexd.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error(`No se encontró el PDF en: ${pdfPath}`);
        return;
    }

    console.log(`\n======================================================`);
    console.log(`Caso de prueba: ${name}`);
    console.log(`======================================================`);
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Save and temporarily modify/clear GEMINI_KEYS for fallback testing
    const originalKeys = process.env.GEMINI_KEYS;
    
    // Clear Node require cache for config and ocrService
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/services/ocrService')];

    if (!useKeys) {
        process.env.GEMINI_KEYS = '';
    } else {
        process.env.GEMINI_KEYS = originalKeys;
    }

    // Require dynamically after setting env
    const configDynamic = require('../src/config');
    const ocrServiceDynamic = require('../src/services/ocrService');

    try {
        const datos = await ocrServiceDynamic.extraerConIA(pdfBuffer, 'adelantexd.pdf');
        console.log("DATOS EXTRAÍDOS:");
        console.log(JSON.stringify(datos, null, 2));
    } catch (err) {
        console.error("Error en la extracción:", err.message);
    } finally {
        process.env.GEMINI_KEYS = originalKeys;
        delete require.cache[require.resolve('../src/config')];
        delete require.cache[require.resolve('../src/services/ocrService')];
    }
}

async function main() {
    // 1. Test standard Gemini flow (with keys, if configured)
    await runTestCase(true, "Extracción normal con Gemini AI");
    
    // 2. Test Fallback flow (without keys)
    await runTestCase(false, "Fallback automático a OCR Tesseract (Sin Claves)");
}

main().catch(console.error);
