/**
 * Excel Template Structure for Question Upload
 * 
 * This file documents the exact Excel format required for uploading questions
 * Save this as a reference or template
 */

// Example row structure:
const excelTemplate = [
  {
    number: 1,
    category: "TWK",
    question_text: "Bunga raya adalah lambang nasional atau simbol resmi dari negara...",
    option_a: "Bunga mawar",
    option_b: "Bunga teratai", 
    option_c: "Bunga rafflesia",
    option_d: "Bunga anggrek",
    option_e: "Bunga dahlia",
    correct_answer: "C",
    explanation: "Rafflesia adalah bunga nasional Indonesia. Bunga ini ditetapkan sebagai simbol nasional karena keunikan dan keindahannya."
  },
  {
    number: 2,
    category: "TIU",
    question_text: "Jika 3x + 5 = 20, maka nilai x adalah...",
    option_a: "3",
    option_b: "4",
    option_c: "5",
    option_d: "6",
    option_e: "7",
    correct_answer: "C",
    explanation: "3x + 5 = 20 → 3x = 15 → x = 5"
  },
  {
    number: 3,
    category: "TKP",
    question_text: "Bagaimana sikap Anda ketika diminta mengerjakan tugas yang sulit?",
    option_a: "Menolak tugas karena terlalu sulit",
    option_b: "Menerima tugas dan berusaha menyelesaikannya",
    option_c: "Menerima tapi minta bantuan teman tanpa belajar",
    option_d: "Mengabaikan tugas",
    option_e: "Menunda-nunda pekerjaan",
    correct_answer: "B",
    explanation: "Sikap yang baik adalah menerima tugas dan berusaha menyelesaikannya dengan baik, menunjukkan profesionalisme dan dedikasi."
  }
];

// ════════════════════════════════════════════════════════
// COLUMN DESCRIPTIONS
// ════════════════════════════════════════════════════════

const columnDescriptions = {
  number: {
    type: "Integer",
    required: true,
    description: "Question number (1, 2, 3, ...)",
    example: "1",
    validation: "Must be unique within package, positive integer"
  },
  
  category: {
    type: "String (Enum)",
    required: true,
    description: "Question category",
    example: "TWK, TIU, atau TKP",
    validation: "Must be one of: TWK, TIU, TKP",
    values: ["TWK", "TIU", "TKP"]
  },
  
  question_text: {
    type: "String",
    required: true,
    description: "Full question text",
    example: "Bunga raya adalah lambang nasional dari negara...",
    validation: "Cannot be empty, max 2000 characters",
    tips: "Use plain text. If contains HTML, will be sanitized."
  },
  
  option_a: {
    type: "String",
    required: true,
    description: "Option A",
    example: "Bunga mawar",
    validation: "Cannot be empty"
  },
  
  option_b: {
    type: "String",
    required: true,
    description: "Option B",
    example: "Bunga teratai",
    validation: "Cannot be empty"
  },
  
  option_c: {
    type: "String",
    required: true,
    description: "Option C",
    example: "Bunga rafflesia",
    validation: "Cannot be empty"
  },
  
  option_d: {
    type: "String",
    required: true,
    description: "Option D",
    example: "Bunga anggrek",
    validation: "Cannot be empty"
  },
  
  option_e: {
    type: "String",
    required: true,
    description: "Option E",
    example: "Bunga dahlia",
    validation: "Cannot be empty"
  },
  
  correct_answer: {
    type: "String (Single Letter)",
    required: true,
    description: "The correct answer",
    example: "C",
    validation: "Must be exactly one of: A, B, C, D, E (uppercase)",
    values: ["A", "B", "C", "D", "E"]
  },
  
  explanation: {
    type: "String",
    required: false,
    description: "Answer explanation (optional but recommended)",
    example: "Rafflesia adalah bunga nasional Indonesia...",
    validation: "Maximum 3000 characters",
    tips: "Provide clear explanation to help students understand the concept"
  }
};

// ════════════════════════════════════════════════════════
// CSV EXAMPLE (if using CSV format)
// ════════════════════════════════════════════════════════

const csvExample = `number,category,question_text,option_a,option_b,option_c,option_d,option_e,correct_answer,explanation
1,TWK,Bunga raya adalah lambang nasional dari negara...,Bunga mawar,Bunga teratai,Bunga rafflesia,Bunga anggrek,Bunga dahlia,C,Rafflesia adalah bunga nasional Indonesia
2,TIU,Jika 3x + 5 = 20 maka nilai x adalah...,3,4,5,6,7,C,"3x + 5 = 20 → 3x = 15 → x = 5"
3,TKP,Bagaimana sikap Anda ketika diminta mengerjakan tugas yang sulit?,Menolak tugas,Menerima tugas,Menerima tapi minta bantuan,Mengabaikan tugas,Menunda-nunda,B,Sikap profesional adalah menerima tugas dan berusaha menyelesaikannya`;

