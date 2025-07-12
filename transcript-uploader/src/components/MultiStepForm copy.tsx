'use client';
import { useState } from "react";
import Step1PersonalInfo from "./steps/PersonalInfoStep";
import Step2DocumentUpload from "./steps/DocumentUploadStep";
import Step3ReviewSubmit from "./steps/ReviewSubmitStep";
import FormNavigation from "./steps/FormNavigation";
import SuccessStep from "./steps/SuccessStep";

// --- Must match backend case-sensitive keys ---
const initialFormData = {
  firstName: "",
  middleName: "",
  lastName: "",
  additionalName: "",
  gender: "",
  birthDate: "",
  studentType: "",
  degreeLevel: "",
  
  personalEmail: "",
  notes: "",
  nationalCountry: "",
  t1Country: "",
  t2Country: "",
  t3Country: "",
  t4Country: "",
  termsConditions: false,
  nationalID: null,
  transcript1: null,
  transcript2: null,
  transcript3: null,
  transcript4: null,
};

export default function MultiStepForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(initialFormData);
  const stepsCount = 3;

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ error?: string; success?: string } | null>(null);

  const handleChange = (updates: any) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => setStep(s => Math.min(s + 1, stepsCount - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitResult(null);

    // Required field check (matches backend)
    if (!formData.NationalID || !formData.Transcript1) {
      setSubmitResult({ error: "You must upload at least National ID and Transcript 1." });
      setSubmitting(false);
      return;
    }
    if (!formData.Terms_Conditions) {
      setSubmitResult({ error: "You must check the confirmation box to submit." });
      setSubmitting(false);
      return;
    }

    // Build FormData exactly as backend expects (case-sensitive!)
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value instanceof File) {
        data.append(key, value, value.name);
      } else if (typeof value !== "undefined" && value !== null) {
        data.append(key, value as any);
      }
    });

    // Debug: See what you're sending
    // for (let [k, v] of data.entries()) console.log(k, v);

    try {
      for (let [key, value] of data.entries()) {
      console.log(key, value);
      }
      const response = await fetch(
        "https://handletranscriptsubmission-4rkcjxtdfq-uc.a.run.app", // Your backend endpoint
        {
          method: "POST",
          body: data,
        }
      );
      let msg = await response.text();

      if (!response.ok) {
        setSubmitResult({ error: msg || "Submission failed. Please check your inputs." });
      } else {
        setSubmitResult({ success: "Submission successful! Your documents have been uploaded. Thank you!" });
      }
    } catch (err: any) {
      setSubmitResult({ error: err.message || "Unknown network error." });
    }
    setSubmitting(false);
  };

  return (
    <div className="m-10 p-10 bg-white rounded-2xl shadow-lg max-w-2xl w-full">
      {submitResult?.success ? (
        <SuccessStep message={submitResult.success} />
      ) : (
        <>
          {step === 0 && (
            <Step1PersonalInfo form={formData} updateForm={handleChange} onNext={handleNext} step={1} />
          )}
          {step === 1 && (
            <Step2DocumentUpload form={formData} updateForm={handleChange} onNext={handleNext} onBack={handleBack} step={2} />
          )}
          {step === 2 && (
            <Step3ReviewSubmit
              form={formData}
              updateForm={handleChange}
              onBack={handleBack}
              onSubmit={handleSubmit}
              step={3}
              submitting={submitting}
              submitResult={submitResult}
            />
          )}
          <FormNavigation
            step={step}
            stepsCount={stepsCount}
            nextStep={handleNext}
            prevStep={handleBack}
            handleSubmit={handleSubmit}
            formData={formData}
            submitting={submitting}
            submitResult={submitResult}
          />
        </>
      )}
    </div>
  );
}
