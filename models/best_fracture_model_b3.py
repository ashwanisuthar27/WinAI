import torch
import torch.nn as nn
import timm
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np
import gradio as gr

class XRayModel(nn.Module):
    def __init__(self, model_name='efficientnet_b3', pretrained=False):
        super().__init__()
        self.model = timm.create_model(model_name, pretrained=pretrained, in_chans=3, num_classes=1)

    def forward(self, x):
        return self.model(x)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

model = XRayModel(model_name='efficientnet_b3', pretrained=False)
model.load_state_dict(torch.load('best_fracture_model_b3.pth', map_location=device))
model.to(device)
model.eval()

IMG_SIZE = 300

transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
    ToTensorV2()
])

def predict_fracture(image):
    if image is None:
        return {"Error": 0.0}
    
    img_array = np.array(image)
    
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
    elif img_array.shape[2] == 4:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
        
    transformed = transform(image=img_array)
    input_tensor = transformed['image'].unsqueeze(0).to(device)
    
    with torch.no_grad():
        output = model(input_tensor)
        prob = torch.sigmoid(output).item()
        
    return {"Fracture (Positive)": prob, "Normal (Negative)": 1.0 - prob}

interface = gr.Interface(
    fn=predict_fracture,
    inputs=gr.Image(type="pil", label="Upload Chest X-ray"),
    outputs=gr.Label(num_top_classes=2, label="Prediction Confidence"),
    title="Rib Fracture Detection AI",
    theme="default"
)

if __name__ == "__main__":
    interface.launch(share=False)