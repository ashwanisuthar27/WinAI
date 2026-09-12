import streamlit as st
from PIL import Image

# -----------------------
# Page Config
# -----------------------
st.set_page_config(
    page_title="Brain Tumor MRI Classifier",
    page_icon="🧠",
    layout="wide"
)

# -----------------------
# Custom CSS
# -----------------------
st.markdown("""
<style>

.title{
    font-size:40px;
    font-weight:bold;
    text-align:center;
    color:#1565C0;
}

.subtitle{
    text-align:center;
    color:#555555;
}

.result-box{
    background-color:#1565C0;
    color:white;
    padding:20px;
    border-radius:12px;
    border:2px solid #0D47A1;
    text-align:center;
    margin-top:10px;
}

.result-box h2{
    color:white;
    margin:0;
}

.result-box h3{
    color:#E3F2FD;
    margin-top:10px;
}

</style>
""", unsafe_allow_html=True)

# -----------------------
# Header
# -----------------------
st.markdown('<div class="title">🧠 Brain Tumor MRI Classification</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Upload an MRI image to predict the tumor type.</div>', unsafe_allow_html=True)

st.write("")

left, right = st.columns([1,1])

# -----------------------
# Upload Section
# -----------------------
with left:

    st.subheader("📤 Upload MRI Image")

    uploaded_file = st.file_uploader(
        "Choose an MRI image",
        type=["jpg","jpeg","png"]
    )

    predict = st.button(
        "🔍 Predict",
        use_container_width=True
    )

# -----------------------
# Result Section
# -----------------------
with right:

    st.subheader("Prediction")

    if uploaded_file is not None:

        image = Image.open(uploaded_file)

        st.image(
            image,
            caption="Uploaded MRI",
            use_container_width=True
        )

        if predict:

            # ------------------------------------
            # Put your prediction code here
            # ------------------------------------

            disease = "Glioma"
            confidence = 97.52

            st.success("Prediction Completed")

            st.markdown(f"""
            <div class="result-box">
            <h2>🧠 {disease}</h2>
            <h3>Confidence : {confidence:.2f}%</h3>
            </div>
            """, unsafe_allow_html=True)

            st.subheader("Probability")

            chart = {
                "Glioma":0.97,
                "Meningioma":0.02,
                "Pituitary":0.01,
                "No Tumor":0.00
            }

            st.bar_chart(chart)

            st.subheader("Disease Information")

            st.info("""
Glioma is a tumor that begins in the glial cells of the brain.

Replace this text with the information corresponding to the predicted class.
""")

    else:

        st.info("Upload an MRI image to start.")

# -----------------------
# Footer
# -----------------------
st.markdown("---")
st.caption("Brain Tumor MRI Classification using EfficientNetV2B3")