const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Увеличен лимит для base64-фото (до 50MB — base64 ~33% больше оригинала)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Log API requests for debugging (before routes)
app.use('/api', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});

// API Routes
app.use('/api/config', require('./routes/config'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/models', require('./routes/models'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/access', require('./routes/access'));
const ordersRouter = require('./routes/orders');
app.use('/api/orders', ordersRouter);
const paymentsRouter = require('./routes/payments');
paymentsRouter.setOrdersRouter(ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', require('./routes/admin'));

// Frontend Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Новые минималистичные страницы
app.get('/gift', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/gift.html'));
});

app.get('/gift/:slug?', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/gift.html'));
});

app.get('/cabinet', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/cabinet.html'));
});

// Legacy pages
app.get('/model', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/model.html'));
});

app.get('/donor/:publicLink?', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/donor.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// 404 handler - must be before error handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handling - must be last
app.use((err, req, res, next) => {
    const msg = err && (err.message || String(err));
    const isPayloadTooLarge = err && (err.type === 'entity.too.large' || msg && msg.toLowerCase().includes('too large'));
    
    console.error('❌ Express Error:', msg);
    if (err && err.stack) console.error('❌ Stack:', err.stack);
    
    if (res.headersSent) return next(err);
    
    if (isPayloadTooLarge) {
        return res.status(413).json({ error: 'Фото слишком большие. Выберите изображения меньшего размера.' });
    }
    
    res.status(500).json({ 
        error: msg || 'Something went wrong!'
    });
});

const host = process.env.HOST || '0.0.0.0';
app.listen(PORT, host, () => {
    console.log(`🚀 Server running at http://${host}:${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

