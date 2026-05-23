const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { API_KEYS } = require('../src/config');

if (API_KEYS.length === 0) {
    console.error("No API keys configured.");
    process.exit(1);
}

const key = API_KEYS[0];
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.models) {
                console.log("Modelos disponibles:");
                parsed.models.forEach(m => {
                    console.log(`- Name: ${m.name}`);
                    console.log(`  Supported Actions: ${m.supportedGenerationMethods.join(', ')}`);
                });
            } else {
                console.log("Respuesta sin modelos:", parsed);
            }
        } catch (e) {
            console.error("Error parsing response:", e.message);
            console.log("Raw response:", data);
        }
    });
}).on('error', (err) => {
    console.error("HTTP request failed:", err.message);
});
