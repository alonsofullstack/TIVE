module.exports = {
    registerCommands(bot, state, deps) {
        bot.onText(/\/ping/, (msg) => {
            bot.sendMessage(msg.chat.id, "🏓 ¡PONG! El bot está vivo y escuchando.");
        });
    }
};
