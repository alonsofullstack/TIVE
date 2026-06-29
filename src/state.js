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
const PDF_TTL_MS = parseInt(process.env.PDF_TTL_MS || '1800000', 10); // 30 min por defecto

function setUserPdf(chatId, buffer, fileName = '') {
    userPdfs.set(chatId, buffer);
    userPdfNames.set(chatId, fileName);

    if (pdfTimers.has(chatId)) {
        clearTimeout(pdfTimers.get(chatId));
    }

    pdfTimers.set(chatId, setTimeout(() => {
        userPdfs.delete(chatId);
        userPdfNames.delete(chatId);
        userPendingCharge.delete(chatId);
        pdfTimers.delete(chatId);
    }, PDF_TTL_MS));
}

function clearUserPdf(chatId) {
    userPdfs.delete(chatId);
    userPdfNames.delete(chatId);
    userPendingCharge.delete(chatId);

    if (pdfTimers.has(chatId)) {
        clearTimeout(pdfTimers.get(chatId));
        pdfTimers.delete(chatId);
    }
}

module.exports = {
    userPdfs, userPdfNames, userState, userAntiguaData,
    userTiveCompletoData, userTiveCompletarData, userFirmaPendienteData,
    userFisicaPvcCompletarData, userPendingCharge,
    setUserPdf, clearUserPdf, PDF_TTL_MS,
};