#!/bin/bash
echo "🔍 Checking server status..."
sleep 2

# Check if process is running
if pgrep -f "node server/index.js" > /dev/null; then
    echo "✅ Server process is running"
else
    echo "❌ Server process not found"
fi

# Check if port is listening
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✅ Port 3000 is in use"
    lsof -i :3000 | head -2
else
    echo "❌ Port 3000 is not in use"
fi

# Try to connect
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding at http://localhost:3000"
else
    echo "❌ Server is not responding"
fi


