import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk
import cv2
import numpy as np
import torch
import torch.nn as nn
import timm
import albumentations as A
from albumentations.pytorch import ToTensorV2

class PneumothoraxModel(nn.Module):
    def __init__(self, model_name='tf_efficientnet_b3.ns_jft_in1k', pretrained=False):
        super().__init__()
        self.model = timm.create_model(model_name, pretrained=pretrained, in_chans=3, num_classes=1)

    def forward(self, x):
        return self.model(x).squeeze(-1)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = PneumothoraxModel(pretrained=False)

try:
    model.load_state_dict(torch.load('best_pneumothorax_model.pth', map_location=device, weights_only=True))
    model.to(device)
    model.eval()
except Exception as e:
    print(e)

transform = A.Compose([
    A.Resize(384, 384),
    A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ToTensorV2()
])

clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))

def preprocess_image(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    
    img = clahe.apply(img)
    img = cv2.bilateralFilter(img, d=9, sigmaColor=75, sigmaSpace=75)
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    
    augmented = transform(image=img)
    return augmented['image'].unsqueeze(0).to(device)

def open_image():
    file_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
    if not file_path:
        return

    try:
        display_img = Image.open(file_path)
        display_img.thumbnail((400, 400))
        img_tk = ImageTk.PhotoImage(display_img)
        panel.configure(image=img_tk)
        panel.image = img_tk

        input_tensor = preprocess_image(file_path)
        if input_tensor is None:
            result_label.configure(text="Error loading image", fg="red")
            return

        with torch.no_grad():
            output = model(input_tensor)
            prob = torch.sigmoid(output).item()

        if prob > 0.5:
            res_text = f"Pneumothorax Detected\nConfidence: {prob*100:.2f}%"
            color = "#D32F2F"
        else:
            res_text = f"Normal\nConfidence: {(1-prob)*100:.2f}%"
            color = "#388E3C"

        result_label.configure(text=res_text, fg=color)

    except Exception as e:
        messagebox.showerror("Error", str(e))

root = tk.Tk()
root.title("Local Pneumothorax Detector")
root.geometry("500x600")
root.configure(bg="#F5F5F5")

btn = tk.Button(root, text="Upload Chest X-Ray", command=open_image, font=("Segoe UI", 12, "bold"), bg="#2196F3", fg="white", padx=20, pady=10, relief="flat")
btn.pack(pady=30)

panel = tk.Label(root, bg="#F5F5F5")
panel.pack(pady=10)

result_label = tk.Label(root, text="Awaiting Image...", font=("Segoe UI", 16, "bold"), bg="#F5F5F5", fg="#555555")
result_label.pack(pady=20)

root.mainloop()