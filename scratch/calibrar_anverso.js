/**
 * CALIBRADOR ANVERSO — dibuja cada campo con su nombre y valor
 * para comparar visualmente con el modelo de referencia.
 * 
 * Uso: node scratch/calibrar_anverso.js
 * Salida: scratch/output/calibracion_ANV.png  y  calibracion_REV.png
 */
require('dotenv').config();
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit  = require('@pdf-lib/fontkit');
const bwipjs   = require('bwip-js');
const pdf2img  = require('pdf-img-convert');
const fs       = require('path').join;
const path     = require('path');
const fss      = require('fs');

const config   = require('../src/config');
const { FONT_BYTES } = config;
const { safe, obtenerZonaNormalizada } = require('../src/utils/helpers');

const OUT = path.join(__dirname, 'output');
if (!fss.existsSync(OUT)) fss.mkdirSync(OUT, { recursive: true });

function getTemplate(name) {
    const p = path.join(__dirname, '..', 'tarjeta', name);
    if (!fss.existsSync(p)) throw new Error('No encontrado: ' + p);
    return p;
}

// ── Datos del modelo de referencia ───────────────────────────────
const D = {
    placa:       '4422-CS',
    zona:        'III',
    sede:        'TARAPOTO',
    partida:     '60687645',
    dua:         '118 2018 10 114792 490',
    titulo:      '2019-00094796',
    tituloNo:    '2019-00094796',
    fechaTitulo: '04/05/2018',
    codVerif:    '1006918726',
    fechaFinal:  '23/05/2026 10:30:00',

    categoria:   'L3',
    marca:       'YAMAHA',
    modelo:      'XTZ 125',
    color:       'NEGRO',
    vin:         'LBPDE1218J0015219',
    serie:       'LBPDE1218J0015219',
    motor:       'E3W8E027263',
    carroceria:  'MOTOCICLETA',
    potencia:    '12,00@8000',
    formRod:     '2X1',
    combustible: 'GASOLINA',
    añoFabricacion: '2018',
    añoModelo:   '2018',
    version:     'SIN VERSION',
    asientos:    '',
    pasajeros:   '1',
    ruedas:      '2',
    ejes:        '2',
    cilindros:   '1',
    cilindrada:  '0.124',
    pBruto:      '0.271',
    pNeto:       '0.125',
    cargaUtil:   '0.118',
    longitud:    '2.00',
    altura:      '1.05',
    ancho:       '0.78',
};

// ─────────────────────────────────────────────────────────────────
// ANVERSO
// ─────────────────────────────────────────────────────────────────
async function calibrarAnverso() {
    const doc = await PDFDocument.load(fss.readFileSync(getTemplate('TARJETA FISICA ADELANTE.pdf')));
    doc.registerFontkit(fontkit);
    const font  = await doc.embedFont(FONT_BYTES);
    const fontH = await doc.embedFont(StandardFonts.Helvetica);
    const page  = doc.getPages()[0];
    const { width: W, height: H } = page.getSize();
    const negro = rgb(0, 0, 0);
    const rojo  = rgb(0.9, 0, 0);
    const gris  = rgb(0.5, 0.5, 0.5);

    const zonaLimpia = obtenerZonaNormalizada(D.zona, D.sede);
    let sedeLimpia   = D.sede.replace(/^SEDE REGISTRAL[\s\-:]*/i, '').trim();

    // Helper: dibuja texto + marcador rojo de posición
    const put = (label, value, x, y, size, color = negro) => {
        if (!value) return;
        page.drawText(String(value), { x, y: H - y, size, font, color });
        // Punto rojo en la posición exacta
        page.drawCircle({ x, y: H - y, size: 1.2, color: rojo });
        // Etiqueta del campo (muy pequeña, en rojo)
        page.drawText(label, { x, y: H - y + size + 1, size: 3, font: fontH, color: rojo });
    };

    // ── Campos del anverso (coordenadas actuales) ─────────────────
    put('zona',        zonaLimpia,       58,    55.5,  5.2, gris);
    put('sede',        sedeLimpia,       53,    63.5,  5.2, gris);
    put('partida',     D.partida,        65,    75,    6.8);
    put('dua',         D.dua,            50,    89,    6.8);
    put('titulo',      D.titulo,         34.5,  104,   6.8);
    put('fechaTitulo', D.fechaTitulo,    62,    117,   6.8);
    put('placa',       D.placa,          159,   115,   17.9);
    put('codVerif',    D.codVerif,       213,   142,   4.5);
    put('tituloNo',    D.tituloNo,       183,   149.5, 4.5);
    put('fechaFinal',  D.fechaFinal,     177,   158,   4.5);

    // Código de barras
    const barImg = await bwipjs.toBuffer({ bcid: 'code128', text: D.placa, scale: 4, height: 15, includetext: false });
    page.drawImage(await doc.embedPng(barImg), { x: 10, y: H - 168, width: 82, height: 18 });
    page.drawRectangle({ x: 10, y: H - 168, width: 82, height: 18, borderColor: rojo, borderWidth: 0.5 });
    page.drawText('barcode', { x: 10, y: H - 168 + 19, size: 3, font: fontH, color: rojo });

    const out = await doc.save();
    const imgs = await pdf2img.convert(Buffer.from(out), { width: 2400 });
    const outPath = path.join(OUT, 'calibracion_ANV.png');
    fss.writeFileSync(outPath, Buffer.from(imgs[0]));
    console.log('✅ Anverso calibración:', outPath);
    return { W, H };
}

