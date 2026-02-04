#!/usr/bin/env node
/**
 * Сборка для Vercel: подставляет API_URL в public/js/config.js
 * Переменная: VITE_API_URL или API_URL (полный URL бэкенда, например https://api.example.com/api)
 */
const fs = require('fs');
const path = require('path');

const apiUrl = process.env.VITE_API_URL || process.env.API_URL || '';
const content = apiUrl
  ? `// Generated for Vercel — API: ${apiUrl}\nwindow.API_BASE_URL = '${apiUrl.replace(/'/g, "\\'")}';\n`
  : `// Default (local)\nwindow.API_BASE_URL = window.API_BASE_URL || '/api';\n`;

const outPath = path.join(__dirname, '../public/js/config.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('config.js written, API_BASE_URL:', apiUrl || '/api (default)');
