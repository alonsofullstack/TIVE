const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function testLayout() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    const buffer = fs.readFileSync(pdfPath);
    const data = new Uint8Array(buffer);

    console.log("Loading PDF with pdfjs-dist...");
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(1);
    const textContent = await page.getTextContent();
    
    console.log(`Extracted ${textContent.items.length} text items.`);

    // Group items by their vertical Y coordinate
    // transform[5] is the Y coordinate (baseline of the text)
    // transform[4] is the X coordinate
    const items = textContent.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
    }));

    // Group rows using a threshold (e.g. 5 pixels)
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

    // Sort rows from top to bottom (Y descending)
    rows.sort((a, b) => b.y - a.y);

    // Sort items inside each row from left to right (X ascending)
    for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
    }

    // Convert rows to text
    const lines = rows.map(row => {
        return row.items.map(item => item.text).join(' ');
    });

    console.log("\n📝 --- VISUALLY SORTED TEXT ---");
    console.log(lines.join('\n'));
    console.log("--------------------------------\n");
}

testLayout().catch(console.error);
