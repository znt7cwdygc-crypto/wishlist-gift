/**
 * Единый источник токена бота: везде в приложении используется только он.
 * В .env задайте BOT_TOKEN (или TELEGRAM_BOT_TOKEN).
 */
function getBotToken() {
    return process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
}

module.exports = { getBotToken };
