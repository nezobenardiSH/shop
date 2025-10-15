#!/bin/bash

# Test Direct Booking URLs
# This script runs Playwright tests for the direct booking URL feature

echo "🧪 Testing Direct Booking URLs Feature"
echo "========================================"
echo ""

# Check if server is running
echo "📡 Checking if development server is running..."
if curl -s http://localhost:3010 > /dev/null; then
    echo "✅ Server is running on http://localhost:3010"
else
    echo "❌ Server is not running!"
    echo "Please start the development server first:"
    echo "  npm run dev"
    exit 1
fi

echo ""
echo "🎭 Running Playwright tests..."
echo ""

# Run the specific test file
cd "$(dirname "$0")"
npx playwright test e2e/direct-booking-urls.spec.ts --reporter=list

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    echo ""
    echo "📊 Test Summary:"
    echo "  - POS Training URL: ✅"
    echo "  - BackOffice Training URL: ✅"
    echo "  - Installation URL: ✅"
    echo "  - Invalid parameter handling: ✅"
    echo "  - Language opt-in behavior: ✅"
    echo "  - URL cleanup: ✅"
else
    echo ""
    echo "❌ Some tests failed!"
    echo "Check the output above for details."
    exit 1
fi

