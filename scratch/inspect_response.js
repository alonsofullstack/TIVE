const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { API_KEYS } = require('../src/config');

async function main() {
    const pdfPath = path.join(__dirname, '..', 'tarjeta', 'adelantexd.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error("PDF path not found");
        return;
    }
    const pdfBuffer = fs.readFileSync(pdfPath);
    const key = API_KEYS[0];
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Analiza este documento TIVE y extrae todos los datos técnicos en formato JSON.`;
    
    try {
        const result = await model.generateContent([
            { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: prompt }
        ]);
        console.log("RESPONSE TEXT:");
        console.log(result.response.text());
    } catch (err) {
        console.error("Error:", err.message);
    }
}

main().catch(console.error);
