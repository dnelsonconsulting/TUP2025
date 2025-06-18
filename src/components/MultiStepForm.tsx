'use client';
import { useState } from "react";
import Step1PersonalInfo from "./steps/PersonalInfoStep";
import Step2DocumentUpload from "./steps/DocumentUploadStep";
import Step3ReviewSubmit from "./steps/ReviewSubmitStep";
import FormNavigation from "./steps/FormNavigation";

// Initial form data structure
const initialFormData = {
  FirstName: "",
  LastName: "",
  MiddleName: "",
  AdditionalName: "",
  StudentType: "",
  DegreeLevel: "",
  Gender: "",
  BirthDate: "",
  PersonalEmail: "",
  Notes: "",
  National_Country: "",
  T1_Country: "",
  T2_Country: "",
  T3_Country: "",
  T4_Country: "",
  Terms_Conditions: false,

  NationalID: null,
  Transcript1: null,
  Transcript2: null,
  Transcript3: null,
  Transcript4: null,
};

export default function MultiStepForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(initialFormData);

  const stepsCount = 3; // adjust if you add/remove steps

  const handleChange = (updates: any) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => setStep(s => Math.min(s + 1, stepsCount - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  // Replace with your actual submit logic
  const handleSubmit = () => {
    // TODO: Submit formData to backend
    alert("Submitted! (Wire this up to your backend)");
  };




  return (
    <div className="m-10 p-10 bg-white rounded-2xl shadow-lg max-w-2xl w-full">
      {step === 0 && (
        <Step1PersonalInfo form={formData} updateForm={handleChange} onNext={handleNext} step={1} />
      )}
      {step === 1 && (
        <Step2DocumentUpload form={formData} updateForm={handleChange} onNext={handleNext} onBack={handleBack} step={2} />
      )}
      {step === 2 && (
        <Step3ReviewSubmit form={formData} updateForm={handleChange} onBack={handleBack} onSubmit={handleSubmit} step={3} />
      )}

      <FormNavigation
        step={step}
        stepsCount={stepsCount}
        nextStep={handleNext}
        prevStep={handleBack}
        handleSubmit={handleSubmit}
        formData={formData}
      />
    </div>
  );
}
