const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function testLines() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdf(buffer);
    const lines = data.text.split('\n');
    console.log(`Total lines: ${lines.length}`);
    for (let i = 0; i < lines.length; i++) {
        console.log(`${String(i + 1).padStart(3, ' ')}: "${lines[i]}"`);
    }
}

testLines().catch(console.error);
