const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function test() {
    const pdfPath = path.join(__dirname, '..', 'tivetest', 'tivecompleto', 'BOCHO DIEGO.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    
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
    console.log("=== EXTRACTED TEXT ===");
    console.log(data.text);
    console.log("======================");
}

test().catch(console.error);