// ─────────────────────────────────────────────────────────────────
// REVERSO
// ─────────────────────────────────────────────────────────────────
async function calibrarReverso() {
    const doc = await PDFDocument.load(fss.readFileSync(getTemplate('TARJETA FISICA ATRAS.pdf')));
    doc.registerFontkit(fontkit);
    const font  = await doc.embedFont(FONT_BYTES);
    const fontH = await doc.embedFont(StandardFonts.Helvetica);
    const page  = doc.getPages()[0];
    const { width: W, height: H } = page.getSize();
    const negro = rgb(0, 0, 0);
    const rojo  = rgb(0.9, 0, 0);

    const put = (label, value, x, y, size = 4.5) => {
        if (!value && value !== 0) return;
        page.drawText(String(value), { x, y: H - y, size, font, color: negro });
        page.drawCircle({ x, y: H - y, size: 1.2, color: rojo });
        page.drawText(label, { x, y: H - y + size + 1, size: 3, font: fontH, color: rojo });
    };

    // ── Campos del reverso (coordenadas actuales) ─────────────────
    put('categoria',   D.categoria,    37,   40.5);
    put('marca',       D.marca,        37,   47.5);
    put('modelo',      D.modelo,       37,   54.5);
    put('color',       D.color,        37,   61.5);
    put('vin',         D.vin,          59,   69.5);
    put('serie',       D.serie,        59,   76.5);
    put('motor',       D.motor,        61,   83.5);
    put('carroceria',  D.carroceria,   59,   90.5);
    put('potencia',    D.potencia,     45,   97.5);
    put('formRod',     D.formRod,      45,  104.5);
    put('combustible', D.combustible,  48,  111.5);
    put('añoFab',      D.añoFabricacion, 148, 40.5);
    put('añoModelo',   D.añoModelo,   225,   39);
    put('version',     D.version,     148,  100);  // ← ajustar
    put('asientos',    D.asientos,     45,  122);
    put('pasajeros',   D.pasajeros,    45,  129);
    put('ruedas',      D.ruedas,       45,  134.9);
    put('ejes',        D.ejes,         45,  141.9);
    put('cilindros',   D.cilindros,   115,  121);
    put('longitud',    D.longitud,    115,  127.8);
    put('altura',      D.altura,      115,  134.6);
    put('ancho',       D.ancho,       115,  141.4);
    put('cilindrada',  D.cilindrada,  203,  121);
    put('pBruto',      D.pBruto,      203,  127.8);
    put('pNeto',       D.pNeto,       203,  134.6);
    put('cargaUtil',   D.cargaUtil,   203,  142);

    // PDF417
    const bwipjs = require('bwip-js');
    const barText = [
        `!ZONA REGISTRAL N III!SEDE REGISTRAL`,
        `- TARAPOTO             !4422-CS !`,
        `60687645!118 2018 10 114792 490!`,
        `2019-00094796!04/05/2018!`,
        `NUEVO                 !    !1006918726!`,
        `YAMAHA                !`,
        `E3W8E027263           !`,
        `LBPDE1218J0015219     !`,
        `LBPDE1218J0015219`,
    ].join('\n');
    const barImg = await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 });
    page.drawImage(await doc.embedPng(barImg), { x: (W / 2) - (170 / 2), y: 5, width: 170, height: 22 });
    page.drawRectangle({ x: (W/2)-(170/2), y: 5, width: 170, height: 22, borderColor: rojo, borderWidth: 0.5 });
    page.drawText('PDF417', { x: (W/2)-(170/2), y: 28, size: 3, font: fontH, color: rojo });

    const out = await doc.save();
    const imgs = await pdf2img.convert(Buffer.from(out), { width: 2400 });
    const outPath = path.join(OUT, 'calibracion_REV.png');
    fss.writeFileSync(outPath, Buffer.from(imgs[0]));
    console.log('✅ Reverso calibración:', outPath);
}

(async () => {
    console.log('🔧 Generando imágenes de calibración...\n');
    await calibrarAnverso();
    await calibrarReverso();
    console.log('\n💡 Abre scratch/output/calibracion_ANV.png y calibracion_REV.png');
    console.log('   Los puntos rojos muestran dónde empieza cada campo.');
    console.log('   Compara con el modelo y ajusta las coordenadas en cardGenerator.js');
})().catch(console.error);
