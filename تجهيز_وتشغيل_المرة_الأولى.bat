@echo off
chcp 65001 >nul
cd /d "%~dp0"
title موجة البرمجة - تجهيز التشغيل
echo ============================================
echo   موجة البرمجة - تجهيز التشغيل لأول مرة
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo لم يتم العثور على Node.js.
  echo ثبّت نسخة LTS من Node.js ثم أعد تشغيل هذا الملف.
  pause
  exit /b 1
)
echo سيتم تنزيل مكتبات Electron اللازمة لأول مرة.
echo بعد اكتمال التثبيت يمكن تشغيل التطبيق دون إنترنت.
echo.
call npm install
if errorlevel 1 (
  echo فشل تثبيت المكتبات. تحقق من اتصال الإنترنت ثم أعد المحاولة.
  pause
  exit /b 1
)
echo.
echo اكتمل التجهيز. سيتم تشغيل المنظومة الآن...
call npm start
if errorlevel 1 pause
