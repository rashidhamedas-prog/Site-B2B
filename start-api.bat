@echo off
chcp 65001 >nul
echo ============================================================
echo   Taranom API - NestJS Server
echo ============================================================
echo.
cd /d "%~dp0apps\api"
echo در حال اجرای API روی http://localhost:4000
echo Swagger: http://localhost:4000/api/docs
echo.
npm run start:dev
pause
