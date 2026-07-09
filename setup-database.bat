@echo off
chcp 65001 >nul
echo ============================================================
echo   Taranom DB Setup — PostgreSQL Database Creation
echo ============================================================
echo.
echo این اسکریپت دیتابیس taranom_db را در PostgreSQL می‌سازد.
echo.

set PSQL="C:\Program Files\PostgreSQL\18\bin\psql.exe"
set /p PG_PASS=رمز عبور postgres را وارد کنید:

set PGPASSWORD=%PG_PASS%

echo.
echo در حال ساخت کاربر و دیتابیس...

%PSQL% -U postgres -h localhost -c "CREATE USER taranom WITH PASSWORD 'taranom_pass';" 2>nul
%PSQL% -U postgres -h localhost -c "CREATE DATABASE taranom_db OWNER taranom ENCODING 'UTF8';" 2>nul
%PSQL% -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE taranom_db TO taranom;" 2>nul
%PSQL% -U postgres -h localhost -c "ALTER USER taranom CREATEDB;" 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [موفق] دیتابیس با موفقیت ساخته شد.
    echo.
    echo اکنون در ترمینال جدید API را اجرا کنید:
    echo   cd apps\api
    echo   npm run start:dev
) else (
    echo.
    echo [خطا] لطفاً رمز عبور postgres را بررسی کنید.
    echo       در صورت نیاز از pgAdmin برای ساخت دیتابیس استفاده کنید.
    echo.
    echo دستورات SQL لازم:
    echo   CREATE USER taranom WITH PASSWORD 'taranom_pass';
    echo   CREATE DATABASE taranom_db OWNER taranom ENCODING 'UTF8';
    echo   GRANT ALL PRIVILEGES ON DATABASE taranom_db TO taranom;
)

echo.
pause
