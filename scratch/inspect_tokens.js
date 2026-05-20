const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function inspectTokens() {
    const pdfPath = path.join(__dirname, '..', 'servicio', 'verCertificado', 'Tive', '96C5F1DFC68568134BBB4D1EAD4E66BA03EFA32CBFEDE48FD0A3774D6AAC03EA.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF not found:", pdfPath);
        process.exit(1);
    }
    
    const buffer = fs.readFileSync(pdfPath);
    
    function customRender(pageData) {
        return pageData.getTextContent().then(function(textContent) {
            console.log(`Raw items count: ${textContent.items.length}`);
            for (const item of textContent.items) {
                if (item.str.trim()) {
                    console.log(`X: ${item.transform[4].toFixed(2)}, Y: ${item.transform[5].toFixed(2)} -> "${item.str}"`);
                }
            }
            return "";
        });
    }
    
    const options = {
        pagerender: customRender
    };
    
    await pdf(buffer, options);
}

inspectTokens().catch(console.error);
