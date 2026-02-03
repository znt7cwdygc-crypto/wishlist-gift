// Simple server launcher with logging
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'server.log');
const pidFile = path.join(__dirname, 'server.pid');

// Clear previous log
if (fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
}

console.log('🚀 Starting server...');
console.log(`📝 Log file: ${logFile}`);

const server = spawn('node', ['server/index.js'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe']
});

// Save PID
fs.writeFileSync(pidFile, server.pid.toString());
console.log(`✅ Server started with PID: ${server.pid}`);

// Log output
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

server.stdout.on('data', (data) => {
    const message = data.toString();
    process.stdout.write(message);
    logStream.write(message);
});

server.stderr.on('data', (data) => {
    const message = data.toString();
    process.stderr.write(message);
    logStream.write(message);
});

server.on('close', (code) => {
    console.log(`\n⚠️ Server exited with code ${code}`);
    logStream.end();
    if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping server...');
    server.kill('SIGTERM');
    process.exit(0);
});

console.log('\n🌐 Server should be available at: http://localhost:3000');
console.log('📋 To view logs: tail -f server.log');
console.log('🛑 Press Ctrl+C to stop\n');


