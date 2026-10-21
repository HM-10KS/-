@echo off
chcp 65001 >nul
cd /d "%~dp0"
title بناء موجة البرمجة لنظام Windows
echo سيتم إنشاء ملف تثبيت Windows داخل مجلد dist.
echo يتطلب هذا الإجراء تنزيل أدوات البناء عند أول مرة.
call npm install
if errorlevel 1 goto failed
call npm run dist
if errorlevel 1 goto failed
echo.
echo اكتمل البناء. افتح مجلد dist للعثور على ملف التثبيت.
pause
exit /b 0
:failed
echo.
echo تعذر إكمال البناء. راجع رسالة الخطأ أعلاه.
pause
exit /b 1
