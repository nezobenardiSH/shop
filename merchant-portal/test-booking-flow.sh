#!/bin/bash

echo "🧪 Testing Complete Booking Flow"
echo "================================="
echo ""

MERCHANT_ID="a0yBE000002SwCnYAK"  # Nasi Lemak's Salesforce ID
DATE="2025-10-07"
START_TIME="11:00"
END_TIME="13:00"

# Step 1: Check current training date
echo "📋 Step 1: Current trainer data"
CURRENT_DATA=$(curl -s "http://localhost:3010/api/salesforce/merchant/Nasi-Lemak")
CURRENT_DATE=$(echo "$CURRENT_DATA" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success') and data.get('onboardingTrainerData', {}).get('trainers'):
    trainer = data['onboardingTrainerData']['trainers'][0]
    print(f\"Current training date: {trainer.get('trainingDate', 'Not set')}\")
    print(f\"Trainer ID: {trainer.get('id', 'Unknown')}\")
else:
    print('Could not get trainer data')
" 2>/dev/null)
echo "$CURRENT_DATE"
echo ""

# Step 2: Make a booking
echo "📅 Step 2: Making a booking for $DATE from $START_TIME to $END_TIME"
BOOKING_RESULT=$(curl -s -X POST "http://localhost:3010/api/lark/book-training" \
  -H "Content-Type: application/json" \
  -d "{
    \"merchantId\": \"$MERCHANT_ID\",
    \"merchantName\": \"Nasi Lemak\",
    \"trainerName\": \"System\",
    \"date\": \"$DATE\",
    \"startTime\": \"$START_TIME\",
    \"endTime\": \"$END_TIME\"
  }")

echo "$BOOKING_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    print(f\"✅ Booking successful!\")
    print(f\"   Assigned to: {data.get('assignedTrainer', 'Unknown')}\")
    print(f\"   Event ID: {data.get('eventId', 'Unknown')}\")
    print(f\"   Salesforce updated: {data.get('salesforceUpdated', False)}\")
else:
    print(f\"❌ Booking failed: {data.get('error', 'Unknown error')}\")
" 2>/dev/null
echo ""

# Step 3: Wait a moment for updates to propagate
echo "⏳ Waiting 2 seconds for updates..."
sleep 2
echo ""

# Step 4: Check if training date was updated
echo "📋 Step 4: Checking updated trainer data"
UPDATED_DATA=$(curl -s "http://localhost:3010/api/salesforce/merchant/Nasi-Lemak")
UPDATED_DATE=$(echo "$UPDATED_DATA" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success') and data.get('onboardingTrainerData', {}).get('trainers'):
    trainer = data['onboardingTrainerData']['trainers'][0]
    new_date = trainer.get('trainingDate', 'Not set')
    print(f\"New training date: {new_date}\")
    if '$DATE' in str(new_date):
        print(f\"✅ Date successfully updated to {new_date}!\")
    else:
        print(f\"⚠️ Date not updated as expected (still shows: {new_date})\")
else:
    print('Could not get updated trainer data')
" 2>/dev/null)
echo "$UPDATED_DATE"
echo ""

echo "================================="
echo "✅ Test complete!"