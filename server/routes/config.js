/**
 * Публичная конфигурация для фронтенда (URL приложения, бот)
 */
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const appUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
    res.json({
        appUrl,
        botUsername: process.env.BOT_USERNAME || 'WishlistGiftBot',
        shareLink: `https://t.me/${process.env.BOT_USERNAME || 'WishlistGiftBot'}?start=me`
    });
});

module.exports = router;
