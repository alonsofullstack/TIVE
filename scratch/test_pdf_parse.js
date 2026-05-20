const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function testPdfParse() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF not found:", pdfPath);
        process.exit(1);
    }

    const buffer = fs.readFileSync(pdfPath);
    console.log("Running pdf-parse...");
    try {
        const data = await pdf(buffer);
        console.log("\n--- pdf-parse Text ---");
        console.log(`Text length: ${data.text.length}`);
        console.log("Preview:");
        console.log(data.text);
        console.log("-----------------------\n");
    } catch (e) {
        console.error("Error in pdf-parse:", e);
    }
}

testPdfParse();
