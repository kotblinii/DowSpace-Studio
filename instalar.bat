@echo off
title Instalador - DowSpace Studio
echo ============================================================
echo           Instalando o DowSpace Studio no Windows...
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro durante a instalacao.
    pause
)
