@echo off
cd /d %~dp0
start "ClearAller Backend" cmd /k "npm.cmd run dev --workspace backend"
start "ClearAller Frontend" cmd /k "npm.cmd run dev --workspace frontend"
