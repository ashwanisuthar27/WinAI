import base64
import io
import json
import os
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Optional

import albumentations as A
import cv2
import numpy as np
import ollama
import timm
import torch
import torch.nn as nn
import uvicorn
from albumentations.pytorch import ToTensorV2
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image

AUTH_TOKEN = "my-secret-key"
MAX_HISTORY_MESSAGES = 18
MAX_IMAGE_SIZE = 5 * 1024 * 1024
HISTORY_FILE = "chat_history.json"
MODELS_DIR = Path("models")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BASE_SYSTEM_PROMPT = (
    "You are WinAI, a warm and careful medical AI assistant for chest X-ray support. "
    "You help users understand model findings in clear, human language. "
    "and when clinical review is important. If the conversation includes prior chat context, "
    "use it to answer follow-up questions naturally. Keep responses supportive and easy to understand."
)

MODEL_FRIENDLY_NAMES = {
    "pneumonia": "Pneumonia",
    "tb": "Tuberculosis (TB)",
    "pneumothorax": "Pneumothorax",
    "cardiomegaly": "Cardiomegaly",
    "emphysema": "Emphysema",
    "mass_nodule": "Mass / Nodule (Lung Cancer proxy)",
    "rib_fracture": "Rib Fracture",
}


class ChatRequest(BaseModel):
    session_id: str
    message: Optional[str] = ""
    image_base64: Optional[str] = None
    selected_model: Optional[str] = None


class BinaryEfficientNetModel(nn.Module):
    def __init__(self, model_name: str = "efficientnet_b3", squeeze: bool = False):
        super().__init__()
        self.model = timm.create_model(model_name, pretrained=False, in_chans=3, num_classes=1)
        self.squeeze = squeeze

    def forward(self, x):
        output = self.model(x)
        return output.squeeze(-1) if self.squeeze else output


class PneumothoraxModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.model = timm.create_model(
            "tf_efficientnet_b3.ns_jft_in1k",
            pretrained=False,
            in_chans=3,
            num_classes=1,
        )

    def forward(self, x):
        return self.model(x).squeeze(-1)


class TBModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.model = timm.create_model("efficientnet_b3", pretrained=False, num_classes=2)

    def forward(self, x):
        return self.model(x)


class EmphysemaModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = timm.create_model("tf_efficientnet_b3", pretrained=False, num_classes=1)

    def forward(self, x):
        return self.backbone(x)


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan_handler(app: FastAPI):
    load_history()
    check_ollama_connection()
    find_available_ollama_model()
    load_medical_models()
    yield

