import torch
import torch.nn as nn
import cv2
import numpy as np
import timm
import gradio as gr
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

# 1. Setup Configuration
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL_PATH = 'best_emphysema_model_b3.pth'
IMAGE_SIZE = 384

# 2. Recreate Model Architecture
class ChestXrayModel(nn.Module):
    def __init__(self, model_name='tf_efficientnet_b3'):
        super().__init__()
        self.backbone = timm.create_model(model_name, pretrained=False, num_classes=1)
        
    def forward(self, x):
        return self.backbone(x)

# 3. Load Model and Grad-CAM
model = ChestXrayModel()
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.to(DEVICE)
model.eval()

target_layers = [model.backbone.conv_head]
cam = GradCAM(model=model, target_layers=target_layers)

# 4. Preprocessing Pipeline (Same as Training)
transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    A.CLAHE(clip_limit=3.5, tile_grid_size=(8, 8), p=1.0),
    A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ToTensorV2()
])

def predict(input_img):
    # Prepare Image
    img_rgb = cv2.cvtColor(input_img, cv2.COLOR_BGR2RGB)
    aug = transform(image=img_rgb)
    input_tensor = aug['image'].unsqueeze(0).to(DEVICE)

    # Run Inference
    with torch.no_grad():
        logits = model(input_tensor)
        prob = torch.sigmoid(logits).item()
    
    # Generate Heatmap
    targets = [ClassifierOutputTarget(0)]
    grayscale_cam = cam(input_tensor=input_tensor, targets=targets)[0, :]
    
    # Process original image for overlay
    img_display = cv2.resize(img_rgb, (IMAGE_SIZE, IMAGE_SIZE)) / 255.0
    cam_image = show_cam_on_image(img_display, grayscale_cam, use_rgb=True)
    
    label = "EMPHYSEMA DETECTED" if prob > 0.5 else "NORMAL / NO FINDING"
    confidence = prob if prob > 0.5 else (1 - prob)
    
    return cam_image, f"{label} (Confidence: {confidence:.2%})"

# 5. Build Gradio Interface
interface = gr.Interface(
    fn=predict,
    inputs=gr.Image(label="Upload Chest X-Ray"),
    outputs=[
        gr.Image(label="Explainability Heatmap (Grad-CAM)"),
        gr.Textbox(label="Model Prediction")
    ],
    title="🫁 AI Emphysema Diagnostic Assistant",
    description="Upload a Chest X-ray to detect Emphysema. The heatmap highlights areas of concern.",
    theme="soft"
)

if __name__ == "__main__":
    interface.launch(share=True)