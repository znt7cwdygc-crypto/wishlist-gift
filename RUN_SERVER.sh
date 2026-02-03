#!/bin/bash
# Script to run the server

cd "$(dirname "$0")"
echo "🚀 Starting Wishlist Gift Server..."
echo "📁 Directory: $(pwd)"
echo ""
node server/index.js


