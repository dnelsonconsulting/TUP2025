# Transcript Uploader Backend

A Python Flask backend for uploading transcript documents, storing files in Google Drive, and writing metadata to Google Sheets.  
Built for robust, secure integration with a Next.js frontend and Google Cloud services.

---

## Features

- Accepts multi-part POST requests with files and student info
- Saves uploaded docs into organized Google Drive subfolders
- Writes a row to a Google Sheet with all metadata and links
- Returns clear JSON responses for success/error
- No Node/Busboy headaches!

---

## Folder Structure

transcript-uploader-backend/
├── app.py # Main Flask app
├── requirements.txt # Python dependencies
├── Dockerfile # For Cloud Run deployment
├── service_account.json # Google Cloud service account credentials (never commit!)
├── .gitignore # Git ignore settings
└── README.md # Project documentation



---

## Setup

### 1. Clone the repo (or create your backend folder)
```bash
git clone <your-repo-url> transcript-uploader-backend
cd transcript-uploader-backend

## Setup Virtual
Summary Table
Step	macOS/Linux Command	Windows Command
Create venv	python3 -m venv venv	python -m venv venv
Activate venv	source venv/bin/activate	venv\Scripts\activate
Install requirements	pip install -r requirements.txt	same


##Redeploy tu-backend

gcloud builds submit --tag gcr.io/transcriptuploaderproject/tu-backend
gcloud run deploy tu-backend --image gcr.io/transcriptuploaderproject/tu-backend --platform managed --allow-unauthenticated


