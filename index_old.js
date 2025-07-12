/**
 * Cloud Function to handle transcript and document submissions.
 * It receives multipart/form-data, validates fields and files,
 * uploads files to Google Drive with specific naming, makes them shareable,
 * records form data and file links in a Google Sheet, and cleans up temporary files.
 */

const functions = require('firebase-functions');
const Busboy = require('busboy');
const { google } = require('googleapis');
const path = require('path');
const os = require('os');
const fs = require('fs');
// Install uuid: npm install uuid --save in your functions directory
const { v4: uuidv4 } = require('uuid');

// --- Configuration ---
const SPREADSHEET_ID = '1eOE98EMLJ56AAtFuXqQG5IqA4ABwyFLyqzoIbH7lHXg'; // Your Google Sheet ID
const SHEET_NAME = 'Transcripts'; // Your Google Sheet tab name
const BASE_DRIVE_FOLDER_ID = '1uBtsAnQrwPMcb-BcYRfE5m_mNA7nTyyW'; // 'StudentFiles' Google Drive folder ID

// List of required form fields (text inputs) - field names must match frontend form element names
const REQUIRED_FIELDS = [
    'FirstName',
    'MiddleName',
    'LastName',
    'AdditionalName',
    'StudentType',
    'DegreeLevel',
    'Gender',
    'BirthDate',
    'PersonalEmail',
    'Notes',
    'National_Country', // Also required for naming
    'T1_Country',
    'T2_Country',
    'T3_Country',
    'T4_Country',
    'ID or T#', // Required for naming
];

// Map of expected file upload field names to a short code for file naming
// Keys MUST match the 'name' attribute of your file input fields in the frontend form
const FILE_FIELDS_MAP = {
    'NationalID': 'NationalID',
    'Transcript1': 'T1',
    'Transcript2': 'T2',
    'Transcript3': 'T3',
    'Transcript4': 'T4',
};

// Required file fields (all from FILE_FIELDS_MAP are required based on requirements)
const REQUIRED_FILE_FIELDS = Object.keys(FILE_FIELDS_MAP);

// Field name for the accuracy checkbox
const ACCURACY_CHECKBOX_FIELD = 'Terms_Conditions';

// --- Google API Setup ---
// Configure Google Auth using the default service account credentials provided by Cloud Functions
const auth = new google.auth.GoogleAuth({
    // Scopes required for accessing Drive and Sheets
    scopes: [
        'https://www.googleapis.com/auth/drive', // Full access to Drive files and folders
        'https://www.googleapis.com/auth/spreadsheets' // Full access to Sheets
    ]
});

