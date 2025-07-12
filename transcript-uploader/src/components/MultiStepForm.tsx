'use client';
import { useState } from "react";
import Step1PersonalInfo from "./steps/PersonalInfoStep";
import Step2DocumentUpload from "./steps/DocumentUploadStep";
import Step3ReviewSubmit from "./steps/ReviewSubmitStep";
import FormNavigation from "./steps/FormNavigation";
import SuccessStep from "./steps/SuccessStep";
import { studentTypes, degreeLevels, genders } from "../utils/lookupData";


// --- Must match backend case-sensitive keys ---
const initialFormData = {
  // Personal Info
  firstName: "",
  lastName: "",
  middleName: "",
  additionalName: "",
  studentType: "",
  degreeLevel: "",
  gender: "",
  birthDate: "",
  personalEmail: "",
  notes: "",
  termsConditions: false,

  // Country Data (consistent naming)
  nationalCountry: "",
  nationalCountryCode: "",
  t1Country: "",
  t1CountryCode: "",
  t2Country: "",
  t2CountryCode: "",
  t3Country: "",
  t3CountryCode: "",
  t4Country: "",
  t4CountryCode: "",

  // Files (consistent naming)
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

  // Lookup code values for studentType and degreeLevel
  const studentTypeObj = studentTypes.find(st => st.name === formData.studentType || st.code === formData.studentType);
  const degreeLevelObj = degreeLevels.find(dl => dl.name === formData.degreeLevel || dl.code === formData.degreeLevel);
  const genderObj = genders.find(g => g.name === formData.gender || g.code === formData.gender);

  const studentTypeCode = studentTypeObj ? studentTypeObj.code : formData.studentType;
  const degreeLevelCode = degreeLevelObj ? degreeLevelObj.code : formData.degreeLevel;
  const genderCode = genderObj ? genderObj.code : formData.gender;

  // Compose the base filename
  const baseFileName = [
    formData.lastName,
    formData.firstName,
    degreeLevelCode,
    studentTypeCode,
  ].join('_').replace(/\s+/g, '_').replace(/\//g, '_');

  // Compose the expected file names
  const nationalIDFilename = `${baseFileName}_${formData.nationalCountryCode}-ID`;
  const transcriptFileNames = [1,2,3,4].map(num =>
    (formData as any)[`t${num}CountryCode`]
      ? `${baseFileName}_${(formData as any)[`t${num}CountryCode`]}-T${num}`
      : ''
  );

  // Prepare the submission data
  const submissionData: { [key: string]: any } = { ...formData };

  // Force codes in the payload
  submissionData.gender = genderCode;
  submissionData.studentType = studentTypeCode;
  submissionData.degreeLevel = degreeLevelCode;
  submissionData.nationalIDFilename = nationalIDFilename;
  submissionData.transcript1Filename = transcriptFileNames[0];
  submissionData.transcript2Filename = transcriptFileNames[1];
  submissionData.transcript3Filename = transcriptFileNames[2];
  submissionData.transcript4Filename = transcriptFileNames[3];

  // Prepare the FormData
  const data = new FormData();
  Object.entries(submissionData).forEach(([key, value]) => {
    // Only append non-empty values
    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      // If it's a File, skip appending empty files
      (!(value instanceof File) || value.size > 0)
    ) {
      data.append(key, value);
    }
  });

  // Logging for debug
  for (let [k, v] of data.entries()) {
    console.log("FormData:", k, v, typeof v, v instanceof File ? v.name : '');
  }

  try {
    const response = await fetch(
      "https://tu-backend-270306986889.us-central1.run.app/submit",
      { method: "POST", body: data }
    );
    const resultText = await response.text();

    if (!response.ok) {
      throw new Error(resultText || "Submission failed with no error message.");
    }

    setSubmitResult({ success: resultText || "Your application has been submitted successfully!" });
  } catch (err: any) {
    console.error("Submission Error:", err);
    setSubmitResult({ error: err.message || "An unexpected network error occurred." });
  } finally {
    setSubmitting(false);
  }
};



  return (
    <div className="m-10 p-10 bg-white rounded-2xl shadow-lg max-w-2xl w-full">
      {submitResult?.success ? (
        <SuccessStep />
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
          />
        </>
      )}
    </div>
  );
}
