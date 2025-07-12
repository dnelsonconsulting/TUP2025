import React from "react";

interface StepperProps {
  step: number;      // current step (1-indexed)
  steps: string[];   // array of step labels
}

export default function Stepper({ step, steps }: StepperProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((label, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg 
                ${step === idx + 1
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white border-2 border-blue-200 text-blue-500"}`}
            >
              {idx + 1}
            </div>
            <div
              className={`mt-2 text-xs font-medium
                ${step === idx + 1 ? "text-blue-600" : "text-gray-400"}`}
            >
              {label}
            </div>
          </div>
          {idx < steps.length - 1 && (
            <div className="w-12 h-1 bg-blue-200 mx-2 rounded"></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
