const crypto = require('crypto');
const { logInfo, logError } = require('../utils/logger');

module.exports = function registerCommands(bot, state, deps) {
    const {
        userPdfs, userPdfNames, userState, userAntiguaData,
        userTiveCompletoData, userTiveCompletarData, userFirmaPendienteData,
        userFisicaPvcCompletarData
    } = state;
    
    const {
        isAuthorized, extraerConIA, generarTIVE, extraerTiveCompletoConLibreria,
        iniciarCapturaFaltantesTiveCompleto, iniciarCapturaFaltantesTiveCompletar,
        iniciarCapturaFaltantesFisicaPvcCompletar,
        finalizarInsercionQR, extraerConIA_Antigua, generarTarjetaAntigua,
        guardarFirmaPendienteDesdeMensaje, componerTituloCompletar, generarTiveCompleto,
        fmtPlaca, escapeMarkdown
    } = deps;

    const handleEditError = (err) => {
        if (err && err.message && err.message.includes("message is not modified")) return;
        logError('BOT', '❌', 'Error editMessageText', err);
    };

    bot.onText(/\/ping/, (msg) => {
        bot.sendMessage(msg.chat.id, "🏓 ¡PONG! El bot está vivo y escuchando.");
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;

        logInfo('BOT', '🖱️', 'Botón presionado', { boton: data, chatId });
        bot.answerCallbackQuery(query.id).catch(() => { });

        const buffer = userPdfs.get(chatId);
        if (!buffer) {
            return bot.sendMessage(chatId, "⚠️ El documento expiró. Por favor, envíalo de nuevo.");
        }

        if (data === "ask_qr" || data === "qr") {
            userState.set(chatId, "awaiting_qr");
            bot.editMessageText(`🔗 *Configuración QR*\nEscribe el link personalizado o elige el oficial:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "🏢 Usar Link Oficial SUNARP", callback_data: "use_official" }]]
                }
            }).catch(handleEditError);
        } else if (data === "use_official") {
            bot.editMessageText(`🧾 *Procesando datos localmente...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                await generarTIVE(chatId, datos, null, buffer);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
        } else if (data === "gen_tive_completo") {
            bot.editMessageText(`📄 *Extrayendo datos para TIVE COMPLETO...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerTiveCompletoConLibreria(buffer);
                await iniciarCapturaFaltantesTiveCompleto(chatId, datos, buffer);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
        } else if (data === "gen_tive_completar") {
            bot.editMessageText(`📄 *Extrayendo datos para TIVE PARA COMPLETAR...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerTiveCompletoConLibreria(buffer);
                await iniciarCapturaFaltantesTiveCompletar(chatId, datos, buffer);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
        } else if (data === "gen_tarjeta_fisica_pvc") {
            userState.set(chatId, "awaiting_qr_fisica_pvc");
            bot.editMessageText(`💳 *Configuración QR para Tarjeta Física PVC*\nEscribe el link personalizado o elige el oficial:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "🏢 Usar Link Oficial SUNARP", callback_data: "use_official_fisica_pvc" }]]
                }
            }).catch(handleEditError);
        } else if (data === "use_official_fisica_pvc") {
            bot.editMessageText(`💳 *Procesando datos localmente...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                await generarTIVE(chatId, datos, null, buffer, { anv: 'TARJETA FISICA ADELANTE.pdf', rev: 'TARJETA FISICA ATRAS.pdf' });
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
        } else if (data === "gen_tarjeta_fisica_pvc_completar") {
            bot.editMessageText(`💳 *Extrayendo datos para TARJETA FISICA PVC PARA COMPLETAR...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(handleEditError);
            try {
                const datos = await extraerTiveCompletoConLibreria(buffer);
                await iniciarCapturaFaltantesFisicaPvcCompletar(chatId, datos, buffer);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
        } else if (data === "insert_qr_only") {
            const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
            await finalizarInsercionQR(chatId, buffer, "CERTIFICADO", hash, messageId);
        } else if (data === "gen_antigua") {
            const n1 = Math.floor(100000 + Math.random() * 900000).toString();
            let n2; do { n2 = Math.floor(100000 + Math.random() * 900000).toString(); } while (n1 === n2);
            const exp = Math.floor(10000 + Math.random() * 90000).toString();

            userAntiguaData.set(chatId, { controlAnverso: n1, controlReverso: n2, exp: exp });
            userState.set(chatId, "awaiting_antigua_placa");

            extraerConIA_Antigua(buffer).then(datos => {
                const current = userAntiguaData.get(chatId);
                if (current) current.datosIA = datos;
            }).catch(e => logError('IA-ANTIGUA', '❌', 'Error extracción en segundo plano', e));

            bot.editMessageText(
                `📜 *Generación de Tarjeta Antigua*\n\n` +
                `Introduce la **PLACA** con su guion (ej: \`5053-QS\`):`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
            ).catch(handleEditError);
        }
    });

    bot.onText(/\/start/, (msg) => {
        logInfo('BOT', '📥', 'Comando /start recibido', { username: msg.from.username || 'sin_username', id: msg.from.id });
        if (!isAuthorized(msg)) return;
        const welcome =
            `✨ *TIVE AI PRO* ✨\n` +
            `━━━━━━━━━━━━━━━━━\n` +
            `Bienvenido al sistema avanzado de generación de tarjetas TIVE.\n\n` +
            `🚀 *Capacidades:*\n` +
            `• Extracción inteligente de datos (Gemini AI)\n` +
            `• Generación de anverso/reverso en alta definición\n` +
            `• QR y Código de barras dinámicos\n` +
            `• Recorte automático de firma original\n\n` +
            `📥 *Para comenzar:* Envía el documento PDF original de SUNARP.`;
        bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' }).catch(err => logError('BOT', '❌', 'Error enviando /start', err));
    });

    bot.onText(/\/tive_completar/, (msg) => {
        if (!isAuthorized(msg)) return;
        bot.sendMessage(msg.chat.id, "💡 Para usar *TIVE PARA COMPLETAR*, primero sube un archivo PDF de SUNARP y presiona el botón correspondiente en el menú.", { parse_mode: 'Markdown' });
    });

    bot.onText(/\/tive_completo/, (msg) => {
        if (!isAuthorized(msg)) return;
        bot.sendMessage(msg.chat.id, "💡 Para usar *TIVE COMPLETO*, primero sube un archivo PDF de SUNARP y presiona el botón correspondiente en el menú.", { parse_mode: 'Markdown' });
    });

    bot.on('document', async (msg) => {
        logInfo('BOT', '📄', 'Documento recibido', { name: msg.document.file_name, size: msg.document.file_size });
        if (!isAuthorized(msg)) return;
        const chatId = msg.chat.id;
        const state = userState.get(chatId);

        if (state === 'awaiting_tive_firma_image') {
            try {
                await guardarFirmaPendienteDesdeMensaje(chatId, msg);
            } catch (e) {
                logError('FIRMA', '❌', 'Error guardando firma', e);
                await bot.sendMessage(chatId, "❌ Error guardando la firma: " + e.message);
            }
            return;
        }

        const statusMsg = await bot.sendMessage(chatId, "⏳ *Descargando documento...*", { parse_mode: 'Markdown' });

        try {
            const chunks = [];
            for await (const chunk of bot.getFileStream(msg.document.file_id)) { chunks.push(chunk); }
            userPdfs.set(chatId, Buffer.concat(chunks));
            userPdfNames.set(chatId, msg.document.file_name || '');
            logInfo('BOT', '✅', 'Documento descargado en memoria');

            const menuOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🚀 Generar Fotos TIVE PVC", callback_data: "ask_qr" }],
                        [{ text: "🧾 TIVE COMPLETO", callback_data: "gen_tive_completo" }],
                        [{ text: "🧾 TIVE PARA COMPLETAR", callback_data: "gen_tive_completar" }],
                        [{ text: "💳 TARJETA FISICA PVC", callback_data: "gen_tarjeta_fisica_pvc" }],
                        [{ text: "💳 TARJETA FISICA PVC PARA COMPLETAR", callback_data: "gen_tarjeta_fisica_pvc_completar" }],
                        [{ text: "📜 Generar Tarjeta Antigua", callback_data: "gen_antigua" }],
                        [{ text: "🔐 Insertar QR en PDF Original", callback_data: "insert_qr_only" }]
                    ]
                }
            };

            bot.editMessageText(
                `📄 *Documento Cargado*\n` +
                `━━━━━━━━━━━━━━━━━\n` +
                `• Archivo: \`${msg.document.file_name}\`\n` +
                `• Estado: Ready ✨\n\n` +
                `¿Qué acción deseas realizar con este documento?`,
                { chat_id: chatId, message_id: statusMsg.message_id, ...menuOptions }
            ).catch(handleEditError);
        } catch (e) {
            bot.editMessageText(`❌ *Error al procesar el archivo:* ${e.message}`, { chat_id: chatId, message_id: statusMsg.message_id }).catch(handleEditError);
        }
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const state = userState.get(chatId);
        const buffer = userPdfs.get(chatId);

        if (state === "awaiting_tive_firma_name" && msg.text && !msg.text.startsWith('/')) {
            const pending = userFirmaPendienteData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                return bot.sendMessage(chatId, "⚠️ No hay una firma pendiente. Vuelve a generar el TIVE.");
            }
            pending.firmaNombre = msg.text.trim();
            userFirmaPendienteData.set(chatId, pending);
            userState.set(chatId, "awaiting_tive_firma_image");
            return bot.sendMessage(chatId, `📷 Ahora envía la imagen JPG/PNG de la firma para *${escapeMarkdown(pending.firmaNombre)}*.`, { parse_mode: 'Markdown' });
        }

        if (state === "awaiting_tive_firma_image") {
            if (msg.document) return;
            if (msg.photo && msg.photo.length) {
                try {
                    await guardarFirmaPendienteDesdeMensaje(chatId, msg);
                } catch (e) {
                    logError('FIRMA', '❌', 'Error guardando firma', e);
                    await bot.sendMessage(chatId, "❌ Error guardando la firma: " + e.message);
                }
                return;
            }
            return bot.sendMessage(chatId, "📷 Envía la firma como imagen JPG/PNG para guardarla.");
        }

        if (state === "awaiting_tive_completar_field" && msg.text && (!msg.text.startsWith('/') || msg.text.toLowerCase() === '/ok')) {
            const pending = userTiveCompletarData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                return bot.sendMessage(chatId, "⚠️ Se perdió el estado de captura. Vuelve a elegir *TIVE PARA COMPLETAR*.", { parse_mode: 'Markdown' });
            }
            const current = pending.missingFields[pending.index];
            const rawValue = msg.text.trim();

            if (current.key === 'placa') {
                const respuesta = rawValue.toLowerCase().replace(/^\//,'');
                const esConfirmacion = ['si', 'sí', 'si', 'ok', 'si.', 'sí.', 'yes', 'y'].includes(respuesta);
                if (esConfirmacion && (pending.datos.placaOriginal || pending.datos.placa)) {
                    // Usar el valor ya detectado
                    const placaDetectada = fmtPlaca(pending.datos.placaOriginal || pending.datos.placa);
                    pending.datos.placa = placaDetectada;
                    pending.datos.placaOriginal = pending.datos.placaOriginal || pending.datos.placa;
                } else {
                    // Usar el nuevo valor que escribió el usuario
                    pending.datos.placa = fmtPlaca(rawValue);
                    pending.datos.placaOriginal = rawValue;
                }
            } else {
                pending.datos[current.key] = rawValue;
            }

            pending.index += 1;

            if (pending.index >= pending.missingFields.length) {
                userTiveCompletarData.delete(chatId);
                userState.delete(chatId);

                const fullTitle = componerTituloCompletar(pending.datos.tituloNo, pending.datos.añoTitulo);
                if (fullTitle) {
                    pending.datos.titulo = fullTitle;
                    pending.datos.tituloNo = fullTitle;
                }
                
                await bot.sendMessage(chatId, "✅ Datos faltantes completados. Generando *TIVE PARA COMPLETAR*...", { parse_mode: 'Markdown' });
                try {
                    await generarTiveCompleto(chatId, pending.datos, null, pending.sourceHash);
                } catch (e) {
                    logError('BOT', '❌', 'Error generando TIVE PARA COMPLETAR', e);
                    bot.sendMessage(chatId, "❌ Error: " + e.message);
                }
            } else {
                userTiveCompletarData.set(chatId, pending);
                const next = pending.missingFields[pending.index];
                await bot.sendMessage(chatId, `✍️ Falta el dato *${next.label}*.\nEnvíalo para continuar.`, { parse_mode: 'Markdown' });
            }
        } else if (state === "awaiting_fisica_pvc_completar_field" && msg.text && (!msg.text.startsWith('/') || msg.text.toLowerCase() === '/ok')) {
            const pending = userFisicaPvcCompletarData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                return bot.sendMessage(chatId, "⚠️ Se perdió el estado de captura. Vuelve a elegir *TARJETA FISICA PVC PARA COMPLETAR*.", { parse_mode: 'Markdown' });
            }
            const current = pending.missingFields[pending.index];
            const rawValue = msg.text.trim();

            if (current.key === 'placa') {
                const respuesta = rawValue.toLowerCase().replace(/^\//,'');
                const esConfirmacion = ['si', 'sí', 'si', 'ok', 'si.', 'sí.', 'yes', 'y'].includes(respuesta);
                if (esConfirmacion && (pending.datos.placaOriginal || pending.datos.placa)) {
                    // Usar el valor ya detectado
                    const placaDetectada = fmtPlaca(pending.datos.placaOriginal || pending.datos.placa);
                    pending.datos.placa = placaDetectada;
                    pending.datos.placaOriginal = pending.datos.placaOriginal || pending.datos.placa;
                } else {
                    // Usar el nuevo valor que escribió el usuario
                    pending.datos.placa = fmtPlaca(rawValue);
                    pending.datos.placaOriginal = rawValue;
                }
            } else {
                pending.datos[current.key] = rawValue;
            }

            pending.index += 1;

            if (pending.index >= pending.missingFields.length) {
                userFisicaPvcCompletarData.delete(chatId);
                userState.delete(chatId);

                const fullTitle = componerTituloCompletar(pending.datos.tituloNo, pending.datos.añoTitulo);
                if (fullTitle) {
                    pending.datos.titulo = fullTitle;
                    pending.datos.tituloNo = fullTitle;
                }
                
                await bot.sendMessage(chatId, "✅ Datos faltantes completados. Generando *TARJETA FISICA PVC PARA COMPLETAR*...", { parse_mode: 'Markdown' });
                try {
                    await generarTIVE(chatId, pending.datos, null, pending.sourceBuffer, { anv: 'TARJETA FISICA ADELANTE.pdf', rev: 'TARJETA FISICA ATRAS.pdf' });
                } catch (e) {
                    logError('BOT', '❌', 'Error generando TARJETA FISICA PVC PARA COMPLETAR', e);
                    bot.sendMessage(chatId, "❌ Error: " + e.message);
                }
            } else {
                userFisicaPvcCompletarData.set(chatId, pending);
                const next = pending.missingFields[pending.index];
                await bot.sendMessage(chatId, `✍️ Falta el dato *${next.label}*.\nEnvíalo para continuar.`, { parse_mode: 'Markdown' });
            }
        } else if (state === "awaiting_tive_completo_field" && msg.text && (!msg.text.startsWith('/') || msg.text.toLowerCase() === '/ok')) {
            const pending = userTiveCompletoData.get(chatId);
            if (!pending) {
                userState.delete(chatId);
                return bot.sendMessage(chatId, "⚠️ Se perdió el estado de captura. Vuelve a elegir *TIVE COMPLETO*.", { parse_mode: 'Markdown' });
            }
            const current = pending.missingFields[pending.index];
            const rawValue = msg.text.trim();

            if (current.key === 'placa') {
                const respuesta = rawValue.toLowerCase().replace(/^\//,'');
                const esConfirmacion = ['si', 'sí', 'si', 'ok', 'si.', 'sí.', 'yes', 'y'].includes(respuesta);
                if (esConfirmacion && (pending.datos.placaOriginal || pending.datos.placa)) {
                    // Usar el valor ya detectado
                    const placaDetectada = fmtPlaca(pending.datos.placaOriginal || pending.datos.placa);
                    pending.datos.placa = placaDetectada;
                    pending.datos.placaOriginal = pending.datos.placaOriginal || pending.datos.placa;
                } else {
                    // Usar el nuevo valor que escribió el usuario
                    pending.datos.placa = fmtPlaca(rawValue);
                    pending.datos.placaOriginal = rawValue;
                }
            } else {
                pending.datos[current.key] = rawValue;
            }

            pending.index += 1;

            if (pending.index >= pending.missingFields.length) {
                userTiveCompletoData.delete(chatId);
                userState.delete(chatId);
                await bot.sendMessage(chatId, "✅ Datos faltantes completados. Generando *TIVE COMPLETO*...", { parse_mode: 'Markdown' });
                try {
                    await generarTiveCompleto(chatId, pending.datos, null, pending.sourceHash);
                } catch (e) {
                    logError('BOT', '❌', 'Error generando TIVE COMPLETO', e);
                    bot.sendMessage(chatId, "❌ Error: " + e.message);
                }
            } else {
                userTiveCompletoData.set(chatId, pending);
                const next = pending.missingFields[pending.index];
                await bot.sendMessage(chatId, `✍️ Falta el dato *${next.label}*.\nEnvíalo para continuar.`, { parse_mode: 'Markdown' });
            }
        } else if (state === "awaiting_qr" && msg.text && !msg.text.startsWith('/')) {
            const customLink = msg.text;
            userState.delete(chatId);
            bot.sendMessage(chatId, `🧾 Procesando datos localmente...`);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                if (!datos.placa) bot.sendMessage(chatId, "⚠️ Advertencia: No se detectó placa.");
                await generarTIVE(chatId, datos, customLink, buffer);
            } catch (e) {
                logError('BOT', '❌', 'Error en flujo custom', e);
                bot.sendMessage(chatId, "❌ Error: " + escapeMarkdown(e.message), { parse_mode: 'Markdown' });
            }
        } else if (state === "awaiting_qr_fisica_pvc" && msg.text && !msg.text.startsWith('/')) {
            const customLink = msg.text;
            userState.delete(chatId);
            bot.sendMessage(chatId, `💳 Procesando datos localmente...`);
            try {
                const datos = await extraerConIA(buffer, userPdfNames.get(chatId));
                if (!datos.placa) bot.sendMessage(chatId, "⚠️ Advertencia: No se detectó placa.");
                await generarTIVE(chatId, datos, customLink, buffer, { anv: 'TARJETA FISICA ADELANTE.pdf', rev: 'TARJETA FISICA ATRAS.pdf' });
            } catch (e) {
                logError('BOT', '❌', 'Error en flujo custom fisica pvc', e);
                bot.sendMessage(chatId, "❌ Error: " + escapeMarkdown(e.message), { parse_mode: 'Markdown' });
            }
        } else if (state === "awaiting_plate_for_qr") {
            const plate = msg.text.toUpperCase().trim();
            userState.delete(chatId);

            bot.sendMessage(chatId, `⏳ Generando PDF con QR para la placa *${plate}*...`, { parse_mode: 'Markdown' });
            try {
                const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
                await finalizarInsercionQR(chatId, buffer, plate, hash);
            } catch (e) {
                bot.sendMessage(chatId, `❌ Error: ${e.message}`);
            }
        } else if (state === "awaiting_antigua_placa" && msg.text) {
            userAntiguaData.get(chatId).placa = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_clase");
            bot.sendMessage(chatId, "🛵 Introduce la **CLASE** (ej: MOTOCICLETA):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_clase" && msg.text) {
            userAntiguaData.get(chatId).clase = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_placa_sede");
            bot.sendMessage(chatId, "📍 Introduce la **PLACA SEDE** (ej: TARAPOTO):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_placa_sede" && msg.text) {
            userAntiguaData.get(chatId).placaSede = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_zona");
            bot.sendMessage(chatId, "🌏 Introduce la **ZONA** (ej: III):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_zona" && msg.text) {
            userAntiguaData.get(chatId).zona = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_sede");
            bot.sendMessage(chatId, "📍 Introduce la **SEDE** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_sede" && msg.text) {
            userAntiguaData.get(chatId).sede = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_reparticion");
            bot.sendMessage(chatId, "📂 Introduce la **REPARTICIÓN** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_reparticion" && msg.text) {
            userAntiguaData.get(chatId).reparticion = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_sede_domicilio");
            bot.sendMessage(chatId, "📍 Introduce la **SEDE DOMICILIO** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_sede_domicilio" && msg.text) {
            userAntiguaData.get(chatId).sedeDomicilio = msg.text.trim().toUpperCase();
            userState.set(chatId, "awaiting_antigua_domicilio");
            bot.sendMessage(chatId, "🏠 Introduce la **DIRECCIÓN (DOMICILIO)** (o /skip):", { parse_mode: 'Markdown' });
        } else if (state === "awaiting_antigua_domicilio" && msg.text) {
            let domicilio = msg.text.trim();
            if (domicilio.startsWith('/skip')) domicilio = "";
            const data = userAntiguaData.get(chatId);
            data.domicilio = domicilio;

            const checkIA = async () => {
                if (!data.datosIA) {
                    const status = await bot.sendMessage(chatId, "⏳ *Esperando que la IA detecte la fecha...*", { parse_mode: 'Markdown' });
                    while (!data.datosIA) { await new Promise(r => setTimeout(r, 1000)); }
                    bot.deleteMessage(chatId, status.message_id).catch(() => { });
                }
                const fechaSugerida = data.datosIA.fechaAsiento || data.datosIA.fechaInferior || "";
                userState.set(chatId, "awaiting_antigua_fecha");
                bot.sendMessage(chatId,
                    `✅ **Datos Registrados.**\n\n` +
                    `📅 **Fecha Detectada:** \`${fechaSugerida}\`\n\n` +
                    `Introduce **LA FECHA** (o escribe /ok para usar la detectada):`,
                    { parse_mode: 'Markdown' }
                );
            };
            checkIA();
        } else if (state === "awaiting_antigua_fecha" && msg.text) {
            let fecha = msg.text.trim();
            const data = userAntiguaData.get(chatId);
            if (fecha.toLowerCase() === "/ok" && data.datosIA) {
                fecha = data.datosIA.fechaAsiento || data.datosIA.fechaInferior || "";
            }
            data.fecha = fecha;
            userState.delete(chatId);

            bot.sendMessage(chatId, `✨ *Generando Tarjeta Antigua...*`, { parse_mode: 'Markdown' });

            try {
                const datos = data.datosIA || await extraerConIA_Antigua(buffer);
                datos.controlAnverso = data.controlAnverso;
                datos.controlReverso = data.controlReverso;
                datos.titulo = data.exp;
                datos.partida = fecha;
                datos.fechaPropiedad = fecha;
                datos.fechaInferior = fecha;
                datos.zona = data.zona;
                datos.sede = data.sede;
                datos.reparticion = data.reparticion;
                if (data.placa) datos.placa = fmtPlaca(data.placa);
                if (data.clase) datos.clase = data.clase;
                if (data.placaSede) datos.placaSede = data.placaSede;
                if (data.sedeDomicilio) datos.sedeDomicilio = data.sedeDomicilio;
                if (data.domicilio) datos.domicilio = data.domicilio;

                await generarTarjetaAntigua(chatId, datos, buffer);
                userAntiguaData.delete(chatId);
            } catch (e) {
                logError('BOT', '❌', 'Error final en tarjeta antigua', e);
                bot.sendMessage(chatId, "❌ Error: " + e.message);
            }
        }
    });
};
