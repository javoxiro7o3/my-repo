@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Birlashtirilmoqda...
copy /b DevOps-Akademiya-Setup.exe.001 + DevOps-Akademiya-Setup.exe.002 + DevOps-Akademiya-Setup.exe.003 "DevOps Akademiya-Setup-1.0.2.exe" >nul
if errorlevel 1 (echo XATO: 3 ta qism ham shu papkada ekanini tekshiring & pause & exit /b 1)
echo Tayyor: "DevOps Akademiya-Setup-1.0.2.exe"
echo Kutilgan SHA256: 57aa60147e97579776f16b491614b0a11ca3708c0a56599ae8577cd140d31cc6
certutil -hashfile "DevOps Akademiya-Setup-1.0.2.exe" SHA256
pause