// Create instances of the Drive and Sheets APIs
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// --- Main Cloud Function (HTTP Trigger) ---
// This function will be triggered by a POST request to its endpoint URL
exports.handleTranscriptSubmission = functions.https.onRequest(async (req, res) => {
    functions.logger.info("Received submission request.");

    // Ensure it's a POST request
    if (req.method !== 'POST') {
        functions.logger.warn(`Received non-POST request: ${req.method}`);
        return res.status(405).send('Method Not Allowed - Only POST requests are accepted');
    }

    // Busboy setup to parse multipart/form-data
    const busboy = Busboy({ headers: req.headers });

    // Objects to hold form data and file promises
    const fields = {};
    const filePromises = []; // To store promises for processing each file upload

    // Directory for temporary file storage in Cloud Functions (read-only except for /tmp)
    const tmpdir = os.tmpdir();

    // Array to keep track of temporary file paths for cleanup
    const tempFilePaths = [];

    // --- Busboy Event Handlers ---

    // Handle text fields ('field' event)
    busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
        // functions.logger.debug(`Field [${fieldname}]: value = "${val}"`); // Log field data (use debug level for sensitive data)
        fields[fieldname] = val; // Store the text field value
    });

    // Handle file uploads ('file' event)
    busboy.on('file', (fieldname, fileStream, filename, info) => {
        const { encoding, mimeType } = info;
        functions.logger.info(`Processing file [${fieldname}]: filename = "${filename}", encoding = ${encoding}, mimeType = ${mimeType}`);

        // Check if this file field name is expected
        if (!FILE_FIELDS_MAP[fieldname]) {
            functions.logger.warn(`Received unexpected file field: ${fieldname}. This file will not be processed.`);
            // Important: Consume the stream to prevent the function from hanging
            fileStream.resume();
            return;
        }

        // Create a unique temporary filename in the Cloud Functions /tmp directory
        // Adding original filename helps debugging, uuid ensures uniqueness
        const tempFileName = path.join(tmpdir, `upload_${uuidv4()}_${filename}`);
        tempFilePaths.push(tempFileName); // Add to cleanup list
        functions.logger.info(`Saving temporary file for [${fieldname}] to: ${tempFileName}`);

        // Create a write stream to the temporary file path
        const writeStream = fs.createWriteStream(tempFileName);

        // Pipe the incoming file stream directly to the temporary file write stream
        fileStream.pipe(writeStream);

        // Create a promise that resolves when the file is fully written to /tmp
        // This is needed because busboy processes files asynchronously
        const filePromise = new Promise((resolve, reject) => {
            // Event when the incoming file stream ends (all data received)
            fileStream.on('end', () => {
                 functions.logger.debug(`File stream ended for [${fieldname}]`);
                 // Once the stream ends, close the write stream to finalize the file
                 writeStream.end();
            });

            // Event when the temporary file write stream finishes
            writeStream.on('finish', () => {
                functions.logger.info(`Temporary file finished writing for [${fieldname}]: ${tempFileName}`);
                // Resolve the promise with the necessary info about the saved file
                resolve({
                    fieldname: fieldname, // The name of the form field (e.g., 'NationalID')
                    filename: filename,   // The original filename from the user's computer
                    mimetype: mimeType,
                    encoding: encoding,
                    tempFilePath: tempFileName // The path to the temporary file in /tmp
                });
            });

            // Handle errors during stream piping
            fileStream.on('error', (err) => {
                functions.logger.error(`Error with file stream for [${fieldname}]:`, err);
                 // Attempt to clean up partially written temp file immediately on error
                 if (fs.existsSync(tempFileName)) {
                     try { fs.unlinkSync(tempFileName); } catch(e) { functions.logger.error(`Cleanup failed for ${tempFileName} after stream error:`, e); }
                 }
                reject(err); // Reject the promise
            });

            writeStream.on('error', (err) => {
                functions.logger.error(`Error writing temporary file for [${fieldname}]:`, err);
                 // Attempt to clean up partially written temp file immediately on error
                 if (fs.existsSync(tempFileName)) {
                      try { fs.unlinkSync(tempFileName); } catch(e) { functions.logger.error(`Cleanup failed for ${tempFileName} after write error:`, e); }
                 }
                reject(err); // Reject the promise
            });
        });

        // Add the promise for this file to our array
        filePromises.push(filePromise);
    });

    // --- Busboy Finish Handler ---
    // This event fires after busboy has processed the entire request body
    busboy.on('finish', async () => {
        functions.logger.info('Busboy finished parsing form. Starting backend processing.');

        try {
            // --- Wait for all temporary files to be saved ---
            // Ensure all file streams are fully written to /tmp before proceeding
            const uploadedFilesInfo = await Promise.all(filePromises);
            functions.logger.info(`All temporary files saved and promises resolved. Proceeding with ${uploadedFilesInfo.length} files.`);

            // --- 1. Validation ---

            // Validate required text fields
            for (const fieldName of REQUIRED_FIELDS) {
                if (!fields[fieldName]) {
                    functions.logger.warn(`Validation failed: Missing required field "${fieldName}"`);
                    // Clean up temporary files before returning error
                    cleanupTempFiles(tempFilePaths);
                    return res.status(400).send(`Missing required field: ${fieldName}`);
                }
                 // Basic check for empty strings too
                 if (typeof fields[fieldName] === 'string' && fields[fieldName].trim() === '') {
                      functions.logger.warn(`Validation failed: Required field "${fieldName}" is empty`);
                      cleanupTempFiles(tempFilePaths);
                      return res.status(400).send(`Required field is empty: ${fieldName}`);
                 }
            }

             // Validate required file fields by checking the number of files received
             // and potentially checking which ones are missing if the count is off.
             if (uploadedFilesInfo.length !== REQUIRED_FILE_FIELDS.length) {
                 functions.logger.error(`Validation failed: Expected ${REQUIRED_FILE_FIELDS.length} files, but received/processed ${uploadedFilesInfo.length}`);
                 // Determine which required files are missing
                 const receivedFileFieldNames = uploadedFilesInfo.map(f => f.fieldname);
                 const missingFileFields = REQUIRED_FILE_FIELDS.filter(fieldName => !receivedFileFieldNames.includes(fieldName));

                 // Clean up temporary files before returning error
                 cleanupTempFiles(tempFilePaths);
                 return res.status(400).send(`Missing required file uploads. Please upload: ${missingFileFields.join(', ')}`);
             }
             // Optional: Add checks here if specific file types are required

            // Validate the accuracy checkbox
            // Assuming the checkbox field name is 'Terms_Conditions' and its value is 'true' when checked
            if (fields[ACCURACY_CHECKBOX_FIELD] !== 'true') { // React might send 'true' as string
                 functions.logger.warn(`Validation failed: Accuracy checkbox not checked.`);
                 // Clean up temporary files before returning error
                cleanupTempFiles(tempFilePaths);
                return res.status(400).send('You must confirm the accuracy of the information by checking the box.');
            }

            functions.logger.info('Validation passed successfully.');

            // --- Extract Naming Components ---
            // Get the necessary fields for folder and file naming
            // Use optional chaining or default empty string in case a field was somehow missed by busboy field handler (shouldn't happen if required fields check passes)
            const lastName = fields.LastName || '';
            const firstName = fields.FirstName || '';
            const degreeLevel = fields.DegreeLevel || '';
            const nationalCountry = fields.National_Country || ''; // Country associated with National ID, used for folder naming
            const studentId = fields['ID or T#'] || ''; // Using the exact key name with brackets

            // Construct folder name and base file name prefix
            // Folder format: <LastName>_<FirstName>_<DegreeLevel>_<NationalID Country>
            const studentFolderName = `${lastName}_${firstName}_${degreeLevel}_${nationalCountry}`.replace(/[^a-zA-Z0-9_\-]/g, '_'); // Sanitize for valid folder name
            // Base file name prefix format: <LastName>_<FirstName>_<DegreeLevel>_<ID or T#>_<NationalID Country>
            const baseFileNamePrefix = `${lastName}_${firstName}_${degreeLevel}_${studentId}_${nationalCountry}`.replace(/[^a-zA-Z0-9_\-]/g, '_'); // Sanitize

            functions.logger.info(`Constructed Student Folder Name: "${studentFolderName}"`);
            functions.logger.info(`Constructed Base File Name Prefix: "${baseFileNamePrefix}"`);

            // --- 2. Google Drive Actions ---

            // Find or Create the student-specific folder inside BASE_DRIVE_FOLDER_ID
            let studentFolderId = null;
            try {
                functions.logger.info(`Searching for student folder: "${studentFolderName}" inside parent "${BASE_DRIVE_FOLDER_ID}"`);
                const searchStudentFolderResult = await drive.files.list({
                    q: `name='${studentFolderName}' and mimeType='application/vnd.google-apps.folder' and '${BASE_DRIVE_FOLDER_ID}' in parents`,
                    spaces: 'drive', // Search within user's Drive files
                    fields: 'files(id, name)' // Request only the ID and name
                });

                if (searchStudentFolderResult.data.files.length > 0) {
                    studentFolderId = searchStudentFolderResult.data.files[0].id;
                    functions.logger.info(`Found existing student folder: ${studentFolderId}`);
                } else {
                    functions.logger.info(`Student folder not found. Creating new folder: "${studentFolderName}"`);
                    const createStudentFolder = await drive.files.create({
                         resource: {
                            name: studentFolderName,
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [BASE_DRIVE_FOLDER_ID] // Place it inside the base folder
                        },
                        fields: 'id' // Request the ID of the newly created folder
                    });
                    studentFolderId = createStudentFolder.data.id;
                     functions.logger.info(`Created student folder successfully: ${studentFolderId}`);
                }
            } catch (driveError) {
                 functions.logger.error('Error finding or creating student folder:', driveError);
                 // Clean up temporary files before returning error
                 cleanupTempFiles(tempFilePaths);
                 return res.status(500).send('Error accessing Google Drive to manage folders.');
            }

            // Upload each temporary file to the student folder and get shareable links
            const driveLinks = {}; // Object to store file field names and their shareable links

            for (const fileInfo of uploadedFilesInfo) {
                 // Determine the short code based on the file field name (e.g., 'NationalID', 'T1')
                 const fileCode = FILE_FIELDS_MAP[fileInfo.fieldname];
                 // This check is technically redundant due to the earlier validation, but safe
                 if (!fileCode) {
                     functions.logger.warn(`No file code mapped for field: ${fileInfo.fieldname}`);
                     continue;
                 }
                 
                 // Construct the final filename using the base prefix and file code
                 const finalFileName = `${baseFileNamePrefix}_${fileCode}_${fileInfo.filename}`;
                 
                 try {
                     // Upload the file to Google Drive
                     const uploadResult = await drive.files.create({
                         resource: {
                             name: finalFileName,
                             parents: [studentFolderId]
                         },
                         media: {
                             mimeType: fileInfo.mimetype,
                             body: fs.createReadStream(fileInfo.tempFilePath)
                         },
                         fields: 'id, webViewLink'
                     });
                     
                     // Make the file shareable
                     await drive.permissions.create({
                         fileId: uploadResult.data.id,
                         resource: {
                             role: 'reader',
                             type: 'anyone'
                         }
                     });
                     
                     // Store the shareable link
                     driveLinks[fileInfo.fieldname] = uploadResult.data.webViewLink;
                     functions.logger.info(`Successfully uploaded and shared file: ${finalFileName}`);
                     
                 } catch (uploadError) {
                     functions.logger.error(`Error uploading file ${finalFileName}:`, uploadError);
                     cleanupTempFiles(tempFilePaths);
                     return res.status(500).send(`Error uploading file: ${fileInfo.filename}`);
                 }
            }
            
            // --- 3. Google Sheets Recording ---
            try {
                const rowData = [
                    new Date().toISOString(), // Timestamp
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
                    fields['ID or T#'],
                    fields.Terms_Conditions
                ];
                
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:W`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [rowData]
                    }
                });
                
                functions.logger.info('Successfully recorded data to Google Sheets');
                
            } catch (sheetsError) {
                functions.logger.error('Error recording to Google Sheets:', sheetsError);
                // Note: We don't return error here as files are already uploaded
                // The user should be notified that files were uploaded but recording failed
            }
            
            // --- 4. Cleanup ---
            cleanupTempFiles(tempFilePaths);
            
            // --- 5. Success Response ---
            res.status(200).json({
                success: true,
                message: 'Application submitted successfully',
                driveLinks: driveLinks
            });
            
        } catch (error) {
            functions.logger.error('Unexpected error during processing:', error);
            cleanupTempFiles(tempFilePaths);
            res.status(500).send('Internal server error during processing');
        }
    });
    
    // Pipe the request body to busboy for parsing
    req.pipe(busboy);
});

// Helper function to clean up temporary files
function cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                functions.logger.debug(`Cleaned up temporary file: ${filePath}`);
            } catch (error) {
                functions.logger.error(`Failed to clean up temporary file ${filePath}:`, error);
            }
        }
    }
}