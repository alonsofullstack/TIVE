/**
 * clientService.js
 * Gestión de clientes y créditos — persistencia en JSON local
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'clients.json');

// ── Costos por operación ────────────────────────────────────────────────────
const CREDIT_COSTS = {
    ask_qr:                          1,   // Fotos TIVE PVC
    gen_tive_completo:               1,   // TIVE Completo
    gen_tive_completar:              1,   // TIVE Para Completar
    gen_tarjeta_fisica_pvc:          1,   // Tarjeta Física PVC
    gen_tarjeta_fisica_pvc_completar:1,   // Tarjeta Física PVC Para Completar
    gen_antigua:                     1,   // Tarjeta Antigua
    insert_qr_only:                  1,   // Insertar QR en PDF Original
    consulta_grupo:                  1,   // Consulta al grupo (comandos externos)
};

// ── Helpers de persistencia ─────────────────────────────────────────────────
function _load() {
    try {
        if (!fs.existsSync(DB_PATH)) return {};
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function _save(db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Registra un nuevo cliente. Si ya existe devuelve false.
 * @returns {{ ok: boolean, client?: object, alreadyExists?: boolean }}
 */
function registerClient(userId, username, firstName) {
    const db = _load();
    const id = String(userId);
    if (db[id]) return { ok: false, alreadyExists: true, client: db[id] };

    db[id] = {
        userId:    id,
        username:  username  || null,
        firstName: firstName || 'Sin nombre',
        credits:   0,
        totalUsed: 0,
        registeredAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
    };
    _save(db);
    return { ok: true, client: db[id] };
}

/**
 * Devuelve el cliente o null si no existe.
 */
function getClient(userId) {
    const db = _load();
    return db[String(userId)] || null;
}

/**
 * Devuelve todos los clientes como array.
 */
function getAllClients() {
    const db = _load();
    return Object.values(db);
}

/**
 * Agrega créditos a un cliente existente.
 * @returns {{ ok: boolean, credits?: number, error?: string }}
 */
function addCredits(userId, amount) {
    const db = _load();
    const id = String(userId);
    if (!db[id]) return { ok: false, error: 'Cliente no registrado.' };
    if (amount <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0.' };

    db[id].credits += amount;
    _save(db);
    return { ok: true, credits: db[id].credits };
}

/**
 * Quita créditos a un cliente existente (admin puede forzar negativo).
 * @returns {{ ok: boolean, credits?: number, error?: string }}
 */
function removeCredits(userId, amount) {
    const db = _load();
    const id = String(userId);
    if (!db[id]) return { ok: false, error: 'Cliente no registrado.' };
    if (amount <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0.' };

    db[id].credits = Math.max(0, db[id].credits - amount);
    _save(db);
    return { ok: true, credits: db[id].credits };
}

/**
 * Intenta consumir créditos para una operación.
 * @returns {{ ok: boolean, remaining?: number, cost?: number, error?: string }}
 */
function consumeCredits(userId, operation) {
    const db = _load();
    const id = String(userId);
    if (!db[id]) return { ok: false, error: 'no_registered' };

    const cost = CREDIT_COSTS[operation] ?? 1;
    if (db[id].credits < cost) return { ok: false, error: 'no_credits', cost, remaining: db[id].credits };

    db[id].credits   -= cost;
    db[id].totalUsed += cost;
    db[id].lastActivity = new Date().toISOString();
    _save(db);
    return { ok: true, remaining: db[id].credits, cost };
}

/**
 * Actualiza username/firstName si cambiaron.
 */
function touchClient(userId, username, firstName) {
    const db = _load();
    const id = String(userId);
    if (!db[id]) return;
    db[id].username     = username  || db[id].username;
    db[id].firstName    = firstName || db[id].firstName;
    db[id].lastActivity = new Date().toISOString();
    _save(db);
}

module.exports = {
    registerClient,
    getClient,
    getAllClients,
    addCredits,
    removeCredits,
    consumeCredits,
    touchClient,
    CREDIT_COSTS,
};
