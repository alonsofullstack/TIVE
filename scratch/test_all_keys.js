const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { API_KEYS } = require('../src/config');

async function testKey(keyIndex, key, modelName) {
    console.log(`\n--- Probando Llave #${keyIndex + 1} con modelo: ${modelName} ---`);
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    try {
        const result = await model.generateContent("Hola, responde con la palabra 'OK' si recibes este mensaje.");
        console.log(`Llave #${keyIndex + 1} exitosa:`, result.response.text().trim());
        return true;
    } catch (err) {
        console.error(`Llave #${keyIndex + 1} falló:`, err.message);
        return false;
    }
}

async function main() {
    console.log(`Total de llaves configuradas: ${API_KEYS.length}`);
    const modelsToTest = ["gemini-flash-latest", "gemini-1.5-flash-latest", "gemini-2.0-flash-exp"];
    
    for (let i = 0; i < API_KEYS.length; i++) {
        const key = API_KEYS[i];
        for (const m of modelsToTest) {
            await testKey(i, key, m);
        }
    }
}

main().catch(console.error);
