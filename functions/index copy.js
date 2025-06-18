const functions = require('firebase-functions');
const Busboy = require('busboy');
const { google } = require('googleapis');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const SPREADSHEET_ID = '1eOE98EMLJ56AAtFuXqQG5IqA4ABwyFLyqzoIbH7lHXg';
const SHEET_NAME = 'Transcripts';
const BASE_DRIVE_FOLDER_ID = '1uBtsAnQrwPMcb-BcYRfE5m_mNA7nTyyW';

const REQUIRED_FIELDS = [
    'FirstName', 'MiddleName', 'LastName', 'AdditionalName',
    'StudentType', 'DegreeLevel', 'Gender', 'BirthDate',
    'PersonalEmail', 'Notes', 'National_Country', 'T1_Country',
    'T2_Country', 'T3_Country', 'T4_Country', 'Terms_Conditions'
];

// You may want to align 'IDorTNum' with your front-end field. (No spaces/symbols.)

const FILE_FIELDS_MAP = {
    'NationalID': 'NationalID',
    'Transcript1': 'T1',
    'Transcript2': 'T2',
    'Transcript3': 'T3',
    'Transcript4': 'T4',
};
const REQUIRED_FILE_FIELDS = Object.keys(FILE_FIELDS_MAP);
const ACCURACY_CHECKBOX_FIELD = 'Terms_Conditions';

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
        return res.status(405).send('Method Not Allowed - Only POST requests are accepted');
    }

    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const filePromises = [];
    const tmpdir = os.tmpdir();
    const tempFilePaths = [];

    busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
    });

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
                resolve({ fieldname, filename, mimetype: info.mimeType, tempFilePath: tempFileName });
            });
            fileStream.on('error', reject);
            writeStream.on('error', reject);
        });
        filePromises.push(filePromise);
    });

    busboy.on('finish', async () => {
        try {
            const uploadedFilesInfo = await Promise.all(filePromises);

            // Validation
            for (const fieldName of REQUIRED_FIELDS) {
                if (!fields[fieldName] || typeof fields[fieldName] === 'string' && fields[fieldName].trim() === '') {
                    cleanupTempFiles(tempFilePaths);
                    return res.status(400).send(`Missing or empty required field: ${fieldName}`);
                }
            }
            if (uploadedFilesInfo.length !== REQUIRED_FILE_FIELDS.length) {
                cleanupTempFiles(tempFilePaths);
                return res.status(400).send(`Missing required files.`);
            }
            if (fields[ACCURACY_CHECKBOX_FIELD] !== 'true') {
                cleanupTempFiles(tempFilePaths);
                return res.status(400).send('You must confirm accuracy.');
            }

            // Naming
            const lastName = fields.LastName || '';
            const firstName = fields.FirstName || '';
            const degreeLevel = fields.DegreeLevel || '';
            const nationalCountry = fields.National_Country || '';
            const studentId = fields['IDorTNum'] || ''; // Use the exact field name from the frontend!
            const studentFolderName = `${lastName}_${firstName}_${degreeLevel}_${nationalCountry}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
            const baseFileNamePrefix = `${lastName}_${firstName}_${degreeLevel}_${studentId}_${nationalCountry}`.replace(/[^a-zA-Z0-9_\-]/g, '_');

            // Google Auth (per-request)
            const authClient = await auth.getClient();
            const drive = google.drive({ version: 'v3', auth: authClient });
            const sheets = google.sheets({ version: 'v4', auth: authClient });

            // Find or create student folder
            let studentFolderId = null;
            const search = await drive.files.list({
                q: `name='${studentFolderName}' and mimeType='application/vnd.google-apps.folder' and '${BASE_DRIVE_FOLDER_ID}' in parents`,
                spaces: 'drive', fields: 'files(id, name)'
            });
            if (search.data.files.length > 0) {
                studentFolderId = search.data.files[0].id;
            } else {
                const created = await drive.files.create({
                    resource: {
                        name: studentFolderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [BASE_DRIVE_FOLDER_ID]
                    },
                    fields: 'id'
                });
                studentFolderId = created.data.id;
            }

            // Upload files
            const driveLinks = {};
            for (const fileInfo of uploadedFilesInfo) {
                const fileCode = FILE_FIELDS_MAP[fileInfo.fieldname];
                const thisCountry =
                    fileInfo.fieldname === 'NationalID'
                        ? nationalCountry
                        : fields[`${fileCode}_Country`] || '';
                const driveFileName = `${baseFileNamePrefix}_${fileCode}_${thisCountry}${path.extname(fileInfo.filename)}`;
                const fileMeta = {
                    name: driveFileName,
                    parents: [studentFolderId]
                };
                const media = {
                    mimeType: fileInfo.mimetype,
                    body: fs.createReadStream(fileInfo.tempFilePath)
                };
                const uploadRes = await drive.files.create({
                    resource: fileMeta,
                    media,
                    fields: 'id'
                });
                const fileId = uploadRes.data.id;
                // Make file shareable (anyone with link can view)
                await drive.permissions.create({
                    fileId,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone'
                    }
                });
                const webViewLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
                driveLinks[fileInfo.fieldname] = webViewLink;
            }

            // Write to Google Sheet
            const sheetRow = [
                fields.FirstName,
                fields.MiddleName,
                fields.LastName,
                fields.AdditionalName,
                fields.StudentType,
                fields.DegreeLevel,
                fields.Gender,
                fields.BirthDate,
                fields.PersonalEmail,
                fields.Notes,
                driveLinks.NationalID || '',
                fields.National_Country,
                driveLinks.Transcript1 || '',
                fields.T1_Country,
                driveLinks.Transcript2 || '',
                fields.T2_Country,
                driveLinks.Transcript3 || '',
                fields.T3_Country,
                driveLinks.Transcript4 || '',
                fields.T4_Country,
                fields.Terms_Conditions,
                new Date().toISOString()
            ];
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!B3`,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                requestBody: {
                    values: [sheetRow]
                }
            });

            cleanupTempFiles(tempFilePaths);
            return res.status(200).send({ success: true, message: 'Submission complete.' });
        } catch (err) {
            cleanupTempFiles(tempFilePaths);
            functions.logger.error('Error during submission:', err);
            return res.status(500).send('Backend error. Please try again.');
        }
    });

    req.pipe(busboy);
});
