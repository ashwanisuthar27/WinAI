# 🧠 Brain Tumor MRI Classification using EfficientNetV2B3

![Python](https://img.shields.io/badge/Python-3.10-blue.svg)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-Web%20App-red.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 📌 Project Overview

Brain Tumor MRI Classification is a Deep Learning project that automatically classifies brain MRI scans into one of four categories using a fine-tuned **EfficientNetV2B3** model.

The project also includes a **Streamlit Web Application** that allows users to upload an MRI image and receive a prediction with confidence scores and probability visualization.

---

# 🎯 Objectives

- Detect Brain Tumor from MRI images.
- Classify MRI images into one of four classes.
- Provide an easy-to-use web interface.
- Demonstrate Transfer Learning using EfficientNetV2B3.
- Showcase a real-world Deep Learning deployment.

---

# 🧠 Tumor Classes

The model predicts one of the following classes:

- Glioma
- Meningioma
- Pituitary Tumor
- No Tumor

---

# 🏗️ Project Structure

```
BrainTumor_TransferLearning_Project/
│
├── app.py
├── BrainTumor_EfficientNetV2B3.keras
├── BrainTumor_EfficientNetV2B3.h5
├── best_brain_tumor_model.keras
├── class_names.json
├── requirements.txt
├── training_log.csv
└── README.md
```

---

# 📂 Dataset

**Dataset Name**

Brain Tumor MRI Dataset

**Kaggle Dataset Link**

https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset

**Kaggle ID**

ashwanidhukra(https://www.kaggle.com/ashwanidhukra)

**Kaggle Notebook Link**

https://www.kaggle.com/code/ashwanidhukra/brain-tumor-mri-classification-using-transfer-lear

Dataset contains MRI scans belonging to four different categories.

Training Images

- Glioma
- Meningioma
- Pituitary
- No Tumor

Testing Images

Images are used to evaluate model performance after training.

---

# 🧠 Model Architecture

Transfer Learning Model

**EfficientNetV2B3**

Additional Layers

- Global Average Pooling
- Batch Normalization
- Dense Layer
- Dropout
- Softmax Output Layer

---

# ⚙️ Training Configuration

| Parameter | Value |
|------------|-------|
| Model | EfficientNetV2B3 |
| Image Size | 300 × 300 |
| Optimizer | AdamW |
| Loss Function | Categorical Crossentropy |
| Label Smoothing | 0.1 |
| Learning Rate | Cosine Decay |
| Mixed Precision | Enabled |
| Framework | TensorFlow / Keras |

---

# 📈 Model Performance

The trained model provides high classification accuracy on unseen MRI images.

Evaluation includes:

- Accuracy
- Precision
- Recall
- F1 Score
- Confusion Matrix
- ROC Curve
- Precision-Recall Curve

---

# 💻 Streamlit Web Application

The project contains a Streamlit-based graphical user interface.

Features include:

- Upload MRI Image
- Image Preview
- Predict Button
- Tumor Prediction
- Confidence Score
- Probability Chart
- Disease Information
- Clean Responsive Interface

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/BrainTumor_TransferLearning_Project.git

cd BrainTumor_TransferLearning_Project
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

# ▶️ Run Application

```bash
streamlit run app.py
```

Application will open in your browser.

Usually at

```
http://localhost:8501
```

---

# 🖼️ How to Use

1. Open the application.
2. Upload an MRI image.
3. Click **Predict**.
4. Wait for the prediction.
5. View

- Predicted Class
- Confidence Score
- Probability Graph
- Disease Information

---

# 📊 Output

The application displays

- Uploaded MRI
- Predicted Tumor Class
- Confidence Percentage
- Probability Distribution
- Disease Description

---

# 🛠 Technologies Used

- Python
- TensorFlow
- Keras
- NumPy
- Pillow
- Streamlit
- Matplotlib
- Pandas

---

# 📋 Requirements

```
tensorflow
streamlit
numpy
pandas
matplotlib
Pillow
```

Install using

```bash
pip install -r requirements.txt
```

---

# 📸 Application Preview

Add screenshots of your application here.

Example

```
images/
│
├── home.png
├── prediction.png
└── result.png
```

---

# 🔮 Future Improvements

- Grad-CAM Heatmap Visualization
- Multi-model Support
- PDF Report Generation
- Mobile-Friendly Interface
- Explainable AI
- Cloud Deployment
- Docker Support
- REST API

---

# 👨‍💻 Author

**Ashwani Dhukra**

B.Tech Computer Science Engineering

Artificial Intelligence & Machine Learning Enthusiast

---

# ⭐ Acknowledgements

- TensorFlow
- Keras
- Streamlit
- EfficientNetV2
- Kaggle
- Brain Tumor MRI Dataset

---

# 📜 License

This project is developed for educational and research purposes.

MIT License

---

## ⭐ If you found this project helpful, consider giving it a star on GitHub!