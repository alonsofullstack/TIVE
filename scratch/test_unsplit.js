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

async function testUnsplit() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("No existe el PDF de prueba en:", pdfPath);
        process.exit(1);
    }

    console.log("🚀 Iniciando prueba de OCR UNSPLIT en:", pdfPath);
    try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const images = await pdf2img.convert(pdfBuffer, { width: 2200 });
        console.log(`Páginas renderizadas: ${images.length}`);
        
        const worker = await createWorker('spa');
        try {
            await worker.setParameters({
                tessedit_pageseg_mode: PSM.AUTO,
                preserve_interword_spaces: '1',
            });
            
            const imageBuffer = Buffer.from(images[0]);
            const sharpImg = sharp(imageBuffer);
            const metadata = await sharpImg.metadata();
            console.log("Image Metadata:", metadata);
            
            console.log("Ejecutando OCR completo sin dividir...");
            const result = await worker.recognize(imageBuffer);
            console.log("\n📝 --- TEXTO OCR OBTENIDO (COMPLETO) ---");
            console.log(result.data.text);
            console.log("---------------------------------------\n");
        } finally {
            await worker.terminate();
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

testUnsplit();
