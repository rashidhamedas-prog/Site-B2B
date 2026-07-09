@echo off
echo Starting Taranom Dev Servers...

start "Taranom API" cmd /k "cd /d %~dp0apps\api && npx ts-node -r tsconfig-paths/register src/main.ts"

timeout /t 10 /nobreak >nul

start "Taranom Web" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo Servers starting:
echo   API:  http://localhost:4000
echo   Web:  http://localhost:3000/admin
echo.
pause
