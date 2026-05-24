/**
 * TEST TARJETA FÍSICA PVC — Pre-producción
 * ─────────────────────────────────────────────────────────────────
 * Genera anverso y reverso con datos reales de referencia.
 * Ajusta las coordenadas X/Y de cada campo hasta que quede igual
 * al modelo. Luego copia los valores a cardGenerator.js.
 *
 * Uso:
 *   node scratch/test_tarjeta_fisica.js
 *   node scratch/test_tarjeta_fisica.js --placa XYZ-789 --sede LIMA
 *   node scratch/test_tarjeta_fisica.js --pdf ruta/al/original.pdf
 *
 * Salida: scratch/output/tarjeta_fisica_ANV_*.png  y  REV_*.png
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const path   = require('path');
const fs     = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit  = require('@pdf-lib/fontkit');
const bwipjs   = require('bwip-js');
const pdf2img  = require('pdf-img-convert');
const sharp    = require('sharp');
const config   = require('../src/config');
const { FONT_BYTES } = config;
const { safe, obtenerZonaNormalizada, limpiarPotencia, fmtPlaca } = require('../src/utils/helpers');

// ── CLI args ──────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i !== -1 && args[i+1] ? args[i+1] : null; };

// ── Directorio de salida ──────────────────────────────────────────
const OUT = path.join(__dirname, 'output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ── Plantillas ────────────────────────────────────────────────────
function tpl(name) {
    const p = path.join(__dirname, '..', 'tarjeta', name);
    if (!fs.existsSync(p)) throw new Error('Plantilla no encontrada: ' + p);
    return p;
}

// =================================================================
//  DATOS DE REFERENCIA — Tarjeta real: Placa 4422-CS / TARAPOTO
//  Edita estos valores para probar con otro vehículo.
// =================================================================
const D = {
    placa:          getArg('--placa') || '4422-CS',
    zona:           'III',
    sede:           getArg('--sede') || 'TARAPOTO',
    partida:        '60687645',
    dua:            '118 2018 10 114792 490',
    titulo:         '2019-00094796',
    tituloNo:       '2019-00094796',
    fechaTitulo:    '04/05/2018',
    codVerif:       '1006918726',
    fechaFinal:     '23/05/2026 10:30:00',
    categoria:      'L3',
    marca:          'YAMAHA',
    modelo:         'XTZ 125',
    color:          'NEGRO',
    vin:            'LBPDE1218J0015219',
    serie:          'LBPDE1218J0015219',
    motor:          'E3W8E027263',
    carroceria:     'MOTOCICLETA',
    potencia:       '12,00@8000',
    formRod:        '2X1',
    combustible:    'GASOLINA',
    añoFabricacion: '2018',
    añoModelo:      '2018',
    version:        'SIN VERSION',
    asientos:       '2',
    pasajeros:      '1',
    ruedas:         '2',
    ejes:           '2',
    cilindros:      '1',
    cilindrada:     '0.124',
    pBruto:         '0.271',
    pNeto:          '0.125',
    cargaUtil:      '0.118',
    longitud:       '2.00',
    altura:         '1.05',
    ancho:          '0.78',
};

// =================================================================
//
//  ██████╗ ██████╗ ███████╗ ██████╗
//  ██╔══██╗██╔══██╗██╔════╝██╔════╝
//  ██████╔╝██████╔╝█████╗  ██║
//  ██╔═══╝ ██╔══██╗██╔══╝  ██║
//  ██║     ██║  ██║███████╗╚██████╗
//
//  Plantilla: TARJETA FISICA ADELANTE.pdf
//  Tamaño:    267.72 x 176.74 pts
//
//  Sistema de coordenadas pdf-lib:
//    X → izquierda a derecha  (0 = borde izquierdo)
//    Y → abajo a arriba       (0 = borde inferior)
//  Aquí usamos  y: hA - VALOR  para trabajar desde arriba.
//
//  ┌─────────────────────────────────────────────────────┐
//  │  Zona Registral No.: [zona]   Oficina: [sede]       │  ← fila 1
//  │  Placa No.: [placa]   Partida: [partida]            │  ← fila 2
//  │  DUA/DAM: [dua]                                     │  ← fila 3
//  │  Titulo: [titulo]     Fecha del Título: [fechaTit]  │  ← fila 4
//  │  [barcode]  [espacio QR vacío]                      │  ← inferior
//  │  [codVerif] [tituloNo] [fechaFinal]  (muy pequeños) │
//  └─────────────────────────────────────────────────────┘
//
// =================================================================

// -----------------------------------------------------------------
//  COORDENADAS ANVERSO — ajusta X e Y hasta que coincida con el modelo
//  Formato:  { x, y, size }
//  y = distancia desde el BORDE SUPERIOR (se convierte internamente)
// -----------------------------------------------------------------
const ANV = {
    // ─────────────────────────────────────────────────────────────────────
    //  Cómo mover:
    //    x  → sube el número para ir a la DERECHA, bájalo para ir a la IZQUIERDA
    //    y  → sube el número para ir hacia ABAJO,  bájalo para ir hacia ARRIBA
    //    size → tamaño de la fuente en puntos
    // ─────────────────────────────────────────────────────────────────────

    //         imprime →  "III"
    //         campo   →  Zona Registral No.  (texto gris pequeño)
    zona:        { x:  58,   y:  66.5, size: 6  },

    //         imprime →  "TARAPOTO"
    //         campo   →  Oficina Registral  (texto gris pequeño)
    sede:        { x:  128,   y:  67, size: 6  },

    //         imprime →  "60687645"
    //         campo   →  Partida Registral
    partida:     { x:  128,   y:  79,   size: 5.5  },

    //         imprime →  "118 2018 10 114792 490"
    //         campo   →  DUA/DAM
    dua:         { x:  38,   y:  96,   size: 5.5 },

    //         imprime →  "2019-00094796"
    //         campo   →  Título
    titulo:      { x:  38, y: 109.5,   size: 5.5  },

    //         imprime →  "04/05/2018"
    //         campo   →  Fecha del Título
    fechaTitulo: { x:  128,   y: 109,   size: 5.5  },

    //         imprime →  "4422-CS"
    //         campo   →  Placa No.  (texto GRANDE)
    placa:       { x: 38,   y: 80,   size: 7.5 },

    //         imprime →  código de barras de la placa
    //         campo   →  rectángulo inferior izquierdo
    //         x/y     →  esquina superior izquierda del rectángulo
    //         w/h     →  ancho y alto en puntos
    barcode: { x: 16.5, y: 161.5, w: 68, h: 17 },
};

// =================================================================
//
//  ██████╗ ███████╗██╗   ██╗███████╗██████╗ ███████╗ ██████╗
//  ██╔══██╗██╔════╝██║   ██║██╔════╝██╔══██╗██╔════╝██╔═══██╗
//  ██████╔╝█████╗  ██║   ██║█████╗  ██████╔╝███████╗██║   ██║
//  ██╔══██╗██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██║   ██║
//  ██║  ██║███████╗ ╚████╔╝ ███████╗██║  ██║███████║╚██████╔╝
//
//  Plantilla: TARJETA FISICA ATRAS.pdf
//  Tamaño:    267.66 x 177.36 pts
//
//  ┌──────────────────────────────────────────────────────────────┐
//  │ Categoría:[cat]  Año Fab:[añoFab]  Cilindros:[cil]  Cil:[cc]│
//  │ Marca:[marca]    Año Mod:[añoMod]                   PBruto:  │
//  │ Modelo:[modelo]  Versión:[version]                  PNeto:   │
//  │ Color:[color]                                       CargaUt: │
//  │ VIN:[vin]                                                    │
//  │ Serie:[serie]                                                │
//  │ Motor:[motor]                                                │
//  │ Carrocería:[carr]                                            │
//  │ Potencia:[pot]                                               │
//  │ Form.Rod:[form]                                              │
//  │ Combustible:[comb]                                           │
//  │ Asientos:[as]  Cilindros:[cil]  Cilindrada:[cc]             │
//  │ Pasajeros:[pas] Longitud:[lon]  P.Bruto:[pb]                │
//  │ Ruedas:[rue]   Altura:[alt]     P.Neto:[pn]                 │
//  │ Ejes:[eje]     Ancho:[anc]      Carga Útil:[cu]             │
//  │ [════════════ PDF417 ════════════]                           │
//  └──────────────────────────────────────────────────────────────┘
//
// =================================================================

// -----------------------------------------------------------------
//  COORDENADAS REVERSO — ajusta X e Y hasta que coincida con el modelo
//  y = distancia desde el BORDE SUPERIOR
// -----------------------------------------------------------------
const REV = {
    // ─────────────────────────────────────────────────────────────────────
    //  Cómo mover:
    //    x  → sube el número para ir a la DERECHA, bájalo para ir a la IZQUIERDA
    //    y  → sube el número para ir hacia ABAJO,  bájalo para ir hacia ARRIBA
    //    size → tamaño de la fuente en puntos
    // ─────────────────────────────────────────────────────────────────────

    //         imprime →  "L3"
    //         campo   →  Categoría
    categoria:   { x:  32,   y:  52, size: 4.5 },

    //         imprime →  "YAMAHA"
    //         campo   →  Marca
    marca:       { x:  25,   y:  60, size: 4.5 },

    //         imprime →  "XTZ 125"
    //         campo   →  Modelo
    modelo:      { x:  28,   y:  69, size: 4.5 },

    //         imprime →  "NEGRO"
    //         campo   →  Color
    color:       { x:  25,   y:  77, size: 4.5 },

    //         imprime →  "LBPDE1218J0015219"
    //         campo   →  VIN
    vin:         { x:  21,   y:  109.5, size: 4.5 },

    //         imprime →  "LBPDE1218J0015219"
    //         campo   →  Serie / Chasis
    serie:       { x:  37,   y:  117.5, size: 4.5 },

    //         imprime →  "E3W8E027263"
    //         campo   →  Motor
    motor:       { x:  25,   y:  85, size: 4.5 },

    //         imprime →  "MOTOCICLETA"
    //         campo   →  Carrocería
    carroceria:  { x:  138,   y:  110, size: 4.5 },

    //         imprime →  "12,00@8000"
    //         campo   →  Potencia
    potencia:    { x:  138,   y:  118, size: 4.5 },

    //         imprime →  "2X1"
    //         campo   →  Fórmula Rodante
    formRod:     { x:  42,   y: 101.5, size: 4.5 },

    //         imprime →  "GASOLINA"
    //         campo   →  Combustible
    combustible: { x:  38,   y: 93, size: 4.5 },

    //         imprime →  "2018"
    //         campo   →  Año de Fabricación  (columna central)
    añoFabricacion:{ x: 138, y:  52.5, size: 4.5 },

    //         imprime →  "2018"
    //         campo   →  Año Modelo  (columna derecha)
    añoModelo:   { x: 138,   y:  60.5,   size: 4.5 },

    //         imprime →  "SIN VERSION"
    //         campo   →  Versión
    version:     { x: 138,   y: 69,   size: 4.5 },

    //         imprime →  ""  (vacío en el modelo de referencia)
    //         campo   →  Asientos
    asientos:    { x:  138,   y: 85,   size: 4.5 },

    //         imprime →  "1"
    //         campo   →  Pasajeros
    pasajeros:   { x:  138,   y: 93.5,   size: 4.5 },

    //         imprime →  "2"
    //         campo   →  Ruedas
    ruedas:      { x:  138,   y: 102, size: 4.5 },

    //         imprime →  "2"
    //         campo   →  Ejes
    ejes:        { x: 138,   y: 77, size: 4.5 },

    //         imprime →  "1"
    //         campo   →  Cilindros  (columna central)
    cilindros:   { x: 225,   y: 52.5,   size: 4.5 },

    //         imprime →  "2.00"
    //         campo   →  Longitud  (columna central)
    longitud:    { x: 225,   y: 93.5, size: 4.5 },

    //         imprime →  "1.05"
    //         campo   →  Altura  (columna central)
    altura:      { x: 225,   y: 102, size: 4.5 },

    //         imprime →  "0.78"
    //         campo   →  Ancho  (columna central)
    ancho:       { x: 225,   y: 110, size: 4.5 },

    //         imprime →  "0.124"
    //         campo   →  Cilindrada  (columna derecha)
    cilindrada:  { x: 225,   y: 60.5,   size: 4.5 },

    //         imprime →  "0.271"
    //         campo   →  P. Bruto  (columna derecha)
    pBruto:      { x: 225,   y: 69, size: 4.5 },

    //         imprime →  "0.125"
    //         campo   →  P. Neto  (columna derecha)
    pNeto:       { x: 225,   y: 77.5, size: 4.5 },

    //         imprime →  "0.118"
    //         campo   →  Carga Útil  (columna derecha)
    cargaUtil:   { x: 225,   y: 85.5,   size: 4.5 },

    //         imprime →  código de barras 2D con todos los datos del vehículo
    //         campo   →  PDF417  (parte inferior)
    //         x       →  posición horizontal — sube para ir a la DERECHA, baja para ir a la IZQUIERDA
    //                     pon null para centrar automáticamente
    //         y       →  distancia desde el BORDE INFERIOR — sube para ir más ARRIBA
    //         w/h     →  ancho y alto en puntos
    pdf417: { x: 12, y: 11, w: 225, h: 35 },
};

// =================================================================
//  GENERACIÓN — no tocar salvo que cambies la lógica
// =================================================================

function formatearPdf417(datos, zonaLimpia, sedeLimpia) {
    const v = (k) => safe(datos[k]).replace(/\s+/g, ' ').trim().toUpperCase();
    return [
        `!ZONA REGISTRAL N ${zonaLimpia}!SEDE REGISTRAL`,
        `- ${sedeLimpia.padEnd(22)}!${v('placa')} !`,
        `${v('partida')}!${v('dua')}!`,
        `${v('titulo')}!${v('fechaTitulo')}!`,
        `NUEVO                 !    !${v('codVerif')}!`,
        `${v('marca').padEnd(22)}!`,
        `${v('motor').padEnd(22)}!`,
        `${v('vin').padEnd(22)}!`,
        v('serie'),
    ].join('\n');
}

async function generar(datos, pdfPath = null) {
    console.log('\n🔧 Normalizando datos...');
    datos.placa      = fmtPlaca(datos.placa);
    datos.potencia   = limpiarPotencia(datos.potencia || '');
    datos.codVerif   = datos.codVerif || Math.floor(10000000 + Math.random() * 90000000).toString();
    datos.fechaFinal = datos.fechaFinal || new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

    const zonaLimpia = obtenerZonaNormalizada(datos.zona, datos.sede);
    const sedeLimpia = safe(datos.sede).replace(/^SEDE REGISTRAL[\s\-:]*/i, '').trim();
    const negro = rgb(0, 0, 0);
    const gris  = rgb(0.6, 0.6, 0.6);

    // ── ANVERSO ───────────────────────────────────────────────────
    console.log('📄 Anverso...');
    const docA = await PDFDocument.load(fs.readFileSync(tpl('TARJETA FISICA ADELANTE.pdf')));
    docA.registerFontkit(fontkit);
    const fA   = await docA.embedFont(FONT_BYTES);
    const pgA  = docA.getPages()[0];
    const { width: wA, height: hA } = pgA.getSize();
    console.log(`   ${wA.toFixed(1)} x ${hA.toFixed(1)} pts`);

    const putA = (val, cfg, color = negro) => {
        if (!safe(val)) return;
        pgA.drawText(safe(val), { x: cfg.x, y: hA - cfg.y, size: cfg.size, font: fA, color });
    };

    putA(zonaLimpia,        ANV.zona);
    putA(sedeLimpia,        ANV.sede);
    putA(datos.partida,     ANV.partida);
    putA(datos.dua,         ANV.dua);
    putA(datos.titulo,      ANV.titulo);
    putA(datos.fechaTitulo, ANV.fechaTitulo);
    putA(datos.placa,       ANV.placa);

    // Código de barras
    const barImg = await bwipjs.toBuffer({ bcid: 'code128', text: safe(datos.placa), scale: 4, height: 15, includetext: false });
    pgA.drawImage(await docA.embedPng(barImg), {
        x: ANV.barcode.x,
        y: hA - ANV.barcode.y,
        width:  ANV.barcode.w,
        height: ANV.barcode.h,
    });

    // ── REVERSO ───────────────────────────────────────────────────
    console.log('📄 Reverso...');
    const docR = await PDFDocument.load(fs.readFileSync(tpl('TARJETA FISICA ATRAS.pdf')));
    docR.registerFontkit(fontkit);
    const fR   = await docR.embedFont(FONT_BYTES);
    const pgR  = docR.getPages()[0];
    const { width: wR, height: hR } = pgR.getSize();
    console.log(`   ${wR.toFixed(1)} x ${hR.toFixed(1)} pts`);

    const putR = (val, cfg) => {
        if (!safe(val)) return;
        pgR.drawText(safe(val), { x: cfg.x, y: hR - cfg.y, size: cfg.size, font: fR, color: negro });
    };

    putR(datos.categoria,      REV.categoria);
    putR(datos.marca,          REV.marca);
    putR(datos.modelo,         REV.modelo);
    putR(datos.color,          REV.color);
    putR(datos.vin,            REV.vin);
    putR(datos.serie,          REV.serie);
    putR(datos.motor,          REV.motor);
    putR(datos.carroceria,     REV.carroceria);
    putR(datos.potencia,       REV.potencia);
    putR(datos.formRod,        REV.formRod);
    putR(datos.combustible,    REV.combustible);
    putR(datos.añoFabricacion, REV.añoFabricacion);
    putR(datos.añoModelo,      REV.añoModelo);
    putR(datos.version,        REV.version);
    putR(datos.asientos,       REV.asientos);
    putR(datos.pasajeros,      REV.pasajeros);
    putR(datos.ruedas,         REV.ruedas);
    putR(datos.ejes,           REV.ejes);
    putR(datos.cilindros,      REV.cilindros);
    putR(datos.longitud,       REV.longitud);
    putR(datos.altura,         REV.altura);
    putR(datos.ancho,          REV.ancho);
    putR(datos.cilindrada,     REV.cilindrada);
    putR(datos.pBruto,         REV.pBruto);
    putR(datos.pNeto,          REV.pNeto);
    putR(datos.cargaUtil,      REV.cargaUtil);

    // PDF417
    const pdf417Img = await bwipjs.toBuffer({ bcid: 'pdf417', text: formatearPdf417(datos, zonaLimpia, sedeLimpia), scale: 2, height: 12 });
    pgR.drawImage(await docR.embedPng(pdf417Img), {
        x: REV.pdf417.x !== null && REV.pdf417.x !== undefined
            ? REV.pdf417.x                        // posición manual
            : (wR / 2) - (REV.pdf417.w / 2),     // centrado automático
        y: REV.pdf417.y,
        width:  REV.pdf417.w,
        height: REV.pdf417.h,
    });

    // Firma (opcional)
    if (pdfPath && fs.existsSync(pdfPath)) {
        console.log('   ✂️  Recortando firma...');
        try {
            const imgs = await pdf2img.convert(fs.readFileSync(pdfPath), { width: 2000 });
            if (imgs && imgs.length > 0) {
                const imgBuf = Buffer.from(imgs[0]);
                const meta   = await sharp(imgBuf).metadata();
                const scale  = 2000 / 612;
                let l = Math.round(403.05 * scale), t = Math.round(790 * scale);
                let w = Math.round(140 * scale),    h = Math.round(60  * scale);
                l = Math.max(0, Math.min(l, meta.width  - 1));
                t = Math.max(0, Math.min(t, meta.height - 1));
                w = Math.min(w, meta.width  - l);
                h = Math.min(h, meta.height - t);
                if (w > 0 && h > 0) {
                    const sig = await sharp(imgBuf).extract({ left: l, top: t, width: w, height: h }).png().toBuffer();
                    pgR.drawImage(await docR.embedPng(sig), { x: 184, y: 4, width: 55, height: 24 });
                    console.log('   ✅ Firma incrustada');
                }
            }
        } catch (e) { console.warn('   ⚠️  Firma:', e.message); }
    }

    // ── Renderizar PNG ────────────────────────────────────────────
    console.log('\n🖼️  Renderizando PNG...');
    const bufA = await docA.save();
    const bufR = await docR.save();
    const [imgA] = await pdf2img.convert(bufA, { width: 1200 });
    const [imgR] = await pdf2img.convert(bufR, { width: 1200 });

    const crop = async (buf, extraR = 0, extraL = 0) => {
        const b = Buffer.from(buf);
        const m = await sharp(b).metadata();
        const px = 35;
        const fw = m.width  - px - extraL - px - extraR;
        const fh = m.height - px - px;
        return fw > 0 && fh > 0
            ? sharp(b).extract({ left: px + extraL, top: px, width: fw, height: fh }).toBuffer()
            : b;
    };

    const finalA = await crop(imgA, 30, 0);
    const finalR = await crop(imgR, 25, 25);

    const tag = safe(datos.placa).replace(/[^A-Z0-9]/gi, '');
    const paths = {
        anvPng: path.join(OUT, `tarjeta_fisica_ANV_${tag}.png`),
        revPng: path.join(OUT, `tarjeta_fisica_REV_${tag}.png`),
        anvPdf: path.join(OUT, `tarjeta_fisica_ANV_${tag}.pdf`),
        revPdf: path.join(OUT, `tarjeta_fisica_REV_${tag}.pdf`),
    };
    fs.writeFileSync(paths.anvPng, finalA);
    fs.writeFileSync(paths.revPng, finalR);
    fs.writeFileSync(paths.anvPdf, bufA);
    fs.writeFileSync(paths.revPdf, bufR);

    return { ...paths, zonaLimpia, sedeLimpia };
}

