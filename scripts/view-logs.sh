#!/bin/bash

echo "📋 Viewing Vercel logs for OnboardingPortal..."
echo ""
echo "This will show real-time logs from your deployed application."
echo "Press Ctrl+C to stop viewing logs."
echo ""
echo "----------------------------------------"

# View Vercel logs with follow mode
vercel logs --follow

# Alternative: If you want to see just recent logs without following
# vercel logs -n 100