#!/bin/bash
# Corporate SSL Certificate Fix for Puppeteer Installation
# Based on your SSL troubleshooting guide

echo "🔍 Step 1: Diagnosing SSL Certificate Issue"

# Test SSL connectivity to npm registry
echo "Testing SSL connection to registry.npmjs.org..."
openssl s_client -connect registry.npmjs.org:443 -servername registry.npmjs.org -showcerts > ssl_test.txt 2>&1

# Check if we have certificate verification issues
if grep -q "unable to get local issuer certificate" ssl_test.txt; then
    echo "❌ Corporate SSL certificate issue detected"
    echo "🔍 Analyzing certificate chain..."
    
    # Extract the certificate chain
    echo "Certificate chain found:"
    grep -A 50 "Certificate chain" ssl_test.txt | head -20
    
    echo ""
    echo "🔧 Step 2: Applying SSL Fix"
    
    # Find certificate bundle locations
    CERT_LOCATIONS=(
        "/opt/homebrew/opt/ca-certificates/share/ca-certificates/cacert.pem"
        "/usr/local/etc/openssl/cert.pem" 
        "/etc/ssl/cert.pem"
        "$(python3 -c "import certifi; print(certifi.where())" 2>/dev/null)"
    )
    
    echo "🔍 Found certificate bundles at:"
    for cert_path in "${CERT_LOCATIONS[@]}"; do
        if [[ -f "$cert_path" ]]; then
            echo "  ✅ $cert_path"
        else
            echo "  ❌ $cert_path (not found)"
        fi
    done
    
    # Extract missing root certificate from the chain
    echo ""
    echo "🔧 Extracting missing root certificate..."
    
    # Get the last certificate from the chain (usually the root)
    awk '/-----BEGIN CERTIFICATE-----/{flag=1} flag; /-----END CERTIFICATE-----/{if(flag) print ""; flag=0}' ssl_test.txt | tail -n +$(($(awk '/-----BEGIN CERTIFICATE-----/{flag=1} flag; /-----END CERTIFICATE-----/{if(flag) print NR; flag=0}' ssl_test.txt | tail -1))) ssl_test.txt > missing_root_cert.pem
    
    if [[ -s missing_root_cert.pem ]]; then
        echo "✅ Extracted root certificate to missing_root_cert.pem"
        echo "First few lines of extracted certificate:"
        head -3 missing_root_cert.pem
        
        # Add to certificate bundles
        echo ""
        echo "🔧 Adding certificate to system bundles..."
        
        # For Homebrew ca-certificates
        if [[ -f "/opt/homebrew/opt/ca-certificates/share/ca-certificates/cacert.pem" ]]; then
            echo "Adding to Homebrew certificate bundle..."
            cat missing_root_cert.pem >> /opt/homebrew/opt/ca-certificates/share/ca-certificates/cacert.pem
            echo "✅ Added to Homebrew bundle"
        fi
        
        # For Python certifi
        CERTIFI_PATH=$(python3 -c "import certifi; print(certifi.where())" 2>/dev/null)
        if [[ -f "$CERTIFI_PATH" ]]; then
            echo "Adding to Python certifi bundle..."
            cat missing_root_cert.pem >> "$CERTIFI_PATH"
            echo "✅ Added to certifi bundle: $CERTIFI_PATH"
        fi
        
        # Set environment variables
        echo ""
        echo "🔧 Setting SSL environment variables..."
        
        # Create or update shell profile
        SHELL_PROFILE="$HOME/.zshrc"
        if [[ "$SHELL" == *"bash"* ]]; then
            SHELL_PROFILE="$HOME/.bashrc"
        fi
        
        # Add SSL configuration
        echo "" >> "$SHELL_PROFILE"
        echo "# Corporate SSL Certificate Configuration" >> "$SHELL_PROFILE"
        echo "export SSL_CERT_FILE=\"$CERTIFI_PATH\"" >> "$SHELL_PROFILE"
        echo "export REQUESTS_CA_BUNDLE=\"$CERTIFI_PATH\"" >> "$SHELL_PROFILE"
        echo "export CURL_CA_BUNDLE=\"$CERTIFI_PATH\"" >> "$SHELL_PROFILE"
        echo "export NODE_EXTRA_CA_CERTS=\"$CERTIFI_PATH\"" >> "$SHELL_PROFILE"
        
        # Apply to current session
        export SSL_CERT_FILE="$CERTIFI_PATH"
        export REQUESTS_CA_BUNDLE="$CERTIFI_PATH"
        export CURL_CA_BUNDLE="$CERTIFI_PATH"
        export NODE_EXTRA_CA_CERTS="$CERTIFI_PATH"
        
        echo "✅ Environment variables set"
        echo "Added to: $SHELL_PROFILE"
        
    else
        echo "❌ Could not extract root certificate"
    fi
    
else
    echo "✅ No SSL certificate issues detected"
fi

echo ""
echo "🔧 Step 3: Installing Puppeteer with SSL fix"

# Clean up previous installation
rm -rf node_modules package-lock.json

# Install with corrected SSL configuration
echo "Installing with SSL configuration..."
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Try installation with SSL fixes
npm install puppeteer-core@^22.0.0 express@^4.18.2 cors@^2.8.5

if [[ $? -eq 0 ]]; then
    echo "✅ Installation successful!"
else
    echo "❌ Installation failed, trying alternative approach..."
    
    # Alternative: temporarily disable SSL verification
    echo "Temporarily disabling SSL verification..."
    npm config set strict-ssl false
    npm config set registry https://registry.npmjs.org/
    
    npm install puppeteer-core@^22.0.0 express@^4.18.2 cors@^2.8.5
    
    # Re-enable SSL
    npm config set strict-ssl true
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Installation successful with SSL bypass!"
    else
        echo "❌ Installation still failed. Manual intervention required."
        echo "Try: npm install --legacy-peer-deps"
    fi
fi

echo ""
echo "🔧 Step 4: Verification"

# Test the SSL fix
echo "Testing SSL fix..."
openssl s_client -connect registry.npmjs.org:443 -servername registry.npmjs.org < /dev/null 2>&1 | grep "Verify return code"

echo ""
echo "✅ Setup complete! You can now run:"
echo "   npm start"
echo ""
echo "If you still have issues, reload your shell:"
echo "   source $SHELL_PROFILE"

# Clean up temporary files
rm -f ssl_test.txt missing_root_cert.pem