// ── Verificar campos ──────────────────────────────────────────────
function verificar(datos) {
    const checks = [
        ['placa',          true ], ['partida',      true ], ['dua',          true ],
        ['titulo',         true ], ['fechaTitulo',  true ], ['marca',        true ],
        ['motor',          true ], ['vin',          false], ['serie',        false],
        ['categoria',      false], ['color',        false], ['potencia',     false],
        ['combustible',    false], ['añoFabricacion',false], ['añoModelo',   false],
    ];
    console.log('\n📋 Campos:');
    let ok = true;
    for (const [campo, critico] of checks) {
        const v = datos[campo];
        const tiene = v && String(v).trim().length > 0;
        console.log(`   ${tiene ? '✅' : critico ? '❌' : '⚠️ '} ${campo.padEnd(16)}: ${tiene ? String(v).trim() : '(vacío)'}`);
        if (!tiene && critico) ok = false;
    }
    return ok;
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('   TEST TARJETA FÍSICA PVC');
    console.log('═══════════════════════════════════════════════════');

    if (!verificar(D)) { console.error('\n❌ Campos críticos vacíos.'); process.exit(1); }

    try {
        const r = await generar(D, getArg('--pdf'));
        console.log('\n═══════════════════════════════════════════════════');
        console.log('   ✅ OK');
        console.log('═══════════════════════════════════════════════════');
        console.log(`\n📁 ${OUT}`);
        console.log(`   🖼️  ${path.basename(r.anvPng)}`);
        console.log(`   🖼️  ${path.basename(r.revPng)}`);
        console.log(`   📄  ${path.basename(r.anvPdf)}`);
        console.log(`   📄  ${path.basename(r.revPdf)}`);
        console.log(`\n   Zona : ${r.zonaLimpia}  |  Sede : ${r.sedeLimpia}  |  Placa : ${D.placa}`);
        console.log('   QR   : ❌ no insertado (correcto)');
        console.log('\n💡 Abre los PNG en scratch/output/ y compara con el modelo.');
        console.log('   Ajusta ANV.* y REV.* arriba en este archivo, luego vuelve a correr.');
    } catch (e) {
        console.error('\n❌', e.message);
        process.exit(1);
    }
})();
