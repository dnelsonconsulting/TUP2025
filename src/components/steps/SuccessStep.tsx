import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

export default function SuccessStep() {
  return (
    <div className="text-center py-12">
      <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Submission Successful!</h2>
      <p>Your documents have been uploaded and recorded. Thank you!</p>
    <p>Wait to Start Your SEU Application (details below)! The Miscio team will take care of your transcript evaluation through Josef Silney and will send the evaluation to Southeastern University when it is complete. 
      Transcript evaluations take approximately 15 days to complete.<br/>
     Transcripts cannot be submitted to SEU, until you have started your SEU application.  
     If you have any questions related to transcripts, send an email to:  transcripts@miscio.io "</p>
    </div>
  );
}
