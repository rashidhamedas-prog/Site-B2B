@echo off
chcp 65001 >nul
echo ============================================================
echo   Taranom Seed — ساخت کاربر ادمین پیش‌فرض
echo ============================================================
echo.
echo این اسکریپت یک کاربر ادمین در دیتابیس می‌سازد.
echo قبل از اجرا، API (start-api.bat) را یک بار اجرا کنید تا جداول ساخته شوند.
echo.
cd /d "%~dp0apps\api"
npx ts-node -r tsconfig-paths/register src/seed.ts
echo.
echo اطلاعات ورود ادمین:
echo   موبایل: 09152424624
echo   رمز: Admin@1234
echo.
pause
