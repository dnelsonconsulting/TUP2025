from flask import Flask, request, jsonify
from flask_cors import CORS
import os, tempfile
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from datetime import datetime
import time

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=True)

# --- CONFIG ---
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]
SERVICE_ACCOUNT_FILE = "service_account.json"
BASE_DRIVE_FOLDER_ID = "1uBtsAnQrwPMcb-BcYRfE5m_mNA7nTyyW"  # YOUR FOLDER
SPREADSHEET_ID = "1eOE98EMLJ56AAtFuXqQG5IqA4ABwyFLyqzoIbH7lHXg"
SHEET_NAME = "Transcripts"

# --- GOOGLE CREDS ---
def get_creds():
    return service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)

def get_drive_service():
    return build("drive", "v3", credentials=get_creds())

def get_sheets_service():
    return build("sheets", "v4", credentials=get_creds())

# --- UTIL ---
def make_folder_name(fields):
    # Use code for studentType, e.g. "Nelson_Denise_MBA_MSOHQ"
    return "_".join([
        fields.get("lastName", "Unknown"),
        fields.get("firstName", ""),
        fields.get("degreeLevel", ""),
        fields.get("studentType", ""),  # CODE, not label
    ]).replace(" ", "_").replace("/", "_")

def find_folder(drive, folder_name):
    query = (
        f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' "
        f"and '{BASE_DRIVE_FOLDER_ID}' in parents and trashed=false"
    )
    res = drive.files().list(q=query, spaces="drive", fields="files(id)").execute()
    if res.get("files"):
        return res["files"][0]["id"]
    return None

def create_folder(drive, folder_name):
    file_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [BASE_DRIVE_FOLDER_ID],
    }
    file = drive.files().create(
        body=file_metadata, fields="id", supportsAllDrives=True
    ).execute()
    return file.get("id")

def find_file_in_folder(drive, folder_id, filename):
    query = (
        f"name='{filename}' and '{folder_id}' in parents and trashed=false"
    )
    res = drive.files().list(q=query, spaces="drive", fields="files(id)").execute()
    if res.get("files"):
        return res["files"][0]["id"]
    return None

def upload_file_to_drive(drive, file_storage, folder_id, drive_filename):
    # Delete old file if exists
    file_id = find_file_in_folder(drive, folder_id, drive_filename)
    if file_id:
        drive.files().delete(fileId=file_id).execute()

    # Upload new
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        file_storage.save(tmp)
        tmp_path = tmp.name
    media = MediaFileUpload(tmp_path, mimetype=file_storage.mimetype)
    file_metadata = {"name": drive_filename, "parents": [folder_id]}
    gfile = drive.files().create(
        body=file_metadata, media_body=media, fields="id", supportsAllDrives=True
    ).execute()
    file_id = gfile["id"]
    os.remove(tmp_path)
    # No need to set permission if parent is shared
    return f"https://drive.google.com/file/d/{file_id}/view?usp=sharing"

# --- API ---
@app.route("/submit", methods=["POST"])
def handle_submit():
    try:
        # Get fields & files
        fields = {k: request.form.get(k) for k in request.form}
        files = {k: request.files[k] for k in request.files}
        # Validation
        required = ["firstName", "lastName", "studentType", "degreeLevel", "gender",
                    "birthDate", "personalEmail", "nationalCountry", "t1Country",
                    "nationalID", "transcript1"]
        missing = [k for k in required if not (fields.get(k) or files.get(k))]
        if fields.get("termsConditions") != "true":
            missing.append("termsConditions")
        if missing:
            return jsonify({"error": f"Missing required fields: {missing}"}), 400

        # Folder logic
        drive = get_drive_service()
        folder_name = make_folder_name(fields)
        folder_id = find_folder(drive, folder_name)
        if not folder_id:
            folder_id = create_folder(drive, folder_name)
        # FILE NAMES FROM FRONTEND
        links = {}
        for k in ["nationalID", "transcript1", "transcript2", "transcript3", "transcript4"]:
            if k in files and files[k]:
                filename_key = f"{k}Filename"
                drive_filename = fields.get(filename_key)  # e.g. Nelson_Denise_MBA_MSOHQ_ARM-T1
                if not drive_filename:
                    # fallback to old naming
                    ext = os.path.splitext(files[k].filename)[1]
                    drive_filename = f"{folder_name}-{k}{ext}"
                # Add extension if missing
                if "." not in drive_filename:
                    ext = os.path.splitext(files[k].filename)[1]
                    drive_filename += ext
                links[k] = upload_file_to_drive(drive, files[k], folder_id, drive_filename)
            else:
                links[k] = ""

        # Write to Sheets (add links & details)
        sheets = get_sheets_service()
        row = [
            fields.get("firstName", ""), fields.get("middleName", ""), fields.get("lastName", ""), fields.get("additionalName", ""),
            fields.get("studentType", ""), fields.get("degreeLevel", ""), fields.get("gender", ""), fields.get("birthDate", ""),
            fields.get("personalEmail", ""), fields.get("notes", ""), 
            links["nationalID"], fields.get("nationalCountry", ""),
            links["transcript1"], fields.get("t1Country", ""),
            links["transcript2"], fields.get("t2Country", ""),
            links["transcript3"], fields.get("t3Country", ""),
            links["transcript4"], fields.get("t4Country", ""),
            fields.get("termsConditions", ""),
            datetime.utcnow().isoformat()
        ]
        sheets.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A2",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row]}
        ).execute()
        return jsonify({"success": True, "links": links})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
