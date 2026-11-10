@echo off
title SQL Server 2000 Schema Exporter
echo ====================================================
echo   Exporting SQL Server 2000 Database Schema...
echo ====================================================
echo.

node export-schema.js

echo.
echo ====================================================
echo  Sync Complete! Check db-schema.json file.
echo ====================================================
pause