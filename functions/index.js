// functions/index.js
const functions = require('firebase-functions');
const Busboy = require('busboy');
const { google } = require('googleapis');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// CONFIG
const SPREADSHEET_ID = 'YOUR_SHEET_ID';
const SHEET_NAME = 'Transcripts';
const BASE_DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';

const REQUIRED_FIELDS = [
  "firstName", "lastName", "studentType", "degreeLevel", "gender",
  "birthDate", "personalEmail", "National_Country", "T1_Country"
];
const REQUIRED_FILES = ["NationalID", "Transcript1"];

const FILE_FIELDS_MAP = {
  "NationalID": "ID",
  "Transcript1": "T1",
  "Transcript2": "T2",
  "Transcript3": "T3",
  "Transcript4": "T4"
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
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  const files = {};
  const filePromises = [];
  const tempFilePaths = [];
  const tmpdir = os.tmpdir();

  // Collect fields
  busboy.on('field', (fieldname, val) => { fields[fieldname] = val; });

  // Collect files
  busboy.on('file', (fieldname, fileStream, filename, info) => {
    if (!FILE_FIELDS_MAP[fieldname]) {
      fileStream.resume();
      return;
    }
    const tempFileName = path.join(tmpdir, `upload_${uuidv4()}_${filename}`);
    tempFilePaths.push(tempFileName);
    const writeStream = fs.createWriteStream(tempFileName);
    fileStream.pipe(writeStream);

    const filePromise = new Promise((resolve, reject) => {
      fileStream.on('end', () => writeStream.end());
      writeStream.on('finish', () => {
        files[fieldname] = {
          filename,
          mimetype: info.mimeType,
          tempFilePath: tempFileName
        };
        resolve();
      });
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
          return res.status(400).send(`Missing required field: ${f}`);
        }
      }
      for (const f of REQUIRED_FILES) {
        if (!files[f]) {
          cleanupTempFiles(tempFilePaths);
          return res.status(400).send(`Missing required file: ${f}`);
        }
      }
      if (fields.Terms_Conditions !== "true") {
        cleanupTempFiles(tempFilePaths);
        return res.status(400).send(`You must confirm accuracy.`);
      }

      // GOOGLE API
      const authClient = await auth.getClient();
      const drive = google.drive({ version: "v3", auth: authClient });
      const sheets = google.sheets({ version: "v4", auth: authClient });

      // CREATE/GET STUDENT FOLDER
      const folderName = [
        fields.lastName,
        fields.firstName,
        fields.degreeLevel,
        fields.National_Country
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
        // Pick the right country for each doc type
        let country = "";
        if (field === "NationalID") country = fields.National_Country;
        else if (field.startsWith("Transcript")) {
          country = fields[`T${field.slice(-1)}_Country`] || "";
        }
        const driveFileName = [
          folderName,
          country,
          FILE_FIELDS_MAP[field]
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
        fields.personalEmail, fields.notes || "",
        driveLinks.NationalID || "", fields.National_Country || "",
        driveLinks.Transcript1 || "", fields.T1_Country || "",
        driveLinks.Transcript2 || "", fields.T2_Country || "",
        driveLinks.Transcript3 || "", fields.T3_Country || "",
        driveLinks.Transcript4 || "", fields.T4_Country || "",
        new Date().toISOString()
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!B3`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [sheetRow] }
      });

      cleanupTempFiles(tempFilePaths);
      return res.status(200).json({ success: true, message: "Submitted!" });
    } catch (err) {
      cleanupTempFiles(tempFilePaths);
      console.error(err);
      return res.status(500).send("Backend error. Please try again.");
    }
  });

  req.pipe(busboy);
});
