@echo off
echo MediScanAI V6 Setup
cd backend && npm install
cd ..\frontend && npm install
echo Done! Edit backend\.env then:
echo   cd backend && node seed.js
echo   cd backend && node server.js
echo   cd frontend && npm run dev
