// utils/lookupData.ts
export type Country = { name: string; code: string; };
export type StudentType = { name: string; code: string; };
export type DegreeLevel = { name: string; code: string; };
export type Gender = { name: string; code: string; };
// Add more as your project grows!

// etc.



export const studentTypes = [
  {name: "Ugandan Student", code: "1UG01"},
  {name: "International Student (Not from Uganda)", code: "MSOHQ"},
  {name: "Domestic Student in OneHope", code: "PPNO"},
];

export const degreeLevels = [
  {name: "Undergraduate", code: "UnderGrad"},
  {name: "Graduate Certificate", code: "GradCert"},
  {name: "MBA", code: "MBA"},
  {name: "Other Master's", code: "Masters"},
  {name: "Doctorial", code: "Doctorate"},
];

export const genders = [
  {name: "Female", code: "F"},
  {name: "Male", code: "M"},
];

// Short version, use the full list in your project
// utils/lookupData.ts

export const countries = [
  { name: "Uganda", code: "UGA" },
  { name: "United States", code: "USA" },
  { name: "Afghanistan", code: "AFG" },
  { name: "Albania", code: "ALB" },
  { name: "Algeria", code: "DZA" },
  { name: "Andorra", code: "AND" },
  { name: "Angola", code: "AGO" },
  { name: "Antigua and Barbuda", code: "ATG" },
  { name: "Argentina", code: "ARG" },
  { name: "Armenia", code: "ARM" },
  { name: "Australia", code: "AUS" },
  { name: "Austria", code: "AUT" },
  { name: "Azerbaijan", code: "AZE" },
  { name: "Bahamas", code: "BHS" },
  { name: "Bahrain", code: "BHR" },
  { name: "Bangladesh", code: "BGD" },
  { name: "Barbados", code: "BRB" },
  { name: "Belarus", code: "BLR" },
  { name: "Belgium", code: "BEL" },
  { name: "Belize", code: "BLZ" },
  { name: "Benin", code: "BEN" },
  { name: "Bhutan", code: "BTN" },
  { name: "Bolivia", code: "BOL" },
  { name: "Bosnia and Herzegovina", code: "BIH" },
  { name: "Botswana", code: "BWA" },
  { name: "Brazil", code: "BRA" },
  { name: "Brunei", code: "BRN" },
  { name: "Bulgaria", code: "BGR" },
  { name: "Burkina Faso", code: "BFA" },
  { name: "Burundi", code: "BDI" },
  { name: "Cabo Verde", code: "CPV" },
  { name: "Cambodia", code: "KHM" },
  { name: "Cameroon", code: "CMR" },
  { name: "Canada", code: "CAN" },
  { name: "Central African Republic", code: "CAF" },
  { name: "Chad", code: "TCD" },
  { name: "Chile", code: "CHL" },
  { name: "China", code: "CHN" },
  { name: "Colombia", code: "COL" },
  { name: "Comoros", code: "COM" },
  { name: "Congo", code: "COG" },
  { name: "Costa Rica", code: "CRI" },
  { name: "Croatia", code: "HRV" },
  { name: "Cuba", code: "CUB" },
  { name: "Cyprus", code: "CYP" },
  { name: "Czech Republic", code: "CZE" },
  { name: "Denmark", code: "DNK" },
  { name: "Djibouti", code: "DJI" },
  { name: "Dominica", code: "DMA" },
  { name: "Dominican Republic", code: "DOM" },
  { name: "Ecuador", code: "ECU" },
  { name: "Egypt", code: "EGY" },
  { name: "El Salvador", code: "SLV" },
  { name: "Equatorial Guinea", code: "GNQ" },
  { name: "Eritrea", code: "ERI" },
  { name: "Estonia", code: "EST" },
];
