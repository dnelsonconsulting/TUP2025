import React from "react";
import { countries } from "../../utils/lookupData";
import Stepper from "../stepper";
import Header from "../header";

const steps = ["Personal Info", "Document Upload", "Review & Submit"];

type Props = {
  form: any;
  updateForm: (updates: any) => void;
  onNext: () => void;
  onBack?: () => void;
  step: number;
};

export default function DocumentUploadStep({
  form,
  updateForm,
  onNext,
  onBack,
  step,
}: Props) {
  // Utility: Required fields
  const required = { input: "border-red-300", label: "text-red-600" };

  return (
    <div className="max-w-2xl w-full p-8">
      <Header />
      <Stepper step={step} steps={steps} />
      <h2 className="text-xl font-bold mb-6 bg-green-200 text-gray-600 text-center shadow-lg">DOCUMENT UPLOAD</h2>
      <form
        onSubmit={e => {
          e.preventDefault();
          onNext();
        }}
        autoComplete="off"
      >
        {/* National ID */}
        <div className="flex flex-row gap-6 mb-6 w-full max-w-3xl">
          <div className="flex flex-col flex-1 min-w-[250px] max-w-md">
            <label className="font-bold text-gray-900 mb-1">
              National ID <span className="text-red-600">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 h-12"
              required
              onChange={e => updateForm({ nationalID: e.target.files?.[0] })}
            />
            {form.n && (
              <span className="text-xs text-gray-500 mt-1">Selected: {form.nationalID.name}</span>
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-[250px] max-w-md">
            <label className="font-bold text-gray-900 mb-1">
              National ID Issuing Country <span className="text-red-600">*</span>
            </label>
            <select
              className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 h-12"
              required
              value={form.nationalCountryCode || ""}
              onChange={e => {
                const code = e.target.value;
                const selected = countries.find(c => c.code === code);
                updateForm({
                  nationalCountryCode: code,
                  nationalCountry: selected ? selected.name : ""
                });
              }}
            >
              <option value="">Select Country</option>
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        </div>
        {/* Transcripts */}
        {[1, 2, 3, 4].map(num => (
          <div key={num} className="flex flex-row gap-6 mb-6 w-full max-w-3xl">
            <div className="flex flex-col flex-1 min-w-[250px] max-w-md">
              <label className="font-bold text-gray-900 mb-1">
                Transcript {num}{num === 1 && <span className="text-red-600">*</span>}
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 h-12"
                required={num === 1}
                onChange={e => updateForm({ [`transcript${num}`]: e.target.files?.[0] })}
              />
              {form[`transcript${num}`] && (
                <span className="text-xs text-gray-500 mt-1">
                  Selected: {form[`transcript${num}`].name}
                </span>
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-[250px] max-w-md">
              <label className="font-bold text-gray-900 mb-1">
                Transcript {num} Issuing Country{num === 1 && <span className="text-red-600">*</span>}
              </label>
              <select
                className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 h-12"
                required={num === 1}
                value={form[`t${num}CountryCode`] || ""}
                onChange={e => {
                  const code = e.target.value;
                  const selected = countries.find(c => c.code === code);
                  updateForm({
                    [`t${num}CountryCode`]: code,
                    [`t${num}Country`]: selected ? selected.name : ""
                  });
                }}
              >
                <option value="">Select Country</option>
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {/* Navigation (Next, Back, etc.) here if needed */}
      </form>
    </div>
  );
}
