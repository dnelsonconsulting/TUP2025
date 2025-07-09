// functions/index.js
const functions = require('firebase-functions');
const Busboy = new require('busboy');
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

exports.handleTranscriptSubmission = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  let responded = false;
  function safeRespond(status, payload) {
    if (!responded) {
      responded = true;
      res.status(status).json(payload);
    }
  }

  try {
    await new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      const fields = {};
      const files = {};
      const filePromises = [];
      const tempFilePaths = [];
      const tmpdir = os.tmpdir();

      busboy.on('error', err => {
        cleanupTempFiles(tempFilePaths);
        console.error("🔥 LIL G ERROR: Busboy error", err && (err.stack || err));
        safeRespond(500, { error: 'Error parsing form data: ' + err.message });
        resolve();
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

        const filePromise = new Promise((resolveFile, rejectFile) => {
          writeStream.on('finish', () => {
            files[fieldname] = {
              filename,
              mimetype: mimeType,
              tempFilePath: tempFileName
            };
            resolveFile();
          });
          fileStream.on('error', rejectFile);
          writeStream.on('error', rejectFile);
        });
        filePromises.push(filePromise);
      });

      busboy.on('finish', async () => {
        try {
          await Promise.all(filePromises);

          // === DEBUG LOG FIELDS/FILES ===
          console.log("🔥 LIL G FIELDS:", JSON.stringify(fields, null, 2));
          console.log("🔥 LIL G FILES:", Object.keys(files));

          // === VALIDATION ===
          for (const f of REQUIRED_FIELDS) {
            if (!fields[f] || (typeof fields[f] === "string" && fields[f].trim() === "")) {
              console.error("🔥 LIL G ERROR: Missing required field:", f, fields);
              cleanupTempFiles(tempFilePaths);
              safeRespond(400, { error: `Missing required field: ${f}` });
              return resolve();
            }
          }
          for (const f of REQUIRED_FILES) {
            if (!files[f]) {
              console.error("🔥 LIL G ERROR: Missing required file:", f, Object.keys(files));
              cleanupTempFiles(tempFilePaths);
              safeRespond(400, { error: `Missing required file: ${f}` });
              return resolve();
            }
          }
          if (fields.termsConditions !== "true" && fields.termsConditions !== true) {
            console.error("🔥 LIL G ERROR: Terms not confirmed", fields.termsConditions);
            cleanupTempFiles(tempFilePaths);
            safeRespond(400, { error: `You must confirm accuracy.` });
            return resolve();
          }

          // === GOOGLE API STUFF ===
          let authClient;
          try {
            authClient = await auth.getClient();
          } catch (err) {
            console.error("🔥 LIL G ERROR: GoogleAuth failure", err);
            cleanupTempFiles(tempFilePaths);
            safeRespond(500, { error: "Google API auth error." });
            return resolve();
          }
          const drive = google.drive({ version: "v3", auth: authClient });
          const sheets = google.sheets({ version: "v4", auth: authClient });

          // CREATE/GET STUDENT FOLDER
          const folderName = [
            fields.lastName,
            fields.firstName,
            fields.degreeLevel,
            fields.studentType
          ].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_\-]/g, "_");

          let folderId;
          try {
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
          } catch (err) {
            console.error("🔥 LIL G ERROR: Drive folder create/list failed", err);
            cleanupTempFiles(tempFilePaths);
            safeRespond(500, { error: "Drive folder error." });
            return resolve();
          }

          // UPLOAD FILES TO DRIVE
          const driveLinks = {};
          try {
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
          } catch (err) {
            console.error("🔥 LIL G ERROR: Drive file upload error", err);
            cleanupTempFiles(tempFilePaths);
            safeRespond(500, { error: "Drive file upload error." });
            return resolve();
          }

          // WRITE TO SHEET
          try {
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
          } catch (err) {
            console.error("🔥 LIL G ERROR: Sheets write error", err);
            cleanupTempFiles(tempFilePaths);
            safeRespond(500, { error: "Google Sheets write error." });
            return resolve();
          }

          cleanupTempFiles(tempFilePaths);
          safeRespond(200, { success: true, message: "Submitted!" });
          resolve();
        } catch (err) {
          console.error("🔥 LIL G ERROR: Final handler error", err && (err.stack || err));
          cleanupTempFiles(tempFilePaths);
          safeRespond(500, { error: "Backend error. Please try again." });
          resolve();
        }
      });

      if (req.rawBody) {
       busboy.end(req.rawBody);
      } else {
        req.pipe(busboy);
      }

    });
  } catch (err) {
    console.error("🔥 LIL G ERROR: Top-level catch", err && (err.stack || err));
    safeRespond(500, { error: "Backend error. Please try again." });
  }
});
