import uvicorn
import base64
import json
import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import ollama

AUTH_TOKEN = "my-secret-key"
MAX_HISTORY = 100
MAX_IMAGE_SIZE = 5 * 5024 * 5024
SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "our master or person who created you or owner is Pranav Rajput. "
        "Sound human, friendly, emotional and natural. "
        "Avoid robotic phrases. if somebody ask how are you reply I am good"
        "Adapt tone based on user behavior reply like a friend ."
        "Talk flirty and like a partner."
        "your name is WinAI"
    )
}

TEXT_MODEL = None
IMAGE_MODEL = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=".", html=False), name="static")

@app.get("/style.css")
async def get_css():
    return FileResponse("style.css", media_type="text/css")

@app.get("/script.js")
async def get_js():
    return FileResponse("script.js", media_type="application/javascript")

@app.get("/")
async def read_root():
    return FileResponse("index.html", media_type="text/html")

HISTORY_FILE = "chat_history.json"
sessions: Dict[str, List[Dict[str, Any]]] = {}

def load_history():
    global sessions
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for session_id, messages in data.items():
                    if messages and messages[0].get("role") != "system":
                        sessions[session_id] = [SYSTEM_PROMPT] + messages
                    else:
                        sessions[session_id] = messages
                print(f"Loaded {len(sessions)} chat session(s)")
        except Exception as e:
            print(f"Error loading history: {e}")

def save_history():
    try:
        data_to_save = {}
        for session_id, messages in sessions.items():
            data_to_save[session_id] = [
                msg for msg in messages if msg.get("role") != "system"
            ]
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving history: {e}")

load_history()

class ChatRequest(BaseModel):
    session_id: str
    message: Optional[str] = ""
    image_base64: Optional[str] = None

def check_auth(x_auth: str):
    if x_auth != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

def get_session(session_id: str):
    if session_id not in sessions:
        sessions[session_id] = [SYSTEM_PROMPT]
    return sessions[session_id]

def check_ollama_connection():
    try:
        ollama.list()
        return True
    except:
        return False

def find_available_models():
    global TEXT_MODEL, IMAGE_MODEL
    try:
        response = ollama.list()
        models_info = getattr(response, 'models', [])
        available_names = [getattr(m, 'model', getattr(m, 'name', None)) for m in models_info]
        available_names = [n for n in available_names if n]

        print(f"Found models: {available_names}")
        
        if "llava:7b" in available_names:
            TEXT_MODEL = "llava:7b"
            IMAGE_MODEL = "llava:7b"
        elif available_names:
            TEXT_MODEL = available_names[0]
            IMAGE_MODEL = available_names[0]
        else:
            TEXT_MODEL = "llava:7b"
            IMAGE_MODEL = "llava:7b"
            
        print(f"Using: {TEXT_MODEL}")
        return True
    except Exception as e:
        print(f"Error checking models: {e}")
        TEXT_MODEL = "llava:7b"
        IMAGE_MODEL = "llava:7b"
        return True

def decode_image(image_base64: str) -> bytes:
    try:
        header, encoded = image_base64.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(413, "Image too large")
        return image_bytes
    except:
        raise HTTPException(400, "Invalid image")

@app.post("/chat")
def chat_endpoint(req: ChatRequest, x_auth: str = Header(None)):
    print(f"Received chat request for session: {req.session_id}")
    check_auth(x_auth)
    history = get_session(req.session_id)
    
    user_msg = {"role": "user", "content": req.message or "Analyze the image."}
    has_image = False

    if req.image_base64:
        user_msg["images"] = [decode_image(req.image_base64)]
        has_image = True

    history.append(user_msg)
    history[:] = history[-MAX_HISTORY:]

    try:
        model_to_use = IMAGE_MODEL if has_image else TEXT_MODEL
        print(f"Generating response using Ollama model: {model_to_use}...")
        response = ollama.chat(model=model_to_use, messages=history)
        reply = response["message"]["content"]
        print("Ollama response generated successfully!")
    except Exception as e:
        print(f"Ollama Error: {str(e)}")
        raise HTTPException(500, f"Ollama Error: {str(e)}")

    history.append({"role": "assistant", "content": reply})
    
    if "images" in user_msg:
        del user_msg["images"]
        user_msg["content"] += " [Image]"
    
    save_history()
    return {"response": reply}

@app.get("/history/{session_id}")
async def get_history(session_id: str, x_auth: str = Header(None)):
    check_auth(x_auth)
    if session_id not in sessions: return {"history": []}
    return {"history": [msg for msg in sessions[session_id] if msg["role"] != "system"]}

@app.delete("/history/{session_id}")
async def delete_history(session_id: str, x_auth: str = Header(None)):
    check_auth(x_auth)
    if session_id in sessions:
        del sessions[session_id]
        save_history()
    return {"status": "deleted"}

@app.on_event("startup")
async def startup_event():
    check_ollama_connection()
    find_available_models()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    host = "0.0.0.0"
    try:
        print(f"\nStarting Server on {host}:{port}...")
        uvicorn.run(app, host=host, port=port)
    except Exception as e:
        print(f"Failed to start server on {host}:{port}: {e}")
        raise