#!/bin/bash
# setup_chrome_debug.sh - Prepare your existing Chrome for Puppeteer

echo "🔧 Setting up Chrome for Puppeteer (existing window mode)"

# Check if Chrome is running
CHROME_RUNNING=$(pgrep -f "Google Chrome" | wc -l)

if [[ $CHROME_RUNNING -gt 0 ]]; then
    echo "📱 Chrome is currently running"
    echo "🔄 We need to restart Chrome with remote debugging enabled"
    echo "⚠️  This will close and reopen Chrome (your tabs will be restored)"
    
    read -p "Continue? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Restarting Chrome with debugging..."
        
        # Close Chrome gracefully
        osascript -e 'tell application "Google Chrome" to quit'
        sleep 3
        
        # Create temporary user data directory
        TEMP_DATA_DIR="/tmp/chrome_debug_$(date +%s)"
        mkdir -p "$TEMP_DATA_DIR"

        # Start Chrome with remote debugging and temporary data directory
        /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
            --remote-debugging-port=9222 \
            --user-data-dir="$TEMP_DATA_DIR" \
            --enable-automation \
            --no-first-run \
            --no-default-browser-check \
            --disable-background-timer-throttling \
            --disable-backgrounding-occluded-windows \
            --disable-renderer-backgrounding &

        echo "✅ Chrome restarted with remote debugging on port 9222"
        echo "🔗 Debug interface: http://localhost:9222"
        echo "📁 Using temp data dir: $TEMP_DATA_DIR"

        # Wait for Chrome to fully start
        echo "⏳ Waiting for Chrome to start..."
        sleep 8

        # Test the connection with retries
        for i in {1..10}; do
            if curl -s http://localhost:9222/json > /dev/null 2>&1; then
                echo "✅ Remote debugging is working!"
                echo "🚀 Now start your Puppeteer service: npm start"
                break
            else
                echo "⏳ Attempt $i/10: Waiting for remote debugging..."
                sleep 2
            fi
        done

        if ! curl -s http://localhost:9222/json > /dev/null 2>&1; then
            echo "❌ Remote debugging still not responding"
            echo "🔧 Try manually:"
            echo "   1. Quit Chrome completely"
            echo "   2. Run: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome_debug"
        fi
    else
        echo "❌ Setup cancelled"
    fi
else
    echo "📱 Chrome is not running"
    echo "🚀 Starting Chrome with remote debugging..."

    # Create temporary user data directory
    TEMP_DATA_DIR="/tmp/chrome_debug_$(date +%s)"
    mkdir -p "$TEMP_DATA_DIR"

    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --remote-debugging-port=9222 \
        --user-data-dir="$TEMP_DATA_DIR" \
        --enable-automation \
        --no-first-run \
        --no-default-browser-check \
        --disable-background-timer-throttling \
        --disable-backgrounding-occluded-windows \
        --disable-renderer-backgrounding &

    echo "✅ Chrome started with remote debugging"
    echo "🔗 Debug interface: http://localhost:9222"
    echo "📁 Using temp data dir: $TEMP_DATA_DIR"
    sleep 8

    # Test the connection with retries
    for i in {1..10}; do
        if curl -s http://localhost:9222/json > /dev/null 2>&1; then
            echo "✅ Remote debugging is working!"
            echo "🚀 Now start your Puppeteer service: npm start"
            break
        else
            echo "⏳ Attempt $i/10: Waiting for remote debugging..."
            sleep 2
        fi
    done
fi

echo ""
echo "📋 Next steps:"
echo "1. Start Puppeteer service: cd claude-automation && npm start"
echo "2. Click '🤖 Claude Code' in your app"
echo "3. Watch Claude.ai open in a NEW TAB of your existing Chrome!"