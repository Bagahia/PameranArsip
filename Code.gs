// ============================================================
// Google Apps Script - Secured Quiz API Backend
// ============================================================
// DEPLOYMENT: Deploy as Web App → Execute as: Me → Who has access: Anyone
// ============================================================

const API_SECRET_KEY = "CHANGE_ME_TO_A_RANDOM_SECRET_KEY_32_CHARS";

function doGet(e) {
  const paramKey = e.parameter.key;

  if (paramKey !== API_SECRET_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Read QuestionCount from "Settings" sheet ---
  let questionCount = 5;
  try {
    const settingsSheet = ss.getSheetByName("Settings");
    if (settingsSheet) {
      const val = settingsSheet.getRange("B1").getValue();
      if (val && !isNaN(val) && Number(val) > 0) {
        questionCount = Number(val);
      }
    }
  } catch (err) {
    // fallback to 5
  }

  // --- Read all questions from "Questions" sheet ---
  const questionsSheet = ss.getSheetByName("Questions");
  const data = questionsSheet.getDataRange().getValues();
  const header = data[0]; // [Question, OptionA, OptionB, OptionC, OptionD, CorrectIndex]
  const rows = data.slice(1); // skip header

  const allQuestions = rows.map(function (row) {
    return {
      question: String(row[0]),
      options: [String(row[1]), String(row[2]), String(row[3]), String(row[4])],
      correctIndex: Number(row[5])
    };
  });

  // --- Fisher-Yates shuffle ---
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = allQuestions[i];
    allQuestions[i] = allQuestions[j];
    allQuestions[j] = temp;
  }

  // --- Slice to configured count ---
  const selected = allQuestions.slice(0, questionCount);

  // --- Return JSON ---
  const output = {
    totalQuestions: selected.length,
    questions: selected
  };

  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
