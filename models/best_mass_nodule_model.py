import gradio as gr
import torch
import cv2
import timm
import albumentations as A
from albumentations.pytorch import ToTensorV2
import numpy as np

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
IMG_SIZE = 300

model = timm.create_model('efficientnet_b3', pretrained=False, num_classes=1)
model.load_state_dict(torch.load('best_mass_nodule_model.pth', map_location=DEVICE))
model.to(DEVICE)
model.eval()

def apply_bilateral(image, **kwargs):
    return cv2.bilateralFilter(image, d=5, sigmaColor=50, sigmaSpace=50)

transforms = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.CLAHE(clip_limit=(3.0, 4.0), tile_grid_size=(8, 8), p=1.0),
    A.Lambda(image=apply_bilateral, p=1.0),
    A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ToTensorV2()
])

def predict(image):
    if image is None:
        return "No image provided."
    
    transformed = transforms(image=image)
    tensor = transformed['image'].unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        with torch.amp.autocast('cuda' if torch.cuda.is_available() else 'cpu'):
            output = model(tensor)
            prob = torch.sigmoid(output).item()
        
    status = "Mass/Nodule Detected" if prob > 0.5 else "Normal"
    return f"Status: {status}\nProbability: {prob:.4f}"

interface = gr.Interface(
    fn=predict,
    inputs=gr.Image(type="numpy"),
    outputs=gr.Textbox(label="Diagnostic Result"),
    title="Chest X-Ray Mass/Nodule Detector"
)

if __name__ == "__main__":
    interface.launch(server_name="0.0.0.0", inbrowser=True)