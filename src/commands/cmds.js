const { logInfo } = require('../utils/logger');

const categories = {
    reniec: {
        title: "🪪 RENIEC",
        text: `🪪 *RENIEC*\n\n` +
              `▪️ \`/dnim\` \`44443333\` ➔ MINSA DB · Rostro + datos _(2 cred)_\n` +
              `▪️ \`/dni\` \`44443333\` ➔ Online Nv2 · Rostro + datos _(1 cred)_\n` +
              `▪️ \`/dnif\` \`44443333\` ➔ Online Nv3 · Rostro + firma _(2 cred)_\n` +
              `▪️ \`/dnit\` \`44443333\` ➔ Online Nv4 · Rostro+firma+huellas _(3 cred)_\n` +
              `▪️ \`/nm\` \`N¹|AP¹|AP²\` ➔ Búsqueda por nombre _(2 cred)_\n` +
              `▪️ \`/dir\` \`44443333\` ➔ Geolocalización + dirección _(3 cred)_\n` +
              `▪️ \`/dnidb\` \`44443333\` ➔ DB Nv1 · Rostro + datos _(1 cred)_\n` +
              `▪️ \`/dnifdb\` \`44443333\` ➔ DB Nv2 · Rostro + firma _(2 cred)_\n` +
              `▪️ \`/dnitdb\` \`44443333\` ➔ DB Nv3 · Rostro+firma+huellas _(3 cred)_\n` +
              `▪️ \`/nmdb\` \`44443333\` ➔ DB nombres _(gratis)_`
    },
    telefonia: {
        title: "📞 TELEFONÍA",
        text: `📞 *TELEFONÍA*\n\n` +
              `▪️ \`/telp\` \`999888777\` ➔ OSIPTEL Online Pro Max _(10 cred)_\n` +
              `▪️ \`/tel\` \`999888777\` ➔ DB Telefónica _(gratis)_\n` +
              `▪️ \`/stel\` \`44443333\` / \`/cel\` \`999888777\` ➔ OSIPTEL DB Nv2 _(5 cred)_\n` +
              `▪️ \`/telpdb\` \`999888777\` ➔ OSIPTEL DB Nv3 extendida _(5 cred)_\n` +
              `▪️ \`/claro\` \`999888777\` ➔ Titular CLARO online _(5 cred)_\n` +
              `▪️ \`/bitel\` \`987654321\` ➔ Titular BITEL online _(5 cred)_\n` +
              `▪️ \`/movistar\` \`956047006\` ➔ Titular MOVISTAR online _(5 cred)_\n` +
              `▪️ \`/entel\` \`987654321\` ➔ Titular ENTEL online _(5 cred)_\n` +
              `▪️ \`/lineas\` \`44443333\` / \`/operador\` \`999888777\` ➔ Líneas OSIPTEL _(3 cred)_`
    },
    delitos: {
        title: "⛓️ DELITOS",
        text: `⛓️ *DELITOS*\n\n` +
              `▪️ \`/fiscapdf\` \`44443333\` ➔ Fiscalía MPFN PDF _(10/15 cred)_\n` +
              `▪️ \`/fiscacs\` \`170-2006-560\` ➔ Fiscalía MPFN Caso _(15 cred)_\n` +
              `▪️ \`/fiscanm\` \`N¹|AP¹|AP²\` ➔ Fiscalía MPFN Nombre _(15 cred)_\n` +
              `▪️ \`/den\` \`44443333\` ➔ Denuncias PNP texto _(10 cred)_\n` +
              `▪️ \`/denuncias\` \`44443333\` ➔ Denuncias PNP PDF _(20 cred)_\n` +
              `▪️ \`/denpla\` \`ABC123\` ➔ Denuncias por placa PDF _(20 cred)_\n` +
              `▪️ \`/rqh\` \`44443333\` ➔ Requisitoria texto _(20 cred)_\n` +
              `▪️ \`/rq\` \`44443333\` ➔ Requisitoria PDF _(20 cred)_\n` +
              `▪️ \`/rqv\` \`ABC123\` ➔ Requisitoria placa PDF _(20 cred)_\n` +
              `▪️ \`/rqant\` \`44443333\` ➔ Antecedentes PNP PDF _(20 cred)_\n` +
              `▪️ \`/antpenv\` \`44443333\` ➔ Verif. ant. penales _(3 cred)_\n` +
              `▪️ \`/antpolv\` \`44443333\` ➔ Verif. ant. policiales _(3 cred)_\n` +
              `▪️ \`/antjudv\` \`44443333\` ➔ Verif. ant. judiciales _(3 cred)_\n` +
              `▪️ \`/jne\` \`44443333\` ➔ Multas electorales foto _(5 cred)_`
    },
    policia: {
        title: "👮 POLICÍA",
        text: `👮 *POLICÍA*\n\n` +
              `▪️ \`/pnp\` \`44443333\` ➔ Datos PNP online _(3 cred)_`
    },
    sunat: {
        title: "🏛 SUNAT",
        text: `🏛 *SUNAT*\n\n` +
              `▪️ \`/ruc\` \`44443333\` / \`10072601802\` ➔ Datos personal _(3 cred)_\n` +
              `▪️ \`/sunat\` \`44443333\` ➔ Datos empresa PDF _(10 cred)_\n` +
              `▪️ \`/consu\` \`44443333\` ➔ Consumos texto _(10 cred)_\n` +
              `▪️ \`/consumos\` \`44443333\` ➔ Consumos PDF _(15 cred)_\n` +
              `▪️ \`/reptrib\` \`44443333\` ➔ Reporte tributario PDF _(premium)_\n` +
              `▪️ \`/tra\` \`44443333\` ➔ Trabajos SUNAT _(3 cred)_\n` +
              `▪️ \`/suel\` \`44443333\` ➔ Sueldos SUNAT _(3 cred)_\n` +
              `▪️ \`/sueld\` \`44443333\` ➔ Sueldos DB _(3 cred)_`
    },
    sunarp: {
        title: "🏘 SUNARP",
        text: `🏘 *SUNARP*\n\n` +
              `▪️ \`/pro\` \`44443333\` ➔ Propiedades texto _(5 cred)_\n` +
              `▪️ \`/propdf\` \`44443333\` ➔ Propiedades PDF _(15 cred)_\n` +
              `▪️ \`/partida\` \`44443333|LIMA|MUEBLES\` ➔ Partidas PDF _(10 cred)_`
    },
    vehiculos: {
        title: "🚐 VEHÍCULOS",
        text: `🚐 *VEHÍCULOS*\n\n` +
              `▪️ \`/vec\` \`44443333\` ➔ DB vehículos texto _(3 cred)_\n` +
              `▪️ \`/pla\` \`ABC123\` ➔ Foto vehículo SUNARP _(1 cred)_\n` +
              `▪️ \`/plat\` \`ABC123\` ➔ Full datos vehículo _(3 cred)_\n` +
              `▪️ \`/revtec\` / \`/revtecpdf\` \`ABC123\` ➔ Rev. técnica _(5 cred)_\n` +
              `▪️ \`/boi\` \`ABC123\` ➔ Boleta informativa PDF _(15 cred)_\n` +
              `▪️ \`/hsoat\` \`ABC123\` ➔ Historial SOAT _(5 cred)_\n` +
              `▪️ \`/soat\` \`ABC123\` ➔ SOAT vigente PDF _(10 cred)_\n` +
              `▪️ \`/tive\` \`ABC123\` ➔ TIVE original PDF _(20 cred)_\n` +
              `▪️ \`/tivep\` \`ABC123\` ➔ TIVE plantilla PDF _(10 cred)_\n` +
              `▪️ \`/tivev\` \`ABC123\` ➔ TIVE electrónico foto _(10 cred)_\n` +
              `▪️ \`/tivevpdf\` \`ABC123\` ➔ TIVE electrónico PDF _(15 cred)_\n` +
              `▪️ \`/paptrud\` \`M5D408\` ➔ Papeletas Trujillo _(10 cred)_\n` +
              `▪️ \`/brevete\` \`44443333\` ➔ Brevete MTC PDF _(10 cred)_`
    },
    generadores: {
        title: "⚙️ GENERADORES",
        text: `⚙️ *GENERADORES*\n\n` +
              `▪️ \`/c4a\` \`44443333\` ➔ Ficha C4 azul PDF _(5 cred)_\n` +
              `▪️ \`/c4b\` \`44443333\` ➔ Ficha C4 blanco PDF _(5 cred)_\n` +
              `▪️ \`/c4i\` \`44443333\` ➔ Ficha C4 certificado PDF _(5 cred)_\n` +
              `▪️ \`/dniv\` \`44443333\` ➔ DNI digital azul/amarillo foto _(5 cred)_\n` +
              `▪️ \`/dnivel\` \`44443333\` ➔ DNI electrónico foto _(5 cred)_`
    },
    certificados: {
        title: "📄 CERTIFICADOS",
        text: `📄 *CERTIFICADOS*\n\n` +
              `▪️ \`/antpen\` \`44443333\` ➔ Ant. penales PDF _(5 cred)_\n` +
              `▪️ \`/antpol\` \`44443333\` ➔ Ant. policiales PDF _(5 cred)_\n` +
              `▪️ \`/antjud\` \`44443333\` ➔ Ant. judiciales PDF _(5 cred)_`
    },
    familiares: {
        title: "👨‍👩‍👧 FAMILIARES",
        text: `👨‍👩‍👧 *FAMILIARES*\n\n` +
              `▪️ \`/ag\` \`44443333\` ➔ Árbol genealógico texto _(5 cred)_\n` +
              `▪️ \`/agv\` \`44443333\` ➔ Árbol genealógico foto _(10 cred)_\n` +
              `▪️ \`/agvp\` \`44443333\` ➔ Árbol genealógico PDF _(15 cred)_\n` +
              `▪️ \`/fam\` / \`/her\` \`44443333\` ➔ Familiares texto _(3 cred)_\n` +
              `▪️ \`/hogar\` \`44443333\` ➔ SISFOH online _(5 cred)_\n` +
              `▪️ \`/hogardb\` \`44443333\` ➔ SISFOH DB _(3 cred)_`
    },
    financiero: {
        title: "💰 FINANCIERO",
        text: `💰 *FINANCIERO*\n\n` +
              `▪️ \`/sentinel\` \`44443333\` ➔ Sentinel PDF _(30 cred)_\n` +
              `▪️ \`/financiero\` \`44443333\` ➔ Financiero PDF _(30 cred)_\n` +
              `▪️ \`/sbs\` \`44443333\` ➔ SBS texto _(10 cred)_\n` +
              `▪️ \`/sbsv\` \`44443333\` ➔ SBS foto _(15 cred)_\n` +
              `▪️ \`/sbsvp\` \`44443333\` ➔ SBS PDF _(20 cred)_`
    },
    spam: {
        title: "☠️ SPAM",
        text: `☠️ *SPAM*\n\n` +
              `▪️ \`/spm\` \`999888777\` ➔ SPM operadores _(3 cred)_\n` +
              `▪️ \`/spm2\` \`999888777\` ➔ SPM bancos _(5 cred)_\n` +
              `▪️ \`/spm3\` \`999888777\` ➔ SPM ultra todos _(10 cred)_`
    },
    seeker: {
        title: "🔎 SEEKER",
        text: `🔎 *SEEKER*\n\n` +
              `▪️ \`/seeker\` \`44443333\` ➔ Búsqueda general _(20 cred)_\n` +
              `▪️ \`/sekcel\` \`999888777\` ➔ Búsqueda celular _(20 cred)_\n` +
              `▪️ \`/seekerpdf\` \`44443333\` ➔ Búsqueda PDF _(20 cred)_`
    },
    baucher: {
        title: "💳 BAUCHER",
        text: `💳 *BAUCHER*\n\n` +
              `▪️ \`/yape\` \`10|LUIS PEDRO|987|1\` ➔ Yape fake foto _(1 cred)_\n` +
              `▪️ \`/plin\` \`10|LUIS PEDRO|987|2\` ➔ Plin fake foto _(3 cred)_\n` +
              `▪️ \`/ibk\` \`3051234567891|3|10000\` ➔ Interbank fake foto _(3 cred)_\n` +
              `▪️ \`/bcp\` \`Maria Perez|3051|8000\` ➔ BCP fake foto _(3 cred)_`
    },
    extras: {
        title: "➕ EXTRAS",
        text: `➕ *EXTRAS*\n\n` +
              `▪️ \`/meta\` \`44443333\` ➔ Meta Data full texto _(15 cred)_\n` +
              `▪️ \`/sunedu\` \`44443333\` ➔ SUNEDU texto _(5 cred)_\n` +
              `▪️ \`/sunedupdf\` \`44443333\` ➔ SUNEDU PDF _(10 cred)_\n` +
              `▪️ \`/cor\` \`44443333\` / \`email@gmail.com\` ➔ Meta correo _(3 cred)_\n` +
              `▪️ \`/sis\` \`44443333\` ➔ SIS online _(3 cred)_\n` +
              `▪️ \`/essa2\` \`44443333\` ➔ ESSALUD online _(3 cred)_`
    },
    vip: {
        title: "💎 VIP",
        text: `💎 *VIP*\n\n` +
              `▪️ \`/facial\` \`FOTO\` ➔ Reconocimiento facial PDF _(30 cred)_\n` +
              `▪️ \`/migra\` \`44443333\` ➔ Migraciones DNI PDF _(30 cred)_\n` +
              `▪️ \`/migrace\` \`005748402\` ➔ Migraciones CE PDF _(30 cred)_\n` +
              `▪️ \`/migra2\` \`44443333\` ➔ Migraciones DNI texto _(20 cred)_\n` +
              `▪️ \`/migrace2\` \`005748402\` ➔ Migraciones CE texto _(20 cred)_\n` +
              `▪️ \`/minedu\` \`44443333\` ➔ Certificado MINEDU PDF _(25 cred)_\n` +
              `▪️ \`/mtc\` \`44443333\` ➔ Certificado MTC PDF _(15 cred)_\n` +
              `▪️ \`/cerjov\` / \`/ceradu\` \`44443333\` ➔ Cert. MTPE PDF _(10 cred)_`
    },
    mundial: {
        title: "🌐 MUNDIAL",
        text: `🌐 *MUNDIAL*\n\n` +
              `▪️ \`/cedula\` \`007532113\` ➔ SAIME Venezuela _(3 cred)_\n` +
              `▪️ \`/nmv\` \`N¹|AP¹|AP²\` ➔ SAIME nombres _(3 cred)_\n` +
              `▪️ \`/mtel\` \`+58 999888777\` ➔ Telefonía mundial _(3 cred)_\n` +
              `▪️ \`/ssn\` \`361894163\` ➔ SSN USA _(3 cred)_`
    },
    temporal: {
        title: "⏳ TEMPORAL",
        text: `⏳ *TEMPORAL*\n\n` +
              `▪️ \`/utp\` \`u22233661\` ➔ UTP online _(3 cred)_\n` +
              `▪️ \`/dpm\` \`NOMBRE|CARRERA\` ➔ Daniel Alcides Carrión _(2 cred)_`
    },
    medico: {
        title: "💊 MÉDICO",
        text: `💊 *MÉDICO*\n\n` +
              `▪️ \`/minsa\` \`44443333\` ➔ Descanso médico MINSA PDF _(30 cred)_\n` +
              `▪️ \`/const\` \`44443333\` ➔ Constancia MINSA PDF _(30 cred)_\n` +
              `▪️ \`/reminsa\` \`44443333\` ➔ Receta médica MINSA PDF _(30 cred)_\n` +
              `▪️ \`/cliluz\` \`44443333\` ➔ Descanso Clínica La Luz PDF _(30 cred)_\n` +
              `▪️ \`/essalud\` \`44443333\` ➔ Descanso ESSALUD PDF _(30 cred)_\n` +
              `▪️ \`/certmed\` \`44443333\` ➔ Certificado médico ESSALUD PDF _(30 cred)_\n` +
              `▪️ \`/reessalud\` \`44443333\` ➔ Receta médica ESSALUD PDF _(30 cred)_`
    },
    actas: {
        title: "📜 ACTAS",
        text: `📜 *ACTAS*\n\n` +
              `▪️ \`/actnac\` \`44443333\` ➔ Acta de nacimiento PDF _(30 cred)_\n` +
              `▪️ \`/actmat\` \`44443333\` ➔ Acta de matrimonio PDF _(30 cred)_\n` +
              `▪️ \`/actdef\` \`44443333\` ➔ Acta de defunción PDF _(30 cred)_`
    },
    imprenta: {
        title: "🖨️ IMPRENTA",
        text: `🖨️ *SISTEMA ORION — MÓDULO DE IMPRENTA*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `👤 *GESTIÓN DE CUENTA*\n` +
              `▪️ \`/start\` ➔ Panel de bienvenida y estado actual\n` +
              `▪️ \`/register\` ➔ Alta en el sistema _(Requerido)_\n` +
              `▪️ \`/credits\` ➔ Consulta de saldo operativo\n\n` +
              `📄 *PROCESAMIENTO DE TARJETAS* _(Requiere documento PDF)_\n` +
              `▪️ 🚀 Fotos TIVE PVC\n▪️ 🧾 TIVE Completo\n▪️ 🧾 TIVE Para Completar\n▪️ 💳 Tarjeta Física PVC\n▪️ 💳 Tarjeta Física PVC Para Completar\n▪️ 📜 Tarjeta Antigua\n▪️ 🔐 Insertar QR en PDF\n\n` +
              `_💡 Los parámetros como \`44443333\` son referenciales. Sustitúyalos por el valor real._`
    }
};

const MAIN_MENU_TEXT = `🌌 *SISTEMA ORION BOT v2.0* 🌌\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                       `_Bienvenido al panel central de operaciones. Por favor, seleccione un módulo a continuación para desplegar el catálogo de herramientas._\n\n` +
                       `💡 *Interfaz Dinámica:* Navegue utilizando el teclado interactivo inferior para un acceso rápido y seguro.`;

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
                parse_mode: 'Markdown',
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
                parse_mode: 'Markdown',
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
                        const adminSection = `🛠️ *ADMINISTRACIÓN AVANZADA*\n` +
                                             `▪️ \`/clientes\` · \`/cliente <id>\`\n▪️ \`/addcredits <id> <n>\` · \`/removecredits <id> <n>\`\n\n`;
                        sendText = sendText.replace('_💡 Los parámetros', adminSection + '_💡 Los parámetros');
                    }
                }

                await bot.editMessageText(sendText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
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
