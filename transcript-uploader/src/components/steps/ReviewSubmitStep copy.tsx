import React from "react";
import { EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
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
  // Grab codes for filename logic (fall back to blank string if not provided)
  const nationalCode = form.National_Country_Code || "";
  const studentTypeCode = studentTypes.find(s => s.name === form.studentType)?.code || "";
  const degreeLevelCode = degreeLevels.find(d => d.name === form.degreeLevel)?.code || "";
  const genderCode = genders.find(g => g.name === form.gender)?.code || "";

  // For transcripts, use the *_Country_Code fields
  const transcriptCodes = [1, 2, 3, 4].map(num => form[`T${num}_Country_Code`] || "");

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
    file: form[`Transcript${num}`],
    country: form[`T${num}_Country`],
    countryCode: form[`T${num}_Country_Code`] || "",
    num,
  }));

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
        {form.NationalID && (
          <div className="mb-4">
            <div className="font-medium">
              National ID <span className="text-sm text-gray-600">({form.National_Country} / {nationalCode})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-2">{form.NationalID.name}</span>
              <button
                type="button"
                onClick={() => window.open(URL.createObjectURL(form.NationalID), "_blank")}
                className="p-1 text-blue-500 hover:text-blue-700"
                aria-label="Preview National ID"
              >
                <EyeIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => updateForm({ NationalID: undefined, National_Country: "", National_Country_Code: "" })}
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
                  onClick={() => window.open(URL.createObjectURL(file), "_blank")}
                  className="p-1 text-blue-500 hover:text-blue-700"
                  aria-label={`Preview Transcript ${num}`}
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateForm({ [`Transcript${num}`]: undefined, [`T${num}_Country`]: "", [`T${num}_Country_Code`]: "" })}
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
          checked={form.Terms_Conditions || false}
          onChange={(e) => updateForm({ Terms_Conditions: e.target.checked })}
          required
        />
        <label htmlFor="accuracy" className="text-gray-900 font-medium"><span className="text-red-600">*</span>
          I have double-checked all my inputs and confirm their accuracy. 
          I understand that the information I have provided is accurate and that any false information will result in the rejection of my application.
        </label>
      </div>
    </div>
  );
}