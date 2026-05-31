const { logInfo, logError } = require('../utils/logger');
const { QUERY_DELAY: CONFIG_QUERY_DELAY } = require('../config');

/**
 * Sistema de colas para procesar comandos de Telegram secuencialmente
 * Evita saturación y errores procesando comandos uno a la vez con delay
 * Diseñado para puente Telegram con límite de spam de 15 segundos
 */

// Cola global para procesamiento secuencial (todas las consultas pasan por el puente)
const globalQueue = [];
let isProcessingGlobal = false;

// Configuración de delay (en milisegundos) - desde config.js
let QUERY_DELAY = CONFIG_QUERY_DELAY || 16000; // 16 segundos para evitar límite de spam de 15 segundos

/**
 * Agrega una tarea a la cola global con delay
 * @param {Function} task - Función a ejecutar
 * @param {Object} metadata - Información de la tarea
 */
async function addToGlobalQueue(task, metadata = {}) {
    return new Promise((resolve, reject) => {
        const queueItem = {
            task,
            metadata,
            resolve,
            reject,
            timestamp: Date.now()
        };
        
        globalQueue.push(queueItem);
        logInfo('QUEUE', '📥', 'Tarea agregada a cola global', {
            posicion: globalQueue.length,
            metadata: JSON.stringify(metadata),
            esperaEstimada: `${globalQueue.length * (QUERY_DELAY / 1000)}s`
        });
        
        processGlobalQueue();
    });
}

/**
 * Función de delay
 * @param {number} ms - Milisegundos a esperar
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Procesa la cola global secuencialmente con delay entre consultas
 */
async function processGlobalQueue() {
    if (isProcessingGlobal || globalQueue.length === 0) {
        return;
    }
    
    isProcessingGlobal = true;
    
    while (globalQueue.length > 0) {
        const queueItem = globalQueue.shift();
        const { task, metadata, resolve, reject } = queueItem;
        
        try {
            logInfo('QUEUE', '⚙️', 'Procesando tarea de cola global', {
                restantes: globalQueue.length,
                metadata: JSON.stringify(metadata)
            });
            
            const result = await task();
            resolve(result);
            
            logInfo('QUEUE', '✅', 'Tarea completada exitosamente', {
                restantes: globalQueue.length,
                siguienteConsultaEn: `${QUERY_DELAY / 1000}s`
            });
            
            // Delay entre consultas para evitar límite de spam
            if (globalQueue.length > 0) {
                logInfo('QUEUE', '⏱️', `Esperando ${QUERY_DELAY / 1000}s antes de la siguiente consulta...`);
                await delay(QUERY_DELAY);
            }
        } catch (error) {
            logError('QUEUE', '❌', 'Error procesando tarea', error);
            reject(error);
            
            // Incluso si hay error, esperar antes de la siguiente consulta
            if (globalQueue.length > 0) {
                await delay(QUERY_DELAY);
            }
        }
    }
    
    isProcessingGlobal = false;
}

/**
 * Agrega una tarea a la cola (alias de addToGlobalQueue para compatibilidad)
 * @param {Function} task - Función a ejecutar
 * @param {Object} metadata - Información de la tarea
 */
async function addToQueue(task, metadata = {}) {
    return addToGlobalQueue(task, metadata);
}

/**
 * Obtiene estadísticas de la cola
 */
function getQueueStats() {
    return {
        global: {
            pending: globalQueue.length,
            processing: isProcessingGlobal,
            delaySegundos: QUERY_DELAY / 1000,
            esperaTotalEstimada: `${globalQueue.length * (QUERY_DELAY / 1000)}s`
        }
    };
}

/**
 * Establece el delay entre consultas
 * @param {number} ms - Milisegundos de delay
 */
function setQueryDelay(ms) {
    global.QUERY_DELAY = ms;
    logInfo('QUEUE', '⚙️', `Delay actualizado a ${ms}ms (${ms / 1000}s)`);
}

module.exports = {
    addToGlobalQueue,
    addToQueue,
    getQueueStats,
    setQueryDelay,
    QUERY_DELAY
};
