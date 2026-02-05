const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const projectRoot = path.join(__dirname, '..');

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Увеличен лимит для base64-фото (до 50MB — base64 ~33% больше оригинала)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ответы JSON в UTF-8 (кириллица в названиях товаров и т.д.)
app.set('json content type', 'application/json; charset=utf-8');

// Static files — без кэша, чтобы после деплоя дарители видели актуальную версию
app.use(express.static(path.join(__dirname, '../public'), {
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
    }
}));

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
app.use('/api/stars', require('./routes/stars'));

const adminAuth = require('./middleware/admin-auth');

// Админ: вход только по особой ссылке + пароль
app.get('/manage', (req, res) => {
    if (!adminAuth.checkEntryKey(req.query.key)) {
        return res.status(404).send('Not found');
    }
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Вход в админку</title>
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body>
  <div class="container" style="max-width: 400px; margin: 4rem auto; padding: 2rem;">
    <h1 class="mb-3">🔐 Вход в админку</h1>
    <form id="login-form" method="post" action="/api/admin/login">
      <input type="hidden" name="key" value="${(req.query.key || '').replace(/"/g, '&quot;')}">
      <div class="form-group mb-3">
        <label class="form-label">Пароль</label>
        <input type="password" name="password" class="form-input" placeholder="Пароль" required autofocus>
      </div>
      <button type="submit" class="btn btn-primary w-full">Войти</button>
    </form>
    <p id="err" class="text-secondary mt-2" style="display:none;"></p>
  </div>
  <script>
    document.getElementById('login-form').onsubmit = function(e) {
      e.preventDefault();
      var form = e.target;
      var err = document.getElementById('err');
      err.style.display = 'none';
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: form.key.value, password: form.password.value })
      }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(o) {
          if (o.ok && o.data.success) window.location.href = '/admin';
          else { err.textContent = o.data.error || 'Неверный пароль'; err.style.display = 'block'; }
        }).catch(function() { err.textContent = 'Ошибка сети'; err.style.display = 'block'; });
    };
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

app.post('/api/admin/login', (req, res) => {
    const { key, password } = req.body || {};
    if (!adminAuth.checkEntryKey(key)) {
        return res.status(400).json({ error: 'Неверная ссылка' });
    }
    if (!adminAuth.checkPassword(password)) {
        return res.status(401).json({ error: 'Неверный пароль' });
    }
    adminAuth.setAdminCookie(res);
    res.json({ success: true });
});

app.use('/api/admin', adminAuth.requireAdminSession, require('./routes/admin'));

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

app.get('/stars', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/stars.html'));
});

// Legacy pages
app.get('/model', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/model.html'));
});

app.get('/donor/:publicLink?', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/donor.html'));
});

app.get('/admin', adminAuth.requireAdminSession, (req, res) => {
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

function startServer() {
    const sslKeyPath = process.env.SSL_KEY_PATH || path.join(projectRoot, 'ssl', 'key.pem');
    const sslCertPath = process.env.SSL_CERT_PATH || path.join(projectRoot, 'ssl', 'cert.pem');
    const useHttps = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

    const onListen = async () => {
        const protocol = useHttps ? 'https' : 'http';
        console.log(`🚀 Server running at ${protocol}://${host}:${PORT}`);
        console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);

        const { getBotToken } = require('./bot-token');
        const botToken = getBotToken();

        if (botToken) {
            const telegramPolling = require('./telegram-polling');
            telegramPolling.setOrdersRouter(ordersRouter);
            telegramPolling.setProcessUpdate(paymentsRouter.processUpdate);
            telegramPolling.startPolling();
        } else {
            console.log('ℹ️ BOT_TOKEN не задан — Stars и авторизация через бота недоступны');
        }
    };

    if (useHttps) {
        const options = {
            key: fs.readFileSync(sslKeyPath),
            cert: fs.readFileSync(sslCertPath)
        };
        https.createServer(options, app).listen(PORT, host, onListen);
    } else {
        app.listen(PORT, host, onListen);
    }
}

startServer();

