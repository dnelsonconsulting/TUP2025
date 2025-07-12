// utils/submitApplication.ts (create this file, or add to your handler)
import type { FormData as ApplicationFormData } from './types';

export async function submitApplication(form: ApplicationFormData) {
  const endpoint = "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/handleTranscriptSubmission"; // Replace with your actual deployed endpoint!
  const formData = new FormData();

  // Append all regular fields and files
  for (const [key, val] of Object.entries(form)) {
    // If it's a file, add it as a file
    if (
      ["NationalID", "Transcript1", "Transcript2", "Transcript3", "Transcript4"].includes(key)
    ) {
      if (val) formData.append(key, val, val.name);
    } else if (val !== undefined && val !== null) {
      // Otherwise, treat as regular value
      formData.append(key, val);
    }
  }

  // Add the accuracy checkbox (if not already in form)
  if (form.Terms_Conditions !== undefined) {
    formData.append("Terms_Conditions", form.Terms_Conditions ? "true" : "false");
  }

  // Send the POST
  const res = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorMsg = await res.text();
    throw new Error(errorMsg);
  }
  return await res.json();
}
