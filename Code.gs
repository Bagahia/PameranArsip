// ============================================================
// Google Apps Script - Secured Quiz API Backend
// ============================================================
// DEPLOYMENT: Deploy as Web App → Execute as: Me → Who has access: Anyone
// ============================================================

const API_SECRET_KEY = "CHANGE_ME_TO_A_RANDOM_SECRET_KEY_32_CHARS";
const ADMIN_PASSWORD = "CHANGE_ME_TO_A_RANDOM_ADMIN_PASSWORD";

// --- In-memory cache (persists across warm invocations) ---
var _cachedQuestions = null;
var _cacheTimestamp = 0;
var _cacheTTL = 5 * 60 * 1000; // 5 minutes

// --- Parse CorrectIndex - supports both formats ---
// Numeric: 0,1,2,3 (legacy)
// Letter: A,B,C,D (new human-readable)
function parseCorrectIndex(value) {
  const str = String(value).trim().toUpperCase();
  if (['A','B','C','D'].includes(str)) {
    return str.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
  }
  const num = Number(value);
  return (!isNaN(num) && num >= 0 && num <= 3) ? num : 0;
}

// ============================================================
// GET - Fetch quiz questions
// ============================================================
function doGet(e) {
  const paramKey = e.parameter.key;

  if (paramKey !== API_SECRET_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // --- Route: check attempt ---
  const action = e.parameter.action;

  if (action === "checkAttempt") {
    return handleCheckAttempt(e);
  }

  // --- Default: return questions ---
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

  // --- Read all questions (with in-memory cache) ---
  const now = Date.now();
  let allQuestions;

  if (_cachedQuestions && (now - _cacheTimestamp) < _cacheTTL) {
    allQuestions = _cachedQuestions; // skip sheet read
  } else {
    const questionsSheet = ss.getSheetByName("Questions");
    const data = questionsSheet.getDataRange().getValues();
    const header = data[0]; // [Question, OptionA, OptionB, OptionC, OptionD, CorrectIndex]
    const rows = data.slice(1); // skip header

    allQuestions = rows.map(function (row) {
      return {
        question: String(row[0]),
        options: [String(row[1]), String(row[2]), String(row[3]), String(row[4])],
        correctIndex: parseCorrectIndex(row[5])
      };
    });

    _cachedQuestions = allQuestions;
    _cacheTimestamp = now;
  }

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

// ============================================================
// POST - Submit quiz results, admin actions
// ============================================================
function doPost(e) {
  const paramKey = e.parameter.key;

  if (paramKey !== API_SECRET_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "submitQuiz") {
      return handleSubmitQuiz(body);
    } else if (action === "adminReset") {
      return handleAdminReset(body);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Unknown action" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Invalid request: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// CHECK ATTEMPT - Has this user already attempted today?
// ============================================================
function handleCheckAttempt(e) {
  const name = (e.parameter.name || "").trim().toLowerCase();
  const fingerprint = (e.parameter.fingerprint || "").trim();

  if (!name || !fingerprint) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Name and fingerprint required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const today = getTodayDate();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Attempts");

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ attempted: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const rows = data.slice(1);

  // Find columns by header
  const nameCol = header.indexOf("name");
  const fpCol = header.indexOf("fingerprint");
  const dateCol = header.indexOf("date");
  const scoreCol = header.indexOf("score");
  const flaggedCol = header.indexOf("flagged");
  const resetCol = header.indexOf("adminReset");

  let lastAttempt = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = String(row[dateCol] || "");
    const rowName = String(row[nameCol] || "").trim().toLowerCase();
    const rowFp = String(row[fpCol] || "").trim();
    const isReset = row[resetCol] === true || String(row[resetCol]).toLowerCase() === "true";

    if (rowDate === today && rowName === name && rowFp === fingerprint && !isReset) {
      lastAttempt = {
        score: row[scoreCol],
        flagged: row[flaggedCol]
      };
    }
  }

  if (lastAttempt) {
    return ContentService
      .createTextOutput(JSON.stringify({ attempted: true, lastScore: lastAttempt.score, flagged: lastAttempt.flagged }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ attempted: false }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SUBMIT QUIZ - Save attempt to Attempts sheet
// ============================================================
function handleSubmitQuiz(body) {
  const { name, fingerprint, score, totalQuestions, duration, questionTimes, tabSwitchCount, date, timestamp } = body;

  if (!name || !fingerprint || score === undefined || !totalQuestions) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Missing required fields" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Flag suspicious submissions
  const avgTimePerQuestion = duration / totalQuestions;
  const flagged = avgTimePerQuestion < 3 || tabSwitchCount > 5;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Attempts");

  // Auto-create Attempts sheet if missing
  if (!sheet) {
    sheet = ss.insertSheet("Attempts");
    sheet.appendRow([
      "timestamp", "name", "fingerprint", "score", "totalQuestions",
      "duration", "questionTimes", "tabSwitchCount", "date", "flagged", "adminReset"
    ]);
    // Style header
    const headerRange = sheet.getRange(1, 1, 1, 11);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4a86c8");
    headerRange.setFontColor("#ffffff");
    // Auto-resize columns
    for (let c = 1; c <= 11; c++) {
      sheet.autoResizeColumn(c);
    }
  }

  sheet.appendRow([
    timestamp || new Date().toISOString(),
    name,
    fingerprint,
    score,
    totalQuestions,
    Math.round(duration),
    JSON.stringify(questionTimes || []),
    tabSwitchCount || 0,
    date || getTodayDate(),
    flagged ? "TRUE" : "FALSE",
    "FALSE"
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, flagged: flagged }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ADMIN RESET - Allow a user to retake the quiz
// ============================================================
function handleAdminReset(body) {
  const { adminPassword, name, fingerprint } = body;

  if (adminPassword !== ADMIN_PASSWORD) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Invalid admin password" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const today = getTodayDate();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Attempts");

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "No Attempts sheet found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const nameCol = header.indexOf("name");
  const fpCol = header.indexOf("fingerprint");
  const dateCol = header.indexOf("date");
  const resetCol = header.indexOf("adminReset");

  let resetCount = 0;

  for (let i = 1; i <= data.length; i++) {
    const row = data[i - 1];
    const rowDate = String(row[dateCol] || "");
    const rowName = String(row[nameCol] || "").trim().toLowerCase();
    const rowFp = String(row[fpCol] || "").trim();

    if (rowDate === today && rowName === name.toLowerCase().trim() && (!fingerprint || rowFp === fingerprint)) {
      sheet.getRange(i + 1, resetCol + 1).setValue("TRUE");
      resetCount++;
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, resetCount: resetCount }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// HELPERS
// ============================================================
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
