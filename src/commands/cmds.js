const { logInfo } = require('../utils/logger');

module.exports = {
    registerCommands(bot, state, deps) {
        bot.onText(/\/cmds/, (msg) => {
            logInfo('BOT', '📋', 'Comando /cmds recibido', { id: msg.from.id });

            const menu =
                `📋 *LISTA DE COMANDOS DISPONIBLES*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

                `👤 *PERSONAS*\n` +
                `\`/nm\` — Búsqueda por nombre\n` +
                `\`/fiscanm\` — Fiscalía por nombre\n` +
                `\`/fiscanmDELITOS\` — Fiscalía delitos\n` +
                `\`/den\` — Denuncias\n` +
                `\`/denuncias\` — Denuncias completo\n` +
                `\`/denpla\` — Denuncias por placa\n` +
                `\`/jne\` — JNE\n` +
                `\`/actnac\` — Acta de nacimiento\n` +
                `\`/actmat\` — Acta de matrimonio\n` +
                `\`/actdef\` — Acta de defunción\n\n` +

                `🏦 *SUNAT / TRIBUTARIO*\n` +
                `\`/sunat\` — Consulta con DNI\n` +
                `\`/sunat\` — Consulta con RUC\n` +
                `\`/consu\` — Consulta con DNI\n` +
                `\`/consu\` — Consulta con RUT\n` +
                `\`/reptrib\` — Reporte tributario\n` +
                `\`/tra\` — Trabajadores\n` +
                `\`/suel\` — Sueldo\n` +
                `\`/sueld\` — Sueldo detallado\n\n` +

                `🚗 *VEHÍCULOS*\n` +
                `\`/pla\` — Consulta por placa\n` +
                `\`/tive\` — TIVE por placa\n` +
                `\`/tivep\` — TIVE PDF\n` +
                `\`/revtec\` — Revisión técnica\n` +
                `\`/revtecpdf\` — Revisión técnica PDF\n` +
                `\`/hsoat\` — Historial SOAT\n` +
                `\`/soat\` — SOAT vigente\n` +
                `\`/brevete\` — Brevete\n` +
                `\`/paptrud\` — Papeletas TRUD\n` +
                `\`/mtc\` — MTC\n\n` +

                `📜 *CERTIFICADOS*\n` +
                `\`/antpen\` — Antecedentes penales\n` +
                `\`/antpol\` — Antecedentes policiales\n` +
                `\`/antpolv\` — Antecedentes pol. (v2)\n` +
                `\`/antjud\` — Antecedentes judiciales\n` +
                `\`/antjudv\` — Antecedentes jud. (v2)\n` +
                `\`/rqh\` — RQ historial\n` +
                `\`/rq\` — RQ\n` +
                `\`/rqv\` — RQ verificado\n\n` +

                `💰 *FINANCIERO*\n` +
                `\`/sentinel\` — Sentinel\n` +
                `\`/financiero\` — Financiero\n` +
                `\`/sbs\` — SBS\n` +
                `\`/sbsv\` — SBS verificado\n` +
                `\`/sbsvp\` — SBS PDF\n` +
                `\`/sbsFINANCIERO\` — SBS financiero\n\n` +

                `🔍 *SEEKER*\n` +
                `\`/seeker\` — Búsqueda general\n` +
                `\`/sekcel\` — Búsqueda celular\n` +
                `\`/seekerpdf\` — Búsqueda PDF\n\n` +

                `⭐ *VIP*\n` +
                `\`/facial\` — Reconocimiento facial\n` +
                `\`/migra\` — Migraciones\n` +
                `\`/migrace\` — Migraciones CE\n` +
                `\`/migra2\` — Migraciones v2\n` +
                `\`/cerjov\` — Certificado joven\n` +
                `\`/utp\` — UTP\n` +
                `\`/dpm\` — DPM\n\n` +

                `🎓 *EXTRAS*\n` +
                `\`/meta\` — Meta\n` +
                `\`/sunedu\` — SUNEDU\n` +
                `\`/sunedupdf\` — SUNEDU PDF\n` +
                `\`/cor\` — COR\n` +
                `\`/sis\` — SIS\n\n` +

                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `💡 _Uso: \`/comando parámetro\`_\n` +
                `_Ejemplo: \`/tive ABC123\`_`;

            bot.sendMessage(msg.chat.id, menu, { parse_mode: 'Markdown' });
        });
    }
};
