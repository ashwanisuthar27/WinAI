import tkinter as tk
from tkinter import filedialog, messagebox
import torch
import torch.nn as nn
import timm
import cv2
import numpy as np
from PIL import Image, ImageTk
import albumentations as A
from albumentations.pytorch import ToTensorV2

class TBGui:
    def __init__(self, root):
        self.root = root
        self.root.title("TB Detection System - Medical AI")
        self.root.geometry("600x700")
        
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self.load_model('best_tb_model.pth')
        
        self.transform = A.Compose([
            A.Resize(224, 224),
            A.CLAHE(clip_limit=3.0, tile_grid_size=(8, 8), p=1.0),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2()
        ])

        self.label_title = tk.Label(root, text="Tuberculosis X-Ray Classifier", font=("Arial", 20, "bold"))
        self.label_title.pack(pady=20)

        self.canvas = tk.Canvas(root, width=400, height=400, bg="gray")
        self.canvas.pack()

        self.btn_upload = tk.Button(root, text="Upload Chest X-Ray", command=self.upload_image, font=("Arial", 12), bg="#2196F3", fg="white", padx=10, pady=5)
        self.btn_upload.pack(pady=20)

        self.result_text = tk.StringVar()
        self.result_text.set("Result: Waiting for input...")
        self.label_result = tk.Label(root, textvariable=self.result_text, font=("Arial", 14, "bold"))
        self.label_result.pack()

    def load_model(self, path):
        # 1. Create the base model
        model = timm.create_model('efficientnet_b3', pretrained=False, num_classes=2)
        
        # 2. Load the state dict
        state_dict = torch.load(path, map_location=self.device)
        
        # 3. Create a new state dict without the 'model.' prefix
        from collections import OrderedDict
        new_state_dict = OrderedDict()
        
        for k, v in state_dict.items():
            if k.startswith('model.'):
                name = k[6:] # remove 'model.' (6 characters)
            else:
                name = k
            new_state_dict[name] = v
        
        # 4. Load the cleaned state dict into the model
        model.load_state_dict(new_state_dict)
        model.to(self.device)
        model.eval()
        return model

    def preprocess(self, image_path):
        image = cv2.imread(image_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image = cv2.bilateralFilter(image, 9, 75, 75)
        augmented = self.transform(image=image)
        return augmented['image'].unsqueeze(0).to(self.device)

    def upload_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("Image files", "*.jpg *.jpeg *.png")])
        if not file_path:
            return

        img = Image.open(file_path)
        img = img.resize((400, 400))
        self.img_tk = ImageTk.PhotoImage(img)
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.img_tk)

        input_tensor = self.preprocess(file_path)
        
        with torch.no_grad():
            output = self.model(input_tensor)
            prob = torch.softmax(output, dim=1)
            prediction = torch.argmax(prob, dim=1).item()
            confidence = prob[0][prediction].item()

        label_map = {0: "NORMAL", 1: "TUBERCULOSIS"}
        result = label_map[prediction]
        
        color = "red" if prediction == 1 else "green"
        self.label_result.config(fg=color)
        self.result_text.set(f"Result: {result} ({confidence:.2%})")

if __name__ == "__main__":
    root = tk.Tk()
    app = TBGui(root)
    root.mainloop()