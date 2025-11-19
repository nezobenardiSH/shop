#!/bin/bash

# Test Lark VC API with curl
# This script tests if the VC API endpoint is accessible

echo "🧪 Testing Lark VC API endpoint..."
echo ""

# Get token from environment or prompt
if [ -z "$LARK_USER_TOKEN" ]; then
  echo "⚠️  Please set LARK_USER_TOKEN environment variable"
  echo ""
  echo "To get your token, run this in your browser console while logged into Lark:"
  echo "  Open Prisma Studio and look at LarkAuthToken table"
  echo ""
  echo "Or run: LARK_USER_TOKEN='your-token-here' ./test-vc-curl.sh"
  exit 1
fi

# Set up test meeting (tomorrow at 10 AM)
TOMORROW=$(date -v+1d +%Y-%m-%d)
START_TIME=$(date -j -f "%Y-%m-%d %H:%M:%S" "$TOMORROW 10:00:00" +%s 2>/dev/null || date -d "$TOMORROW 10:00:00" +%s)
END_TIME=$((START_TIME + 3600))

echo "📍 Endpoint: https://open.larksuite.com/open-apis/vc/v1/reserve/apply"
echo "🗓️  Meeting time: $TOMORROW 10:00-11:00"
echo "⏰ Start timestamp: $START_TIME"
echo "⏰ End timestamp: $END_TIME"
echo "🔑 Token (first 20 chars): ${LARK_USER_TOKEN:0:20}..."
echo ""
echo "📋 Request body:"

REQUEST_BODY=$(cat <<EOF
{
  "start_time": "$START_TIME",
  "end_time": "$END_TIME",
  "meeting_settings": {
    "topic": "Test VC Meeting - API Test",
    "action_at_end": 1
  }
}
EOF
)

echo "$REQUEST_BODY"
echo ""
echo "🚀 Sending request..."
echo ""

# Make the API call
curl -X POST "https://open.larksuite.com/open-apis/vc/v1/reserve/apply" \
  -H "Authorization: Bearer $LARK_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY" \
  -w "\n\n📡 HTTP Status: %{http_code}\n" \
  -v

echo ""
echo "✅ Test complete"
