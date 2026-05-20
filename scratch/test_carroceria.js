const casos = [
    'TRIMOTO PASAJEROS',
    'TRIMOTO DE PASAJEROS',
    'TRIMOTO DE CARGA',
    'TRIMOTO CARGA',
    'TRIMOTO MIXTO',
    'TRIMOTO ESCOLAR',
    'MOTOCICLETA',
    'AUTOMOVIL',
    'TRIMOTO',
];

let ok = true;
casos.forEach(c => {
    const r = (c || '').replace(/\s+(DE\s+)?(PASAJEROS|CARGA|MIXTO|ESCOLAR)$/i, '').trim();
    const esperado = c.replace(/\s+(DE\s+)?(PASAJEROS|CARGA|MIXTO|ESCOLAR)$/i, '').trim();
    const correcto = r === esperado;
    if (!correcto) ok = false;
    console.log(`'${c}' -> '${r}'`);
});

// Casos críticos
const tests = [
    { input: 'TRIMOTO PASAJEROS',    expected: 'TRIMOTO' },
    { input: 'TRIMOTO DE PASAJEROS', expected: 'TRIMOTO' },
    { input: 'TRIMOTO DE CARGA',     expected: 'TRIMOTO' },
    { input: 'TRIMOTO CARGA',        expected: 'TRIMOTO' },
    { input: 'MOTOCICLETA',          expected: 'MOTOCICLETA' },
    { input: 'AUTOMOVIL',            expected: 'AUTOMOVIL' },
    { input: 'TRIMOTO',              expected: 'TRIMOTO' },
];

console.log('\n── Verificación de casos críticos ──');
let allOk = true;
tests.forEach(t => {
    const result = (t.input || '').replace(/\s+(DE\s+)?(PASAJEROS|CARGA|MIXTO|ESCOLAR)$/i, '').trim();
    const pass = result === t.expected;
    if (!pass) allOk = false;
    console.log(`${pass ? '✅' : '❌'} '${t.input}' -> '${result}' (esperado: '${t.expected}')`);
});
console.log(`\n${allOk ? '✅ TODOS LOS CASOS PASAN' : '❌ ALGUNOS CASOS FALLAN'}`);
