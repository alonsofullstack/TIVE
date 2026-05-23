const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { API_KEYS } = require('../src/config');

async function testModel(modelName) {
    console.log(`\n--- Probando modelo: ${modelName} ---`);
    if (API_KEYS.length === 0) {
        console.error("No hay llaves de Gemini configuradas.");
        return;
    }
    
    const key = API_KEYS[0]; // Usar la primera llave
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    try {
        const result = await model.generateContent("Responde solo: 'OK'");
        console.log(`Respuesta de ${modelName}:`, result.response.text().trim());
    } catch (err) {
        console.error(`Error con modelo ${modelName}:`, err.message);
    }
}

async function main() {
    const models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest"
    ];
    
    for (const m of models) {
        await testModel(m);
    }
}

main().catch(console.error);
