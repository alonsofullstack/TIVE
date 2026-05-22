const safe = (t) => t ? String(t).trim() : '';

function fmtPlaca(p = '') {
    let s = safe(p).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length === 6) {
        if (/^\d{4}[A-Z]{2}$/.test(s)) {
            return s.substring(0, 4) + '-' + s.substring(4);
        }
        return s.substring(0, 3) + '-' + s.substring(3);
    }
    return s;
}

function validarPlacaExtraida(placa = '') {
    const p = safe(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (p.length !== 6) return '';
    if (!/[A-Z]/.test(p)) return '';
    return fmtPlaca(p);
}

function buscarPlacaEnTexto(texto = '') {
    const cleanText = texto.toUpperCase();
    
    // Primero, busquemos coincidencias exactas o estándar
    const regexesEstandar = [
        /\b([A-Z]{3}-\d{3})\b/g,
        /\b([A-Z]{3}\d{3})\b/g,
        /\b(\d{4}-[A-Z]{2})\b/g,
        /\b(\d{4}[A-Z]{2})\b/g,
        /\b([A-Z]{2}-\d{4})\b/g,
        /\b([A-Z]{2}\d{4})\b/g,
        /\b(\d{5}-[A-Z])\b/g,
        /\b(\d{5}[A-Z])\b/g,
        /\b([A-Z]\d-\d{4})\b/g,
        /\b([A-Z]\d\d{4})\b/g,
        /\b(\d{4}-\d[A-Z])\b/g,
        /\b(\d{4}\d[A-Z])\b/g
    ];

    for (const regex of regexesEstandar) {
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            // Evitar falsos positivos con la etiqueta "DUA/DAM"
            const startIdx = match.index;
            const prefix = cleanText.substring(Math.max(0, startIdx - 15), startIdx);
            if (prefix.includes('DUA') || prefix.includes('DAM')) {
                console.log(`[IGNORE Standard] Ignoring candidate ${match[1]} because of DUA/DAM label in prefix: "${prefix}"`);
                continue;
            }
            const placa = fmtPlaca(match[1]);
            if (validarPlacaExtraida(placa)) {
                return placa;
            }
        }
    }

    // Si no se encuentra una limpia, busquemos con más tolerancia al ruido OCR
    // (espacios, guiones, paréntesis como en "4379 -D) L" o "1 274-U P")
    const regexesRuido = [
        // 4 dígitos (con espacios opcionales) + 2 letras: e.g. "1 274-U P" o "4379 -D) L"
        /\b(\d\s?\d\s?\d\s?\d)[^A-Z0-9]{1,5}([A-Z])[^A-Z0-9]{0,3}([A-Z])\b/g,
        // 3 letras (con espacios opcionales) + 3 dígitos: e.g. "ABC - 123"
        /\b([A-Z]\s?[A-Z]\s?[A-Z])[^A-Z0-9]{1,5}(\d\s?\d\s?\d)\b/g,
        // 2 letras + 4 dígitos: e.g. "DI - 4898"
        /\b([A-Z]\s?[A-Z])[^A-Z0-9]{1,5}(\d\s?\d\s?\d\s?\d)\b/g,
        // 5 dígitos + 1 letra: e.g. "20677 L"
        /\b(\d\s?\d\s?\d\s?\d\s?\d)[^A-Z0-9]{1,5}([A-Z])\b/g,
        // 1 letra + 1 dígito + 4 dígitos: e.g. "A1 - 2345"
        /\b([A-Z]\s?\d)[^A-Z0-9]{1,5}(\d\s?\d\s?\d\s?\d)\b/g
    ];

    for (const regex of regexesRuido) {
        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            // Evitar falsos positivos con la etiqueta "DUA/DAM"
            const startIdx = match.index;
            const prefix = cleanText.substring(Math.max(0, startIdx - 15), startIdx);
            if (prefix.includes('DUA') || prefix.includes('DAM')) {
                console.log(`[IGNORE Noise] Ignoring candidate ${match[0]} because of DUA/DAM label in prefix: "${prefix}"`);
                continue;
            }
            const cleanPart1 = match[1].replace(/\s+/g, '');
            const cleanPart2 = match[2].replace(/\s+/g, '');
            const cleanPart3 = (match[3] || '').replace(/\s+/g, '');
            const placaCandidata = cleanPart1 + cleanPart2 + cleanPart3;
            const placa = fmtPlaca(placaCandidata);
            if (validarPlacaExtraida(placa)) {
                return placa;
            }
        }
    }

    return '';
}

// Test texts
const textDoc1 = `
Partida Registral : 60707154                                          Placa N*
DUA/DAM : 118-2025-10-068766-41

Título : 2025-1376938                                                       4379 -D) L
`;

const textDoc2 = `
Partida Registral : 61026554                                          Placa N*
DUA/DAM : 118-2025-10-543705-8

Título : 2026-959840                                                   1 274-U P
`;

console.log("Testing Document 1:");
console.log("Extracted Placa:", buscarPlacaEnTexto(textDoc1));

console.log("\nTesting Document 2:");
console.log("Extracted Placa:", buscarPlacaEnTexto(textDoc2));
