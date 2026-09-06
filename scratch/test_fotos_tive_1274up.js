const fs = require('fs');
const path = require('path');
const createCardGenerator = require('../src/services/cardGenerator');

const outputDir = path.join(__dirname, 'output_1274up');
fs.mkdirSync(outputDir, { recursive: true });

const bot = {
    async sendPhoto(_chatId, buffer, options = {}, fileOptions = {}) {
        const filename = fileOptions.filename || 'foto.png';
        fs.writeFileSync(path.join(outputDir, filename), buffer);
        console.log(`Guardado ${filename}: ${buffer.length} bytes (${options.caption || ''})`);
    },
    async sendDocument(_chatId, buffer, _options = {}, fileOptions = {}) {
        const filename = fileOptions.filename || 'documento.pdf';
        fs.writeFileSync(path.join(outputDir, filename), buffer);
        console.log(`Guardado fallback ${filename}: ${buffer.length} bytes`);
    },
    async sendMessage() {}
};

const datos = {
    codVerif: '49747854',
    fechaFinal: '25/03/2026 12:15:02',
    zona: 'N° I',
    sede: 'PIURA',
    partida: '61026554',
    dua: '118-2025-10-543705-8',
    titulo: '2026-959840',
    fechaTitulo: '25/03/2026',
    categoria: 'L3',
    marca: 'SUZUKI',
    modelo: 'GSX-R150 ABS',
    color: 'NEGRO ROJO',
    vin: '9FSDL23E3TC101115',
    serie: '9FSDL23E3TC101115',
    motor: 'CGA2258481',
    carroceria: 'MOTOCICLETA',
    potencia: '14,16@10500',
    formRod: '2X1',
    combustible: 'GASOLINA',
    asientos: '2',
    pasajeros: '1',
    ruedas: '2',
    ejes: '2',
    placa: '1274-UP',
    añoFabricacion: '',
    cilindros: '1',
    longitud: '2.02',
    altura: '1.075',
    ancho: '0.70',
    cilindrada: '0.147',
    pBruto: '0.280',
    pNeto: '0.130',
    cargaUtil: '0.150',
    version: 'GSX-R150 ABS',
    añoModelo: '2026',
    tituloNo: '959840-2026',
    placaOriginal: '1274-UP'
};

async function main() {
    const { generarTIVE } = createCardGenerator(bot);
    await generarTIVE(1274, datos, null, null, {
        anv: 'TARJETA FISICA ADELANTE 2.pdf',
        rev: 'atrasxd.pdf'
    }, {
        anversoLayout: 'fotosV2',
        cropTopAnv: 0,
        cropBottomAnv: 0,
        cropLeftAnv: 0,
        cropRightAnv: 0
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
