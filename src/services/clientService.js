/**
 * clientService.js
 * Gestión de clientes y créditos — persistencia en MySQL
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { logInfo, logError } = require('../utils/logger');

// ── Costos por operación ────────────────────────────────────────────────────
const CREDIT_COSTS = {
    ask_qr:                           1,
    use_official:                     1,
    gen_tive_completo:                1,
    tive_completo_con_anio:           1,
    tive_completo_sin_anio:           1,
    gen_tive_completar:               1,
    tive_completar_con_anio:          1,
    tive_completar_sin_anio:          1,
    gen_tarjeta_fisica_pvc:           1,
    gen_tarjeta_fisica_pvc_completar: 1,
    gen_antigua:                      1,
    insert_qr_only:                  80,
    consulta_grupo:                   1,
};

// ── Pool de conexiones ──────────────────────────────────────────────────────
let pool = null;

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host:               process.env.DB_HOST     || 'localhost',
            port:               parseInt(process.env.DB_PORT || '3306', 10),
            database:           process.env.DB_NAME     || 'mysql',
            user:               process.env.DB_USER     || 'mysql',
            password:           process.env.DB_PASSWORD || '',
            waitForConnections: true,
            connectionLimit:    10,
            queueLimit:         0,
            timezone:           '+00:00',
        });
    }
    return pool;
}

// ── Inicialización de tabla ─────────────────────────────────────────────────
async function initDB() {
    const db = getPool();
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clients (
            user_id       BIGINT       NOT NULL PRIMARY KEY,
            username      VARCHAR(64)  DEFAULT NULL,
            first_name    VARCHAR(128) NOT NULL DEFAULT 'Sin nombre',
            credits       INT          NOT NULL DEFAULT 0,
            total_used    INT          NOT NULL DEFAULT 0,
            registered_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_activity DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    logInfo('DB', '✅', 'Tabla clients lista');
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Registra un nuevo cliente. Si ya existe devuelve alreadyExists: true.
 */
async function registerClient(userId, username, firstName) {
    const db = getPool();
    const id = BigInt(userId);

    const [rows] = await db.execute(
        'SELECT * FROM clients WHERE user_id = ?', [id]
    );
    if (rows.length > 0) {
        return { ok: false, alreadyExists: true, client: _row(rows[0]) };
    }

    await db.execute(
        'INSERT INTO clients (user_id, username, first_name, credits, total_used) VALUES (?, ?, ?, 0, 0)',
        [id, username || null, firstName || 'Sin nombre']
    );
    const [newRows] = await db.execute('SELECT * FROM clients WHERE user_id = ?', [id]);
    return { ok: true, client: _row(newRows[0]) };
}

/**
 * Devuelve el cliente o null si no existe.
 */
async function getClient(userId) {
    const db = getPool();
    const [rows] = await db.execute(
        'SELECT * FROM clients WHERE user_id = ?', [BigInt(userId)]
    );
    return rows.length > 0 ? _row(rows[0]) : null;
}

/**
 * Devuelve todos los clientes como array.
 */
async function getAllClients() {
    const db = getPool();
    const [rows] = await db.execute(
        'SELECT * FROM clients ORDER BY credits DESC, registered_at ASC'
    );
    return rows.map(_row);
}

/**
 * Busca un cliente por userId o username (sin @).
 */
async function findClientByRef(ref) {
    const db = getPool();
    const clean = ref.replace(/^@/, '');

    // Intentar por ID numérico
    if (/^\d+$/.test(clean)) {
        const [rows] = await db.execute(
            'SELECT * FROM clients WHERE user_id = ?', [BigInt(clean)]
        );
        if (rows.length > 0) return _row(rows[0]);
    }

    // Por username (case-insensitive)
    const [rows] = await db.execute(
        'SELECT * FROM clients WHERE LOWER(username) = LOWER(?)', [clean]
    );
    return rows.length > 0 ? _row(rows[0]) : null;
}

/**
 * Agrega créditos a un cliente existente.
 */
async function addCredits(userId, amount) {
    const db = getPool();
    const id = BigInt(userId);
    if (amount <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0.' };

    const [rows] = await db.execute('SELECT credits FROM clients WHERE user_id = ?', [id]);
    if (rows.length === 0) return { ok: false, error: 'Cliente no registrado.' };

    await db.execute(
        'UPDATE clients SET credits = credits + ? WHERE user_id = ?', [amount, id]
    );
    const [updated] = await db.execute('SELECT credits FROM clients WHERE user_id = ?', [id]);
    return { ok: true, credits: updated[0].credits };
}

/**
 * Quita créditos a un cliente (mínimo 0).
 */
async function removeCredits(userId, amount) {
    const db = getPool();
    const id = BigInt(userId);
    if (amount <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0.' };

    const [rows] = await db.execute('SELECT credits FROM clients WHERE user_id = ?', [id]);
    if (rows.length === 0) return { ok: false, error: 'Cliente no registrado.' };

    await db.execute(
        'UPDATE clients SET credits = GREATEST(0, credits - ?) WHERE user_id = ?', [amount, id]
    );
    const [updated] = await db.execute('SELECT credits FROM clients WHERE user_id = ?', [id]);
    return { ok: true, credits: updated[0].credits };
}

/**
 * Intenta consumir créditos para una operación.
 * Usa transacción para evitar race conditions.
 */
async function consumeCredits(userId, operation) {
    const db = getPool();
    const id = BigInt(userId);
    const cost = CREDIT_COSTS[operation] ?? 1;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.execute(
            'SELECT credits FROM clients WHERE user_id = ? FOR UPDATE', [id]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return { ok: false, error: 'no_registered' };
        }

        const current = rows[0].credits;
        if (current < cost) {
            await conn.rollback();
            return { ok: false, error: 'no_credits', cost, remaining: current };
        }

        await conn.execute(
            'UPDATE clients SET credits = credits - ?, total_used = total_used + ?, last_activity = NOW() WHERE user_id = ?',
            [cost, cost, id]
        );
        await conn.commit();

        const [updated] = await db.execute('SELECT credits FROM clients WHERE user_id = ?', [id]);
        return { ok: true, remaining: updated[0].credits, cost };

    } catch (err) {
        await conn.rollback();
        logError('DB', '❌', 'Error en consumeCredits', err);
        return { ok: false, error: err.message };
    } finally {
        conn.release();
    }
}

/**
 * Actualiza username/firstName si cambiaron.
 */
async function touchClient(userId, username, firstName) {
    const db = getPool();
    try {
        await db.execute(
            'UPDATE clients SET username = ?, first_name = ?, last_activity = NOW() WHERE user_id = ?',
            [username || null, firstName || 'Sin nombre', BigInt(userId)]
        );
    } catch (err) {
        // No crítico — ignorar silenciosamente
    }
}

// ── Helper interno ──────────────────────────────────────────────────────────
function _row(r) {
    return {
        userId:       String(r.user_id),
        username:     r.username     || null,
        firstName:    r.first_name   || 'Sin nombre',
        credits:      r.credits,
        totalUsed:    r.total_used,
        registeredAt: r.registered_at instanceof Date ? r.registered_at.toISOString() : r.registered_at,
        lastActivity: r.last_activity instanceof Date ? r.last_activity.toISOString() : r.last_activity,
    };
}

module.exports = {
    initDB,
    registerClient,
    getClient,
    getAllClients,
    findClientByRef,
    addCredits,
    removeCredits,
    consumeCredits,
    touchClient,
    CREDIT_COSTS,
};
