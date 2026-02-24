@echo off
echo ========================================
echo Installing Ollama Models
echo ========================================
echo.
echo This will download the required AI models.
echo This may take several minutes depending on your internet speed.
echo.
pause

echo.
echo Installing llama3 (text model)...
ollama pull llama3

echo.
echo Installing llava (image model)...
ollama pull llava

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo You can now run: python main.py
echo.
pause
