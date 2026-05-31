const { logInfo } = require('../utils/logger');

const COMMANDS_PER_PAGE = 3;
const BUY_URL        = 'https://t.me/odinosea';
const BUY_URL_ORION  = 'https://t.me/odinosea';

const categories = {
    reniec: {
        title: "🪪 RENIEC",
        cmds: [
            { name: "DNI MINSA DB", type: "Standard", cmd: "/dnim 44443333", price: 2, result: "Rostro + datos completos vía MINSA DB" },
            { name: "DNI Online Nv2", type: "Standard", cmd: "/dni 44443333", price: 1, result: "Rostro + datos completos online" },
            { name: "DNI Online Nv3", type: "Standard", cmd: "/dnif 44443333", price: 2, result: "Rostro + firma online" },
            { name: "DNI Online Nv4", type: "Premium", cmd: "/dnit 44443333", price: 3, result: "Rostro + firma + huellas online" },
            { name: "Búsqueda por Nombre", type: "Standard", cmd: "/nm N¹|AP¹|AP²", price: 2, result: "Listado de personas por nombre" },
            { name: "Geolocalización", type: "Standard", cmd: "/dir 44443333", price: 3, result: "Geolocalización + dirección del DNI" },
            { name: "DNI DB Nv1", type: "Standard", cmd: "/dnidb 44443333", price: 1, result: "Rostro + datos vía base de datos" },
            { name: "DNI DB Nv2", type: "Standard", cmd: "/dnifdb 44443333", price: 2, result: "Rostro + firma vía base de datos" },
            { name: "DNI DB Nv3", type: "Premium", cmd: "/dnitdb 44443333", price: 3, result: "Rostro + firma + huellas vía DB" },
            { name: "Búsqueda DB por Nombre", type: "Free", cmd: "/nmdb 44443333", price: 0, result: "Búsqueda de nombres en base de datos" },
        ]
    },
    telefonia: {
        title: "📞 TELEFONÍA",
        cmds: [
            { name: "OSIPTEL Online Pro Max", type: "Premium", cmd: "/telp 999888777", price: 10, result: "Datos completos del titular vía OSIPTEL online" },
            { name: "DB Telefónica", type: "Free", cmd: "/tel 999888777", price: 0, result: "Titular del número vía base de datos" },
            { name: "OSIPTEL DB Nv2", type: "Standard", cmd: "/stel 44443333 o /cel 999888777", price: 5, result: "Líneas y titular vía OSIPTEL DB" },
            { name: "OSIPTEL DB Nv3 Extendida", type: "Standard", cmd: "/telpdb 999888777", price: 5, result: "Datos extendidos del titular vía OSIPTEL" },
            { name: "Titular CLARO", type: "Standard", cmd: "/claro 999888777", price: 5, result: "Titular del número CLARO online" },
            { name: "Titular BITEL", type: "Standard", cmd: "/bitel 987654321", price: 5, result: "Titular del número BITEL online" },
            { name: "Titular MOVISTAR", type: "Standard", cmd: "/movistar 956047006", price: 5, result: "Titular del número MOVISTAR online" },
            { name: "Titular ENTEL", type: "Standard", cmd: "/entel 987654321", price: 5, result: "Titular del número ENTEL online" },
            { name: "Líneas OSIPTEL", type: "Standard", cmd: "/lineas 44443333 o /operador 999888777", price: 3, result: "Todas las líneas asociadas al DNI" },
        ]
    },
    delitos: {
        title: "⛓️ DELITOS",
        cmds: [
            { name: "Fiscalía MPFN - PDF", type: "Premium", cmd: "/fiscapdf 44443333", price: 15, result: "Reporte de procesos fiscales en PDF" },
            { name: "Fiscalía MPFN - Caso", type: "Premium", cmd: "/fiscacs 170-2006-560", price: 15, result: "Datos de caso fiscal específico" },
            { name: "Fiscalía MPFN - Nombre", type: "Premium", cmd: "/fiscanm N¹|AP¹|AP²", price: 15, result: "Procesos fiscales por nombre completo" },
            { name: "Denuncias PNP - Texto", type: "Standard", cmd: "/den 44443333", price: 10, result: "Denuncias policiales en texto" },
            { name: "Denuncias PNP - PDF", type: "Premium", cmd: "/denuncias 44443333", price: 20, result: "Denuncias policiales en PDF" },
            { name: "Denuncias por Placa", type: "Premium", cmd: "/denpla ABC123", price: 20, result: "Denuncias asociadas a la placa en PDF" },
            { name: "Requisitoria - Texto", type: "Premium", cmd: "/rqh 44443333", price: 20, result: "Estado de requisitoria en texto" },
            { name: "Requisitoria - PDF", type: "Premium", cmd: "/rq 44443333", price: 20, result: "Requisitoria completa en PDF" },
            { name: "Requisitoria por Placa", type: "Premium", cmd: "/rqv ABC123", price: 20, result: "Requisitoria asociada a placa en PDF" },
            { name: "Antecedentes PNP - PDF", type: "Premium", cmd: "/rqant 44443333", price: 20, result: "Antecedentes policiales en PDF" },
            { name: "Verif. Ant. Penales", type: "Standard", cmd: "/antpenv 44443333", price: 3, result: "Verificación de antecedentes penales" },
            { name: "Verif. Ant. Policiales", type: "Standard", cmd: "/antpolv 44443333", price: 3, result: "Verificación de antecedentes policiales" },
            { name: "Verif. Ant. Judiciales", type: "Standard", cmd: "/antjudv 44443333", price: 3, result: "Verificación de antecedentes judiciales" },
            { name: "Multas Electorales JNE", type: "Standard", cmd: "/jne 44443333", price: 5, result: "Foto de multas electorales del JNE" },
        ]
    },
    policia: {
        title: "👮 POLICÍA",
        cmds: [
            { name: "Datos PNP Online", type: "Standard", cmd: "/pnp 44443333", price: 3, result: "Datos del efectivo PNP online" },
        ]
    },
    sunat: {
        title: "🏛 SUNAT",
        cmds: [
            { name: "RUC - Datos Personal", type: "Standard", cmd: "/ruc 44443333 o 10072601802", price: 3, result: "Datos del contribuyente por RUC o DNI" },
            { name: "SUNAT Empresa - PDF", type: "Standard", cmd: "/sunat 44443333", price: 10, result: "Ficha completa de empresa en PDF" },
            { name: "Consumos - Texto", type: "Standard", cmd: "/consu 44443333", price: 10, result: "Consumos tributarios en texto" },
            { name: "Consumos - PDF", type: "Standard", cmd: "/consumos 44443333", price: 15, result: "Consumos tributarios en PDF" },
            { name: "Reporte Tributario - PDF", type: "Premium", cmd: "/reptrib 44443333", price: 30, result: "Reporte tributario completo en PDF" },
            { name: "Trabajos SUNAT", type: "Standard", cmd: "/tra 44443333", price: 3, result: "Empleadores registrados en SUNAT" },
            { name: "Sueldos SUNAT", type: "Standard", cmd: "/suel 44443333", price: 3, result: "Sueldos declarados en SUNAT" },
            { name: "Sueldos DB", type: "Standard", cmd: "/sueld 44443333", price: 3, result: "Sueldos en base de datos histórica" },
        ]
    },
    sunarp: {
        title: "🏘 SUNARP",
        cmds: [
            { name: "Propiedades - Texto", type: "Standard", cmd: "/pro 44443333", price: 5, result: "Propiedades registradas en texto" },
            { name: "Propiedades - PDF", type: "Standard", cmd: "/propdf 44443333", price: 15, result: "Propiedades registradas en PDF" },
            { name: "Partidas Registrales", type: "Standard", cmd: "/partida 44443333|LIMA|MUEBLES", price: 10, result: "Partidas registrales en PDF" },
        ]
    },
    vehiculos: {
        title: "🚐 VEHÍCULOS",
        cmds: [
            { name: "Vehículos por DNI - DB", type: "Standard", cmd: "/vec 44443333", price: 3, result: "Vehículos del propietario en DB" },
            { name: "Foto Vehículo SUNARP", type: "Standard", cmd: "/pla ABC123", price: 1, result: "Foto del vehículo en SUNARP" },
            { name: "Full Datos Vehículo", type: "Standard", cmd: "/plat ABC123", price: 3, result: "Datos completos del vehículo por placa" },
            { name: "Revisión Técnica", type: "Standard", cmd: "/revtec ABC123", price: 5, result: "Estado de revisión técnica del vehículo" },
            { name: "Boleta Informativa", type: "Standard", cmd: "/boi ABC123", price: 15, result: "Boleta informativa vehicular en PDF" },
            { name: "Historial SOAT", type: "Standard", cmd: "/hsoat ABC123", price: 5, result: "Historial de seguros SOAT del vehículo" },
            { name: "SOAT Vigente - PDF", type: "Standard", cmd: "/soat ABC123", price: 10, result: "SOAT vigente del vehículo en PDF" },
            { name: "TIVE Original - PDF", type: "Premium", cmd: "/tive ABC123", price: 20, result: "TIVE oficial en PDF vía SUNARP" },
            { name: "TIVE Plantilla - PDF", type: "Standard", cmd: "/tivep ABC123", price: 10, result: "Plantilla TIVE editable en PDF" },
            { name: "TIVE Electrónico - Foto", type: "Standard", cmd: "/tivev ABC123", price: 10, result: "TIVE electrónico en foto" },
            { name: "TIVE Electrónico - PDF", type: "Standard", cmd: "/tivevpdf ABC123", price: 15, result: "TIVE electrónico en PDF" },
            { name: "Papeletas Trujillo", type: "Standard", cmd: "/paptrud M5D408", price: 10, result: "Papeletas de infracción en Trujillo" },
            { name: "Brevete MTC - PDF", type: "Standard", cmd: "/brevete 44443333", price: 10, result: "Licencia de conducir MTC en PDF" },
        ]
    },
    generadores: {
        title: "⚙️ GENERADORES",
        cmds: [
            { name: "Ficha C4 Azul - PDF", type: "Standard", cmd: "/c4a 44443333", price: 5, result: "Ficha C4 color azul en PDF" },
            { name: "Ficha C4 Blanco - PDF", type: "Standard", cmd: "/c4b 44443333", price: 5, result: "Ficha C4 color blanco en PDF" },
            { name: "Ficha C4 Certificado - PDF", type: "Standard", cmd: "/c4i 44443333", price: 5, result: "Ficha C4 con sello certificado en PDF" },
            { name: "DNI Digital Azul/Amarillo", type: "Standard", cmd: "/dniv 44443333", price: 5, result: "DNI digital en foto azul o amarillo" },
            { name: "DNI Electrónico - Foto", type: "Standard", cmd: "/dnivel 44443333", price: 5, result: "DNI electrónico generado en foto" },
        ]
    },
    certificados: {
        title: "📄 CERTIFICADOS",
        cmds: [
            { name: "Antecedentes Penales - PDF", type: "Standard", cmd: "/antpen 44443333", price: 5, result: "Datos certificado antecedentes penales vía PJ online" },
            { name: "Antecedentes Policiales - PDF", type: "Standard", cmd: "/antpol 44443333", price: 5, result: "Datos certificado antecedentes policiales vía PNP online" },
            { name: "Antecedentes Judiciales - PDF", type: "Standard", cmd: "/antjud 44443333", price: 5, result: "Datos certificado antecedentes judiciales vía MPFN online" },
        ]
    },
    familiares: {
        title: "👨‍👩‍👧 FAMILIARES",
        cmds: [
            { name: "Árbol Genealógico - Texto", type: "Standard", cmd: "/ag 44443333", price: 5, result: "Árbol genealógico completo en texto" },
            { name: "Árbol Genealógico - Foto", type: "Standard", cmd: "/agv 44443333", price: 10, result: "Árbol genealógico en imagen" },
            { name: "Árbol Genealógico - PDF", type: "Premium", cmd: "/agvp 44443333", price: 15, result: "Árbol genealógico completo en PDF" },
            { name: "Familiares - Texto", type: "Standard", cmd: "/fam 44443333 o /her 44443333", price: 3, result: "Familiares directos en texto" },
            { name: "SISFOH Online", type: "Standard", cmd: "/hogar 44443333", price: 5, result: "Datos del hogar en SISFOH online" },
            { name: "SISFOH DB", type: "Standard", cmd: "/hogardb 44443333", price: 3, result: "Datos del hogar en base de datos" },
        ]
    },
    financiero: {
        title: "💰 FINANCIERO",
        cmds: [
            { name: "Sentinel - PDF", type: "Premium", cmd: "/sentinel 44443333", price: 30, result: "Reporte Sentinel completo en PDF" },
            { name: "Financiero - PDF", type: "Premium", cmd: "/financiero 44443333", price: 30, result: "Reporte financiero completo en PDF" },
            { name: "SBS - Texto", type: "Standard", cmd: "/sbs 44443333", price: 10, result: "Deudas en el sistema SBS en texto" },
            { name: "SBS - Foto", type: "Standard", cmd: "/sbsv 44443333", price: 15, result: "Reporte SBS en imagen" },
            { name: "SBS - PDF", type: "Premium", cmd: "/sbsvp 44443333", price: 20, result: "Reporte SBS completo en PDF" },
        ]
    },
    spam: {
        title: "☠️ SPAM",
        cmds: [
            { name: "SPM Operadores", type: "Standard", cmd: "/spm 999888777", price: 3, result: "Spam a todos los operadores del número" },
            { name: "SPM Bancos", type: "Standard", cmd: "/spm2 999888777", price: 5, result: "Spam a todos los bancos del número" },
            { name: "SPM Ultra - Todos", type: "Premium", cmd: "/spm3 999888777", price: 10, result: "Spam masivo a todos los registros" },
        ]
    },
    seeker: {
        title: "🔎 SEEKER",
        cmds: [
            { name: "Búsqueda General", type: "Premium", cmd: "/seeker 44443333", price: 20, result: "Búsqueda en todas las bases de datos" },
            { name: "Búsqueda Celular", type: "Premium", cmd: "/sekcel 999888777", price: 20, result: "Búsqueda completa por número celular" },
            { name: "Búsqueda - PDF", type: "Premium", cmd: "/seekerpdf 44443333", price: 20, result: "Reporte de búsqueda completo en PDF" },
        ]
    },
    baucher: {
        title: "💳 BAUCHER",
        cmds: [
            { name: "Yape - Fake Foto", type: "Standard", cmd: "/yape 10|LUIS PEDRO|987|1", price: 1, result: "Voucher Yape falso en foto" },
            { name: "Plin - Fake Foto", type: "Standard", cmd: "/plin 10|LUIS PEDRO|987|2", price: 3, result: "Voucher Plin falso en foto" },
            { name: "Interbank - Fake Foto", type: "Standard", cmd: "/ibk 3051234567891|3|10000", price: 3, result: "Voucher Interbank falso en foto" },
            { name: "BCP - Fake Foto", type: "Standard", cmd: "/bcp Maria Perez|3051|8000", price: 3, result: "Voucher BCP falso en foto" },
        ]
    },
    extras: {
        title: "➕ EXTRAS",
        cmds: [
            { name: "Meta Data Full - Texto", type: "Premium", cmd: "/meta 44443333", price: 15, result: "Metadata completa del DNI en texto" },
            { name: "SUNEDU - Texto", type: "Standard", cmd: "/sunedu 44443333", price: 5, result: "Grados y títulos en SUNEDU en texto" },
            { name: "SUNEDU - PDF", type: "Standard", cmd: "/sunedupdf 44443333", price: 10, result: "Grados y títulos en SUNEDU en PDF" },
            { name: "Meta Correo", type: "Standard", cmd: "/cor 44443333 o email@gmail.com", price: 3, result: "Correos asociados al DNI" },
            { name: "SIS Online", type: "Standard", cmd: "/sis 44443333", price: 3, result: "Estado SIS del asegurado online" },
            { name: "ESSALUD Online", type: "Standard", cmd: "/essa2 44443333", price: 3, result: "Estado ESSALUD del asegurado online" },
        ]
    },
    vip: {
        title: "💎 VIP",
        cmds: [
            { name: "Reconocimiento Facial - PDF", type: "VIP", cmd: "/facial FOTO", price: 30, result: "Reconocimiento facial biométrico en PDF" },
            { name: "Migraciones DNI - PDF", type: "VIP", cmd: "/migra 44443333", price: 30, result: "Movimientos migratorios del DNI en PDF" },
            { name: "Migraciones CE - PDF", type: "VIP", cmd: "/migrace 005748402", price: 30, result: "Movimientos migratorios del CE en PDF" },
            { name: "Migraciones DNI - Texto", type: "VIP", cmd: "/migra2 44443333", price: 20, result: "Movimientos migratorios del DNI en texto" },
            { name: "Migraciones CE - Texto", type: "VIP", cmd: "/migrace2 005748402", price: 20, result: "Movimientos migratorios del CE en texto" },
            { name: "Certificado MINEDU - PDF", type: "VIP", cmd: "/minedu 44443333", price: 25, result: "Certificado MINEDU del docente en PDF" },
            { name: "Certificado MTC - PDF", type: "VIP", cmd: "/mtc 44443333", price: 15, result: "Certificado MTC del conductor en PDF" },
            { name: "Cert. MTPE - PDF", type: "VIP", cmd: "/cerjov 44443333 o /ceradu 44443333", price: 10, result: "Certificado MTPE juvenil o adulto en PDF" },
        ]
    },
    mundial: {
        title: "🌐 MUNDIAL",
        cmds: [
            { name: "SAIME Venezuela", type: "Standard", cmd: "/cedula 007532113", price: 3, result: "Datos del titular de cédula venezolana" },
            { name: "SAIME por Nombre", type: "Standard", cmd: "/nmv N¹|AP¹|AP²", price: 3, result: "Búsqueda venezolana por nombre" },
            { name: "Telefonía Mundial", type: "Standard", cmd: "/mtel +58 999888777", price: 3, result: "Datos de línea telefónica internacional" },
            { name: "SSN USA", type: "Standard", cmd: "/ssn 361894163", price: 3, result: "Datos del Social Security Number USA" },
        ]
    },
    temporal: {
        title: "⏳ TEMPORAL",
        cmds: [
            { name: "UTP Online", type: "Standard", cmd: "/utp u22233661", price: 3, result: "Datos del estudiante UTP online" },
            { name: "DAC - Daniel Alcides Carrión", type: "Standard", cmd: "/dpm NOMBRE|CARRERA", price: 2, result: "Datos del estudiante DAC" },
        ]
    },
    medico: {
        title: "💊 MÉDICO",
        cmds: [
            { name: "Salud Seguros - PDF", type: "Standard", cmd: "/seg 44443333", price: 3, result: "Listado de seguros por DNI en PDF" },
            { name: "Descanso Médico MINSA - PDF", type: "Premium", cmd: "/minsa 44443333", price: 30, result: "Descanso médico MINSA en PDF" },
            { name: "Constancia MINSA - PDF", type: "Premium", cmd: "/const 44443333", price: 30, result: "Constancia médica MINSA en PDF" },
            { name: "Receta Médica MINSA - PDF", type: "Premium", cmd: "/reminsa 44443333", price: 30, result: "Receta médica MINSA en PDF" },
            { name: "Descanso Clínica La Luz - PDF", type: "Premium", cmd: "/cliluz 44443333", price: 30, result: "Descanso médico Clínica La Luz en PDF" },
            { name: "Descanso ESSALUD - PDF", type: "Premium", cmd: "/essalud 44443333", price: 30, result: "Descanso médico ESSALUD en PDF" },
            { name: "Certificado Médico ESSALUD - PDF", type: "Premium", cmd: "/certmed 44443333", price: 30, result: "Certificado médico ESSALUD en PDF" },
            { name: "Receta Médica ESSALUD - PDF", type: "Premium", cmd: "/reessalud 44443333", price: 30, result: "Receta médica ESSALUD en PDF" },
        ]
    },
    sat: {
        title: "🚔 SAT",
        cmds: [
            { name: "SAT Papeletas - Texto", type: "Standard", cmd: "/sat SOS666", price: 4, result: "Consulta SAT papeletas en texto" },
            { name: "SAT Capturas - Texto", type: "Standard", cmd: "/csat SOS666", price: 4, result: "Consulta captura vehicular en texto" },
        ]
    },
    actas: {
        title: "📜 ACTAS",
        cmds: [
            { name: "Acta de Nacimiento - PDF", type: "Premium", cmd: "/actnac 44443333", price: 30, result: "Acta de nacimiento en PDF" },
            { name: "Acta de Matrimonio - PDF", type: "Premium", cmd: "/actmat 44443333", price: 30, result: "Acta de matrimonio en PDF" },
            { name: "Acta de Defunción - PDF", type: "Premium", cmd: "/actdef 44443333", price: 30, result: "Acta de defunción en PDF" },
        ]
    },
    imprenta: {
        title: "🖨️ IMPRENTA",
        cmds: [
            { name: "Panel de Bienvenida", type: "Free", cmd: "/start", price: 0, result: "Muestra tu estado actual y opciones del sistema" },
            { name: "Alta en el Sistema", type: "Free", cmd: "/register", price: 0, result: "Registra tu cuenta para empezar a operar" },
            { name: "Consulta de Saldo", type: "Free", cmd: "/credits", price: 0, result: "Muestra tu saldo operativo disponible" },
            { name: "Comprar Créditos", type: "Free", cmd: "/buy", price: 0, result: "Muestra los planes disponibles y redirige al operador de pagos" },
            { name: "Fotos TIVE PVC", type: "Standard", cmd: "/pvc (sube PDF primero)", price: 80, result: "Genera fotos TIVE PVC desde el PDF" },
            { name: "TIVE Completo", type: "Standard", cmd: "Sube PDF y elige la opción", price: 80, result: "Genera TIVE completo desde el PDF" },
            { name: "TIVE Para Completar", type: "Standard", cmd: "Sube PDF y elige la opción", price: 80, result: "Genera TIVE para completar desde el PDF" },
            { name: "Tarjeta Física PVC", type: "Standard", cmd: "Sube PDF y elige la opción", price: 80, result: "Genera tarjeta física PVC desde el PDF" },
            { name: "Tarjeta Física PVC Para Completar", type: "Standard", cmd: "Sube PDF y elige la opción", price: 80, result: "Genera tarjeta PVC para completar" },
            { name: "Tarjeta Antigua", type: "Standard", cmd: "Sube PDF y elige la opción", price: 80, result: "Genera tarjeta formato antiguo" },
        ]
    },
    estudios: {
        title: "🎓 ESTUDIOS",
        cmds: [
            { name: "MINEDU NOTAS", type: "Standard", cmd: "/notas 45454545", price: 10, result: "Buscar Notas Minedu por Dni. [PDF]." },
            { name: "MINEDU CONSTANCIA", type: "Standard", cmd: "/const 45454545", price: 15, result: "Buscar Constancia Minedu por Dni. [PDF]." },
            { name: "CERT. ADULTO :: MTPE", type: "Standard", cmd: "/cadult 45454545", price: 8, result: "Buscar Cert. Unico Laboral. [PDF]" },
        ]
    },
    mtc: {
        title: "🚗 MTC",
        cmds: [
            { name: "MTC :: BASE", type: "Standard", cmd: "/mtcb 45454545", price: 5, result: "Buscar MTC por DNI. [TXT]." },
            { name: "RECORD :: VEHICULAR", type: "Standard", cmd: "/record 45454545", price: 5, result: "Buscar record conductor x DNI. [TXT]." },
            { name: "REVISION TECNICA", type: "Standard", cmd: "/citv SOS666", price: 6, result: "Consultar CITV Vehicular [TXT]." },
        ]
    }
};

