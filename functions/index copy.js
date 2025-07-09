// functions/index.js
const functions = require('firebase-functions');
const Busboy = require('busboy');
const { google } = require('googleapis');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// CONFIG: Replace with your real IDs
const SPREADSHEET_ID = '1eOE98EMLJ56AAtFuXqQG5IqA4ABwyFLyqzoIbH7lHXg';
const SHEET_NAME = 'Transcripts';
const BASE_DRIVE_FOLDER_ID = '1uBtsAnQrwPMcb-BcYRfE5m_mNA7nTyyW';

const REQUIRED_FIELDS = [
  "firstName", "lastName", "studentType", "degreeLevel", "gender",
  "birthDate", "personalEmail", "nationalCountry", "t1Country",
  "nationalCountryCode", "t1CountryCode"
];
const REQUIRED_FILES = ["nationalID", "transcript1"];
const FILE_FIELDS_MAP = {
  "nationalID": "ID",
  "transcript1": "T1",
  "transcript2": "T2",
  "transcript3": "T3",
  "transcript4": "T4"
};

// Google API Auth
const auth = new google.auth.GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
});

function cleanupTempFiles(tempFilePaths) {
  for (const filePath of tempFilePaths) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { }
    }
  }
}

// Restructure the function to correctly handle the async stream from Busboy
exports.handleTranscriptSubmission = functions.https.onRequest((req, res) => {
  // --- CORS for local/dev and browser FE ---
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  const files = {};
  const filePromises = [];
  const tempFilePaths = [];
  const tmpdir = os.tmpdir();

  // This error handler is critical for catching parsing errors
  busboy.on('error', err => {
    console.error('Busboy error:', err);
    cleanupTempFiles(tempFilePaths);
    res.status(500).json({ error: 'Error parsing form data.' });
  });

  busboy.on('field', (fieldname, val) => { fields[fieldname] = val; });

  busboy.on('file', (fieldname, fileStream, { filename, mimeType }) => {
    if (!FILE_FIELDS_MAP[fieldname]) {
      fileStream.resume();
      return;
    }
    const tempFileName = path.join(tmpdir, `upload_${uuidv4()}_${filename}`);
    tempFilePaths.push(tempFileName);
    const writeStream = fs.createWriteStream(tempFileName);
    fileStream.pipe(writeStream);

    const filePromise = new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        files[fieldname] = {
          filename,
          mimetype: mimeType,
          tempFilePath: tempFileName
        };
        resolve();
      });
      // Catch errors on both streams
      fileStream.on('error', reject);
      writeStream.on('error', reject);
    });
    filePromises.push(filePromise);
  });

  busboy.on('finish', async () => {
    try {
      await Promise.all(filePromises);

      // VALIDATION
      for (const f of REQUIRED_FIELDS) {
        if (!fields[f] || (typeof fields[f] === "string" && fields[f].trim() === "")) {
          cleanupTempFiles(tempFilePaths);
          res.status(400).json({ error: `Missing required field: ${f}` });
          return;
        }
      }
      for (const f of REQUIRED_FILES) {
        if (!files[f]) {
          cleanupTempFiles(tempFilePaths);
          res.status(400).json({ error: `Missing required file: ${f}` });
          return;
        }
      }
      if (fields.termsConditions !== "true" && fields.termsConditions !== true) {
        cleanupTempFiles(tempFilePaths);
        res.status(400).json({ error: `You must confirm accuracy.` });
        return;
      }

      // GOOGLE API
      const authClient = await auth.getClient();
      const drive = google.drive({ version: "v3", auth: authClient });
      const sheets = google.sheets({ version: "v4", auth: authClient });

      // CREATE/GET STUDENT FOLDER & FILENAME BASE
      const folderName = [
        fields.lastName,
        fields.firstName,
        fields.degreeLevel,
        fields.studentType
      ].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_\-]/g, "_");

      let folderId;
      const search = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${BASE_DRIVE_FOLDER_ID}' in parents`,
        spaces: 'drive',
        fields: 'files(id)'
      });
      if (search.data.files.length > 0) {
        folderId = search.data.files[0].id;
      } else {
        const create = await drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [BASE_DRIVE_FOLDER_ID]
          },
          fields: 'id'
        });
        folderId = create.data.id;
      }

      // UPLOAD FILES TO DRIVE
      const driveLinks = {};
      for (const field in FILE_FIELDS_MAP) {
        if (!files[field]) continue;
        
        let fileIdentifier = "";
        if (field === "nationalID") {
          const countryCode = fields.nationalCountryCode || "";
          fileIdentifier = `${countryCode}${FILE_FIELDS_MAP[field]}`; 
        } else if (field.startsWith("transcript")) {
          const num = field.slice(-1);
          const countryCode = fields[`t${num}CountryCode`] || "";
          fileIdentifier = `${countryCode}${FILE_FIELDS_MAP[field]}`;
        }

        const driveFileName = [
          folderName,
          fileIdentifier
        ].filter(Boolean).join("-") + path.extname(files[field].filename);

        const fileMeta = { name: driveFileName, parents: [folderId] };
        const media = {
          mimeType: files[field].mimetype,
          body: fs.createReadStream(files[field].tempFilePath)
        };
        const uploadRes = await drive.files.create({
          resource: fileMeta,
          media,
          fields: 'id'
        });
        const fileId = uploadRes.data.id;
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' }
        });
        driveLinks[field] = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      }

      // WRITE TO SHEET
      const sheetRow = [
        fields.firstName, fields.middleName || "", fields.lastName, fields.additionalName || "",
        fields.studentType, fields.degreeLevel, fields.gender, fields.birthDate,
        fields.personalEmail, fields.notes || "", fields.termsConditions || "",
        driveLinks.nationalID, fields.nationalCountry,
        driveLinks.transcript1, fields.t1Country,
        driveLinks.transcript2 || "", fields.t2Country || "",
        driveLinks.transcript3 || "", fields.t3Country || "",
        driveLinks.transcript4 || "", fields.t4Country || "",
       
        new Date().toISOString()
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!B4`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [sheetRow] }
      });

      cleanupTempFiles(tempFilePaths);
      res.status(200).json({ success: true, message: "Submitted!" });
    } catch (err) {
      cleanupTempFiles(tempFilePaths);
      console.error(err);
      res.status(500).json({ error: "Backend error. Please try again." });
    }
  });

  req.pipe(busboy);
});
