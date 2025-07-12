import React, { useState } from "react";
import { 
  EyeIcon, 
  TrashIcon, 
  XMarkIcon, 
  MagnifyingGlassPlusIcon, 
  MagnifyingGlassMinusIcon 
} from "@heroicons/react/24/outline";
import Header from "../header";
import Stepper from "../stepper";
import { genders, degreeLevels, studentTypes } from "../../utils/lookupData";

const steps = ["Personal Info", "Document Upload", "Review & Submit"];

interface Props {
  form: any;
  updateForm: (updates: any) => void;
  onBack: () => void;
  onSubmit: () => void;
  step: number;
  submitting?: boolean;
  submitResult?: { error?: string; success?: string } | null;
}

export default function ReviewSubmitStep({
  form = {},
  updateForm,
  onBack,
  onSubmit,
  step,
  submitting,
  submitResult,
}: Props) {
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [zoom, setZoom] = useState(1);

  // Grab codes for filename logic (fall back to blank string if not provided)
  const nationalCode = form.nationalCountryCode || "";
  const studentTypeCode = studentTypes.find(s => s.name === form.studentType)?.code || "";
  const degreeLevelCode = degreeLevels.find(d => d.name === form.degreeLevel)?.code || "";
  const genderCode = genders.find(g => g.name === form.gender)?.code || "";

  // For transcripts, use the *_Country_Code fields
  const transcriptCodes = [1, 2, 3, 4].map(num => form[`t${num}CountryCode`] || "");

  // Helper: full name preview
  const fullName = [form.firstName, form.middleName, form.lastName, form.additionalName].filter(Boolean).join(" ");

  // Helper: expected file base
  const baseFileName = [
    form.lastName,
    form.firstName,
    degreeLevelCode,
    studentTypeCode,
  ].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_\-]/g, "_");

  const transcriptFiles = [1, 2, 3, 4].map(num => ({
    file: form[`transcript${num}`],
    country: form[`t${num}Country`],
    countryCode: form[`t${num}CountryCode`] || "",
    num,
  }));

  const handlePreview = (file: File, fileName: string) => {
    setPreviewFile(file);
    setPreviewFileName(fileName);
    setZoom(1); // Reset zoom on new preview
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewFileName("");
  };

  const handleZoomIn = () => setZoom(prev => prev + 0.2);
  const handleZoomOut = () => setZoom(prev => Math.max(0.2, prev - 0.2));

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Header />
      <Stepper step={step} steps={steps} />

      <h2 className="text-xl font-bold mb-6 bg-green-200 text-gray-600 text-center shadow-lg">REVIEW &amp; SUBMIT</h2>

      <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-300">
        <div className="text-xl font-semibold mb-4">Personal Information</div>
        <div className="text-blue-500"><strong>Full Name:</strong> {fullName || <span className="text-gray-400">N/A</span>}</div>
          <div className="text-blue-500"><strong>Student Type:</strong> {form.studentType || <span className="text-gray-400">N/A</span>} <span className="ml-1 text-xs text-gray-400">[{studentTypeCode}]</span></div>
        <div className="text-blue-500"><strong>Degree Level:</strong> {form.degreeLevel || <span className="text-gray-400">N/A</span>} <span className="ml-1 text-xs text-gray-400">[{degreeLevelCode}]</span></div>
        <div className="text-blue-500"><strong>Gender:</strong> {form.gender || <span className="text-gray-400">N/A</span>}
    {genderCode && (
    <span className="ml-1 text-xs text-gray-500">[{genderCode}]</span>
  )}</div>
        <div className="text-blue-500"><strong>Birth Date:</strong> {form.birthDate || <span className="text-gray-400">N/A</span>}</div>
        <div className="text-blue-500"><strong>Email:</strong> {form.personalEmail || <span className="text-gray-400">N/A</span>}</div>
        <div className="text-blue-500"><strong>Notes:</strong> {form.notes || <span className="text-gray-400">N/A</span>}</div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Uploaded Documents</h3>

        {/* National ID */}
        {form.nationalID && (
          <div className="mb-4">
            <div className="font-medium">
              National ID <span className="text-sm text-gray-600">({form.nationalCountry} / {nationalCode})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-2">{form.nationalID.name}</span>
              <button
                type="button"
                onClick={() => handlePreview(form.nationalID, form.nationalID.name)}
                className="p-1 text-blue-500 hover:text-blue-700"
                aria-label="Preview National ID"
              >
                <EyeIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => updateForm({ NationalID: undefined, nationalCountry: "", nationalCountryCode: "" })}
                className="p-1 text-red-500 hover:text-red-700"
                aria-label="Remove National ID"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Expected filename: <span className="font-mono">{`${baseFileName}_${nationalCode}-ID`}</span>
            </div>
          </div>
        )}

        {/* Transcripts 1-4 */}
        {transcriptFiles.map(({ file, country, countryCode, num }) =>
          file ? (
            <div key={num} className="mb-4">
              <div className="font-medium">
                Transcript {num} <span className="text-sm text-gray-600">({country} / {countryCode})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handlePreview(file, file.name)}
                  className="p-1 text-blue-500 hover:text-blue-700"
                  aria-label={`Preview Transcript ${num}`}
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateForm({ [`transcript${num}`]: undefined, [`t${num}Country`]: "", [`t${num}CountryCode`]: "" })}
                  className="p-1 text-red-500 hover:text-red-700"
                  aria-label={`Remove Transcript ${num}`}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="text-sm text-gray-500">
                Expected filename: <span className="font-mono">{`${baseFileName}_${countryCode}-T${num}`}</span>
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* Confirmation Checkbox */}
      <div className="mb-6 flex items-center">
        <input
          id="accuracy"
          type="checkbox"
          className="mr-2 accent-blue-600"
          checked={form.termsConditions || false}
          onChange={(e) => updateForm({ termsConditions: e.target.checked })}
          required
        />
        <label htmlFor="accuracy" className="text-gray-900 font-medium"><span className="text-red-600">*</span>
          I have double-checked all my inputs and confirm their accuracy. 
          I understand that the information I have provided is accurate and that any false information will result in the rejection of my application.
        </label>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-2 pb-2 border-b flex-shrink-0">
              <h3 className="text-lg font-semibold truncate pr-4" title={previewFileName}>
                Preview: {previewFileName}
              </h3>
              <div className="flex items-center gap-2">
                {previewFile.type.startsWith('image/') && (
                  <>
                    <button
                      onClick={handleZoomOut}
                      disabled={zoom <= 0.2}
                      className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                      aria-label="Zoom out"
                    >
                      <MagnifyingGlassMinusIcon className="h-6 w-6" />
                    </button>
                    <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={handleZoomIn}
                      className="p-1 rounded-full hover:bg-gray-200"
                      aria-label="Zoom in"
                    >
                      <MagnifyingGlassPlusIcon className="h-6 w-6" />
                    </button>
                  </>
                )}
                <button
                  onClick={closePreview}
                  className="ml-4 text-gray-500 hover:text-gray-700"
                  aria-label="Close preview"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="flex-grow overflow-auto">
              {previewFile.type.startsWith('image/') ? (
                <div className="p-4 flex justify-center items-center min-h-full">
                  <img
                    src={URL.createObjectURL(previewFile)}
                    alt={previewFileName}
                    className="transition-transform duration-150"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              ) : previewFile.type === 'application/pdf' ? (
                <iframe
                  src={URL.createObjectURL(previewFile)}
                  title={previewFileName}
                  className="w-full h-[75vh]"
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">File preview not available for this file type.</p>
                  <a
                    href={URL.createObjectURL(previewFile)}
                    download={previewFileName}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}