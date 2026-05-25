const { fmtPlaca, validarPlacaExtraida } = require('../src/utils/helpers');
const { buscarPlacaEnTexto, buscarPlacaEnNombreArchivo } = require('../src/services/pdfParser');

console.log("=== PRUEBAS DE LA NUEVA VALIDACIÓN Y FORMATEO DE PLACAS ===");

// 1. Probar fmtPlaca y validarPlacaExtraida
const placasATestear = [
    "MX-69796",     // Antigua moto (7 caracteres)
    "MX69796",      // Antigua moto sin guión
    "ABC-123",      // Auto estándar (6 caracteres)
    "ABC123",       // Auto estándar sin guión
    "1234-5A",      // Moto nueva (6 caracteres)
    "12345A",       // Moto nueva sin guión
    "1234-A",       // Moto antigua (5 caracteres)
    "1234A",        // Moto antigua sin guión
    "AB-1234",      // Auto antiguo (6 caracteres)
    "AB1234",       // Auto antiguo sin guión
    "INVALID-1234", // Inválido (demasiado largo)
    "A-12"          // Inválido (demasiado corto)
];

console.log("\n--- Formateo y Validación ---");
for (const p of placasATestear) {
    const formatted = fmtPlaca(p);
    const validated = validarPlacaExtraida(p);
    console.log(`Original: "${p.padEnd(12)}" => Formateado: "${formatted.padEnd(10)}" => Validado: "${validated || '(inválido)'}"`);
}

// 2. Probar buscarPlacaEnTexto
const textosATestear = [
    "El vehículo con placa MX-69796 transitaba por Tarapoto.",
    "Vehículo marca HONDA, placa: MX69796, color NEGRO ROJO.",
    "Placa N* ABC-123 en el Título 2026-12345.",
    "Placa N* 1234-5A en el Título 2026-12345."
];

console.log("\n--- Extracción desde Texto ---");
for (const t of textosATestear) {
    const placaExtraida = buscarPlacaEnTexto(t);
    console.log(`Texto: "${t}"\n=> Placa Extraída: "${placaExtraida || '(ninguna)'}"\n`);
}

// 3. Probar buscarPlacaEnNombreArchivo
const nombresArchivoATestear = [
    "TIVE_MX-69796.pdf",
    "TIVE_MX69796.pdf",
    "TIVE_ABC-123.pdf",
    "TIVE_ABC123.pdf",
    "TIVE_1234-5A.pdf",
    "TIVE_1234-A.pdf"
];

console.log("\n--- Extracción desde Nombre de Archivo ---");
for (const f of nombresArchivoATestear) {
    const placaExtraida = buscarPlacaEnNombreArchivo(f);
    console.log(`Archivo: "${f.padEnd(20)}" => Placa Extraída: "${placaExtraida || '(ninguna)'}"`);
}
