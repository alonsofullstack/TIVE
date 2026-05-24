function _ts() {
    const d = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function logInfo(mod, emoji, msg, extra = null) {
    let extraStr = '';
    if (extra) {
        if (typeof extra === 'string') {
            extraStr = ' | ' + extra;
        } else {
            const entries = Object.entries(extra).map(([k, v]) => {
                const valStr = String(v);
                const truncated = valStr.length > 50 ? valStr.substring(0, 50) + '...' : valStr;
                return `${k}=${truncated}`;
            });
            extraStr = ' | ' + entries.join(', ');
        }
    }
    console.log(`[${_ts()}] [${mod}] ${emoji} ${msg}${extraStr}`);
}

function logError(mod, emoji, msg, err = null) {
    const detail = err ? ` | ${err.message || err}` : '';
    const stack = err && err.stack ? '\n' + err.stack : '';
    console.error(`[${_ts()}] [${mod}] ${emoji} ${msg}${detail}${stack}`);
}

function logTimer(mod, label) {
    const start = Date.now();
    logInfo(mod, '⏱️', `${label} — iniciado`);
    return {
        end: (extraMsg = '') => {
            const ms = Date.now() - start;
            const sec = (ms / 1000).toFixed(2);
            logInfo(mod, '⏱️', `${label} — completado en ${sec}s (${ms}ms)${extraMsg ? ' | ' + extraMsg : ''}`);
            return ms;
        }
    };
}

module.exports = {
    _ts,
    logInfo,
    logError,
    logTimer
};
