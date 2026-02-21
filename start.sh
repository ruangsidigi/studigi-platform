#!/bin/bash

# SKD CPNS Tryout System - Startup Script for macOS/Linux

echo ""
echo "======================================"
echo "  SKD CPNS Tryout System"
echo "  Starting Backend and Frontend..."
echo "======================================"
echo ""

# Start Backend
echo "Starting Backend Server on http://localhost:5000..."
cd backend
npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo "Starting Frontend on http://localhost:3000..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  Both servers starting..."
echo "  Backend: http://localhost:5000"
echo "  Frontend: http://localhost:3000"
echo "======================================"
echo ""
echo "Admin Login:"
echo "  Email: admin@skdcpns.com"
echo "  Password: admin123"
echo ""
echo "Press Ctrl+C to stop servers"
echo ""

# Wait for both processes
wait
