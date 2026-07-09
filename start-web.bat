@echo off
chcp 65001 >nul
echo ============================================================
echo   Taranom Web - Next.js Frontend
echo ============================================================
echo.
cd /d "%~dp0apps\web"
echo در حال اجرای سایت روی http://localhost:3000
echo.
npm run dev
pause
