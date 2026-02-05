/**
 * Публичная конфигурация для фронтенда (URL приложения, бот)
 */
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (req.protocol + '://' + req.get('host'));
    const bot = process.env.BOT_USERNAME || 'WishlistttGiftBot';
    res.json({
        appUrl,
        botUsername: bot,
        // Прямая ссылка на Mini App — открывает подарки сразу, даже если даритель бота не открывал
        shareLink: `https://t.me/${bot}/app?startapp=me`
    });
});

module.exports = router;
