import gradio as gr
import torch
import cv2
import numpy as np
import timm
import albumentations as A
from albumentations.pytorch import ToTensorV2

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

model = timm.create_model('efficientnet_b3', pretrained=False, num_classes=1)
model.load_state_dict(torch.load('best_cardiomegaly_model.pth', map_location=device, weights_only=True))
model.to(device)
model.eval()

def apply_bilateral(image, **kwargs):
    return cv2.bilateralFilter(image, d=9, sigmaColor=75, sigmaSpace=75)

val_transform = A.Compose([
    A.Resize(300, 300),
    A.Lambda(image=apply_bilateral, p=1.0),
    A.CLAHE(clip_limit=3.5, tile_grid_size=(8, 8), p=1.0),
    A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
    ToTensorV2()
])

def predict(image):
    augmented = val_transform(image=image)
    img_tensor = augmented['image'].unsqueeze(0).to(device)
    
    with torch.no_grad():
        output = model(img_tensor)
        prob = torch.sigmoid(output).item()
        
    label = "Cardiomegaly" if prob > 0.5 else "Normal"
    confidence = prob if prob > 0.5 else 1.0 - prob
    return f"{label} (Confidence: {confidence * 100:.2f}%)"

iface = gr.Interface(
    fn=predict,
    inputs=gr.Image(),
    outputs=gr.Text(label="Prediction"),
    title="Cardiomegaly Detection Interface",
    flagging_mode="never"  # Updated argument for newer Gradio versions
)

if __name__ == "__main__":
    iface.launch()