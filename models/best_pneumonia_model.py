import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk
import torch
import cv2
import albumentations as A
from albumentations.pytorch import ToTensorV2
import timm
import warnings

warnings.filterwarnings('ignore')

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

IMG_SIZE = 224

transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.CLAHE(clip_limit=4.0, tile_grid_size=(8, 8), p=1.0),
    A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
    ToTensorV2()
])

model = timm.create_model('efficientnet_b3', pretrained=False, num_classes=1)
model.load_state_dict(torch.load('best_pneumonia_model.pth', map_location=device, weights_only=True))
model = model.to(device)
model.eval()

def predict_image(image_path):
    image = cv2.imread(image_path, cv2.IMREAD_COLOR)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = cv2.bilateralFilter(image, d=9, sigmaColor=75, sigmaSpace=75)
    
    augmented = transform(image=image)
    tensor = augmented['image'].unsqueeze(0).to(device)
    
    with torch.no_grad():
        output = model(tensor)
        prob = torch.sigmoid(output).item()
            
    prediction = "PNEUMONIA" if prob >= 0.5 else "NORMAL"
    confidence = prob if prediction == "PNEUMONIA" else 1 - prob
    return prediction, confidence

class PneumoniaApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Pneumonia Detection")
        self.root.geometry("500x550")
        
        self.btn_upload = tk.Button(root, text="Upload X-Ray", command=self.upload_image, font=("Arial", 12))
        self.btn_upload.pack(pady=20)
        
        self.lbl_image = tk.Label(root)
        self.lbl_image.pack(pady=10)
        
        self.lbl_result = tk.Label(root, text="", font=("Arial", 16, "bold"))
        self.lbl_result.pack(pady=20)

    def upload_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
        if not file_path:
            return
            
        img = Image.open(file_path)
        img.thumbnail((350, 350))
        img_tk = ImageTk.PhotoImage(img)
        self.lbl_image.config(image=img_tk)
        self.lbl_image.image = img_tk
        
        prediction, confidence = predict_image(file_path)
        
        color = "red" if prediction == "PNEUMONIA" else "green"
        self.lbl_result.config(text=f"Result: {prediction}\nConfidence: {confidence:.2%}", fg=color)

if __name__ == "__main__":
    root = tk.Tk()
    app = PneumoniaApp(root)
    root.mainloop()