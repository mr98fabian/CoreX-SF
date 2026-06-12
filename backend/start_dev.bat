@echo off
set PYTHONIOENCODING=utf-8
set DATABASE_URL=
cd /d C:\Users\Khine\Desktop\Workspace\Proyectos_Software\KoreX\backend
venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001 > uvicorn_out.log 2>&1
