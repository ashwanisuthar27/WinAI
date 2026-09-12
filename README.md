# 🏥 WinAI — Medical Imaging AI

A medical imaging AI assistant powered by custom-trained deep learning models for **Chest X-ray Analysis** and **Brain Tumor MRI Classification**, integrated with Ollama LLM for natural language explanations.

## ✨ Features

- 🫁 **Chest X-ray Analysis** — 7 specialized models:
  - Pneumonia Detection
  - Tuberculosis (TB) Screening
  - Pneumothorax Detection
  - Cardiomegaly (Heart Enlargement)
  - Emphysema Detection
  - Mass / Nodule (Lung Cancer proxy)
  - Rib Fracture Detection

- 🧠 **Brain Tumor MRI Classification** — EfficientNetV2B3 model:
  - Glioma
  - Meningioma
  - Pituitary Tumor
  - No Tumor

- 💬 **AI Chat Assistant** — Explains findings in clear, human language using Ollama LLM
- 🔐 **Firebase Authentication** — User accounts with login/signup
- 🌙 **Dark/Light Theme** — Modern, responsive UI
- 💾 **Chat History** — Persistent conversations via Firebase

## Prerequisites

1. **Python 3.8+** installed
2. **Ollama** installed and running locally
   - Download from: https://ollama.ai
   - Pull a model:
     ```bash
     ollama pull llama3
     ```

## Installation

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. **Download Brain Tumor Models** (not included due to size > 100MB):
   - Place the following files in `models/BrainTumor/`:
     - `best_brain_tumor_model.keras` (~180 MB)
   - The `class_names.json` file is already included in the repository.
   - Train your own model or download from [Kaggle](https://www.kaggle.com/code/ashwanidhukra/brain-tumor-mri-classification-using-transfer-lear)

## Running the Application

1. Make sure Ollama is running

2. Start the FastAPI server:
   ```bash
   python main.py
   ```

3. Open your browser at:
   ```
   http://localhost:8080
   ```

## 🧠 Models

### Chest X-ray Models (PyTorch / EfficientNet-B3)
All chest X-ray models use EfficientNet-B3 architecture trained on medical imaging datasets.
Model weights (`.pth` files) are in the `models/` directory.

### Brain Tumor Model (TensorFlow / EfficientNetV2B3)
- **Architecture:** EfficientNetV2B3 with fine-tuning
- **Input Size:** 300×300 RGB
- **Classes:** Glioma, Meningioma, Pituitary, No Tumor
- **Framework:** TensorFlow/Keras
- **Model file:** `models/BrainTumor/best_brain_tumor_model.keras`

## Tech Stack

- **Backend:** FastAPI + Uvicorn
- **AI Models:** PyTorch (chest), TensorFlow/Keras (brain)
- **LLM:** Ollama (llama3)
- **Frontend:** HTML + Tailwind CSS + Vanilla JS
- **Auth & Storage:** Firebase Realtime Database
- **Image Processing:** OpenCV, Albumentations, PIL

## Troubleshooting

- **"Model failed" error**: Make sure Ollama is running and models are pulled
- **Brain Tumor model not loading**: Ensure `best_brain_tumor_model.keras` is in `models/BrainTumor/`
- **TensorFlow import error**: Run `pip install tensorflow`
- **Cannot connect to Ollama**: Ensure Ollama service is running

## 👨‍💻 Author

**Ashwani Suthar**

## 📜 License

This project is developed for educational and research purposes.
