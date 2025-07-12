export interface FormData {
  FirstName: string;
  MiddleName: string;
  LastName: string;
  AdditionalName: string;
  StudentType: string;
  DegreeLevel: string;
  Gender: string;
  BirthDate: string;
  PersonalEmail: string;
  Notes: string;
  NationalID: File | null;
  National_Country: string;
  Transcript1: File | null;
  T1_Country: string;
  Transcript2: File | null;
  T2_Country: string;
  Transcript3: File | null;
  T3_Country: string;
  Transcript4: File | null;
  T4_Country: string;
  Terms_Conditions: boolean;
}

export {};
