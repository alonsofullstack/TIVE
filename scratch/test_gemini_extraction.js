const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { API_KEYS } = require('../src/config');
const { completarDatosExtraidosTive } = require('../src/services/pdfParser');

async function testExtraction(modelName) {
    console.log(`\n======================================================`);
    console.log(`Probando extracción con modelo: ${modelName}`);
    console.log(`======================================================`);
    
    const pdfPath = path.join(__dirname, '..', 'tarjeta', 'adelantexd.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error(`No se encontró el PDF en: ${pdfPath}`);
        return;
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    const key = API_KEYS[0];
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const prompt = `Analiza este documento TIVE (Tarjeta de Identificación Vehicular Electrónica). 
    Extrae TODOS los datos técnicos y registrales.
    Devuelve estrictamente un objeto JSON con estas llaves exactas:
    {
      "codVerif": "",
      "fechaFinal": "",
      "zona": "",
      "sede": "",
      "partida": "",
      "dua": "",
      "titulo": "",
      "fechaTitulo": "",
      "categoria": "",
      "marca": "",
      "modelo": "",
      "color": "",
      "vin": "",
      "serie": "",
      "motor": "",
      "carroceria": "",
      "potencia": "",
      "formRod": "",
      "combustible": "",
      "asientos": "",
      "pasajeros": "",
      "ruedas": "",
      "ejes": "",
      "placa": "",
      "añoFabricacion": "",
      "cilindros": "",
      "longitud": "",
      "altura": "",
      "ancho": "",
      "cilindrada": "",
      "pBruto": "",
      "pNeto": "",
      "cargaUtil": "",
      "version": "",
      "añoModelo": "",
      "tituloNo": ""
    }
    
    IMPORTANTE:
    - Usa solo valores encontrados en el documento. No inventes datos.
    - No incluyas unidades de medida (como kg, m, mt, etc.) en los campos numéricos como pesos y dimensiones.
    - El código de verificación es un código numérico (generalmente de 4 a 9 dígitos).
    - La fechaFinal suele ser la fecha y hora que aparece debajo del código de verificación o al final del documento.
    - Asegúrate de extraer la Placa correctamente con su formato (por ejemplo: ABC-123 o 1234-AB).`;

    try {
        const result = await model.generateContent([
            { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: prompt }
        ]);
        
        const responseText = result.response.text().replace(/```json|```/g, "").trim();
        console.log("Respuesta cruda recibida!");
        const parsedData = JSON.parse(responseText);
        const datosCompletos = completarDatosExtraidosTive(parsedData, 'adelantexd.pdf');
        console.log("Extracción exitosa. Datos críticos:");
        console.log({
            placa: datosCompletos.placa,
            marca: datosCompletos.marca,
            serie: datosCompletos.serie,
            vin: datosCompletos.vin
        });
    } catch (err) {
        console.error(`Error en la extracción con ${modelName}:`, err.message);
    }
}

async function main() {
    await testExtraction("gemini-3.5-flash");
    await testExtraction("gemini-2.5-flash");
}

main().catch(console.error);
