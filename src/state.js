const userPdfs = new Map();
const userPdfNames = new Map();
const userState = new Map();
const userAntiguaData = new Map();
const userTiveCompletoData = new Map();
const userTiveCompletarData = new Map();
const userFirmaPendienteData = new Map();
const userFisicaPvcCompletarData = new Map();
const userPendingCharge = new Map();

const pdfTimers = new Map();
const stateTimers = new Map();

const PDF_TTL_MS = parseInt(process.env.PDF_TTL_MS || '1800000', 10);
const STATE_TTL_MS = parseInt(process.env.STATE_TTL_MS || '1800000', 10);

let onChatExpire = null;

function setOnChatExpire(handler) {
    onChatExpire = handler;
}

function scheduleStateExpiry(chatId) {
    if (stateTimers.has(chatId)) clearTimeout(stateTimers.get(chatId));
    stateTimers.set(chatId, setTimeout(() => {
        expireChatState(chatId);
    }, STATE_TTL_MS));
}

async function expireChatState(chatId) {
    if (onChatExpire) {
        try { await onChatExpire(chatId); } catch (_) {}
    }
    userState.delete(chatId);
    userAntiguaData.delete(chatId);
    userTiveCompletoData.delete(chatId);
    userTiveCompletarData.delete(chatId);
    userFirmaPendienteData.delete(chatId);
    userFisicaPvcCompletarData.delete(chatId);
    stateTimers.delete(chatId);
}

function setUserPdf(chatId, buffer, fileName = '') {
    userPdfs.set(chatId, buffer);
    userPdfNames.set(chatId, fileName || '');

    if (pdfTimers.has(chatId)) clearTimeout(pdfTimers.get(chatId));
    pdfTimers.set(chatId, setTimeout(() => {
        userPdfs.delete(chatId);
        userPdfNames.delete(chatId);
        userPendingCharge.delete(chatId);
        pdfTimers.delete(chatId);
    }, PDF_TTL_MS));

    scheduleStateExpiry(chatId);
}

function touchChatState(chatId) {
    if (userState.has(chatId) || userAntiguaData.has(chatId) ||
        userTiveCompletoData.has(chatId) || userTiveCompletarData.has(chatId) ||
        userFirmaPendienteData.has(chatId) || userFisicaPvcCompletarData.has(chatId)) {
        scheduleStateExpiry(chatId);
    }
}

function clearUserPdf(chatId) {
    userPdfs.delete(chatId);
    userPdfNames.delete(chatId);
    if (pdfTimers.has(chatId)) {
        clearTimeout(pdfTimers.get(chatId));
        pdfTimers.delete(chatId);
    }
}

function clearAllChatState(chatId) {
    clearUserPdf(chatId);
    userPendingCharge.delete(chatId);
    if (stateTimers.has(chatId)) {
        clearTimeout(stateTimers.get(chatId));
        stateTimers.delete(chatId);
    }
    userState.delete(chatId);
    userAntiguaData.delete(chatId);
    userTiveCompletoData.delete(chatId);
    userTiveCompletarData.delete(chatId);
    userFirmaPendienteData.delete(chatId);
    userFisicaPvcCompletarData.delete(chatId);
}

module.exports = {
    userPdfs, userPdfNames, userState, userAntiguaData,
    userTiveCompletoData, userTiveCompletarData, userFirmaPendienteData,
    userFisicaPvcCompletarData, userPendingCharge,
    setUserPdf, clearUserPdf, clearAllChatState, touchChatState,
    setOnChatExpire, scheduleStateExpiry, PDF_TTL_MS, STATE_TTL_MS,
};