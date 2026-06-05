@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   正在启动 1688 本地代理...
echo.

start "1688代理" /MIN node "%~dp01688_proxy.cjs"

timeout /t 3 /nobreak >nul

start "" "http://42.193.170.109/sourcing-tool"

echo   已打开选品比价工具页面。
echo   代理窗口已最小化到任务栏，请勿关闭。
echo.
