const { logInfo } = require('../utils/logger');

const categories = {
    reniec: {
        title: "🪪 RENIEC",
        text: `🪪 <b>MÓDULO RENIEC</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/dnim 44443333</code>\n   ╰ MINSA DB · Rostro + datos <i>(2 cred)</i>\n\n` +
              `🔸 <code>/dni 44443333</code>\n   ╰ Online Nv2 · Rostro + datos <i>(1 cred)</i>\n\n` +
              `🔸 <code>/dnif 44443333</code>\n   ╰ Online Nv3 · Rostro + firma <i>(2 cred)</i>\n\n` +
              `🔸 <code>/dnit 44443333</code>\n   ╰ Online Nv4 · Rostro+firma+huellas <i>(3 cred)</i>\n\n` +
              `🔸 <code>/nm N¹|AP¹|AP²</code>\n   ╰ Búsqueda por nombre <i>(2 cred)</i>\n\n` +
              `🔸 <code>/dir 44443333</code>\n   ╰ Geolocalización + dirección <i>(3 cred)</i>\n\n` +
              `🔸 <code>/dnidb 44443333</code>\n   ╰ DB Nv1 · Rostro + datos <i>(1 cred)</i>\n\n` +
              `🔸 <code>/dnifdb 44443333</code>\n   ╰ DB Nv2 · Rostro + firma <i>(2 cred)</i>\n\n` +
              `🔸 <code>/dnitdb 44443333</code>\n   ╰ DB Nv3 · Rostro+firma+huellas <i>(3 cred)</i>\n\n` +
              `🔸 <code>/nmdb 44443333</code>\n   ╰ DB nombres <i>(gratis)</i>`
    },
    telefonia: {
        title: "📞 TELEFONÍA",
        text: `📞 <b>MÓDULO TELEFONÍA</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/telp 999888777</code>\n   ╰ OSIPTEL Online Pro Max <i>(10 cred)</i>\n\n` +
              `🔸 <code>/tel 999888777</code>\n   ╰ DB Telefónica <i>(gratis)</i>\n\n` +
              `🔸 <code>/stel 44443333</code> o <code>/cel 999888777</code>\n   ╰ OSIPTEL DB Nv2 <i>(5 cred)</i>\n\n` +
              `🔸 <code>/telpdb 999888777</code>\n   ╰ OSIPTEL DB Nv3 extendida <i>(5 cred)</i>\n\n` +
              `🔸 <code>/claro 999888777</code>\n   ╰ Titular CLARO online <i>(5 cred)</i>\n\n` +
              `🔸 <code>/bitel 987654321</code>\n   ╰ Titular BITEL online <i>(5 cred)</i>\n\n` +
              `🔸 <code>/movistar 956047006</code>\n   ╰ Titular MOVISTAR online <i>(5 cred)</i>\n\n` +
              `🔸 <code>/entel 987654321</code>\n   ╰ Titular ENTEL online <i>(5 cred)</i>\n\n` +
              `🔸 <code>/lineas 44443333</code> o <code>/operador 999888777</code>\n   ╰ Líneas OSIPTEL <i>(3 cred)</i>`
    },
    delitos: {
        title: "⛓️ DELITOS",
        text: `⛓️ <b>MÓDULO DELITOS</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/fiscapdf 44443333</code>\n   ╰ Fiscalía MPFN PDF <i>(10/15 cred)</i>\n\n` +
              `🔸 <code>/fiscacs 170-2006-560</code>\n   ╰ Fiscalía MPFN Caso <i>(15 cred)</i>\n\n` +
              `🔸 <code>/fiscanm N¹|AP¹|AP²</code>\n   ╰ Fiscalía MPFN Nombre <i>(15 cred)</i>\n\n` +
              `🔸 <code>/den 44443333</code>\n   ╰ Denuncias PNP texto <i>(10 cred)</i>\n\n` +
              `🔸 <code>/denuncias 44443333</code>\n   ╰ Denuncias PNP PDF <i>(20 cred)</i>\n\n` +
              `🔸 <code>/denpla ABC123</code>\n   ╰ Denuncias por placa PDF <i>(20 cred)</i>\n\n` +
              `🔸 <code>/rqh 44443333</code>\n   ╰ Requisitoria texto <i>(20 cred)</i>\n\n` +
              `🔸 <code>/rq 44443333</code>\n   ╰ Requisitoria PDF <i>(20 cred)</i>\n\n` +
              `🔸 <code>/rqv ABC123</code>\n   ╰ Requisitoria placa PDF <i>(20 cred)</i>\n\n` +
              `🔸 <code>/rqant 44443333</code>\n   ╰ Antecedentes PNP PDF <i>(20 cred)</i>\n\n` +
              `🔸 <code>/antpenv 44443333</code>\n   ╰ Verif. ant. penales <i>(3 cred)</i>\n\n` +
              `🔸 <code>/antpolv 44443333</code>\n   ╰ Verif. ant. policiales <i>(3 cred)</i>\n\n` +
              `🔸 <code>/antjudv 44443333</code>\n   ╰ Verif. ant. judiciales <i>(3 cred)</i>\n\n` +
              `🔸 <code>/jne 44443333</code>\n   ╰ Multas electorales foto <i>(5 cred)</i>`
    },
    policia: {
        title: "👮 POLICÍA",
        text: `👮 <b>MÓDULO POLICÍA</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/pnp 44443333</code>\n   ╰ Datos PNP online <i>(3 cred)</i>`
    },
    sunat: {
        title: "🏛 SUNAT",
        text: `🏛 <b>MÓDULO SUNAT</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/ruc 44443333</code> o <code>10072601802</code>\n   ╰ Datos personal <i>(3 cred)</i>\n\n` +
              `🔸 <code>/sunat 44443333</code>\n   ╰ Datos empresa PDF <i>(10 cred)</i>\n\n` +
              `🔸 <code>/consu 44443333</code>\n   ╰ Consumos texto <i>(10 cred)</i>\n\n` +
              `🔸 <code>/consumos 44443333</code>\n   ╰ Consumos PDF <i>(15 cred)</i>\n\n` +
              `🔸 <code>/reptrib 44443333</code>\n   ╰ Reporte tributario PDF <i>(premium)</i>\n\n` +
              `🔸 <code>/tra 44443333</code>\n   ╰ Trabajos SUNAT <i>(3 cred)</i>\n\n` +
              `🔸 <code>/suel 44443333</code>\n   ╰ Sueldos SUNAT <i>(3 cred)</i>\n\n` +
              `🔸 <code>/sueld 44443333</code>\n   ╰ Sueldos DB <i>(3 cred)</i>`
    },
    sunarp: {
        title: "🏘 SUNARP",
        text: `🏘 <b>MÓDULO SUNARP</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/pro 44443333</code>\n   ╰ Propiedades texto <i>(5 cred)</i>\n\n` +
              `🔸 <code>/propdf 44443333</code>\n   ╰ Propiedades PDF <i>(15 cred)</i>\n\n` +
              `🔸 <code>/partida 44443333|LIMA|MUEBLES</code>\n   ╰ Partidas PDF <i>(10 cred)</i>`
    },
    vehiculos: {
        title: "🚐 VEHÍCULOS",
        text: `🚐 <b>MÓDULO VEHÍCULOS</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/vec 44443333</code>\n   ╰ DB vehículos texto <i>(3 cred)</i>\n\n` +
              `🔸 <code>/pla ABC123</code>\n   ╰ Foto vehículo SUNARP <i>(1 cred)</i>\n\n` +
              `🔸 <code>/plat ABC123</code>\n   ╰ Full datos vehículo <i>(3 cred)</i>\n\n` +
              `🔸 <code>/revtec ABC123</code> o <code>/revtecpdf ABC123</code>\n   ╰ Rev. técnica <i>(5 cred)</i>\n\n` +
              `🔸 <code>/boi ABC123</code>\n   ╰ Boleta informativa PDF <i>(15 cred)</i>\n\n` +
              `🔸 <code>/hsoat ABC123</code>\n   ╰ Historial SOAT <i>(5 cred)</i>\n\n` +
              `🔸 <code>/soat ABC123</code>\n   ╰ SOAT vigente PDF <i>(10 cred)</i>\n\n` +
              `🔸 <code>/tive ABC123</code>\n   ╰ TIVE original PDF <i>(20 cred)</i>\n\n` +
              `🔸 <code>/tivep ABC123</code>\n   ╰ TIVE plantilla PDF <i>(10 cred)</i>\n\n` +
              `🔸 <code>/tivev ABC123</code>\n   ╰ TIVE electrónico foto <i>(10 cred)</i>\n\n` +
              `🔸 <code>/tivevpdf ABC123</code>\n   ╰ TIVE electrónico PDF <i>(15 cred)</i>\n\n` +
              `🔸 <code>/paptrud M5D408</code>\n   ╰ Papeletas Trujillo <i>(10 cred)</i>\n\n` +
              `🔸 <code>/brevete 44443333</code>\n   ╰ Brevete MTC PDF <i>(10 cred)</i>`
    },
    generadores: {
        title: "⚙️ GENERADORES",
        text: `⚙️ <b>MÓDULO GENERADORES</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/c4a 44443333</code>\n   ╰ Ficha C4 azul PDF <i>(5 cred)</i>\n\n` +
              `🔸 <code>/c4b 44443333</code>\n   ╰ Ficha C4 blanco PDF <i>(5 cred)</i>\n\n` +
              `🔸 <code>/c4i 44443333</code>\n   ╰ Ficha C4 certificado PDF <i>(5 cred)</i>\n\n` +
              `🔸 <code>/dniv 44443333</code>\n   ╰ DNI digital azul/amarillo foto <i>(5 cred)</i>\n\n` +
              `🔸 <code>/dnivel 44443333</code>\n   ╰ DNI electrónico foto <i>(5 cred)</i>`
    },
    certificados: {
        title: "📄 CERTIFICADOS",
        text: `📄 <b>MÓDULO CERTIFICADOS</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/antpen 44443333</code>\n   ╰ Ant. penales PDF <i>(5 cred)</i>\n\n` +
              `🔸 <code>/antpol 44443333</code>\n   ╰ Ant. policiales PDF <i>(5 cred)</i>\n\n` +
              `🔸 <code>/antjud 44443333</code>\n   ╰ Ant. judiciales PDF <i>(5 cred)</i>`
    },
    familiares: {
        title: "👨‍👩‍👧 FAMILIARES",
        text: `👨‍👩‍👧 <b>MÓDULO FAMILIARES</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/ag 44443333</code>\n   ╰ Árbol genealógico texto <i>(5 cred)</i>\n\n` +
              `🔸 <code>/agv 44443333</code>\n   ╰ Árbol genealógico foto <i>(10 cred)</i>\n\n` +
              `🔸 <code>/agvp 44443333</code>\n   ╰ Árbol genealógico PDF <i>(15 cred)</i>\n\n` +
              `🔸 <code>/fam 44443333</code> o <code>/her 44443333</code>\n   ╰ Familiares texto <i>(3 cred)</i>\n\n` +
              `🔸 <code>/hogar 44443333</code>\n   ╰ SISFOH online <i>(5 cred)</i>\n\n` +
              `🔸 <code>/hogardb 44443333</code>\n   ╰ SISFOH DB <i>(3 cred)</i>`
    },
    financiero: {
        title: "💰 FINANCIERO",
        text: `💰 <b>MÓDULO FINANCIERO</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/sentinel 44443333</code>\n   ╰ Sentinel PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/financiero 44443333</code>\n   ╰ Financiero PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/sbs 44443333</code>\n   ╰ SBS texto <i>(10 cred)</i>\n\n` +
              `🔸 <code>/sbsv 44443333</code>\n   ╰ SBS foto <i>(15 cred)</i>\n\n` +
              `🔸 <code>/sbsvp 44443333</code>\n   ╰ SBS PDF <i>(20 cred)</i>`
    },
    spam: {
        title: "☠️ SPAM",
        text: `☠️ <b>MÓDULO SPAM</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/spm 999888777</code>\n   ╰ SPM operadores <i>(3 cred)</i>\n\n` +
              `🔸 <code>/spm2 999888777</code>\n   ╰ SPM bancos <i>(5 cred)</i>\n\n` +
              `🔸 <code>/spm3 999888777</code>\n   ╰ SPM ultra todos <i>(10 cred)</i>`
    },
    seeker: {
        title: "🔎 SEEKER",
        text: `🔎 <b>MÓDULO SEEKER</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/seeker 44443333</code>\n   ╰ Búsqueda general <i>(20 cred)</i>\n\n` +
              `🔸 <code>/sekcel 999888777</code>\n   ╰ Búsqueda celular <i>(20 cred)</i>\n\n` +
              `🔸 <code>/seekerpdf 44443333</code>\n   ╰ Búsqueda PDF <i>(20 cred)</i>`
    },
    baucher: {
        title: "💳 BAUCHER",
        text: `💳 <b>MÓDULO BAUCHER</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/yape 10|LUIS PEDRO|987|1</code>\n   ╰ Yape fake foto <i>(1 cred)</i>\n\n` +
              `🔸 <code>/plin 10|LUIS PEDRO|987|2</code>\n   ╰ Plin fake foto <i>(3 cred)</i>\n\n` +
              `🔸 <code>/ibk 3051234567891|3|10000</code>\n   ╰ Interbank fake foto <i>(3 cred)</i>\n\n` +
              `🔸 <code>/bcp Maria Perez|3051|8000</code>\n   ╰ BCP fake foto <i>(3 cred)</i>`
    },
    extras: {
        title: "➕ EXTRAS",
        text: `➕ <b>MÓDULO EXTRAS</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/meta 44443333</code>\n   ╰ Meta Data full texto <i>(15 cred)</i>\n\n` +
              `🔸 <code>/sunedu 44443333</code>\n   ╰ SUNEDU texto <i>(5 cred)</i>\n\n` +
              `🔸 <code>/sunedupdf 44443333</code>\n   ╰ SUNEDU PDF <i>(10 cred)</i>\n\n` +
              `🔸 <code>/cor 44443333</code> o <code>email@gmail.com</code>\n   ╰ Meta correo <i>(3 cred)</i>\n\n` +
              `🔸 <code>/sis 44443333</code>\n   ╰ SIS online <i>(3 cred)</i>\n\n` +
              `🔸 <code>/essa2 44443333</code>\n   ╰ ESSALUD online <i>(3 cred)</i>`
    },
    vip: {
        title: "💎 VIP",
        text: `💎 <b>MÓDULO VIP</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/facial FOTO</code>\n   ╰ Reconocimiento facial PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/migra 44443333</code>\n   ╰ Migraciones DNI PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/migrace 005748402</code>\n   ╰ Migraciones CE PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/migra2 44443333</code>\n   ╰ Migraciones DNI texto <i>(20 cred)</i>\n\n` +
              `🔸 <code>/migrace2 005748402</code>\n   ╰ Migraciones CE texto <i>(20 cred)</i>\n\n` +
              `🔸 <code>/minedu 44443333</code>\n   ╰ Certificado MINEDU PDF <i>(25 cred)</i>\n\n` +
              `🔸 <code>/mtc 44443333</code>\n   ╰ Certificado MTC PDF <i>(15 cred)</i>\n\n` +
              `🔸 <code>/cerjov 44443333</code> o <code>/ceradu 44443333</code>\n   ╰ Cert. MTPE PDF <i>(10 cred)</i>`
    },
    mundial: {
        title: "🌐 MUNDIAL",
        text: `🌐 <b>MÓDULO MUNDIAL</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/cedula 007532113</code>\n   ╰ SAIME Venezuela <i>(3 cred)</i>\n\n` +
              `🔸 <code>/nmv N¹|AP¹|AP²</code>\n   ╰ SAIME nombres <i>(3 cred)</i>\n\n` +
              `🔸 <code>/mtel +58 999888777</code>\n   ╰ Telefonía mundial <i>(3 cred)</i>\n\n` +
              `🔸 <code>/ssn 361894163</code>\n   ╰ SSN USA <i>(3 cred)</i>`
    },
    temporal: {
        title: "⏳ TEMPORAL",
        text: `⏳ <b>MÓDULO TEMPORAL</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/utp u22233661</code>\n   ╰ UTP online <i>(3 cred)</i>\n\n` +
              `🔸 <code>/dpm NOMBRE|CARRERA</code>\n   ╰ Daniel Alcides Carrión <i>(2 cred)</i>`
    },
    medico: {
        title: "💊 MÉDICO",
        text: `💊 <b>MÓDULO MÉDICO</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/minsa 44443333</code>\n   ╰ Descanso médico MINSA PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/const 44443333</code>\n   ╰ Constancia MINSA PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/reminsa 44443333</code>\n   ╰ Receta médica MINSA PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/cliluz 44443333</code>\n   ╰ Descanso Clínica La Luz PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/essalud 44443333</code>\n   ╰ Descanso ESSALUD PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/certmed 44443333</code>\n   ╰ Certificado médico ESSALUD PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/reessalud 44443333</code>\n   ╰ Receta médica ESSALUD PDF <i>(30 cred)</i>`
    },
    actas: {
        title: "📜 ACTAS",
        text: `📜 <b>MÓDULO ACTAS</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔸 <code>/actnac 44443333</code>\n   ╰ Acta de nacimiento PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/actmat 44443333</code>\n   ╰ Acta de matrimonio PDF <i>(30 cred)</i>\n\n` +
              `🔸 <code>/actdef 44443333</code>\n   ╰ Acta de defunción PDF <i>(30 cred)</i>`
    },
    imprenta: {
        title: "🖨️ IMPRENTA",
        text: `🖨️ <b>SISTEMA ORION — MÓDULO DE IMPRENTA</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `👤 <b>GESTIÓN DE CUENTA</b>\n` +
              `🔸 <code>/start</code>\n   ╰ Panel de bienvenida y estado actual\n\n` +
              `🔸 <code>/register</code>\n   ╰ Alta en el sistema <i>(Requerido)</i>\n\n` +
              `🔸 <code>/credits</code>\n   ╰ Consulta de saldo operativo\n\n` +
              `📄 <b>PROCESAMIENTO DE TARJETAS</b> <i>(Requiere documento PDF)</i>\n` +
              `🔸 🚀 Fotos TIVE PVC\n🔸 🧾 TIVE Completo\n🔸 🧾 TIVE Para Completar\n🔸 💳 Tarjeta Física PVC\n🔸 💳 Tarjeta Física PVC Para Completar\n🔸 📜 Tarjeta Antigua\n🔸 🔐 Insertar QR en PDF\n\n` +
              `<i>💡 Los parámetros como <code>44443333</code> son referenciales. Sustitúyalos por el valor real.</i>`
    }
};

const MAIN_MENU_TEXT = `🌌 <b>SISTEMA ORION BOT v2.0</b> 🌌\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `<i>Bienvenido al panel central de operaciones. Por favor, seleccione un módulo a continuación para desplegar el catálogo de herramientas.</i>\n\n` +
                       `💡 <b>Interfaz Dinámica:</b> Navegue utilizando el teclado interactivo inferior para un acceso rápido y seguro.`;

function getMainMenuKeyboard() {
    const keys = Object.keys(categories);
    const keyboard = [];
    for (let i = 0; i < keys.length; i += 2) {
        const row = [];
        row.push({ text: categories[keys[i]].title, callback_data: `cmds_cat_${keys[i]}` });
        if (keys[i + 1]) {
            row.push({ text: categories[keys[i + 1]].title, callback_data: `cmds_cat_${keys[i + 1]}` });
        }
        keyboard.push(row);
    }
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
                reply_markup: {
                    inline_keyboard: getMainMenuKeyboard()
                }
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
                reply_markup: {
                    inline_keyboard: getMainMenuKeyboard()
                }
            }).catch(() => {});
            return true;
        }

        if (data.startsWith('cmds_cat_')) {
            const cat = data.replace('cmds_cat_', '');
            if (categories[cat]) {
                let sendText = categories[cat].text;

                if (cat === 'imprenta') {
                    const { ADMIN_IDS } = require('../config');
                    const userId = String(query.from.id);
                    if (ADMIN_IDS.includes(userId)) {
                        const adminSection = `🛠️ <b>ADMINISTRACIÓN AVANZADA</b>\n` +
                                             `🔸 <code>/clientes</code> o <code>/cliente &lt;id&gt;</code>\n` +
                                             `   ╰ Gestión de clientes\n\n` +
                                             `🔸 <code>/addcredits &lt;id&gt; &lt;n&gt;</code> o <code>/removecredits &lt;id&gt; &lt;n&gt;</code>\n` +
                                             `   ╰ Gestión de saldo\n\n`;
                        sendText = sendText.replace('<i>💡 Los parámetros', adminSection + '<i>💡 Los parámetros');
                    }
                }

                await bot.editMessageText(sendText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 Volver al Menú', callback_data: 'cmds_main' }]]
                    }
                }).catch(() => {});
            }
            return true;
        }

        return false;
    }
};
