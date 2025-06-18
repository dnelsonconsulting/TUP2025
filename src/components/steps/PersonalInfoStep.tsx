// components/steps/PersonalInformationStep.tsx

import React from "react";
import { studentTypes, degreeLevels, genders } from "../../utils/lookupData";
import Stepper from "../stepper";
import Header from "../header";

const steps = ["Personal Info", "Document Upload", "Review & Submit"];

interface Props {
  form: any;
  updateForm: (updates: any) => void;
  onNext: () => void;
  step: number;         // <-- Add this prop!
}

const PersonalInformationStep: React.FC<Props> = ({ form, updateForm, onNext, step }) => {
  return (
    <div className="max-w-2xl w-full p-8">
      <Header />
      <Stepper step={step} steps={steps} />
      <h2 className="text-xl font-bold mb-6 bg-green-200 text-gray-600 text-center shadow-lg">PERSONAL INFORMATION</h2>
      <form
        onSubmit={e => {
          e.preventDefault();
          onNext();
        }}
        autoComplete="off"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              First Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={form.firstName || ""}
              onChange={e => updateForm({ firstName: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          {/* Middle Name */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Middle Name</label>
            <input
              type="text"
              value={form.middleName || ""}
              onChange={e => updateForm({ middleName: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Last Name */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Last Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={form.lastName || ""}
              onChange={e => updateForm({ lastName: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          {/* Additional Name */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Additional Name</label>
            <input
              type="text"
              value={form.additionalName || ""}
              onChange={e => updateForm({ additionalName: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Student Type */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Student Type <span className="text-red-600">*</span>
            </label>
            <select
              value={form.studentType || ""}
              onChange={e => updateForm({ studentType: e.target.value })}
              className="w-full pr-1.5 px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            >
              <option value="">Select...</option>
              {studentTypes.map(st => (
                <option value={st.name} key={st.code}>{st.name}</option>
              ))}
            </select>
          </div>
          {/* Degree Level */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Degree Level <span className="text-red-600">*</span>
            </label>
            <select
              value={form.degreeLevel || ""}
              onChange={e => updateForm({ degreeLevel: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            >
              <option value="">Select...</option>
              {degreeLevels.map(dl => (
                <option value={dl.name} key={dl.code}>{dl.name}</option>
              ))}
            </select>
          </div>
          {/* Gender */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Gender <span className="text-red-600">*</span>
            </label>
            <select
              value={form.gender || ""}
              onChange={e => updateForm({ gender: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            >
              <option value="">Select...</option>
              {genders.map(g => (
                <option value={g.name} key={g.code}>{g.name}</option>
              ))}
            </select>
          </div>
          {/* Birth Date */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Birth Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={form.birthDate || ""}
              onChange={e => updateForm({ birthDate: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          {/* Personal Email */}
          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-1">
              Personal Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={form.personalEmail || ""}
              onChange={e => updateForm({ personalEmail: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-1">Additional Notes</label>
            <textarea
              value={form.notes || ""}
              onChange={e => updateForm({ notes: e.target.value })}
              className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
              rows={3}
            />
          </div>
        </div>
        
      </form>
    </div>
  );
};

export default PersonalInformationStep;
