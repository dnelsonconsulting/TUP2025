/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require('firebase-functions');
const Busboy = require('busboy');
const { google } = require('googleapis');
const path = require('path');
const os = require('os');
const fs = require('fs');

// You might want to install the uuid library to generate unique temp filenames
// npm install uuid --save
const { v4: uuidv4 } = require('uuid');

// --- Configuration ---
const SPREADSHEET_ID = '1eOE98EMLJ56AAtFuXqQG5IqA4ABwyFLyqzoIbH7lHXg';
const SHEET_NAME = 'Transcripts';
const BASE_DRIVE_FOLDER_ID = '1uBtsAnQrwPMcb-BcYRfE5m_mNA7nTyyW'; // 'StudentFiles' folder ID

// List of required form fields (text inputs)
const REQUIRED_FIELDS = [
    'FirstName',
    'LastName',
    'MiddleName',
    'AdditionalName',
    'StudentType',
    'DegreeLevel',
    'Gender',
    'BirthDate',
    'PersonalEmail',
    // 'AdditionalNotes' is optional
];

// Map of expected file upload field names to a short code for file naming
// The keys must match the 'name' attribute of your file input fields in the frontend form
const FILE_FIELDS_MAP = {
    'NationalID': 'NationalID',
    'Transcript1': 'T1',
    'Transcript2': 'T2',
    'Transcript3': 'T3',
    'Transcript4': 'T4',
};

// Required file fields (all from FILE_FIELDS_MAP)
const REQUIRED_FILE_FIELDS = Object.keys(FILE_FIELDS_MAP);
// --- Google API Setup ---
// Configure Google Auth using the default service account credentials
const auth = new google.auth.GoogleAuth({
    // Scopes required for accessing Drive and Sheets
    scopes: [
        'https://www.googleapis.com/auth/drive', // For managing files in Drive
        'https://www.googleapis.com/auth/spreadsheets' // For writing to Sheets
    ]
});

