/**
 * Fuente única de precios — consultas e imprenta.
 */
const { categories } = require('./commands/cmds');

const COMMAND_PRICES = {};
for (const catKey in categories) {
    const cat = categories[catKey];
    if (cat && Array.isArray(cat.cmds)) {
        for (const item of cat.cmds) {
            if (item.cmd && typeof item.price === 'number') {
                const matches = item.cmd.match(/\/([a-zA-Z0-9_]+)/g);
                if (matches) {
                    for (const match of matches) {
                        COMMAND_PRICES[match.toLowerCase()] = item.price;
                    }
                }
            }
        }
    }
}

const EXTRA_COMMAND_PRICES = {
    '/dnis': 1, '/dnib': 2, '/fab': 30, '/movn': 5, '/movd': 5, '/bitx': 5,
    '/rucn': 3, '/rucd': 3, '/revtecpdf': 5, '/tiv': 20, '/c4': 5,
};

const COMMAND_PRICE_OVERRIDES = {
    '/const': 30,
};

const IMPRENTA_COSTS = {
    ask_qr:                           80,
    use_official:                     80,
    gen_tive_completo:                80,
    tive_completo_con_anio:           80,
    tive_completo_sin_anio:           80,
    gen_tive_completar:               80,
    tive_completar_con_anio:          80,
    tive_completar_sin_anio:          80,
    gen_tarjeta_fisica_pvc:           80,
    gen_tarjeta_fisica_pvc_completar: 80,
    gen_antigua:                      80,
    insert_qr_only:                   80,
};

function resolveCommandPrice(matchedCmd) {
    const cmd = (matchedCmd || '').toLowerCase();
    if (COMMAND_PRICE_OVERRIDES[cmd] !== undefined) return COMMAND_PRICE_OVERRIDES[cmd];
    if (COMMAND_PRICES[cmd] !== undefined) return COMMAND_PRICES[cmd];
    if (EXTRA_COMMAND_PRICES[cmd] !== undefined) return EXTRA_COMMAND_PRICES[cmd];
    return 1;
}

function getImprentaCost(operation) {
    return IMPRENTA_COSTS[operation] ?? 80;
}

module.exports = {
    COMMAND_PRICES,
    EXTRA_COMMAND_PRICES,
    COMMAND_PRICE_OVERRIDES,
    IMPRENTA_COSTS,
    resolveCommandPrice,
    getImprentaCost,
};