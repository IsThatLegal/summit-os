#!/bin/bash

echo "🧹 Cleaning up E2E test data..."

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Server is not running. Starting development server..."
    npm run dev > /dev/null 2>&1 &
    echo "⏳ Waiting for server to start..."
    sleep 15
fi

# Run cleanup - try multiple approaches
echo "🔄 Running standard cleanup..."
response=$(curl -s -X DELETE http://localhost:3000/api/cleanup/tests)

echo "🔥 Running aggressive cleanup..."
response=$(curl -s -X DELETE http://localhost:3000/api/cleanup/aggressive)

echo "💥 Running nuke cleanup..."
response=$(curl -s -X DELETE http://localhost:3000/api/cleanup/nuke)

echo "🎯 Running stubborn cleanup..."
response=$(curl -s -X DELETE http://localhost:3000/api/cleanup/stubborn)

echo "🔥 SCORCHED EARTH cleanup..."
response=$(curl -s -X DELETE http://localhost:3000/api/cleanup/scorched)
echo "📊 Cleanup response: $response"

# Extract numbers from response
tenants_deleted=$(echo $response | grep -o '"tenantsDeleted":[0-9]*' | cut -d':' -f2)
units_reset=$(echo $response | grep -o '"unitsReset":[0-9]*' | cut -d':' -f2)

echo "✅ Cleanup completed!"
echo "   - Tenants deleted: $tenants_deleted"
echo "   - Units reset: $units_reset"