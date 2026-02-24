# AI Chatbot - Local Setup

A local AI chatbot application using Ollama models (llama3 for text, llava for images).

## Prerequisites

1. **Python 3.8+** installed on your computer
2. **Ollama** installed and running locally
   - Download from: https://ollama.ai
   - After installation, pull the required models:
     ```bash
     ollama pull llama3
     ollama pull llava
     ```

## Installation

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Make sure Ollama is running on your computer (it should start automatically)

2. Start the FastAPI server:
   ```bash
   python main.py
   ```

3. Open your web browser and navigate to:
   ```
   http://localhost:8000
   ```

## Features

- 💬 Text chat using llama3 model
- 🖼️ Image analysis using llava model
- 💾 Conversation history stored in browser localStorage
- 🎨 Modern, responsive UI

## Troubleshooting

### "Model 'llama3' not found" Error

If you see this error, you need to install the Ollama models:

**Windows:**
```bash
# Run the installer script
install_models.bat

# Or manually:
ollama pull llama3
ollama pull llava
```

**Linux/Mac:**
```bash
# Make script executable and run
chmod +x install_models.sh
./install_models.sh

# Or manually:
ollama pull llama3
ollama pull llava
```

### Other Common Issues

- **"Model failed" error**: Make sure Ollama is running and you have pulled the models
- **"Cannot connect to Ollama"**: 
  - Make sure Ollama is installed from https://ollama.ai
  - On Windows, ensure Ollama service is running
  - Try restarting Ollama
- **Connection refused**: Ensure the server is running on port 8000 and no other application is using that port
- **Static files not loading**: Make sure you're accessing the app via `http://localhost:8000` (not `file://`)

## Notes

- The application runs entirely on your local machine
- No internet connection required after initial setup
- All data stays on your computer
