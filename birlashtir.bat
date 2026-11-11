@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Birlashtirilmoqda...
copy /b DevOps-Akademiya-Setup.exe.001 + DevOps-Akademiya-Setup.exe.002 + DevOps-Akademiya-Setup.exe.003 "DevOps Akademiya-Setup-1.0.1.exe" >nul
if errorlevel 1 (echo XATO: 3 ta qism ham shu papkada ekanini tekshiring & pause & exit /b 1)
echo Tayyor: "DevOps Akademiya-Setup-1.0.1.exe"
echo Kutilgan SHA256: 2815f7a9978c047970a801fb9eb28e89605896309047cd75d22d683eafd64994
certutil -hashfile "DevOps Akademiya-Setup-1.0.1.exe" SHA256
pause