function buildCategoryPage(catKey, page) {
    const cat = categories[catKey];
    if (!cat) return null;

    const totalCmds = cat.cmds.length;
    const totalPages = Math.ceil(totalCmds / COMMANDS_PER_PAGE);
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * COMMANDS_PER_PAGE;
    const slice = cat.cmds.slice(start, start + COMMANDS_PER_PAGE);

    const TYPE_BADGE = { Free: '🟢', Standard: '🔵', Premium: '🟠', VIP: '💎' };
    const PRICE_LABEL = (p) => p === 0 ? '<i>Gratis</i>' : `${p} Créditos`;

    let text = `${cat.title} <b>— Herramientas</b>\n` +
               `━━━━━━━━━━━━━━━━━━━━━━\n` +
               `Categoría ➠ <i>${cat.title.replace(/^.+ /, '')}</i>\n` +
               `Comandos disponibles ➠ <b>${totalCmds}</b>\n` +
               `Página ➠ <b>${safePage + 1}/${totalPages}</b>\n` +
               `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    slice.forEach((cmd, idx) => {
        const badge = TYPE_BADGE[cmd.type] || '🔵';
        text += `<b>${start + idx + 1}. ${cmd.name}</b> — ${cmd.type}\n`;
        text += `Estado ➠ OPERATIVO [${badge}]\n`;
        text += `Comando ➠ <code>${cmd.cmd}</code>\n`;
        text += `Precio ➠ ${PRICE_LABEL(cmd.price)}\n`;
        text += `Resultado ➠ <i>${cmd.result}</i>\n\n`;
    });

    text += `<i>💡 Toca cualquier comando para copiarlo.</i>`;

    // Build keyboard
    const keyboard = [];

    // Pagination row
    const pagRow = [];
    if (safePage > 0) {
        pagRow.push({ text: '◀️ Anterior', callback_data: `cmds_cat_${catKey}_${safePage - 1}` });
    }
    if (safePage < totalPages - 1) {
        pagRow.push({ text: 'Siguiente ▶️', callback_data: `cmds_cat_${catKey}_${safePage + 1}` });
    }
    if (pagRow.length > 0) keyboard.push(pagRow);

    // Nav row
    keyboard.push([
        { text: '🔙 Volver al Menú', callback_data: 'cmds_main' }
    ]);
    // Botones de compra — dos operadores
    keyboard.push([
        { text: '🛒 Comprar Créditos', url: BUY_URL },
        { text: '🛒 ING. ORION BOT', url: BUY_URL_ORION }
    ]);

    return { text, keyboard };
}

const MAIN_MENU_TEXT = `🌌 <b>SISTEMA ORION BOT v2.0</b> 🌌\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `<i>Bienvenido al panel central de operaciones. Seleccione un módulo para desplegar el catálogo de herramientas.</i>\n\n` +
                       `💡 <b>Leyenda:</b> 🟢 Gratis  🔵 Standard  🟠 Premium  💎 VIP`;

function getMainMenuKeyboard() {
    const keys = Object.keys(categories);
    const keyboard = [];
    for (let i = 0; i < keys.length; i += 2) {
        const row = [];
        row.push({ text: categories[keys[i]].title, callback_data: `cmds_cat_${keys[i]}_0` });
        if (keys[i + 1]) {
            row.push({ text: categories[keys[i + 1]].title, callback_data: `cmds_cat_${keys[i + 1]}_0` });
        }
        keyboard.push(row);
    }
    // Dos botones de compra en la fila final
    keyboard.push([
        { text: '🛒 Comprar Créditos', url: BUY_URL },
        { text: '🛒 ING. ORION BOT', url: BUY_URL_ORION }
    ]);
    return keyboard;
}

module.exports = {
    registerCommands(bot, state, deps) {
        bot.on('message', (msg) => {
            if (!msg.text) return;
            const texto = msg.text.trim().toLowerCase();
            if (texto !== '/cmds' && texto !== '/menu' && !texto.startsWith('/cmds ') && !texto.startsWith('/menu ')) return;

            logInfo('BOT', '📋', 'Comando /cmds recibido', { id: msg.from.id });

            bot.sendMessage(msg.chat.id, MAIN_MENU_TEXT, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: getMainMenuKeyboard() }
            }).catch(() => {
                bot.sendMessage(msg.chat.id, '❌ Error mostrando el menú. Intenta de nuevo.');
            });
        });
    },

    async handleCallback(chatId, messageId, data, query, buffer, bot, state, deps) {
        if (data === 'cmds_main') {
            await bot.editMessageText(MAIN_MENU_TEXT, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: getMainMenuKeyboard() }
            }).catch(() => {});
            return true;
        }

        // Match: cmds_cat_<key>_<page>
        const catMatch = data.match(/^cmds_cat_([a-z_]+)_(\d+)$/);
        if (catMatch) {
            const catKey = catMatch[1];
            const page = parseInt(catMatch[2], 10);

            // Admin imprenta injection
            let extraAdminCmds = [];
            if (catKey === 'imprenta') {
                const { ADMIN_IDS } = require('../config');
                if (ADMIN_IDS.includes(String(query.from.id))) {
                    extraAdminCmds = [
                        { name: "Insertar QR en PDF", type: "Admin", cmd: "Sube PDF y elige la opción", price: 0, result: "Inserta el QR en el PDF original (solo administradores)" },
                        { name: "Gestión de Clientes", type: "Admin", cmd: "/clientes o /cliente &lt;id&gt;", price: 0, result: "Lista o detalle de clientes del sistema" },
                        { name: "Agregar Créditos", type: "Admin", cmd: "/addcredits &lt;id&gt; &lt;n&gt;", price: 0, result: "Agrega créditos a un cliente" },
                        { name: "Quitar Créditos", type: "Admin", cmd: "/removecredits &lt;id&gt; &lt;n&gt;", price: 0, result: "Resta créditos a un cliente" },
                    ];
                }
            }

            // Temporarily patch admin cmds into a clone
            const originalCmds = categories[catKey] ? [...categories[catKey].cmds] : null;
            if (originalCmds && extraAdminCmds.length > 0) {
                categories[catKey].cmds = [...originalCmds, ...extraAdminCmds];
            }

            const result = buildCategoryPage(catKey, page);

            // Restore
            if (originalCmds) categories[catKey].cmds = originalCmds;

            if (result) {
                await bot.editMessageText(result.text, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: result.keyboard }
                }).catch(() => {});
            }
            return true;
        }

        return false;
    }
};
