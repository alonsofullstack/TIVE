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

async function render() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF not found:", pdfPath);
        process.exit(1);
    }

    console.log("Rendering PDF to PNG...");
    const pdfBuffer = fs.readFileSync(pdfPath);
    const images = await pdf2img.convert(pdfBuffer, { width: 2200 });
    
    if (!images || images.length === 0) {
        console.error("Failed to render PDF.");
        process.exit(1);
    }

    const imageBuffer = Buffer.from(images[0]);
    fs.writeFileSync(path.join(__dirname, 'rendered_page.png'), imageBuffer);
    console.log("Saved scratch/rendered_page.png");

    const sharpImg = sharp(imageBuffer);
    const metadata = await sharpImg.metadata();
    const halfWidth = Math.floor((metadata.width || 2200) / 2);
    const height = metadata.height || 1550;

    const leftImage = await sharp(imageBuffer)
        .extract({ left: 0, top: 0, width: halfWidth, height: height })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();
    fs.writeFileSync(path.join(__dirname, 'left.png'), leftImage);
    console.log("Saved scratch/left.png");

    const rightImage = await sharp(imageBuffer)
        .extract({ left: halfWidth, top: 0, width: (metadata.width || 2200) - halfWidth, height: height })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();
    fs.writeFileSync(path.join(__dirname, 'right.png'), rightImage);
    console.log("Saved scratch/right.png");
    console.log("Done!");
}

render().catch(console.error);
