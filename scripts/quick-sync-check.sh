#!/bin/bash

# Quick Sync Investigation Script
# Usage: bash scripts/quick-sync-check.sh

echo "🔍 SALESFORCE CALENDAR SYNC - QUICK CHECK"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "📋 Step 1: Checking if diagnostic tool dependencies are installed..."
if command -v node &> /dev/null; then
    echo -e "${GREEN}✅ Node.js is installed${NC}"
    node --version
else
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "   Install Node.js to run the diagnostic tool"
fi

if npm list jsforce &> /dev/null; then
    echo -e "${GREEN}✅ jsforce is installed${NC}"
else
    echo -e "${YELLOW}⚠️  jsforce is not installed${NC}"
    echo "   Run: npm install jsforce"
fi

echo ""
echo "📋 Step 2: Checking environment variables..."
if [ -z "$SF_USERNAME" ]; then
    echo -e "${RED}❌ SF_USERNAME not set${NC}"
else
    echo -e "${GREEN}✅ SF_USERNAME is set${NC}"
fi

if [ -z "$SF_PASSWORD" ]; then
    echo -e "${RED}❌ SF_PASSWORD not set${NC}"
else
    echo -e "${GREEN}✅ SF_PASSWORD is set${NC}"
fi

if [ -z "$SF_TOKEN" ]; then
    echo -e "${RED}❌ SF_TOKEN not set${NC}"
else
    echo -e "${GREEN}✅ SF_TOKEN is set${NC}"
fi

echo ""
echo "📋 Step 3: Checking recent portal logs for event creation..."

if [ -d "logs" ]; then
    echo ""
    echo "Recent Salesforce Event creations:"
    grep -h "Salesforce Event.*created" logs/*.log 2>/dev/null | tail -5 || echo "   No Salesforce Event creation logs found"

    echo ""
    echo "Recent Lark Calendar event creations:"
    grep -h "calendar event created" logs/*.log 2>/dev/null | tail -5 || echo "   No Lark calendar event logs found"

    echo ""
    echo "Recent errors:"
    grep -h "Error\|Failed" logs/*.log 2>/dev/null | tail -5 || echo "   No errors found"
else
    echo -e "${YELLOW}⚠️  No logs directory found${NC}"
fi

echo ""
echo "📋 Step 4: Quick architecture overview..."
echo ""
echo "Current System Architecture:"
echo "  Portal → Lark Calendar (Primary)"
echo "  Portal → Salesforce Events (Secondary)"
echo "           ↕ NO AUTOMATIC SYNC ↕"
echo ""

echo "🎯 Next Steps:"
echo ""
echo "1. Run full diagnostic:"
echo "   ${YELLOW}node scripts/diagnose-salesforce-calendar-sync.js${NC}"
echo ""
echo "2. Check Salesforce manually:"
echo "   - Log into Salesforce"
echo "   - Go to any Trainer record"
echo "   - Click 'Activity' tab"
echo "   - Look for events like 'Remote Training - [Merchant]'"
echo ""
echo "3. Check Lark Calendar manually:"
echo "   - Open trainer's Lark Calendar"
echo "   - Look for same appointments"
echo ""
echo "4. Read full investigation guide:"
echo "   ${YELLOW}docs/SALESFORCE-CALENDAR-SYNC-INVESTIGATION.md${NC}"
echo ""
echo "5. Read quick reference:"
echo "   ${YELLOW}docs/SYNC-INVESTIGATION-QUICKSTART.md${NC}"
echo ""
echo "⚠️  IMPORTANT:"
echo "   The system does NOT have automatic sync by design."
echo "   Events are created in BOTH systems independently by the portal."
echo "   This is normal and expected behavior."
echo ""
