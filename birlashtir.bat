@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Birlashtirilmoqda...
copy /b DevOps-Akademiya-Setup.exe.001 + DevOps-Akademiya-Setup.exe.002 + DevOps-Akademiya-Setup.exe.003 "DevOps Akademiya-Setup-1.0.0.exe" >nul
if errorlevel 1 (echo XATO: 3 ta qism ham shu papkada ekanini tekshiring & pause & exit /b 1)
echo Tayyor: "DevOps Akademiya-Setup-1.0.0.exe"
echo Kutilgan SHA256: 96ae1e7ac82c3f9e3c7130b01993cbc438a8e0e523c83378c28ecd39a8826583
certutil -hashfile "DevOps Akademiya-Setup-1.0.0.exe" SHA256
pause
