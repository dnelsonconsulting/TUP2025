import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

//interface SuccessStepProps {
  //message?: string;
//}

export default function SuccessStep() {
  return (
    <div className="text-center py-12">
      <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Submission Successful!</h2>
      <p className="mb-4 text-green-600 font-medium">Please wait to start your SEU application (details below)!<br/><br/> The Miscio team will take care of your transcript 
      evaluation through Josef Silney and will send the evaluation to Southeastern University when it is complete. <br/><br/>
      Transcript evaluations take approximately 15 days to complete.<br/><br/>
     Transcripts cannot be submitted to SEU, until you have started your SEU application. <br/><br/>
     If you have any questions related to transcripts, send an email to:  <a href="mailto:transcripts@miscio.io">transcripts@miscio.io</a></p>
    
    </div>
  );
}
