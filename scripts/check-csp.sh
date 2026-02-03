#!/bin/bash

# CSP Diagnostic Script for Stripe Integration
# This script checks if CSP is properly configured for Stripe.js

echo "========================================="
echo "CSP Diagnostic for Stripe.js"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if URL is provided
if [ -z "$1" ]; then
    URL="https://mayassessorfiscal.com.br"
    echo "No URL provided. Using default: $URL"
else
    URL="$1"
fi

echo "Testing URL: $URL"
echo ""

# Fetch headers
echo "========================================="
echo "1. Checking HTTP Headers"
echo "========================================="
HEADERS=$(curl -sI "$URL" 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to connect to $URL${NC}"
    echo "Error: $HEADERS"
    exit 1
fi

echo -e "${GREEN}✓ Successfully connected${NC}"
echo ""

# Check for CSP headers
echo "========================================="
echo "2. Content-Security-Policy Headers"
echo "========================================="

CSP_HEADERS=$(echo "$HEADERS" | grep -i "content-security-policy")

if [ -z "$CSP_HEADERS" ]; then
    echo -e "${RED}❌ No Content-Security-Policy header found${NC}"
    echo "This might be okay if the backend sets it dynamically."
else
    CSP_COUNT=$(echo "$CSP_HEADERS" | wc -l)
    echo "Found $CSP_COUNT CSP header(s):"
    echo ""
    echo "$CSP_HEADERS"
    echo ""
    
    if [ $CSP_COUNT -gt 1 ]; then
        echo -e "${YELLOW}⚠️  WARNING: Multiple CSP headers detected!${NC}"
        echo "Browsers will merge them and apply the strictest policy."
        echo "This often causes issues with Stripe."
    fi
fi

echo ""

# Check for required Stripe domains in CSP
echo "========================================="
echo "3. Checking Required Stripe Domains"
echo "========================================="

REQUIRED_DOMAINS=(
    "js.stripe.com"
    "api.stripe.com"
    "m.stripe.network"
    "hooks.stripe.com"
)

ISSUES_FOUND=0

for domain in "${REQUIRED_DOMAINS[@]}"; do
    if echo "$CSP_HEADERS" | grep -q "$domain"; then
        echo -e "${GREEN}✓ $domain found in CSP${NC}"
    else
        echo -e "${RED}❌ $domain NOT found in CSP${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""

# Check for unsafe-inline
echo "========================================="
echo "4. Checking for unsafe-inline"
echo "========================================="

if echo "$CSP_HEADERS" | grep -q "'unsafe-inline'"; then
    echo -e "${GREEN}✓ 'unsafe-inline' found in script-src${NC}"
else
    echo -e "${RED}❌ 'unsafe-inline' NOT found in script-src${NC}"
    echo "Stripe.js requires 'unsafe-inline' to work properly."
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""

# Check for connect-src
echo "========================================="
echo "5. Checking connect-src Directive"
echo "========================================="

if echo "$CSP_HEADERS" | grep -q "connect-src"; then
    echo -e "${GREEN}✓ connect-src directive found${NC}"
    
    if echo "$CSP_HEADERS" | grep "connect-src" | grep -q "js.stripe.com"; then
        echo -e "${GREEN}✓ js.stripe.com is allowed in connect-src${NC}"
    else
        echo -e "${RED}❌ js.stripe.com NOT in connect-src${NC}"
        echo "This will block Stripe.js from loading!"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${YELLOW}⚠️  connect-src not explicitly set${NC}"
    echo "Will fall back to default-src"
fi

echo ""

# Summary
echo "========================================="
echo "6. Summary"
echo "========================================="

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "Your CSP should work with Stripe."
else
    echo -e "${RED}❌ Found $ISSUES_FOUND issue(s)${NC}"
    echo ""
    echo "Recommendations:"
    echo "1. Check if nginx or Cloudflare is setting CSP"
    echo "2. Review docs/nginx-stripe.conf for nginx config"
    echo "3. Review docs/cloudflare-stripe-setup.md for Cloudflare"
    echo "4. Ensure only ONE CSP source (backend OR server, not both)"
fi

echo ""
echo "========================================="
echo "7. Full Response Headers"
echo "========================================="
echo "$HEADERS"

echo ""
echo "Done!"
