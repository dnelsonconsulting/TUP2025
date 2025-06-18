import React from "react";
import Stepper from "../stepper"; // Adjust path as needed

const steps = ["Personal Info", "Document Upload", "Review & Submit"]; // Define this once and pass down

interface Props {
  step: number;
  stepsCount: number;
  nextStep: () => void;
  prevStep: () => void;
  handleSubmit: () => void;
  formData: any;
}

export default function FormNavigation({
  step,
  stepsCount,
  nextStep,
  prevStep,
  handleSubmit,
  formData,
}: Props) {
  return (
    <div className={`flex mt-8 ${step === 0 ? "justify-end" : "justify-between"}`}>
      {step > 0 && (
        <button
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300"
          onClick={prevStep}
          type="button"
        >
          Back
        </button>
      )}
      {step === stepsCount - 1 ? (
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          onClick={handleSubmit}
          type="button"
          disabled={!formData.Terms_Conditions}
        >
          Submit
        </button>
      ) : (
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          onClick={nextStep}
          type="button"
        >
          Next
        </button>
      )}
    </div>
  );
}