// ════════════════════════════════════════════════════════
// VALIDATION RULES
// ════════════════════════════════════════════════════════

const validationRules = {
  fileSize: {
    min: "1 row (minimum)",
    max: "10,000 rows (for performance)",
    recommended: "100-1000 rows per batch"
  },
  
  fileFormat: {
    supported: [".xlsx", ".xls", ".csv"],
    encoding: "UTF-8 for CSV",
    sheets: "Only first sheet will be processed"
  },
  
  required: {
    columns: ["number", "category", "question_text", "option_a", "option_b", "option_c", "option_d", "option_e", "correct_answer"],
    canMiss: ["explanation"]
  },
  
  dataValidation: {
    number: "Positive integer, unique per package",
    category: "Must match: TWK, TIU, or TKP",
    question_text: "Non-empty string, max 2000 chars",
    options: "Non-empty strings",
    correct_answer: "Single letter A-E (uppercase)"
  }
};

// ════════════════════════════════════════════════════════
// COMMON ERRORS AND SOLUTIONS
// ════════════════════════════════════════════════════════

const commonErrors = [
  {
    error: "incorrect_column_name",
    example: "Using 'Question' instead of 'question_text'",
    solution: "Use exact column names: number, category, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation"
  },
  {
    error: "invalid_category",
    example: "Using 'CPNS' instead of 'TWK'",
    solution: "Use only: TWK, TIU, TKP"
  },
  {
    error: "invalid_answer",
    example: "Using 'Opsi C' or 'c' instead of 'C'",
    solution: "Use single uppercase letter: A, B, C, D, or E"
  },
  {
    error: "duplicate_number",
    example: "Two questions with number 5",
    solution: "Ensure question numbers are unique per package"
  },
  {
    error: "missing_field",
    example: "Empty question_text field",
    solution: "Fill all required columns. Only 'explanation' is optional"
  },
  {
    error: "incorrect_encoding",
    example: "Special characters show as ???",
    solution: "Save CSV as UTF-8 encoding"
  }
];

// ════════════════════════════════════════════════════════
// TIPS FOR CREATING GOOD QUESTIONS
// ════════════════════════════════════════════════════════

const questionCreationTips = [
  {
    tip: "Clear Question Text",
    description: "Write questions clearly and unambiguously",
    example: "Instead of: 'Berapa hasil?', use: 'Jika 3x + 5 = 20, maka nilai x adalah...'"
  },
  {
    tip: "Similar Options",
    description: "Make wrong options plausible so students need to know the answer",
    example: "For 'Capital of France': Paris (correct), Rome, Berlin, Madrid, Vienna"
  },
  {
    tip: "Include Explanations",
    description: "Always provide explanations to help learning",
    example: "Explain why one answer is correct and why others are wrong"
  },
  {
    tip: "Avoid Obvious Patterns",
    description: "Don't always make the correct answer 'C' or 'E'",
    example: "Distribute correct answers evenly across A-E"
  },
  {
    tip: "Category Consistency",
    description: "Use appropriate categories for each question",
    values: {
      TWK: "Tes Wawasan Kebangsaan (knowledge questions)",
      TIU: "Tes Intelegensi Umum (reasoning/logic questions)",
      TKP: "Tes Karakteristik Pribadi (behavior/attitude questions)"
    }
  }
];

// ════════════════════════════════════════════════════════
// EXAMPLE: HOW TO PREPARE IN EXCEL
// ════════════════════════════════════════════════════════

const excelSteps = [
  "1. Open Microsoft Excel or Google Sheets",
  "2. Create headers in Row 1 with EXACT names:",
  "   number | category | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation",
  "3. Fill data starting from Row 2",
  "4. Use data validation for category:",
  "   - Select category column",
  "   - Data > Validity/Validation",
  "   - Allow: List",
  "   - Source: TWK,TIU,TKP",
  "5. Use data validation for correct_answer:",
  "   - Select correct_answer column",
  "   - Data > Validity/Validation",
  "   - Allow: List",
  "   - Source: A,B,C,D,E",
  "6. Save as .xlsx or .csv",
  "7. Upload via ContentUploadForm"
];

module.exports = {
  excelTemplate,
  columnDescriptions,
  csvExample,
  validationRules,
  commonErrors,
  questionCreationTips,
  excelSteps
};
