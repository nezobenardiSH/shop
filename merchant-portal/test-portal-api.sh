#!/bin/bash

echo "🚀 Testing Merchant Portal - Nasi-Lemak"
echo "========================================"
echo ""

# Test 1: Check if page loads
echo "📋 Test 1: Checking if merchant page loads..."
response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3010/merchant/Nasi-Lemak")
if [ "$response" = "200" ]; then
    echo "✅ Page loads successfully (HTTP 200)"
else
    echo "❌ Page failed to load (HTTP $response)"
fi
echo ""

# Test 2: Check trainer data API
echo "📋 Test 2: Testing trainer data API..."
trainer_data=$(curl -s "http://localhost:3010/api/salesforce/merchant/Nasi-Lemak")
if echo "$trainer_data" | grep -q "success"; then
    echo "✅ Trainer API responded"
    if echo "$trainer_data" | grep -q '"success":true'; then
        echo "✅ Trainer data loaded successfully"
        echo "📊 Response preview:"
        echo "$trainer_data" | python3 -m json.tool 2>/dev/null | head -20
    else
        echo "⚠️ Trainer not found or error occurred"
        echo "$trainer_data" | python3 -m json.tool 2>/dev/null | head -10
    fi
else
    echo "❌ API call failed"
fi
echo ""

# Test 3: Check Lark availability API
echo "📋 Test 3: Testing Lark availability API..."
availability=$(curl -s "http://localhost:3010/api/lark/availability?trainerName=Nezo")
if echo "$availability" | grep -q "availability"; then
    echo "✅ Lark availability API working"
    slot_count=$(echo "$availability" | grep -o '"available":true' | wc -l)
    echo "📅 Found $slot_count available time slots"
elif echo "$availability" | grep -q "error"; then
    echo "❌ Lark API error:"
    echo "$availability" | python3 -m json.tool
else
    echo "❌ Unexpected response from Lark API"
fi
echo ""

# Test 4: Check available stages
echo "📋 Test 4: Checking available trainer stages..."
stages=$(curl -s "http://localhost:3010/api/salesforce/trainer-stages")
if echo "$stages" | grep -q "stages"; then
    stage_count=$(echo "$stages" | grep -o '"value"' | wc -l)
    echo "✅ Found $stage_count trainer stages"
else
    echo "❌ Could not fetch trainer stages"
fi
echo ""

# Test 5: Test Lark connection
echo "📋 Test 5: Testing Lark integration status..."
lark_test=$(curl -s "http://localhost:3010/api/lark/test")
if echo "$lark_test" | grep -q '"status":"success"'; then
    echo "✅ All Lark tests passed!"
else
    echo "⚠️ Some Lark tests failed. Details:"
    echo "$lark_test" | python3 -m json.tool 2>/dev/null | grep -A2 '"status":"failed"'
fi
echo ""

echo "========================================"
echo "🎯 Test Summary:"
echo ""
echo "Portal URL: http://localhost:3010/merchant/Nasi-Lemak"
echo "Test Page: http://localhost:3010/test-lark"
echo ""
echo "To test the booking UI:"
echo "1. Open http://localhost:3010/merchant/Nasi-Lemak"
echo "2. Click 'Load Trainer Data'"
echo "3. Click 'Book Training' button"
echo "4. Select a date and time slot"
echo "5. Confirm the booking"
echo ""
echo "✅ API tests completed!"