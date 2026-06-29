const path = require('path');
const fs = require('fs');
const { logInfo, logError } = require('../utils/logger');
const { safe, nombreArchivoFirma } = require('../utils/helpers');
const state = require('../state');
const { clearPendingCharge } = require('./creditGuard');

const { userState, userFirmaPendienteData } = state;

module.exports = function(bot) {
    
    async function descargarArchivoTelegram(fileId) {
        const chunks = [];
        for await (const chunk of bot.getFileStream(fileId)) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    function buscarArchivoFirma(sede) {
        if (!sede) return null;
        let cleanSede = safe(sede).toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
        if (cleanSede.length < 3) {
            logInfo('FIRMA', '⚠️', `Sede demasiado corta para buscar firma (min 3 chars)`, { sede, longitud: cleanSede.length });
            return null;
        }

        const firmasDir = path.join(__dirname, '..', '..', 'tarjeta', 'firmas');
        if (!fs.existsSync(firmasDir)) {
            logError('FIRMA', '❌', `Carpeta de firmas NO existe — imposible buscar firma`, { ruta: firmasDir, sede });
            return null;
        }

        const files = fs.readdirSync(firmasDir);

        if (cleanSede === 'tarapoto') cleanSede = 'taraporo';
        if (cleanSede === 'pucallpa') cleanSede = 'pucullpa';
        if (cleanSede === 'huanuco') cleanSede = 'huanuco';

        let bestMatch = files.find(f => {
            const cleanFile = f.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');
            return cleanFile.includes(cleanSede) && !cleanFile.includes(cleanSede + '2') && !cleanFile.includes(cleanSede + '3') && !cleanFile.includes(cleanSede + '4') && !cleanFile.includes(cleanSede + '6') && !cleanFile.includes(cleanSede + '7');
        });

        if (!bestMatch) {
            bestMatch = files.find(f => {
                const cleanFile = f.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]/g, '');
                return cleanFile.includes(cleanSede);
            });
        }

        if (bestMatch) {
            const matchedPath = path.join(firmasDir, bestMatch);
            logInfo('FIRMA', '✅', `Firma encontrada para sede`, { sede, archivoFirma: bestMatch, rutaCompleta: matchedPath });
            return matchedPath;
        }

        logInfo('FIRMA', '⚠️', `No se encontró firma para la sede — se pedirá al usuario`, { sede, sedeNormalizada: cleanSede, archivosDisponibles: files.length });
        return null;
    }

    async function pedirFirmaFaltanteTive(chatId, sedeInput, datos, qrCustomLink, verificationHash) {
        userFirmaPendienteData.set(chatId, {
            sedeInput: safe(sedeInput),
            datos,
            qrCustomLink,
            verificationHash,
            firmaNombre: ''
        });
        userState.set(chatId, 'awaiting_tive_firma_name');
        await bot.sendMessage(
            chatId,
            `⚠️ No tengo firma guardada para la sede *${safe(sedeInput) || 'SIN SEDE'}*.\n\nEnvía el *nombre* con el que debo guardar esta firma para futuros TIVE.`,
            { parse_mode: 'Markdown' }
        );
    }

    async function guardarFirmaPendienteDesdeMensaje(chatId, msg) {
        const pending = userFirmaPendienteData.get(chatId);
        if (!pending) {
            userState.delete(chatId);
            await bot.sendMessage(chatId, "⚠️ No hay una firma pendiente. Vuelve a generar el TIVE.");
            return;
        }

        let fileId = '';
        let mimeType = '';
        if (msg.photo && msg.photo.length) {
            const bestPhoto = msg.photo[msg.photo.length - 1];
            fileId = bestPhoto.file_id;
            mimeType = 'image/jpeg';
        } else if (msg.document && /^image\//i.test(msg.document.mime_type || '')) {
            fileId = msg.document.file_id;
            mimeType = msg.document.mime_type || 'image/jpeg';
        }

        if (!fileId) {
            await bot.sendMessage(chatId, "📷 Envía la firma como imagen JPG/PNG para guardarla.");
            return;
        }

        const firmasDir = path.join(__dirname, '..', '..', 'tarjeta', 'firmas');
        if (!fs.existsSync(firmasDir)) fs.mkdirSync(firmasDir, { recursive: true });

        const nameToUse = pending.firmaNombre || pending.sedeInput;
        const firmaFileName = nombreArchivoFirma(nameToUse, mimeType);
        const firmaPath = path.join(firmasDir, firmaFileName);
        const firmaBuffer = await descargarArchivoTelegram(fileId);
        fs.writeFileSync(firmaPath, firmaBuffer);
        logInfo('FIRMA', '✅', `Nueva firma guardada exitosamente`, { firmaPath, nombre: pending.firmaNombre || '(sin nombre)', sede: pending.sedeInput || '(sin sede)', tamaño: `${firmaBuffer.length} bytes` });

        userFirmaPendienteData.delete(chatId);
        userState.delete(chatId);
        await bot.sendMessage(chatId, `✅ Firma guardada como \`${firmaFileName}\`.\nGenerando TIVE...`, { parse_mode: 'Markdown' });
        
        try {
            const cardGenerator = require('./cardGenerator')(bot);
            await cardGenerator.generarTiveCompleto(chatId, pending.datos, pending.qrCustomLink, pending.verificationHash, firmaPath);
        } catch (err) {
            clearPendingCharge(state, chatId);
            logError('FIRMA', '❌', 'Error generando TIVE tras guardar firma', err);
            await bot.sendMessage(chatId, `❌ Error: ${err.message}\n_No se descontaron créditos._`, { parse_mode: 'Markdown' });
        }
    }

    return {
        descargarArchivoTelegram,
        buscarArchivoFirma,
        pedirFirmaFaltanteTive,
        guardarFirmaPendienteDesdeMensaje
    };
};
