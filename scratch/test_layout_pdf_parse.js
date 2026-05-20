const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

function visualLayoutRender(pageData) {
    return pageData.getTextContent().then(function(textContent) {
        const items = textContent.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5]
        }));
        
        // Group rows using a threshold (e.g. 7 pixels)
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
        return rows.map(row => row.items.map(item => item.text).join(' ')).join('\n');
    });
}

async function test() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF not found:", pdfPath);
        process.exit(1);
    }
    
    const buffer = fs.readFileSync(pdfPath);
    
    const options = {
        pagerender: visualLayoutRender
    };
    
    console.log("Running pdf-parse with visual layout sorting...");
    const data = await pdf(buffer, options);
    console.log("\n📝 --- VISUALLY SORTED TEXT WITH PDF-PARSE ---");
    console.log(data.text);
    console.log("----------------------------------------------\n");
}

test().catch(console.error);