// Create instances of the Drive and Sheets APIs
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// --- Main Cloud Function (HTTP Trigger) ---
exports.handleTranscriptSubmission = functions.https.onRequest(async (req, res) => {
    // Ensure it's a POST request
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed - Only POST requests are accepted');
    }

    const busboy = new Busboy({ headers: req.headers });

    // Objects to hold form data and file promises
    const fields = {};
    const filePromises = []; // To store promises for processing each file

    // Directory for temporary file storage in Cloud Functions
    const tmpdir = os.tmpdir();

    // --- Busboy Event Handlers ---

    // Handle text fields
       busboy.on('finish', async () => {
        functions.logger.info('Busboy finished parsing form. Starting backend processing.');

        try {
            // --- Wait for all temporary files to be saved ---
            // This is crucial! We need to make sure all file streams are fully written to /tmp
            const uploadedFilesInfo = await Promise.all(filePromises);
            functions.logger.info(`All temporary files saved. Proceeding with ${uploadedFilesInfo.length} files.`);

            // --- 1. Validation ---
            // Check all required text fields are present and not empty
            for (const fieldName of REQUIRED_FIELDS) {
                if (!fields[fieldName]) {
                    // Clean up temporary files before returning error
                    uploadedFilesInfo.forEach(file => fs.unlinkSync(file.tempFilePath));
                    return res.status(400).send(`Missing required field: ${fieldName}`);
                }
            }

            // Check if all required file fields were received and saved temporarily
             if (uploadedFilesInfo.length !== REQUIRED_FILE_FIELDS.length) {
                 functions.logger.error(`Expected ${REQUIRED_FILE_FIELDS.length} files, but received/processed ${uploadedFilesInfo.length}`);
                 // You might want to check which specific required files are missing
                 const receivedFileFieldNames = uploadedFilesInfo.map(f => f.fieldname);
                 const missingFileFields = REQUIRED_FILE_FIELDS.filter(fieldName => !receivedFileFieldNames.includes(fieldName));

                 // Clean up temporary files before returning error
                 uploadedFilesInfo.forEach(file => fs.unlinkSync(file.tempFilePath));
                 return res.status(400).send(`Missing required file uploads. Missing: ${missingFileFields.join(', ')}`);
             }


            // Check if the accuracy checkbox was checked
            // Assuming the checkbox field name is 'Terms_Conditions' and its value is 'true' when checked
            if (fields.Terms_Conditions !== 'true') { // React might send 'true' as string
                 // Clean up temporary files before returning error
                uploadedFilesInfo.forEach(file => fs.unlinkSync(file.tempFilePath));
                return res.status(400).send('You must confirm the accuracy of the information.');
            }

            functions.logger.info('Validation passed.');

            // --- Extract Naming Components ---
            // Get the necessary fields for folder and file naming
            const lastName = fields.LastName;
            const firstName = fields.FirstName;
            const degreeLevel = fields.DegreeLevel;
            const country = fields.National_Country; // Assuming this field holds the country for naming
            const studentId = fields['ID or T#']; // Using the exact key name with brackets

            // Construct folder name and base file name prefix
            const studentFolderName = `${lastName}_${firstName}_${degreeLevel}_${country}`;
            const baseFileNamePrefix = `${lastName}_${firstName}_${degreeLevel}_${studentId}_${country}`;

            functions.logger.info(`Student Folder Name: ${studentFolderName}`);
            functions.logger.info(`Base File Name Prefix: ${baseFileNamePrefix}`);

            // --- 2. Google Drive Actions ---

            // Find or Create the student-specific folder inside BASE_DRIVE_FOLDER_ID
            let studentFolderId = null;
            try {
                const searchStudentFolderResult = await drive.files.list({
                    q: `name='${studentFolderName}' and mimeType='application/vnd.google-apps.folder' and '${BASE_DRIVE_FOLDER_ID}' in parents`,
                    spaces: 'drive',
                    fields: 'files(id, name)'
                });

                if (searchStudentFolderResult.data.files.length > 0) {
                    studentFolderId = searchStudentFolderResult.data.files[0].id;
                    functions.logger.info(`Found existing student folder: ${studentFolderId}`);
                } else {
                    functions.logger.info(`Creating new student folder: ${studentFolderName}`);
                    const createStudentFolder = await drive.files.create({
                        resource: {
                            name: studentFolderName,
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [BASE_DRIVE_FOLDER_ID] // Place it inside the base folder
                        },
                        fields: 'id'
                    });
                    studentFolderId = createStudentFolder.data.id;
                     functions.logger.info(`Created student folder: ${studentFolderId}`);
                }
            } catch (driveError) {
                 functions.logger.error('Error finding or creating student folder:', driveError);
                 // Clean up temporary files before returning error
                 uploadedFilesInfo.forEach(file => fs.unlinkSync(file.tempFilePath));
                 return res.status(500).send('Error accessing Google Drive.');
            }


            // Upload each temporary file to the student folder and get links
            const driveLinks = {}; // Object to store file field names and their shareable links

            for (const fileInfo of uploadedFilesInfo) {
                 // Determine the short code based on the file field name
                 const fileCode = FILE_FIELDS_MAP[fileInfo.fieldname];
                 if (!fileCode) {
                     functions.logger.warn(`No file code mapped for field: ${fileInfo.fieldname}. Skipping upload for this file.`);
                     continue; // Skip this file if it wasn't in our expected map
                 }

                 // Construct the final file name for Drive
                 // Format: <LastName>_<FirstName>_<DegreeLevel>_<ID or T#>_<Country>_<FileCode>.<Extension>
                 const fileExtension = path.extname(fileInfo.filename); // Get original extension
                 const uploadFileName = `${baseFileNamePrefix}_${fileCode}${fileExtension}`;
                 functions.logger.info(`Uploading file ${fileInfo.filename} as ${uploadFileName} to Drive folder ${studentFolderId}`);


                 try {
                     const response = await drive.files.create({
                         requestBody: {
                             name: uploadFileName,
                             mimeType: fileInfo.mimetype,
                             parents: [studentFolderId]
                         },
                         media: {
                             mimeType: fileInfo.mimetype,
                             body: fs.createReadStream(fileInfo.tempFilePath) // Stream directly from the temporary file
                         },
                         fields: 'id, webViewLink, webContentLink' // Request necessary link fields
                     });

                     // Make the file shareable (e.g., discoverable by link) - **Important step for shareable link!**
                     // You might need to adjust permissions based on your exact needs (e.g., anyone with link)
                     try {
                          await drive.permissions.create({
                            fileId: response.data.id,
                            requestBody: {
                              role: 'reader', // 'reader' allows viewing
                              type: 'anyone', // 'anyone' makes it discoverable by link
                            },
                          });
                         functions.logger.info(`Set permissions for file ${uploadFileName}`);
                     } catch (permError) {
                          functions.logger.warn(`Could not set shareable permissions for ${uploadFileName}:`, permError);
                          // Decide if this is a fatal error or just log a warning
                          // For now, we'll continue but the link might not work externally without manual sharing
                     }


                     // Store the webViewLink (viewable in browser) or webContentLink (direct download)
                     // Requirement says "shareable link", webViewLink is usually what's intended for users to view
                     driveLinks[fileInfo.fieldname] = response.data.webViewLink || response.data.webContentLink || 'Link Not Available';
                     functions.logger.info(`Uploaded ${uploadFileName}, got link: ${driveLinks[fileInfo.fieldname]}`);

                 } catch (uploadError) {
                     functions.logger.error(`Error uploading file ${fileInfo.filename}:`, uploadError);
                     // Clean up temporary files before returning error
                     uploadedFilesInfo.forEach(file => fs.unlinkSync(file.tempFilePath));
                     return res.status(500).send(`Error uploading file: ${fileInfo.filename}`);
                 }
            }

            functions.logger.info('All files uploaded to Drive and links obtained.');

            // --- 3. Google Sheets Actions ---

            try {
                // Construct the row data array - **ORDER IS CRUCIAL HERE!**
                // Make sure this array matches the column order in your "Transcripts" tab exactly.
                // Based on your fields, a possible order might be:
                const rowData = [
                    fields.FirstName || '',
                    fields.LastName || '',
                    fields.MiddleName || '',
                    fields.AdditionalName || '',
                    fields.StudentType || '',
                    fields.DegreeLevel || '',
                    fields.Gender || '',
                    fields.BirthDate || '',
                    fields.PersonalEmail || '',
                    fields.AdditionalNotes || '', // Optional field
                    // File Links (Order should match your sheet columns for links)
                    driveLinks.NationalID || '',
                    driveLinks.Transcript1 || '',
                    driveLinks.Transcript2 || '',
                    driveLinks.Transcript3 || '',
                    driveLinks.Transcript4 || '',
                    // You might want to add the country fields T1_Country, etc. too if they are in the sheet
                     fields.National_Country || '',
                     fields.T1_Country || '',
                     fields.T2_Country || '',
                     fields.T3_Country || '',
                     fields.T4_Country || '',
                    // Add Accuracy checkbox status? fields.Terms_Conditions
                     fields.Terms_Conditions === 'true' ? 'Yes' : 'No', // Convert boolean to Yes/No

                    // Add any other fields present in your sheet column headers
                ];
                 functions.logger.info('Row data prepared:', rowData);

                // Append the row to the sheet
                const appendResponse = await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:ZZ`, // Use a range wide enough to cover all columns
                    valueInputOption: 'USER_ENTERED', // USER_ENTERED preserves formatting, RAW just inserts values
                    insertDataOption: 'INSERT_ROWS', // Always insert as new rows
                    resource: {
                        values: [rowData], // Append a single row
                    },
                });

                functions.logger.info(`Appended row to sheet. Cells updated: ${appendResponse.data.updates.updatedCells}`);

            } catch (sheetsError) {
                functions.logger.error('Error writing to Google Sheets:', sheetsError);
                 // Clean up temporary files before returning error
                uploadedFilesInfo.forEach(file => fs.unlinkSync(file.tempFilePath));
                return res.status(500).send('Error writing data to Google Sheet.');
            }

             // --- 4. Clean up Temporary Files ---
             // Super important! Delete the files saved in /tmp after processing.
             // Cloud Functions storage in /tmp is temporary and has limits.
             uploadedFilesInfo.forEach(file => {
                 try {
                     fs.unlinkSync(file.tempFilePath);
                     functions.logger.info(`Cleaned up temporary file: ${file.tempFilePath}`);
                 } catch (cleanupError) {
                     functions.logger.warn(`Could not clean up temporary file ${file.tempFilePath}:`, cleanupError);
                     // Log a warning, but don't fail the request if cleanup fails
                 }
             });


            // --- 5. Send Success Response ---
            res.status(200).send('Submission processed successfully! Thank you.');

        } catch (error) {
            // Catch any unexpected errors that might occur during processing
            functions.logger.error('An unexpected error occurred during submission processing:', error);
            // Attempt to clean up temporary files even on unexpected errors
             if (uploadedFilesInfo) { // Check if uploadedFilesInfo was created
                 uploadedFilesInfo.forEach(file => {
                     try {
                         fs.unlinkSync(file.tempFilePath);
                         functions.logger.info(`Cleaned up temporary file after error: ${file.tempFilePath}`);
                     } catch (cleanupError) {
                         functions.logger.warn(`Could not clean up temporary file after error ${file.tempFilePath}:`, cleanupError);
                     }
                 });
             }
            res.status(500).send('An internal server error occurred during submission.');
        }
    });

    // Pipe the incoming request stream to busboy for parsing
    // Use req.rawBody for Cloud Functions environments
    busboy.end(req.rawBody);
});


// You would define the imported libraries (functions, Busboy, google, path, os, fs, uuidv4)
// and constants (SPREADSHEET_ID, SHEET_NAME, BASE_DRIVE_FOLDER_ID, REQUIRED_FIELDS,
// FILE_FIELDS_


