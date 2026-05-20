const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function extraerTextoPdfTive(pdfBuffer) {
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
    return chunks.join(' ');
}

async function inspectPdf() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF not found:", pdfPath);
        process.exit(1);
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`PDF Buffer size: ${pdfBuffer.length} bytes`);

    // 1. Try our custom embedded text extractor
    const embeddedText = extraerTextoPdfTive(pdfBuffer);
    console.log("\n--- Custom Extracted Embedded Text ---");
    console.log(embeddedText ? embeddedText.slice(0, 1000) : "(No text extracted)");

    // 2. Try pdf-lib to see if it contains an AcroForm
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    console.log(`\n--- AcroForm Fields count: ${fields.length} ---`);
    for (const field of fields) {
        const name = field.getName();
        let value = "";
        try {
            value = field.getText ? field.getText() : "";
        } catch(e) {}
        console.log(`Field Name: "${name}", Value: "${value}"`);
    }
}

inspectPdf().catch(console.error);
