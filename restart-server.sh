#!/bin/bash
cd "$(dirname "$0")"

echo "🛑 Stopping server..."
pkill -f "node.*server/index.js" 2>/dev/null
sleep 1

echo "🚀 Starting server..."
node server/index.js > server.log 2>&1 &
SERVER_PID=$!

sleep 2

if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully!"
    echo "📝 PID: $SERVER_PID"
    echo "🌐 URL: http://localhost:3000"
    echo "📋 Logs: tail -f server.log"
else
    echo "❌ Server failed to start. Check server.log for errors:"
    tail -20 server.log
fi