app = FastAPI(lifespan=lifespan_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static", html=False), name="static")

TEXT_MODEL = None
MEDICAL_MODELS: Dict[str, Dict[str, Any]] = {}
sessions: Dict[str, Dict[str, Any]] = {}


def check_auth(x_auth: Optional[str]):
    if x_auth != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


def tensor_from_transform(transform: A.Compose, image_rgb: np.ndarray) -> torch.Tensor:
    augmented = transform(image=image_rgb)
    return augmented["image"].unsqueeze(0).to(DEVICE)


def decode_image_to_rgb(image_base64: str) -> np.ndarray:
    try:
        _, encoded = image_base64.split(",", 1)
        image_bytes = base64.b64decode(encoded)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload") from exc

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large")

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image data") from exc

    return np.array(image)


def extract_state_dict(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        if "state_dict" in payload and isinstance(payload["state_dict"], dict):
            return payload["state_dict"]
        return payload
    return payload


def rewrite_prefix(state_dict: Dict[str, Any], strip_prefix: str = "", add_prefix: str = "") -> OrderedDict:
    rewritten = OrderedDict()
    for key, value in state_dict.items():
        next_key = key
        if strip_prefix and key.startswith(strip_prefix):
            next_key = key[len(strip_prefix):]
        rewritten[f"{add_prefix}{next_key}"] = value
    return rewritten


def load_checkpoint_flex(model: nn.Module, checkpoint_name: str):
    checkpoint = torch.load(MODELS_DIR / checkpoint_name, map_location=DEVICE)
    state_dict = extract_state_dict(checkpoint)
    attempts = [
        state_dict,
        rewrite_prefix(state_dict, strip_prefix="model."),
        rewrite_prefix(state_dict, strip_prefix="backbone."),
        rewrite_prefix(state_dict, add_prefix="model."),
        rewrite_prefix(state_dict, add_prefix="backbone."),
        rewrite_prefix(state_dict, strip_prefix="model.", add_prefix="backbone."),
        rewrite_prefix(state_dict, strip_prefix="backbone.", add_prefix="model."),
    ]

    seen = set()
    last_error = None
    for candidate in attempts:
        signature = tuple(candidate.keys())[:5]
        if signature in seen:
            continue
        seen.add(signature)
        try:
            model.load_state_dict(candidate, strict=True)
            return
        except Exception as exc:
            last_error = exc

    raise last_error


def load_pneumonia_model() -> Dict[str, Any]:
    model = timm.create_model("efficientnet_b3", pretrained=False, num_classes=1)
    load_checkpoint_flex(model, "best_pneumonia_model.pth")
    model.to(DEVICE).eval()

    transform = A.Compose(
        [
            A.Resize(224, 224),
            A.CLAHE(clip_limit=4.0, tile_grid_size=(8, 8), p=1.0),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        filtered = cv2.bilateralFilter(image_rgb, d=9, sigmaColor=75, sigmaSpace=75)
        tensor = tensor_from_transform(transform, filtered)
        with torch.no_grad():
            prob = torch.sigmoid(model(tensor)).item()
        positive = prob >= 0.5
        return {
            "label": "PNEUMONIA" if positive else "NORMAL",
            "confidence": prob if positive else 1 - prob,
            "scores": {"positive": prob, "negative": 1 - prob},
        }

    return {"model": model, "predict": predict}


def load_tb_model() -> Dict[str, Any]:
    model = TBModel()
    load_checkpoint_flex(model, "best_tb_model.pth")
    model.to(DEVICE).eval()

    transform = A.Compose(
        [
            A.Resize(224, 224),
            A.CLAHE(clip_limit=3.0, tile_grid_size=(8, 8), p=1.0),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        filtered = cv2.bilateralFilter(image_rgb, 9, 75, 75)
        tensor = tensor_from_transform(transform, filtered)
        with torch.no_grad():
            probs = torch.softmax(model(tensor), dim=1)[0]
        prediction = int(torch.argmax(probs).item())
        labels = {0: "NORMAL", 1: "TUBERCULOSIS"}
        return {
            "label": labels[prediction],
            "confidence": float(probs[prediction].item()),
            "scores": {"normal": float(probs[0].item()), "tuberculosis": float(probs[1].item())},
        }

    return {"model": model, "predict": predict}


def load_pneumothorax_model() -> Dict[str, Any]:
    model = PneumothoraxModel()
    load_checkpoint_flex(model, "best_pneumothorax_model.pth")
    model.to(DEVICE).eval()
    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))

    transform = A.Compose(
        [
            A.Resize(384, 384),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        enhanced = clahe.apply(gray)
        filtered = cv2.bilateralFilter(enhanced, d=9, sigmaColor=75, sigmaSpace=75)
        rgb = cv2.cvtColor(filtered, cv2.COLOR_GRAY2RGB)
        tensor = tensor_from_transform(transform, rgb)
        with torch.no_grad():
            prob = torch.sigmoid(model(tensor)).item()
        positive = prob > 0.5
        return {
            "label": "PNEUMOTHORAX DETECTED" if positive else "NORMAL",
            "confidence": prob if positive else 1 - prob,
            "scores": {"positive": prob, "negative": 1 - prob},
        }

    return {"model": model, "predict": predict}


def load_cardiomegaly_model() -> Dict[str, Any]:
    model = timm.create_model("efficientnet_b3", pretrained=False, num_classes=1)
    load_checkpoint_flex(model, "best_cardiomegaly_model.pth")
    model.to(DEVICE).eval()

    def apply_bilateral(image: np.ndarray, **kwargs) -> np.ndarray:
        return cv2.bilateralFilter(image, d=9, sigmaColor=75, sigmaSpace=75)

    transform = A.Compose(
        [
            A.Resize(300, 300),
            A.Lambda(image=apply_bilateral, p=1.0),
            A.CLAHE(clip_limit=3.5, tile_grid_size=(8, 8), p=1.0),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        tensor = tensor_from_transform(transform, image_rgb)
        with torch.no_grad():
            prob = torch.sigmoid(model(tensor)).item()
        positive = prob > 0.5
        return {
            "label": "CARDIOMEGALY" if positive else "NORMAL",
            "confidence": prob if positive else 1 - prob,
            "scores": {"positive": prob, "negative": 1 - prob},
        }

    return {"model": model, "predict": predict}


def load_emphysema_model() -> Dict[str, Any]:
    model = EmphysemaModel()
    load_checkpoint_flex(model, "best_emphysema_model_b3.pth")
    model.to(DEVICE).eval()

    transform = A.Compose(
        [
            A.Resize(384, 384),
            A.CLAHE(clip_limit=3.5, tile_grid_size=(8, 8), p=1.0),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        tensor = tensor_from_transform(transform, image_rgb)
        with torch.no_grad():
            prob = torch.sigmoid(model(tensor)).item()
        positive = prob > 0.5
        return {
            "label": "EMPHYSEMA DETECTED" if positive else "NORMAL / NO FINDING",
            "confidence": prob if positive else 1 - prob,
            "scores": {"positive": prob, "negative": 1 - prob},
        }

    return {"model": model, "predict": predict}


def load_rib_fracture_model() -> Dict[str, Any]:
    model = BinaryEfficientNetModel("efficientnet_b3")
    load_checkpoint_flex(model, "best_fracture_model_b3.pth")
    model.to(DEVICE).eval()

    transform = A.Compose(
        [
            A.Resize(300, 300),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        tensor = tensor_from_transform(transform, image_rgb)
        with torch.no_grad():
            prob = torch.sigmoid(model(tensor)).item()
        positive = prob > 0.5
        return {
            "label": "RIB FRACTURE" if positive else "NORMAL",
            "confidence": prob if positive else 1 - prob,
            "scores": {"positive": prob, "negative": 1 - prob},
        }

    return {"model": model, "predict": predict}


def load_mass_nodule_model() -> Dict[str, Any]:
    model = timm.create_model("efficientnet_b3", pretrained=False, num_classes=1)
    load_checkpoint_flex(model, "best_mass_nodule_model.pth")
    model.to(DEVICE).eval()

    def apply_bilateral(image: np.ndarray, **kwargs) -> np.ndarray:
        return cv2.bilateralFilter(image, d=5, sigmaColor=50, sigmaSpace=50)

    transform = A.Compose(
        [
            A.Resize(300, 300),
            A.CLAHE(clip_limit=(3.0, 4.0), tile_grid_size=(8, 8), p=1.0),
            A.Lambda(image=apply_bilateral, p=1.0),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]
    )

    def predict(image_rgb: np.ndarray) -> Dict[str, Any]:
        tensor = tensor_from_transform(transform, image_rgb)
        with torch.no_grad():
            output = model(tensor)
            prob = torch.sigmoid(output).item()
        positive = prob > 0.5
        return {
            "label": "MASS / NODULE DETECTED" if positive else "NORMAL",
            "confidence": prob if positive else 1 - prob,
            "scores": {"positive": prob, "negative": 1 - prob},
        }

    return {"model": model, "predict": predict}


def get_model_blueprints() -> List[Dict[str, Any]]:
    return [
        {
            "id": "pneumonia",
            "label": MODEL_FRIENDLY_NAMES["pneumonia"],
            "task": "Binary chest X-ray classification for pneumonia",
            "loader": load_pneumonia_model,
        },
        {
            "id": "tb",
            "label": MODEL_FRIENDLY_NAMES["tb"],
            "task": "Tuberculosis screening",
            "loader": load_tb_model,
        },
        {
            "id": "pneumothorax",
            "label": MODEL_FRIENDLY_NAMES["pneumothorax"],
            "task": "Collapsed lung screening",
            "loader": load_pneumothorax_model,
        },
        {
            "id": "cardiomegaly",
            "label": MODEL_FRIENDLY_NAMES["cardiomegaly"],
            "task": "Heart enlargement screening",
            "loader": load_cardiomegaly_model,
        },
        {
            "id": "emphysema",
            "label": MODEL_FRIENDLY_NAMES["emphysema"],
            "task": "Emphysema screening",
            "loader": load_emphysema_model,
        },
        {
            "id": "mass_nodule",
            "label": MODEL_FRIENDLY_NAMES["mass_nodule"],
            "task": "Mass or nodule screening",
            "loader": load_mass_nodule_model,
        },
        {
            "id": "rib_fracture",
            "label": MODEL_FRIENDLY_NAMES["rib_fracture"],
            "task": "Rib fracture screening",
            "loader": load_rib_fracture_model,
        },
    ]


def load_medical_models():
    for blueprint in get_model_blueprints():
        model_id = blueprint["id"]
        loader = blueprint.get("loader")
        metadata = {
            "id": model_id,
            "label": blueprint["label"],
            "task": blueprint["task"],
            "available": False,
            "error": blueprint.get("error"),
            "predict": None,
        }
        if loader is None:
            MEDICAL_MODELS[model_id] = metadata
            continue
        try:
            loaded = loader()
            metadata["predict"] = loaded["predict"]
            metadata["available"] = True
            metadata["error"] = None
            print(f"Loaded medical model: {model_id}")
        except Exception as exc:
            metadata["error"] = str(exc)
            print(f"Failed to load medical model {model_id}: {exc}")
        MEDICAL_MODELS[model_id] = metadata


def load_history():
    global sessions
    if not os.path.exists(HISTORY_FILE):
        return
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        for session_id, payload in data.items():
            if isinstance(payload, list):
                messages = [msg for msg in payload if msg.get("role") != "system"]
                sessions[session_id] = {"messages": messages, "summary": ""}
            else:
                messages = payload.get("messages", [])
                sessions[session_id] = {
                    "messages": [msg for msg in messages if msg.get("role") != "system"],
                    "summary": payload.get("summary", ""),
                }
        print(f"Loaded {len(sessions)} chat session(s)")
    except Exception as exc:
        print(f"Error loading history: {exc}")


def save_history():
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as handle:
            json.dump(sessions, handle, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"Error saving history: {exc}")


def get_session(session_id: str) -> Dict[str, Any]:
    if session_id not in sessions:
        sessions[session_id] = {"messages": [], "summary": ""}
    return sessions[session_id]


def check_ollama_connection() -> bool:
    try:
        ollama.list()
        return True
    except Exception as exc:
        print(f"Ollama connection check failed: {exc}")
        return False


def find_available_ollama_model() -> bool:
    global TEXT_MODEL
    try:
        response = ollama.list()
        models_info = getattr(response, "models", [])
        available_names = [getattr(item, "model", getattr(item, "name", None)) for item in models_info]
        available_names = [name for name in available_names if name]
        preferred_order = ["llama3", "llama3.1", "llava:7b", "llava", "mistral", "phi4"]
        for preferred in preferred_order:
            if preferred in available_names:
                TEXT_MODEL = preferred
                break
        if TEXT_MODEL is None and available_names:
            TEXT_MODEL = available_names[0]
        if TEXT_MODEL is None:
            TEXT_MODEL = "llama3"
        print(f"Using Ollama model: {TEXT_MODEL}")
        return True
    except Exception as exc:
        print(f"Error checking Ollama models: {exc}")
        TEXT_MODEL = "llama3"
        return False


def summarise_chat(session_id: str):
    session = get_session(session_id)
    messages = session["messages"]
    if len(messages) <= MAX_HISTORY_MESSAGES:
        return

    archived = messages[:-8]
    recent = messages[-8:]
    prompt_lines = []
    for msg in archived:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        prompt_lines.append(f"{role}: {content}")

    summary_request = [
        {
            "role": "system",
            "content": (
                "Summarize the chat so the assistant can answer future follow-up questions. "
                "Keep important medical findings, user concerns, recommendations, and unresolved questions."
            ),
        },
        {"role": "user", "content": "\n".join(prompt_lines)},
    ]

    try:
        response = ollama.chat(model=TEXT_MODEL, messages=summary_request)
        session["summary"] = response["message"]["content"]
        session["messages"] = recent
    except Exception as exc:
        print(f"Summary generation failed: {exc}")


def build_chat_messages(session: Dict[str, Any], user_message: str, inference: Optional[Dict[str, Any]] = None):
    messages: List[Dict[str, str]] = [{"role": "system", "content": BASE_SYSTEM_PROMPT}]

    if session.get("summary"):
        messages.append(
            {
                "role": "system",
                "content": f"Conversation summary so far:\n{session['summary']}",
            }
        )

    messages.extend(session["messages"])

    if inference is not None:
        user_content = (
            f"User note: {user_message or 'No extra text provided.'}\n\n"
            f"Selected medical model: {inference['model_label']}\n"
            f"Prediction label: {inference['label']}\n"
            f"Confidence: {inference['confidence_percent']}\n"
            f"Scores: {json.dumps(inference['scores'])}\n\n"
            "Explain these findings in friendly language, include what the model suggests, "
            "what it does not prove, and a practical next step."
        )
    else:
        user_content = user_message

    messages.append({"role": "user", "content": user_content})
    return messages


def run_medical_inference(selected_model: str, image_rgb: np.ndarray) -> Dict[str, Any]:
    if not selected_model:
        raise HTTPException(status_code=400, detail="Please select a medical model for image analysis.")

    if selected_model not in MEDICAL_MODELS:
        raise HTTPException(status_code=400, detail="Unknown medical model selected.")

    model_info = MEDICAL_MODELS[selected_model]
    if not model_info["available"] or model_info["predict"] is None:
        raise HTTPException(
            status_code=400,
            detail=model_info.get("error") or "Selected medical model is not available.",
        )

    result = model_info["predict"](image_rgb)
    return {
        "model_id": selected_model,
        "model_label": model_info["label"],
        "label": result["label"],
        "confidence": result["confidence"],
        "confidence_percent": f"{result['confidence'] * 100:.2f}%",
        "scores": result["scores"],
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(content=b"", media_type="image/x-icon")


@app.get("/")
async def read_root():
    return FileResponse("index.html", media_type="text/html")


@app.get("/style.css")
async def get_css():
    return FileResponse("style.css", media_type="text/css")


@app.get("/script.js")
async def get_js():
    return FileResponse("script.js", media_type="application/javascript")


@app.get("/models")
async def list_models(x_auth: str = Header(None)):
    check_auth(x_auth)
    return {
        "models": [
            {
                "id": model_id,
                "label": metadata["label"],
                "task": metadata["task"],
                "available": metadata["available"],
                "error": metadata["error"],
            }
            for model_id, metadata in MEDICAL_MODELS.items()
        ]
    }


@app.post("/chat")
def chat_endpoint(req: ChatRequest, x_auth: str = Header(None)):
    check_auth(x_auth)
    session = get_session(req.session_id)
    user_text = (req.message or "").strip()
    has_image = bool(req.image_base64)

    if not user_text and not has_image:
        raise HTTPException(status_code=400, detail="Message or image is required.")

    inference = None
    if has_image:
        image_rgb = decode_image_to_rgb(req.image_base64)
        inference = run_medical_inference(req.selected_model or "", image_rgb)

    model_messages = build_chat_messages(session, user_text, inference)

    # Trim to last 6 turns (12 messages) to prevent OOM on large histories
    MAX_TURNS = 6
    trimmed_messages = model_messages[:1]  # keep system prompt
    convo_msgs = [m for m in model_messages[1:] if m["role"] != "system"]
    if len(convo_msgs) > MAX_TURNS * 2:
        convo_msgs = convo_msgs[-(MAX_TURNS * 2):]
    model_messages = trimmed_messages + [m for m in model_messages[1:] if m["role"] == "system"] + convo_msgs

    reply = None
    last_error = None

    for attempt in range(2):  # try full context, then minimal context on failure
        try:
            # First attempt: full context. Second attempt: minimal context (System + current User message)
            msgs_to_send = model_messages if attempt == 0 else [model_messages[0], model_messages[-1]]
            response = ollama.chat(model=TEXT_MODEL, messages=msgs_to_send)
            reply = response["message"]["content"]
            break
        except Exception as exc:
            last_error = exc
            err_str = str(exc).lower()
            # Ollama runner crash — retry with minimal context
            if "runner" in err_str or "terminated" in err_str or "500" in err_str:
                print(f"Ollama runner crash on attempt {attempt + 1}, retrying with minimal context...")
                continue
            # Non-recoverable error (connection refused, model not found, etc.)
            break

    if reply is None:
        err_msg = str(last_error)
        # Parse Go-style nil error formatting: %!w(<nil>)
        if "%!w" in err_msg or "<nil>" in err_msg:
            err_msg = "The AI model ran out of memory. Try a shorter message or restart Ollama."
        elif "connection" in err_msg.lower() or "refused" in err_msg.lower():
            err_msg = "Cannot reach Ollama. Please make sure Ollama is running."
        print(f"Ollama error after all retries: {last_error}")
        return {"response": f"⚠️ {err_msg}", "medical_result": inference, "error": True}

    stored_user_text = user_text or "[Image only]"
    if inference:
        stored_user_text = (
            f"{stored_user_text}\n\n"
            f"[Medical model: {inference['model_label']} | "
            f"Prediction: {inference['label']} | Confidence: {inference['confidence_percent']}]"
        )

    session["messages"].append({"role": "user", "content": stored_user_text})
    session["messages"].append({"role": "assistant", "content": reply})
    summarise_chat(req.session_id)
    save_history()

    return {"response": reply, "medical_result": inference}


@app.get("/history/{session_id}")
async def get_history(session_id: str, x_auth: str = Header(None)):
    check_auth(x_auth)
    session = get_session(session_id)
    return {"history": session["messages"], "summary": session.get("summary", "")}


@app.delete("/history/{session_id}")
async def delete_history(session_id: str, x_auth: str = Header(None)):
    check_auth(x_auth)
    if session_id in sessions:
        del sessions[session_id]
        save_history()
    return {"status": "deleted"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    host = "0.0.0.0"
    print(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
