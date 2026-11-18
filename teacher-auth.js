/**
 * SnowDay Class (თოვლის დღის კლასი) — answer.ge
 * Teacher Google OAuth, Personal Lesson History Space & Full-Page Super Admin Panel
 * Powered by Firebase Authentication (Google Sign-In) + Cloud Firestore Security Rules
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const AUTH_I18N = {
  ka: {
    headerSignInFull: "შესვლა (მასწავლებელი)",
    headerSignInShort: "შესვლა",
    headerSuperAdminFull: "ადმინ პანელი · ჩემი სივრცე",
    headerSuperAdminShort: "ადმინი",
    headerTeacherFull: "ჩემი პირადი სივრცე",
    headerTeacherShort: "სივრცე",
    headerUnauthorizedFull: "წვდომა შეზღუდულია",
    headerUnauthorizedShort: "სტატუსი",
    loadingAuth: "მოწმდება მასწავლებლის ავტორიზაცია...",
    googleSignInBtn: "Google-ით შესვლა",
    switchAccountBtn: "სხვა Google ანგარიშით შესვლა",
    signOutBtn: "გასვლა",
    openWorkspaceBtn: "ჩემს პირად სივრცეში გადასვლა →",
    openAdminPanelBtn: "ადმინ პანელის გახსნა",
    verifiedTeacherBadge: "✓ ავტორიზებული მასწავლებელი",
    verifiedAdminBadge: "★ მთავარი ადმინი (Super Admin)",
    unauthorizedBadge: "წვდომა შეზღუდულია",
    gateGuestTitle: "საჭიროა მასწავლებლის ავტორიზაცია",
    gateGuestDesc:
      "გაიარეთ ავტორიზაცია Google (Gmail) ანგარიშით, რომ გახსნათ თქვენი პირადი სივრცე, შეინახოთ გაზიარებული Google Docs ისტორია და შექმნათ QR კოდები.",
    gateStudentNote:
      "მოსწავლეებს ავტორიზაცია არ სჭირდებათ — გაკვეთილი იხსნება პირდაპირ QR კოდით ან მარცხენა ბარათიდან.",
    gateUnauthTitle: "ეს ელფოსტა არ არის მასწავლებლების ჯგუფში",
    gateUnauthBodyPrefix: "თქვენ შესული ხართ მისამართით ",
    gateUnauthBodySuffix:
      ", რომელიც ჯერ არ არის დამატებული ავტორიზებულ მასწავლებლებში. მიმართეთ მთავარ ადმინისტრატორს:",
    authModalKicker: "მასწავლებლის ავტორიზაცია · answer.ge",
    authModalTitleGuest: "შესვლა მასწავლებლის Google ანგარიშით",
    authModalTitleUnauth: "წვდომა მხოლოდ ჯგუფის მასწავლებლებისთვის",

    // Workspace Banner & Tabs
    wsWelcomeDefault: "მასწავლებლის პირადი სივრცე",
    wsWelcomeNamedFmt: (name) => `${name} — პირადი სივრცე`,
    wsWelcomeSubTeacher:
      "შეინახეთ და მართეთ თქვენი გაზიარებული Google Docs გაკვეთილები, კლასის მინიშნებები, პირადი ჩანაწერები და QR კოდები.",
    wsWelcomeSubAdmin:
      "თქვენი მასწავლებლის პირადი სივრცე და სკოლის მასწავლებლების ჯგუფის სრული ადმინ პანელი.",
    wsStatDocsLabel: "შენახული დოკუმენტი",
    wsStatAiLabel: "AI გაკვეთილი",
    wsStatTeachersLabel: "მასწავლებელი ჯგუფში",
    wsReturnLessonBtn: "← გაკვეთილზე დაბრუნება",
    wsStudentHubBtn: "🎓 მოსწავლის საწყისი",
    tabHistoryLabel: "ჩემი დოკუმენტების ისტორია",
    tabCreateLabel: "ახალი გაკვეთილი და QR",
    tabAdminLabel: "ადმინ პანელი · მასწავლებლები",
    tabSettingsLabel: "AI კავშირი და ქეში",

    // Ribbon shortcuts
    ribbonSaveBtn: "📌 ისტორიაში შენახვა",
    ribbonSavedBtn: "✓ შენახულია ჩემს სივრცეში",
    ribbonWorkspaceBtn: "ჩემი სივრცე",

    // History Tab
    historyHeading: "ჩემი გაზიარებული დოკუმენტები და ჩანაწერები",
    historyDesc:
      "აქ ინახება ყველა დოკუმენტი (Google Doc, Drive PDF, DOCX, TXT), რომელიც დაამატეთ ან გაუზიარეთ მოსწავლეებს — კლასის მითითებით, პირადი შენიშვნებითა და მყისიერი QR კოდით.",
    importLocalBtnFmt: (n) => `⚡ ამ ბრაუზერიდან იმპორტი (${n})`,
    jumpCreateBtn: "+ ახალი დოკუმენტის დამატება",
    historySearchPlaceholder: "მოძებნე სათაურით, საგნით, კლასით ან ჩანაწერით...",
    filterAll: "ყველა",
    filterAi: "AI გენერირებული",
    filterQr: "QR გაზიარებული",
    emptyHistoryTitle: "თქვენს პირად ისტორიაში დოკუმენტები ჯერ არ არის",
    emptyHistoryBody:
      "დაამატეთ თქვენი პირველი გაკვეთილი „ახალი გაკვეთილი და QR“ განყოფილებიდან — მხარდაჭერილია Google Docs, Drive PDF, DOCX, TXT და ატვირთული ფაილები.",
    noFilteredDocs: "არჩეული ფილტრით დოკუმენტი ვერ მოიძებნა.",
    statusAiBadge: "⚡ AI გაკვეთილი მზადაა",
    statusQrBadge: "🔗 QR გაზიარებული",
    sharedCountFmt: (n) => (n > 1 ? `გაზიარებულია ${n}-ჯერ` : "გაზიარებულია"),
    updatedLabelPrefix: "განახლდა: ",
    personalNotePrefix: "ჩემი ჩანაწერი: ",
    noPersonalNote: "პირადი ჩანაწერი დამატებული არ არის.",
    docOpenLessonBtn: "გაკვეთილის გახსნა",
    docShowQrBtn: "QR კოდი",
    docCopyStudentLinkBtn: "ბმულის კოპირება",
    docEditDetailsBtn: "ჩანაწერის ჩასწორება",
    docDeleteBtn: "წაშლა",
    docOpenGoogleBtn: "პირველწყარო ↗",
    editTitleLabel: "სათაური",
    editSubjectLabel: "საგანი",
    editClassLabel: "კლასი / ჯგუფი",
    editNoteLabel: "პირადი ჩანაწერი (რა დაამატეთ / რა დაავალეთ)",
    saveChangesBtn: "შენახვა",
    cancelEditBtn: "გაუქმება",
    savedDocToast: "✓ დოკუმენტი შეინახა თქვენს პირად ისტორიაში!",
    updatedDocToast: "✓ ჩანაწერი განახლდა!",
    deletedDocToast: "✓ დოკუმენტი წაიშალა ისტორიიდან.",
    importedDocsToastFmt: (n) => `✓ იმპორტირებულია ${n} გაკვეთილი თქვენს პირად სივრცეში!`,
    copiedLinkToast: "✓ მოსწავლის ბმული დაკოპირდა!",
    untitledDocFmt: (shortId) => `გაკვეთილის დოკუმენტი (${shortId})`,

    // Create & QR Tab
    createHeading: "ახალი გაკვეთილის დამატება და QR კოდის შექმნა",
    createDesc:
      "ჩასვით საჯარო Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთეთ ფაილი — გაკვეთილი ავტომატურად შეინახება თქვენს პირად ისტორიაში.",
    docUrlLabel: "Google Docs / Drive (PDF, DOCX, TXT) ბმული",
    docUrlHint: "Share → Anyone with the link (Viewer) — მხარდაჭერილია Google Docs, Drive PDF, DOCX, TXT.",
    docUrlInvalid: "გთხოვთ, შეიყვანოთ სწორი Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთოთ ფაილი.",
    docTitleLabel: "გაკვეთილის სათაური (არასავალდებულო)",
    docTitlePlaceholder: "მაგ.: დავით აღმაშენებლის რეფორმები (ან AI შეავსებს ავტომატურად)",
    docClassLabel: "კლასი / ჯგუფი (არასავალდებულო)",
    docClassPlaceholder: "მაგ.: IX კლასი · ისტორია",
    docNoteLabel: "პირადი ჩანაწერი — რა დაამატეთ ან რა დაავალეთ კლასს",
    docNotePlaceholder:
      "მაგ.: დავამატე მე-4 პარაგრაფის ტერმინები და 3 საშინაო კითხვა თოვლიანი დღისთვის...",
    qrTargetLegend: "QR კოდის სამიზნე მისამართი",
    saveQrBtn: "QR შექმნა და ისტორიაში შენახვა",
    savingQrBtn: "ინახება...",
    generateOpenBtn: "AI გაკვეთილის გენერაცია და გახსნა",
    qrEmptyPrompt: "ჩასვით დოკუმენტის ბმული ან ატვირთეთ ფაილი QR კოდის შესაქმნელად",
    qrPngDownloaded: "PNG ფაილი ჩამოიტვირთა!",

    // Admin Panel Tab
    adminPanelTitle: "მასწავლებლების ჯგუფის ადმინ პანელი",
    adminPanelLead:
      "მართეთ სკოლის ავტორიზებული მასწავლებლები Google / Gmail მისამართებით. დამატებულ წევრებს ეძლევათ საკუთარი პირადი სივრცე და QR გაკვეთილების შექმნის უფლება.",
    kpiTotalLabel: "სულ ჯგუფში",
    kpiActiveLabel: "აქტიური (შემოსული)",
    kpiPendingLabel: "მოწვეული (ელოდება შესვლას)",
    inviteHeading: "ახალი მასწავლებლის დამატება ჯგუფში",
    addEmailLabel: "მასწავლებლის Google / Gmail ელფოსტა",
    addEmailHint: "ფორმატი: teacher@gmail.com (მხოლოდ Google-თან დაკავშირებული ელფოსტა)",
    addEmailPlaceholder: "nino.teacher@gmail.com",
    addEmailError: "გთხოვთ, შეიყვანოთ სწორი ელფოსტის მისამართი (მაგ.: teacher@gmail.com).",
    addNoteLabel: "სახელი, გვარი და საგანი (არასავალდებულო)",
    addNoteHint: "გამოჩნდება მასწავლებლების ცხრილში იდენტიფიკაციისთვის",
    addNotePlaceholder: "მაგ.: ნინო ბერიძე — ისტორია (VIII–X კლ.)",
    addTeacherSubmitBtn: "+ ჯგუფში დამატება",
    addingTeacherBtn: "ემატება...",
    teachersListHeading: "ავტორიზებული მასწავლებლების სია",
    adminSearchPlaceholder: "მოძებნე ელფოსტით ან სახელით...",
    colTeacher: "მასწავლებელი / ელფოსტა",
    colNote: "სახელი და საგანი",
    colRole: "როლი",
    colStatus: "სტატუსი",
    colActions: "მართვა",
    roleSuperAdminTag: "მთავარი ადმინი",
    roleTeacherTag: "მასწავლებელი",
    statusLoggedBefore: "აქტიური",
    statusInvitedPending: "ელოდება პირველ შესვლას",
    editTeacherNoteBtn: "შენიშვნა",
    removeTeacherBtn: "წაშლა",
    removingBtn: "იშლება...",
    protectedAdminLabel: "ძირითადი ადმინი",
    addedSuccessFmt: (email) => `✓ მასწავლებელი დაემატა ჯგუფში: ${email}`,
    alreadyExistsFmt: (email) => `✓ განახლდა მასწავლებლის ჩანაწერი: ${email}`,
    removedSuccessFmt: (email) => `✓ წაიშალა ჯგუფიდან: ${email}`,
    emptyTeachersList: "ამ საძიებო სიტყვით მასწავლებელი ვერ მოიძებნა.",

    // Settings Tab
    settingsHeading: "Geosoft AI Agent კავშირი და ლოკალური ქეში",
    settingsDesc:
      "შეამოწმეთ ან განაახლეთ გამოქვეყნებული Geosoft AI აგენტის ბმული და მართეთ ამ მოწყობილობაზე დაქეშილი გაკვეთილები.",

    // Errors
    popupClosedMsg: "ავტორიზაციის ფანჯარა დაიხურა შესვლის დასრულებამდე.",
    unauthorizedDomainMsg:
      "მიმდინარე დომენი არ არის დამატებული Firebase Auth Authorized Domains სიაში.",
    genericAuthErrorPrefix: "ავტორიზაციის შეცდომა: ",
    genericSaveErrorPrefix: "შენახვის შეცდომა: "
  },
  en: {
    headerSignInFull: "Teacher Sign In",
    headerSignInShort: "Sign In",
    headerSuperAdminFull: "Admin Panel · My Space",
    headerSuperAdminShort: "Admin",
    headerTeacherFull: "My Teacher Space",
    headerTeacherShort: "My Space",
    headerUnauthorizedFull: "Access Restricted",
    headerUnauthorizedShort: "Status",
    loadingAuth: "Checking teacher authentication...",
    googleSignInBtn: "Sign in with Google",
    switchAccountBtn: "Switch Google Account",
    signOutBtn: "Sign Out",
    openWorkspaceBtn: "Open My Personal Workspace →",
    openAdminPanelBtn: "Open Admin Panel",
    verifiedTeacherBadge: "✓ Authorized Teacher",
    verifiedAdminBadge: "★ Super Admin",
    unauthorizedBadge: "Access Restricted",
    gateGuestTitle: "Teacher Sign-In Required",
    gateGuestDesc:
      "Sign in with your authorized Google (Gmail) account to open your personal workspace, save shared Google Docs in your history, and create student QR codes.",
    gateStudentNote:
      "Students do not need to sign in — open lessons directly via QR code or the Student card.",
    gateUnauthTitle: "This email is not in the Teachers Group",
    gateUnauthBodyPrefix: "You are signed in as ",
    gateUnauthBodySuffix:
      ", which has not been added to the authorized teachers group yet. Please contact the Super Admin:",
    authModalKicker: "Teacher Authentication · answer.ge",
    authModalTitleGuest: "Sign in with Teacher Google Account",
    authModalTitleUnauth: "Restricted to Authorized School Teachers",

    // Workspace Banner & Tabs
    wsWelcomeDefault: "Teacher Personal Workspace",
    wsWelcomeNamedFmt: (name) => `${name}'s Workspace`,
    wsWelcomeSubTeacher:
      "Keep track of every Google Doc you added or shared with classes, personal teaching notes, and printable student QR codes.",
    wsWelcomeSubAdmin:
      "Your personal teaching history plus the full school Teachers Group Admin Panel.",
    wsStatDocsLabel: "Saved Docs",
    wsStatAiLabel: "AI Lessons",
    wsStatTeachersLabel: "Group Teachers",
    wsReturnLessonBtn: "← Back to Open Lesson",
    wsStudentHubBtn: "🎓 Student Hub",
    tabHistoryLabel: "My Docs & History",
    tabCreateLabel: "New Lesson & QR",
    tabAdminLabel: "Admin Panel · Teachers",
    tabSettingsLabel: "AI Agent & Cache",

    // Ribbon shortcuts
    ribbonSaveBtn: "📌 Save to My History",
    ribbonSavedBtn: "✓ Saved in My Space",
    ribbonWorkspaceBtn: "My Space",

    // History Tab
    historyHeading: "My Shared Documents & Teaching Notes",
    historyDesc:
      "Every document (Google Doc, Drive PDF, DOCX, TXT) you add or share is saved to your personal cloud history with class tags, notes, and instant QR codes.",
    importLocalBtnFmt: (n) => `⚡ Import from This Browser (${n})`,
    jumpCreateBtn: "+ Add New Document",
    historySearchPlaceholder: "Search by title, subject, class, or personal note...",
    filterAll: "All",
    filterAi: "AI Generated",
    filterQr: "QR Shared",
    emptyHistoryTitle: "No saved documents in your space yet",
    emptyHistoryBody:
      "Add your first lesson in the 'New Lesson & QR' tab — Google Docs, Drive PDF, DOCX, TXT, and uploaded files stay saved here across devices.",
    noFilteredDocs: "No saved documents matched your current filter.",
    statusAiBadge: "⚡ AI Lesson Ready",
    statusQrBadge: "🔗 QR Shared",
    sharedCountFmt: (n) => (n > 1 ? `Shared ${n} times` : "Shared"),
    updatedLabelPrefix: "Updated: ",
    personalNotePrefix: "My note: ",
    noPersonalNote: "No personal note added yet.",
    docOpenLessonBtn: "Open Lesson",
    docShowQrBtn: "QR Code",
    docCopyStudentLinkBtn: "Copy Link",
    docEditDetailsBtn: "Edit Note",
    docDeleteBtn: "Remove",
    docOpenGoogleBtn: "Original Doc ↗",
    editTitleLabel: "Lesson Title",
    editSubjectLabel: "Subject",
    editClassLabel: "Class / Group",
    editNoteLabel: "Personal Note (what you added or assigned)",
    saveChangesBtn: "Save Changes",
    cancelEditBtn: "Cancel",
    savedDocToast: "✓ Saved to your personal history!",
    updatedDocToast: "✓ Personal note & details updated!",
    deletedDocToast: "✓ Removed document from history.",
    importedDocsToastFmt: (n) => `✓ Imported ${n} lessons into your personal space!`,
    copiedLinkToast: "✓ Student link copied to clipboard!",
    untitledDocFmt: (shortId) => `Lesson Document (${shortId})`,

    // Create & QR Tab
    createHeading: "Add Lesson Document & Create QR Code",
    createDesc:
      "Paste a public Google Docs or Drive (PDF, DOCX, TXT) link or upload a file, add an optional class tag or note, and save it directly to your personal history.",
    docUrlLabel: "Google Docs / Drive (PDF, DOCX, TXT) Link",
    docUrlHint: "Share → Anyone with the link (Viewer) — Supports Google Docs, Drive PDF, DOCX, TXT, and web files.",
    docUrlInvalid: "Please enter a valid Google Docs or Drive (PDF, DOCX, TXT) share URL, or upload a file.",
    docTitleLabel: "Lesson Title (Optional)",
    docTitlePlaceholder: "e.g., Reforms of David the Builder (or auto-filled by AI)",
    docClassLabel: "Class / Group (Optional)",
    docClassPlaceholder: "e.g., Grade 9 · History",
    docNoteLabel: "Personal Note — what you added or assigned",
    docNotePlaceholder:
      "e.g., Added chapter 4 vocabulary terms and 3 snow-day review prompts...",
    qrTargetLegend: "QR Code Destination Host",
    saveQrBtn: "Create QR & Save to History",
    savingQrBtn: "Saving...",
    generateOpenBtn: "Generate & Open AI Lesson",
    qrEmptyPrompt: "Paste a document link or upload a file to preview its QR code",
    qrPngDownloaded: "QR PNG downloaded!",

    // Admin Panel Tab
    adminPanelTitle: "Teachers Group Admin Panel",
    adminPanelLead:
      "Manage authorized school teachers via their Google / Gmail addresses. Authorized teachers receive their own personal history workspace and QR creation tools.",
    kpiTotalLabel: "Total Members",
    kpiActiveLabel: "Active (Signed In)",
    kpiPendingLabel: "Invited (Pending Login)",
    inviteHeading: "Add New Teacher to Group",
    addEmailLabel: "Teacher's Google / Gmail Address",
    addEmailHint: "Format: teacher@gmail.com (must be a valid Google/Gmail address)",
    addEmailPlaceholder: "nino.teacher@gmail.com",
    addEmailError: "Please enter a valid email address in the format teacher@gmail.com.",
    addNoteLabel: "Full Name & Subject (Optional)",
    addNoteHint: "Shown in the teachers directory for easy identification",
    addNotePlaceholder: "e.g., Nino Beridze — History (Grades 8–10)",
    addTeacherSubmitBtn: "+ Add to Group",
    addingTeacherBtn: "Adding...",
    teachersListHeading: "Authorized Teachers Directory",
    adminSearchPlaceholder: "Filter by email or teacher name...",
    colTeacher: "Teacher / Email",
    colNote: "Name & Subject",
    colRole: "Role",
    colStatus: "Status",
    colActions: "Manage",
    roleSuperAdminTag: "Super Admin",
    roleTeacherTag: "Teacher",
    statusLoggedBefore: "Active",
    statusInvitedPending: "Pending first login",
    editTeacherNoteBtn: "Edit Note",
    removeTeacherBtn: "Remove",
    removingBtn: "Removing...",
    protectedAdminLabel: "Primary Admin",
    addedSuccessFmt: (email) => `✓ Added teacher to group: ${email}`,
    alreadyExistsFmt: (email) => `✓ Updated teacher record: ${email}`,
    removedSuccessFmt: (email) => `✓ Removed from group: ${email}`,
    emptyTeachersList: "No teachers matched your search.",

    // Settings Tab
    settingsHeading: "Geosoft AI Agent Connection & Local Cache",
    settingsDesc:
      "Test or update your published Geosoft Headless Agent URL and manage cached lessons stored in this browser.",

    // Errors
    popupClosedMsg: "Sign-in window was closed before completing authentication.",
    unauthorizedDomainMsg:
      "This domain is not yet listed in Firebase Auth Authorized Domains.",
    genericAuthErrorPrefix: "Authentication error: ",
    genericSaveErrorPrefix: "Save error: "
  }
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const cfg = window.SNOWDAY_AUTH_CONFIG || {};
const superAdminEmail = String(cfg.superAdminEmail || "luka@geosoft.dev")
  .trim()
  .toLowerCase();

const firebaseApp = initializeApp(cfg.firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const authState = {
  ready: false,
  status: "loading", // "loading" | "guest" | "unauthorized" | "teacher" | "super_admin"
  uid: "",
  email: "",
  displayName: "",
  photoURL: "",
  isAuthorizedTeacher: false,
  isSuperAdmin: false,
  authError: ""
};

let pendingTeacherAction = null;
let teachersUnsubscribe = null;
let personalDocsUnsubscribe = null;
let cachedTeachersList = [];
let cachedPersonalDocs = [];
let editingDocKey = "";
let editingAdminTeacherEmail = "";

let activeWorkspaceTab = "history"; // "history" | "create" | "admin" | "settings"
let historySearchQuery = "";
let historyStatusFilter = "all"; // "all" | "ai_generated" | "qr_shared"
let adminSearchQuery = "";

let adminFeedbackMessage = "";
let adminFeedbackIsError = false;
let historyToastMessage = "";
let historyToastIsError = false;
let isSigningIn = false;

function getLang() {
  if (window.SnowDayPortal && typeof window.SnowDayPortal.getLang === "function") {
    const l = window.SnowDayPortal.getLang();
    if (l === "en" || l === "ka") return l;
  }
  return document.documentElement.lang === "en" ? "en" : "ka";
}

function t() {
  return AUTH_I18N[getLang()] || AUTH_I18N.ka;
}

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function sanitizeHttpUrl(raw, maxLen = 1024) {
  const s = String(raw || "").trim();
  if (/^https?:\/\//i.test(s)) return s.slice(0, maxLen);
  return "";
}

function normalizeHttpsDocUrl(rawInput) {
  let normalized = "";
  if (window.SnowDayPortal && typeof window.SnowDayPortal.normalizeGoogleDocUrl === "function") {
    normalized = window.SnowDayPortal.normalizeGoogleDocUrl(rawInput);
  } else {
    normalized = String(rawInput || "").trim();
  }
  if (!normalized) return "";
  normalized = normalized.replace(/^http:\/\//i, "https://");
  if (
    !normalized.startsWith("https://docs.google.com/") &&
    !normalized.startsWith("https://drive.google.com/") &&
    !normalized.startsWith("https://") &&
    !normalized.startsWith("local:")
  ) {
    return "";
  }
  return normalized.slice(0, 1024);
}

function getSafeDocKey(normalizedDocUrl) {
  let rawKey = "";
  if (window.SnowDayPortal && typeof window.SnowDayPortal.extractDocCacheKey === "function") {
    rawKey = window.SnowDayPortal.extractDocCacheKey(normalizedDocUrl);
  }
  const clean = String(rawKey || "")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 96);
  return clean || "doc_" + Date.now();
}

function formatDateTime(ms) {
  if (!ms) return "—";
  try {
    const locale = getLang() === "ka" ? "ka-GE" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(ms));
  } catch (_e) {
    return new Date(ms).toLocaleDateString();
  }
}

// ============================================================================
// Focusgroup Progressive Enhancement Polyfill (Modern Web Guidance `tabs`)
// ============================================================================

async function ensureFocusgroupSupport() {
  if (typeof HTMLElement === "undefined") return;
  if (!Object.hasOwn(HTMLElement.prototype, "focusGroup")) {
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@microsoft/focusgroup-polyfill/+esm");
      if (mod && typeof mod.polyfill === "function") {
        mod.polyfill();
      }
    } catch (_e) {
      // Keyboard arrow handler below guarantees tab keyboard support even offline
    }
  }
}

// ============================================================================
// Firestore Real-Time Subscriptions (Personal Docs + Super Admin Roster)
// ============================================================================

function stopAllSubscriptions() {
  if (typeof teachersUnsubscribe === "function") {
    teachersUnsubscribe();
    teachersUnsubscribe = null;
  }
  if (typeof personalDocsUnsubscribe === "function") {
    personalDocsUnsubscribe();
    personalDocsUnsubscribe = null;
  }
  cachedTeachersList = [];
  cachedPersonalDocs = [];
}

/**
 * Real-time listener on `/teachers/{email}/docs` keeps the logged-in teacher's
 * saved lesson history, notes, and AI-enriched titles live across tabs/devices.
 */
function startPersonalDocsSubscription(emailLower) {
  if (!emailLower) return;
  if (typeof personalDocsUnsubscribe === "function") {
    personalDocsUnsubscribe();
    personalDocsUnsubscribe = null;
  }

  const docsCol = collection(db, "teachers", emailLower, "docs");
  personalDocsUnsubscribe = onSnapshot(
    docsCol,
    (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const createdAtMs =
          d.createdAt && typeof d.createdAt.toMillis === "function" ? d.createdAt.toMillis() : 0;
        const updatedAtMs =
          d.updatedAt && typeof d.updatedAt.toMillis === "function"
            ? d.updatedAt.toMillis()
            : createdAtMs;
        list.push({
          docKey: d.docKey || docSnap.id,
          docUrl: d.docUrl || "",
          studentQrUrl: d.studentQrUrl || "",
          title: d.title || "",
          subject: d.subject || "",
          classLabel: d.classLabel || "",
          personalNote: d.personalNote || "",
          status: d.status === "ai_generated" ? "ai_generated" : "qr_shared",
          shareCount: typeof d.shareCount === "number" ? d.shareCount : 1,
          createdAtMs,
          updatedAtMs
        });
      });

      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs || b.createdAtMs - a.createdAtMs);
      cachedPersonalDocs = list;

      renderWorkspaceBanner();
      renderPersonalDocsGrid();
      renderImportFromBrowserButton();
      renderRibbonTeacherButtons();
    },
    (_err) => {
      // Handled gracefully if rules revoke access on teacher removal
    }
  );
}

/**
 * Real-time listener on `/teachers` (strictly when Super Admin is signed in)
 * keeps the Admin Panel directory and KPI counters live.
 */
function startTeachersSubscription() {
  if (teachersUnsubscribe) return;
  const colRef = collection(db, "teachers");
  teachersUnsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() || {};
        items.push({
          id: docSnap.id,
          email: d.email || docSnap.id,
          role: d.role || (docSnap.id === superAdminEmail ? "super_admin" : "teacher"),
          note: d.note || "",
          googleName: d.googleName || "",
          photoURL: d.photoURL || "",
          addedBy: d.addedBy || "",
          addedAtMs: d.addedAt && typeof d.addedAt.toMillis === "function" ? d.addedAt.toMillis() : 0,
          lastLoginAtMs:
            d.lastLoginAt && typeof d.lastLoginAt.toMillis === "function"
              ? d.lastLoginAt.toMillis()
              : 0
        });
      });

      items.sort((a, b) => {
        if (a.email === superAdminEmail && b.email !== superAdminEmail) return -1;
        if (b.email === superAdminEmail && a.email !== superAdminEmail) return 1;
        return b.addedAtMs - a.addedAtMs || a.email.localeCompare(b.email);
      });

      cachedTeachersList = items;
      renderWorkspaceBanner();
      renderAdminPanelDirectory();
    },
    (err) => {
      adminFeedbackIsError = true;
      adminFeedbackMessage =
        t().genericSaveErrorPrefix + (err && err.message ? err.message : String(err));
      renderAdminFeedback();
    }
  );
}

async function performTeacherSelfCheckin(emailLower, user) {
  try {
    const teacherRef = doc(db, "teachers", emailLower);
    const snap = await getDoc(teacherRef);
    const payload = {
      lastLoginAt: serverTimestamp(),
      googleName: String(user.displayName || "").trim().slice(0, 120),
      photoURL: sanitizeHttpUrl(user.photoURL, 1024)
    };

    if (snap.exists()) {
      await updateDoc(teacherRef, payload);
    } else if (emailLower === superAdminEmail) {
      await setDoc(teacherRef, {
        email: superAdminEmail,
        role: "super_admin",
        addedBy: superAdminEmail,
        addedAt: serverTimestamp(),
        note: "Main Super Admin",
        ...payload
      });
    }
  } catch (_e) {
    // Non-blocking login check-in
  }
}

async function handleAuthUserChange(user) {
  authState.authError = "";

  if (!user || !user.email || !user.emailVerified) {
    stopAllSubscriptions();
    authState.ready = true;
    authState.status = "guest";
    authState.uid = "";
    authState.email = "";
    authState.displayName = "";
    authState.photoURL = "";
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    closeWorkspaceIfLoggedOut();
    renderAllAuthSurfaces();
    return;
  }

  const emailLower = normalizeEmail(user.email);
  authState.uid = user.uid || "";
  authState.email = emailLower;
  authState.displayName = String(user.displayName || "").trim();
  authState.photoURL = sanitizeHttpUrl(user.photoURL, 1024);

  if (emailLower === superAdminEmail) {
    authState.ready = true;
    authState.status = "super_admin";
    authState.isAuthorizedTeacher = true;
    authState.isSuperAdmin = true;
    startPersonalDocsSubscription(emailLower);
    startTeachersSubscription();
    performTeacherSelfCheckin(emailLower, user);
    renderAllAuthSurfaces();
    autoEnterWorkspaceIfAtLanding();
    runPendingTeacherActionIfAuthorized();
    return;
  }

  if (typeof teachersUnsubscribe === "function") {
    teachersUnsubscribe();
    teachersUnsubscribe = null;
    cachedTeachersList = [];
  }

  try {
    const teacherSnap = await getDoc(doc(db, "teachers", emailLower));
    if (teacherSnap.exists()) {
      authState.ready = true;
      authState.status = "teacher";
      authState.isAuthorizedTeacher = true;
      authState.isSuperAdmin = false;
      if (activeWorkspaceTab === "admin") activeWorkspaceTab = "history";
      startPersonalDocsSubscription(emailLower);
      performTeacherSelfCheckin(emailLower, user);
      renderAllAuthSurfaces();
      autoEnterWorkspaceIfAtLanding();
      runPendingTeacherActionIfAuthorized();
      return;
    }

    stopAllSubscriptions();
    authState.ready = true;
    authState.status = "unauthorized";
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    closeWorkspaceIfLoggedOut();
  } catch (err) {
    stopAllSubscriptions();
    authState.ready = true;
    authState.status = "unauthorized";
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    authState.authError = err && err.message ? err.message : String(err);
    closeWorkspaceIfLoggedOut();
  }

  renderAllAuthSurfaces();
}

function autoEnterWorkspaceIfAtLanding() {
  if (!authState.isAuthorizedTeacher) return;
  let hasDocParam = false;
  try {
    hasDocParam = Boolean(new URLSearchParams(window.location.search).get("doc"));
  } catch (_e) {}

  const lessonCtx =
    window.SnowDayPortal && typeof window.SnowDayPortal.getActiveLessonContext === "function"
      ? window.SnowDayPortal.getActiveLessonContext()
      : { hasLesson: false };

  if (!hasDocParam && !lessonCtx.hasLesson) {
    openWorkspaceView(activeWorkspaceTab);
  }
}

function closeWorkspaceIfLoggedOut() {
  const wsSec = document.getElementById("teacher-workspace-view");
  if (!wsSec || wsSec.hidden) return;
  wsSec.hidden = true;
  const lessonCtx =
    window.SnowDayPortal && typeof window.SnowDayPortal.getActiveLessonContext === "function"
      ? window.SnowDayPortal.getActiveLessonContext()
      : { hasLesson: false };
  if (lessonCtx.hasLesson && window.SnowDayPortal.returnToActiveLesson) {
    window.SnowDayPortal.returnToActiveLesson();
  } else if (window.SnowDayPortal && window.SnowDayPortal.showLandingHub) {
    window.SnowDayPortal.showLandingHub(false, true);
  }
}

function runPendingTeacherActionIfAuthorized() {
  if (!authState.isAuthorizedTeacher || typeof pendingTeacherAction !== "function") return;
  const fn = pendingTeacherAction;
  pendingTeacherAction = null;

  const authDlg = document.getElementById("teacher-auth-dialog");
  if (authDlg && authDlg.open) {
    authDlg.close();
  }
  fn();
}

function formatAuthError(err) {
  const strings = t();
  const code = (err && err.code) || "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return strings.popupClosedMsg;
  }
  if (code === "auth/unauthorized-domain") {
    return strings.unauthorizedDomainMsg;
  }
  return strings.genericAuthErrorPrefix + ((err && err.message) || String(err));
}

async function signInWithGoogle() {
  if (isSigningIn) return;
  isSigningIn = true;
  authState.authError = "";
  renderAllAuthSurfaces();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err && err.code) || "";
    if (code === "auth/popup-blocked") {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirErr) {
        authState.authError = formatAuthError(redirErr);
      }
    } else {
      authState.authError = formatAuthError(err);
    }
  } finally {
    isSigningIn = false;
    renderAllAuthSurfaces();
  }
}

async function signOutTeacher() {
  pendingTeacherAction = null;
  stopAllSubscriptions();
  authState.authError = "";
  try {
    await signOut(auth);
  } catch (err) {
    authState.authError = formatAuthError(err);
  }
  const studioDlg = document.getElementById("teacher-studio-dialog");
  if (studioDlg && studioDlg.open) studioDlg.close();
  const authDlg = document.getElementById("teacher-auth-dialog");
  if (authDlg && authDlg.open) authDlg.close();
  closeWorkspaceIfLoggedOut();
  renderAllAuthSurfaces();
}

function openAuthDialog() {
  renderAuthDialogContent();
  const dlg = document.getElementById("teacher-auth-dialog");
  if (dlg && typeof dlg.showModal === "function" && !dlg.open) {
    dlg.showModal();
  }
}

function openWorkspaceView(tabName, prefillDocUrl) {
  if (!authState.isAuthorizedTeacher) {
    pendingTeacherAction = () => openWorkspaceView(tabName, prefillDocUrl);
    openAuthDialog();
    return;
  }

  const landingEl = document.getElementById("landing-hub");
  const lessonEl = document.getElementById("lesson-portal-view");
  const wsEl = document.getElementById("teacher-workspace-view");
  if (!wsEl) return;

  if (landingEl) landingEl.hidden = true;
  if (lessonEl) lessonEl.hidden = true;
  wsEl.hidden = false;

  const targetTab =
    tabName && (tabName !== "admin" || authState.isSuperAdmin)
      ? tabName
      : activeWorkspaceTab || "history";

  selectWorkspaceTab(targetTab, false);

  if (typeof prefillDocUrl === "string" && prefillDocUrl.trim()) {
    const wsUrlInput = document.getElementById("ws-doc-url-input");
    if (wsUrlInput) {
      wsUrlInput.value = prefillDocUrl.trim();
      refreshWorkspaceQrPreview();
    }
  }

  syncWorkspaceSettingsInput();
  renderWorkspaceBanner();
  if (window.SnowDayPortal && typeof window.SnowDayPortal.syncHeader === "function") {
    // Also hide active doc ribbon while full-page workspace is displayed
    const ribbon = document.getElementById("active-doc-ribbon");
    const mainNav = document.getElementById("main-nav");
    if (ribbon) ribbon.hidden = true;
    if (mainNav) mainNav.hidden = true;
    window.SnowDayPortal.syncHeader();
  }
}

function requireTeacherAccess(onAuthorized) {
  if (authState.isAuthorizedTeacher) {
    if (typeof onAuthorized === "function") onAuthorized();
    return true;
  }
  pendingTeacherAction = typeof onAuthorized === "function" ? onAuthorized : null;
  openAuthDialog();
  return false;
}

// ============================================================================
// Teacher Personal Docs History CRUD (`/teachers/{email}/docs/{docKey}`)
// ============================================================================

function computeStudentUrlForWorkspace(normalizedDoc) {
  const useCurrentEl = document.getElementById("ws-target-current");
  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const useCurrent = useCurrentEl ? useCurrentEl.checked : isLocalHost;
  if (window.SnowDayPortal && typeof window.SnowDayPortal.buildStudentQrUrlForDoc === "function") {
    return window.SnowDayPortal.buildStudentQrUrlForDoc(normalizedDoc, useCurrent);
  }
  return `https://answer.ge/?doc=${encodeURIComponent(normalizedDoc)}`;
}

async function upsertPersonalDocRecord({
  rawDocUrl,
  title = "",
  subject = "",
  classLabel = "",
  personalNote = "",
  status = "qr_shared",
  incrementShare = false,
  preserveExistingNotes = true
}) {
  if (!authState.isAuthorizedTeacher || !authState.email) return null;

  const normalizedUrl = normalizeHttpsDocUrl(rawDocUrl);
  if (!normalizedUrl) return null;

  const docKey = getSafeDocKey(normalizedUrl);
  const studentQrUrl = sanitizeHttpUrl(computeStudentUrlForWorkspace(normalizedUrl), 1200);
  if (!studentQrUrl) return null;

  const docRef = doc(db, "teachers", authState.email, "docs", docKey);
  const existingSnap = await getDoc(docRef);

  const cleanTitle = String(title || "").trim().slice(0, 200);
  const cleanSubject = String(subject || "").trim().slice(0, 120);
  const cleanClass = String(classLabel || "").trim().slice(0, 80);
  const cleanNote = String(personalNote || "").trim().slice(0, 300);

  if (existingSnap.exists()) {
    const prev = existingSnap.data() || {};
    const nextTitle = cleanTitle || prev.title || t().untitledDocFmt(docKey.slice(0, 8));
    const nextSubject = cleanSubject || prev.subject || "";
    const nextClass = preserveExistingNotes ? cleanClass || prev.classLabel || "" : cleanClass;
    const nextNote = preserveExistingNotes ? cleanNote || prev.personalNote || "" : cleanNote;
    const nextStatus =
      status === "ai_generated" || prev.status === "ai_generated" ? "ai_generated" : "qr_shared";
    const prevShares = typeof prev.shareCount === "number" ? prev.shareCount : 1;
    const nextShares = incrementShare ? Math.min(100000, prevShares + 1) : prevShares;

    await updateDoc(docRef, {
      studentQrUrl,
      title: nextTitle.slice(0, 200),
      subject: nextSubject.slice(0, 120),
      classLabel: nextClass.slice(0, 80),
      personalNote: nextNote.slice(0, 300),
      status: nextStatus,
      shareCount: nextShares,
      updatedAt: serverTimestamp()
    });
  } else {
    const initialTitle = cleanTitle || t().untitledDocFmt(docKey.slice(0, 8));
    await setDoc(docRef, {
      docKey,
      docUrl: normalizedUrl,
      studentQrUrl,
      title: initialTitle.slice(0, 200),
      subject: cleanSubject.slice(0, 120),
      classLabel: cleanClass.slice(0, 80),
      personalNote: cleanNote.slice(0, 300),
      status: status === "ai_generated" ? "ai_generated" : "qr_shared",
      shareCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return { docKey, docUrl: normalizedUrl, studentQrUrl };
}

function showHistoryToast(msg, isError = false) {
  historyToastMessage = msg;
  historyToastIsError = isError;
  const el = document.getElementById("ws-history-feedback");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.className = "api-ping-status ws-toast" + (isError ? " is-error" : "");
  el.textContent = msg;
  setTimeout(() => {
    if (historyToastMessage === msg) {
      el.hidden = true;
      historyToastMessage = "";
    }
  }, 3800);
}

async function importRecentBrowserLessonsToSpace() {
  if (
    !authState.isAuthorizedTeacher ||
    !window.SnowDayPortal ||
    typeof window.SnowDayPortal.listRecentCachedLessons !== "function"
  ) {
    return;
  }
  const recents = window.SnowDayPortal.listRecentCachedLessons() || [];
  const existingKeys = new Set(cachedPersonalDocs.map((d) => d.docKey));
  const lang = getLang();
  let importedCount = 0;

  for (const item of recents) {
    if (!item || !item.sampleDocUrl) continue;
    const normalized = normalizeHttpsDocUrl(item.sampleDocUrl);
    if (!normalized) continue;
    const key = getSafeDocKey(normalized);
    if (existingKeys.has(key)) continue;

    const lessonTitle =
      (item.meta && item.meta.lessonTitle && (item.meta.lessonTitle[lang] || item.meta.lessonTitle.ka)) ||
      "";
    const subject =
      (item.meta && item.meta.subject && (item.meta.subject[lang] || item.meta.subject.ka)) || "";

    try {
      await upsertPersonalDocRecord({
        rawDocUrl: normalized,
        title: lessonTitle,
        subject,
        status: "ai_generated",
        preserveExistingNotes: true
      });
      importedCount++;
    } catch (_e) {}
  }

  if (importedCount > 0) {
    showHistoryToast(t().importedDocsToastFmt(importedCount), false);
  }
  renderImportFromBrowserButton();
}

// ============================================================================
// Super Admin CRUD Operations (`/teachers/{email}`)
// ============================================================================

async function handleAddTeacherSubmit(event) {
  event.preventDefault();
  if (!authState.isSuperAdmin) return;

  const strings = t();
  const emailInput = document.getElementById("admin-teacher-email-input");
  const noteInput = document.getElementById("admin-teacher-note-input");
  const submitBtn = document.getElementById("admin-add-teacher-btn");
  if (!emailInput || !submitBtn) return;

  const emailLower = normalizeEmail(emailInput.value);
  const noteClean = String((noteInput && noteInput.value) || "").trim().slice(0, 160);

  if (!emailLower || emailLower.length < 5 || emailLower.length > 254 || !EMAIL_REGEX.test(emailLower)) {
    emailInput.classList.add("user-invalid-fallback");
    emailInput.setAttribute("aria-invalid", "true");
    syncFieldErrorDescribe(emailInput, true);
    emailInput.focus();
    return;
  }

  emailInput.classList.remove("user-invalid-fallback");
  emailInput.setAttribute("aria-invalid", "false");
  syncFieldErrorDescribe(emailInput, false);

  submitBtn.disabled = true;
  submitBtn.textContent = strings.addingTeacherBtn;
  adminFeedbackMessage = "";
  adminFeedbackIsError = false;
  renderAdminFeedback();

  try {
    const targetRef = doc(db, "teachers", emailLower);
    const existing = await getDoc(targetRef);

    if (existing.exists()) {
      await updateDoc(targetRef, {
        note: noteClean
      });
      adminFeedbackIsError = false;
      adminFeedbackMessage = strings.alreadyExistsFmt(emailLower);
    } else {
      await setDoc(targetRef, {
        email: emailLower,
        role: emailLower === superAdminEmail ? "super_admin" : "teacher",
        addedBy: authState.email,
        addedAt: serverTimestamp(),
        note: noteClean
      });
      adminFeedbackIsError = false;
      adminFeedbackMessage = strings.addedSuccessFmt(emailLower);
    }

    emailInput.value = "";
    emailInput.dataset.touched = "false";
    if (noteInput) noteInput.value = "";
  } catch (err) {
    adminFeedbackIsError = true;
    adminFeedbackMessage = strings.genericSaveErrorPrefix + ((err && err.message) || String(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t().addTeacherSubmitBtn;
    renderAdminFeedback();
  }
}

async function saveAdminTeacherNote(targetEmail, nextNote) {
  if (!authState.isSuperAdmin || !targetEmail) return;
  try {
    await updateDoc(doc(db, "teachers", targetEmail), {
      note: String(nextNote || "").trim().slice(0, 160)
    });
    editingAdminTeacherEmail = "";
    adminFeedbackIsError = false;
    adminFeedbackMessage = t().alreadyExistsFmt(targetEmail);
    renderAdminFeedback();
    renderAdminPanelDirectory();
  } catch (err) {
    adminFeedbackIsError = true;
    adminFeedbackMessage = t().genericSaveErrorPrefix + ((err && err.message) || String(err));
    renderAdminFeedback();
  }
}

async function removeTeacherByEmail(targetEmail, btnEl) {
  if (!authState.isSuperAdmin || !targetEmail || targetEmail === superAdminEmail) return;
  const strings = t();
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = strings.removingBtn;
  }
  try {
    await deleteDoc(doc(db, "teachers", targetEmail));
    adminFeedbackIsError = false;
    adminFeedbackMessage = strings.removedSuccessFmt(targetEmail);
    renderAdminFeedback();
  } catch (err) {
    adminFeedbackIsError = true;
    adminFeedbackMessage = strings.genericSaveErrorPrefix + ((err && err.message) || String(err));
    renderAdminFeedback();
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = strings.removeTeacherBtn;
    }
  }
}

// ============================================================================
// Accessible Tabs Controller (Modern Web Guidance `tabs`)
// ============================================================================

function selectWorkspaceTab(tabId, moveFocus = false) {
  if (tabId === "admin" && !authState.isSuperAdmin) {
    tabId = "history";
  }
  activeWorkspaceTab = tabId;

  const tabs = document.querySelectorAll("#ws-tablist [data-ws-tab]");
  const panels = document.querySelectorAll("[data-ws-panel]");

  tabs.forEach((tab) => {
    const id = tab.getAttribute("data-ws-tab");
    if (id === "admin") {
      tab.hidden = !authState.isSuperAdmin;
      if (!authState.isSuperAdmin) {
        tab.setAttribute("focusgroup", "none");
      } else {
        tab.removeAttribute("focusgroup");
      }
    }

    const isSelected = id === activeWorkspaceTab && !tab.hidden;
    tab.setAttribute("aria-selected", isSelected ? "true" : "false");
    tab.toggleAttribute("focusgroupstart", isSelected);

    if (isSelected) {
      try {
        tab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
      } catch (_e) {
        tab.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      if (moveFocus) tab.focus();
    }
  });

  panels.forEach((panel) => {
    const id = panel.getAttribute("data-ws-panel");
    if (id === "admin" && !authState.isSuperAdmin) {
      panel.hidden = true;
      panel.setAttribute("hidden", "");
      return;
    }
    const isSelected = id === activeWorkspaceTab;
    panel.hidden = !isSelected;
    if (isSelected) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });

  if (activeWorkspaceTab === "create") {
    refreshWorkspaceQrPreview();
  } else if (activeWorkspaceTab === "settings") {
    syncWorkspaceSettingsInput();
  }
}

function setupWorkspaceTabsEvents() {
  const tablist = document.getElementById("ws-tablist");
  if (!tablist) return;

  const getVisibleTabs = () =>
    Array.from(tablist.querySelectorAll("[data-ws-tab]")).filter((el) => !el.hidden);

  tablist.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ws-tab]");
    if (!btn || btn.hidden) return;
    selectWorkspaceTab(btn.getAttribute("data-ws-tab"), false);
  });

  // Selection follows focus when moving between tabs via keyboard
  tablist.addEventListener("focusin", (e) => {
    const btn = e.target.closest("[data-ws-tab]");
    if (!btn || btn.hidden) return;
    const nextId = btn.getAttribute("data-ws-tab");
    if (nextId && nextId !== activeWorkspaceTab) {
      selectWorkspaceTab(nextId, false);
    }
  });

  // Fallback arrow-key handler if focusgroup is neither native nor polyfilled yet
  tablist.addEventListener("keydown", (e) => {
    if (Object.hasOwn(HTMLElement.prototype, "focusGroup")) return;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const tabs = getVisibleTabs();
    if (!tabs.length) return;
    const idx = tabs.indexOf(document.activeElement);
    if (idx === -1) return;

    e.preventDefault();
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    selectWorkspaceTab(tabs[nextIdx].getAttribute("data-ws-tab"), true);
  });

  // Sync tab selection if browser Find-in-Page reveals a panel
  document.querySelectorAll("[data-ws-panel]").forEach((panel) => {
    panel.addEventListener("beforematch", () => {
      const id = panel.getAttribute("data-ws-panel");
      if (id && (id !== "admin" || authState.isSuperAdmin)) {
        selectWorkspaceTab(id, false);
      }
    });
  });
}

// ============================================================================
// Workspace QR Creator & Settings Tab Helpers
// ============================================================================

function refreshWorkspaceQrPreview(customTitle) {
  const urlInput = document.getElementById("ws-doc-url-input");
  const titleInput = document.getElementById("ws-doc-title-input");
  const cardTitleEl = document.getElementById("ws-qr-card-title");
  const svgBox = document.getElementById("ws-qr-svg-box");
  const encodedEl = document.getElementById("ws-qr-encoded-url");
  const actionsEl = document.getElementById("ws-qr-actions");
  const originEl = document.getElementById("ws-current-origin-text");

  if (originEl && window.location.protocol.startsWith("http")) {
    originEl.textContent = window.location.origin;
  }

  if (!svgBox || !window.SnowDayQR) return;

  const normalized = normalizeHttpsDocUrl(urlInput ? urlInput.value : "");
  if (!normalized) {
    svgBox.innerHTML = `<div class="qr-empty-placeholder">${escapeText(t().qrEmptyPrompt)}</div>`;
    if (encodedEl) encodedEl.textContent = "";
    if (actionsEl) actionsEl.hidden = true;
    if (cardTitleEl) cardTitleEl.hidden = true;
    return;
  }

  const studentUrl = computeStudentUrlForWorkspace(normalized);
  const labelTitle = String(customTitle || (titleInput && titleInput.value) || "").trim();
  if (cardTitleEl) {
    if (labelTitle) {
      cardTitleEl.textContent = labelTitle;
      cardTitleEl.hidden = false;
    } else {
      cardTitleEl.hidden = true;
    }
  }

  if (encodedEl) encodedEl.textContent = studentUrl;
  if (actionsEl) actionsEl.hidden = false;
  try {
    svgBox.innerHTML = window.SnowDayQR.toSvgString(studentUrl, {
      pixelSize: 236,
      eccLevel: "M"
    });
  } catch (err) {
    svgBox.textContent = err && err.message ? err.message : String(err);
  }
}

function escapeText(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function syncWorkspaceSettingsInput() {
  const input = document.getElementById("ws-agent-url-input");
  if (
    input &&
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.getEffectiveAgentBaseUrl === "function"
  ) {
    input.value = window.SnowDayPortal.getEffectiveAgentBaseUrl();
  }
}

// ============================================================================
// Accessible Form Validation Helper (`:user-invalid` + ARIA)
// ============================================================================

function syncFieldErrorDescribe(input, shown) {
  const errorId = input && input.dataset ? input.dataset.error : "";
  if (!errorId) return;
  const ids = (input.getAttribute("aria-describedby") || "")
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) input.setAttribute("aria-describedby", ids.join(" "));
  else input.removeAttribute("aria-describedby");
}

function setupAdminEmailValidation() {
  const emailInput = document.getElementById("admin-teacher-email-input");
  const form = document.getElementById("admin-add-teacher-form");
  if (!emailInput || !form) return;

  emailInput.setAttribute("aria-invalid", "false");

  const updateValidity = () => {
    const val = normalizeEmail(emailInput.value);
    const valid = emailInput.validity.valid && EMAIL_REGEX.test(val);
    const matchesNativeInvalid =
      typeof CSS !== "undefined" &&
      CSS.supports("selector(:user-invalid)") &&
      emailInput.matches(":user-invalid");

    if (matchesNativeInvalid || (!valid && emailInput.dataset.touched === "true")) {
      emailInput.classList.add("user-invalid-fallback");
      emailInput.setAttribute("aria-invalid", "true");
      syncFieldErrorDescribe(emailInput, true);
    } else {
      emailInput.classList.remove("user-invalid-fallback");
      emailInput.setAttribute("aria-invalid", "false");
      syncFieldErrorDescribe(emailInput, false);
    }
  };

  emailInput.addEventListener("blur", () => {
    if (emailInput.value.trim()) {
      emailInput.dataset.touched = "true";
      updateValidity();
    }
  });

  emailInput.addEventListener("input", () => {
    if (emailInput.getAttribute("aria-invalid") === "true") {
      updateValidity();
    }
  });

  emailInput.addEventListener("invalid", () => {
    emailInput.dataset.touched = "true";
    updateValidity();
  });

  form.addEventListener("submit", handleAddTeacherSubmit);
}

// ============================================================================
// UI Rendering: Header, Workspace Banner, History Cards, Admin Table, Modals
// ============================================================================

function createGoogleLogoSvg() {
  const span = document.createElement("span");
  span.className = "google-g-icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.23 0 10.06 0 12s.47 3.77 1.29 5.4l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.98 3.09c.95-2.85 3.6-4.94 6.73-4.94z"/></svg>';
  return span;
}

function renderHeaderAuthButton() {
  const btn = document.getElementById("header-teacher-auth-btn");
  const fullLabel = document.getElementById("header-auth-label-full");
  const shortLabel = document.getElementById("header-auth-label-short");
  const dot = document.getElementById("header-auth-dot");
  if (!btn || !fullLabel || !shortLabel) return;

  const strings = t();
  btn.classList.remove("is-authed", "is-super-admin", "is-unauth");

  if (authState.status === "super_admin") {
    btn.classList.add("is-authed", "is-super-admin");
    fullLabel.textContent = strings.headerSuperAdminFull;
    shortLabel.textContent = strings.headerSuperAdminShort;
    btn.title = `${authState.email} (${strings.roleSuperAdminTag})`;
    if (dot) dot.hidden = false;
  } else if (authState.status === "teacher") {
    btn.classList.add("is-authed");
    fullLabel.textContent = strings.headerTeacherFull;
    shortLabel.textContent = strings.headerTeacherShort;
    btn.title = authState.email;
    if (dot) dot.hidden = false;
  } else if (authState.status === "unauthorized") {
    btn.classList.add("is-unauth");
    fullLabel.textContent = strings.headerUnauthorizedFull;
    shortLabel.textContent = strings.headerUnauthorizedShort;
    btn.title = authState.email;
    if (dot) dot.hidden = false;
  } else {
    fullLabel.textContent = strings.headerSignInFull;
    shortLabel.textContent = strings.headerSignInShort;
    btn.title = strings.headerSignInFull;
    if (dot) dot.hidden = true;
  }

  if (window.SnowDayPortal && typeof window.SnowDayPortal.syncHeader === "function") {
    window.SnowDayPortal.syncHeader();
  }
}

function renderWorkspaceBanner() {
  if (!authState.isAuthorizedTeacher) return;
  const strings = t();

  const avatarEl = document.getElementById("ws-user-avatar");
  if (avatarEl) {
    avatarEl.innerHTML = "";
    if (authState.photoURL) {
      const img = document.createElement("img");
      img.src = authState.photoURL;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      avatarEl.appendChild(img);
    } else {
      const initial = (authState.displayName || authState.email || "T").charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }
  }

  const rolePill = document.getElementById("ws-role-pill");
  if (rolePill) {
    rolePill.className = "teacher-verified-pill" + (authState.isSuperAdmin ? " is-admin" : "");
    rolePill.textContent = authState.isSuperAdmin
      ? strings.verifiedAdminBadge
      : strings.verifiedTeacherBadge;
  }

  const emailChip = document.getElementById("ws-user-email");
  if (emailChip) emailChip.textContent = authState.email;

  const headingEl = document.getElementById("ws-welcome-heading");
  if (headingEl) {
    headingEl.textContent = authState.displayName
      ? strings.wsWelcomeNamedFmt(authState.displayName)
      : strings.wsWelcomeDefault;
  }

  const subEl = document.getElementById("ws-welcome-sub");
  if (subEl) {
    subEl.textContent = authState.isSuperAdmin
      ? strings.wsWelcomeSubAdmin
      : strings.wsWelcomeSubTeacher;
  }

  const docsCountEl = document.getElementById("ws-stat-docs-count");
  const aiCountEl = document.getElementById("ws-stat-ai-count");
  const teachersWrap = document.getElementById("ws-stat-teachers-wrap");
  const teachersCountEl = document.getElementById("ws-stat-teachers-count");

  if (docsCountEl) docsCountEl.textContent = String(cachedPersonalDocs.length);
  if (aiCountEl) {
    const aiTotal = cachedPersonalDocs.filter((d) => d.status === "ai_generated").length;
    aiCountEl.textContent = String(aiTotal);
  }
  if (teachersWrap) {
    teachersWrap.hidden = !authState.isSuperAdmin;
    if (teachersCountEl) teachersCountEl.textContent = String(cachedTeachersList.length);
  }

  const returnLessonBtn = document.getElementById("ws-return-lesson-btn");
  if (returnLessonBtn) {
    const ctx =
      window.SnowDayPortal && typeof window.SnowDayPortal.getActiveLessonContext === "function"
        ? window.SnowDayPortal.getActiveLessonContext()
        : { hasLesson: false };
    returnLessonBtn.hidden = !ctx.hasLesson;
    returnLessonBtn.textContent = strings.wsReturnLessonBtn;
  }

  // Ensure Admin tab visibility stays synced
  const adminTab = document.getElementById("ws-tab-admin");
  if (adminTab) {
    adminTab.hidden = !authState.isSuperAdmin;
    if (!authState.isSuperAdmin) adminTab.setAttribute("focusgroup", "none");
    else adminTab.removeAttribute("focusgroup");
  }
}

function renderWorkspaceStaticLabels() {
  const strings = t();
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  const setPh = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.placeholder = val;
  };

  setTxt("ws-stat-docs-label", strings.wsStatDocsLabel);
  setTxt("ws-stat-ai-label", strings.wsStatAiLabel);
  setTxt("ws-stat-teachers-label", strings.wsStatTeachersLabel);
  setTxt("ws-student-hub-btn", strings.wsStudentHubBtn);
  setTxt("ws-signout-btn", strings.signOutBtn);

  setTxt("ws-tab-history-label", strings.tabHistoryLabel);
  setTxt("ws-tab-create-label", strings.tabCreateLabel);
  setTxt("ws-tab-admin-label", strings.tabAdminLabel);
  setTxt("ws-tab-settings-label", strings.tabSettingsLabel);

  // History panel
  setTxt("ws-history-heading", strings.historyHeading);
  setTxt("ws-history-desc", strings.historyDesc);
  setTxt("ws-jump-create-btn", strings.jumpCreateBtn);
  setPh("ws-history-search", strings.historySearchPlaceholder);
  setTxt("ws-filter-all", strings.filterAll);
  setTxt("ws-filter-ai", strings.filterAi);
  setTxt("ws-filter-qr", strings.filterQr);

  // Create panel
  setTxt("ws-create-heading", strings.createHeading);
  setTxt("ws-create-desc", strings.createDesc);
  setTxt("ws-doc-url-label", strings.docUrlLabel);
  setTxt("ws-doc-url-hint", strings.docUrlHint);
  setTxt("ws-doc-title-label", strings.docTitleLabel);
  setPh("ws-doc-title-input", strings.docTitlePlaceholder);
  setTxt("ws-doc-class-label", strings.docClassLabel);
  setPh("ws-doc-class-input", strings.docClassPlaceholder);
  setTxt("ws-doc-note-label", strings.docNoteLabel);
  setPh("ws-doc-note-input", strings.docNotePlaceholder);
  setTxt("ws-qr-target-legend", strings.qrTargetLegend);
  setTxt("ws-save-qr-btn", strings.saveQrBtn);
  setTxt("ws-generate-open-btn", strings.generateOpenBtn);

  // Admin panel
  setTxt("admin-panel-title", strings.adminPanelTitle);
  setTxt("admin-panel-lead", strings.adminPanelLead);
  setTxt("admin-kpi-total-label", strings.kpiTotalLabel);
  setTxt("admin-kpi-active-label", strings.kpiActiveLabel);
  setTxt("admin-kpi-pending-label", strings.kpiPendingLabel);
  setTxt("admin-invite-heading", strings.inviteHeading);
  setTxt("admin-email-label-text", strings.addEmailLabel);
  setTxt("admin-teacher-email-hint", strings.addEmailHint);
  setPh("admin-teacher-email-input", strings.addEmailPlaceholder);
  setTxt("admin-email-error-text", strings.addEmailError);
  setTxt("admin-note-label-text", strings.addNoteLabel);
  setTxt("admin-teacher-note-hint", strings.addNoteHint);
  setPh("admin-teacher-note-input", strings.addNotePlaceholder);
  setTxt("admin-add-teacher-btn", strings.addTeacherSubmitBtn);
  setTxt("admin-list-heading", strings.teachersListHeading);
  setTxt("admin-table-caption", strings.teachersListHeading);
  setPh("admin-teacher-search", strings.adminSearchPlaceholder);
  setTxt("admin-col-teacher", strings.colTeacher);
  setTxt("admin-col-note", strings.colNote);
  setTxt("admin-col-role", strings.colRole);
  setTxt("admin-col-status", strings.colStatus);
  setTxt("admin-col-actions", strings.colActions);

  // Responsive table stacked labels via CSS custom properties (Modern Web Guidance `responsive-table`)
  const tableEl = document.getElementById("ws-admin-table");
  if (tableEl) {
    tableEl.style.setProperty("--label-2", JSON.stringify(strings.colNote));
    tableEl.style.setProperty("--label-3", JSON.stringify(strings.colRole));
    tableEl.style.setProperty("--label-4", JSON.stringify(strings.colStatus));
    tableEl.style.setProperty("--label-5", JSON.stringify(strings.colActions));
  }

  // Settings panel
  setTxt("ws-settings-heading", strings.settingsHeading);
  setTxt("ws-settings-desc", strings.settingsDesc);
}

function renderImportFromBrowserButton() {
  const btn = document.getElementById("ws-import-local-btn");
  if (!btn || !authState.isAuthorizedTeacher) return;

  const recents =
    window.SnowDayPortal && typeof window.SnowDayPortal.listRecentCachedLessons === "function"
      ? window.SnowDayPortal.listRecentCachedLessons() || []
      : [];
  const existingKeys = new Set(cachedPersonalDocs.map((d) => d.docKey));
  const unsavedCount = recents.filter((r) => {
    const norm = r && r.sampleDocUrl ? normalizeHttpsDocUrl(r.sampleDocUrl) : "";
    return norm && !existingKeys.has(getSafeDocKey(norm));
  }).length;

  if (unsavedCount > 0) {
    btn.hidden = false;
    btn.textContent = t().importLocalBtnFmt(unsavedCount);
  } else {
    btn.hidden = true;
  }
}

function renderPersonalDocsGrid() {
  const grid = document.getElementById("ws-docs-grid");
  if (!grid) return;

  const strings = t();
  grid.innerHTML = "";

  if (cachedPersonalDocs.length === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "ws-empty-state";

    const h3 = document.createElement("h3");
    h3.textContent = strings.emptyHistoryTitle;
    const p = document.createElement("p");
    p.textContent = strings.emptyHistoryBody;
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-primary";
    addBtn.textContent = strings.jumpCreateBtn;
    addBtn.addEventListener("click", () => selectWorkspaceTab("create", true));

    emptyCard.appendChild(h3);
    emptyCard.appendChild(p);
    emptyCard.appendChild(addBtn);
    grid.appendChild(emptyCard);
    return;
  }

  const q = historySearchQuery.trim().toLowerCase();
  const filtered = cachedPersonalDocs.filter((item) => {
    if (historyStatusFilter !== "all" && item.status !== historyStatusFilter) {
      return false;
    }
    if (!q) return true;
    const hay = [item.title, item.subject, item.classLabel, item.personalNote, item.docUrl]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0) {
    const emptyFilter = document.createElement("p");
    emptyFilter.className = "ws-empty-filter";
    emptyFilter.textContent = strings.noFilteredDocs;
    grid.appendChild(emptyFilter);
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "ws-doc-card";

    // Card Top Meta Pills
    const metaTop = document.createElement("div");
    metaTop.className = "ws-doc-meta-top";

    const statusBadge = document.createElement("span");
    statusBadge.className =
      "ws-doc-status-pill" + (item.status === "ai_generated" ? " is-ai" : " is-qr");
    statusBadge.textContent =
      item.status === "ai_generated" ? strings.statusAiBadge : strings.statusQrBadge;
    metaTop.appendChild(statusBadge);

    if (item.subject) {
      const subjPill = document.createElement("span");
      subjPill.className = "ws-doc-tag";
      subjPill.textContent = item.subject;
      metaTop.appendChild(subjPill);
    }

    if (item.classLabel) {
      const clsPill = document.createElement("span");
      clsPill.className = "ws-doc-tag is-class";
      clsPill.textContent = "🏫 " + item.classLabel;
      metaTop.appendChild(clsPill);
    }

    card.appendChild(metaTop);

    // Title + Timestamp
    const titleEl = document.createElement("h3");
    titleEl.className = "ws-doc-title";
    titleEl.textContent = item.title || strings.untitledDocFmt(item.docKey.slice(0, 8));
    card.appendChild(titleEl);

    const timeLine = document.createElement("p");
    timeLine.className = "ws-doc-timeline";
    timeLine.textContent = `${strings.updatedLabelPrefix}${formatDateTime(item.updatedAtMs)} · ${strings.sharedCountFmt(item.shareCount)}`;
    card.appendChild(timeLine);

    // Personal Note Callout
    const noteBox = document.createElement("div");
    noteBox.className = "ws-doc-note" + (item.personalNote ? "" : " is-muted");
    if (item.personalNote) {
      const strong = document.createElement("strong");
      strong.textContent = strings.personalNotePrefix;
      noteBox.appendChild(strong);
      noteBox.appendChild(document.createTextNode(item.personalNote));
    } else {
      noteBox.textContent = strings.noPersonalNote;
    }
    card.appendChild(noteBox);

    // Inline Edit Form (when teacher clicks "Edit Note")
    if (editingDocKey === item.docKey) {
      const editForm = document.createElement("form");
      editForm.className = "ws-doc-edit-form";

      const row1 = document.createElement("div");
      row1.className = "ws-meta-two-col";

      const makeField = (labelTxt, val, maxLen) => {
        const wrap = document.createElement("div");
        wrap.className = "field-group";
        const lbl = document.createElement("label");
        lbl.textContent = labelTxt;
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = val;
        inp.maxLength = maxLen;
        wrap.appendChild(lbl);
        wrap.appendChild(inp);
        return { wrap, inp };
      };

      const titleField = makeField(strings.editTitleLabel, item.title, 200);
      const subjField = makeField(strings.editSubjectLabel, item.subject, 120);
      const classField = makeField(strings.editClassLabel, item.classLabel, 80);

      row1.appendChild(titleField.wrap);
      row1.appendChild(classField.wrap);

      const noteWrap = document.createElement("div");
      noteWrap.className = "field-group";
      const noteLbl = document.createElement("label");
      noteLbl.textContent = strings.editNoteLabel;
      const noteArea = document.createElement("textarea");
      noteArea.rows = 2;
      noteArea.maxLength = 300;
      noteArea.value = item.personalNote;
      noteWrap.appendChild(noteLbl);
      noteWrap.appendChild(noteArea);

      const editActions = document.createElement("div");
      editActions.className = "ws-doc-actions";

      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "btn btn-small btn-primary";
      saveBtn.textContent = strings.saveChangesBtn;

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-small btn-ghost";
      cancelBtn.textContent = strings.cancelEditBtn;
      cancelBtn.addEventListener("click", () => {
        editingDocKey = "";
        renderPersonalDocsGrid();
      });

      editActions.appendChild(saveBtn);
      editActions.appendChild(cancelBtn);

      editForm.appendChild(row1);
      editForm.appendChild(subjField.wrap);
      editForm.appendChild(noteWrap);
      editForm.appendChild(editActions);

      editForm.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        saveBtn.disabled = true;
        try {
          await upsertPersonalDocRecord({
            rawDocUrl: item.docUrl,
            title: titleField.inp.value,
            subject: subjField.inp.value,
            classLabel: classField.inp.value,
            personalNote: noteArea.value,
            status: item.status,
            preserveExistingNotes: false
          });
          editingDocKey = "";
          showHistoryToast(strings.updatedDocToast, false);
        } catch (err) {
          showHistoryToast(
            strings.genericSaveErrorPrefix + ((err && err.message) || String(err)),
            true
          );
          saveBtn.disabled = false;
        }
      });

      card.appendChild(editForm);
    }

    // Action Footer
    const actionsRow = document.createElement("footer");
    actionsRow.className = "ws-doc-actions";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn btn-small btn-primary";
    openBtn.textContent = strings.docOpenLessonBtn;
    openBtn.addEventListener("click", () => {
      if (window.SnowDayPortal && typeof window.SnowDayPortal.openDocUrlWithHistory === "function") {
        window.SnowDayPortal.openDocUrlWithHistory(item.docUrl, false);
      }
    });

    const qrBtn = document.createElement("button");
    qrBtn.type = "button";
    qrBtn.className = "btn btn-small btn-secondary";
    qrBtn.textContent = strings.docShowQrBtn;
    qrBtn.addEventListener("click", () => {
      const wsUrlInput = document.getElementById("ws-doc-url-input");
      const wsTitleInput = document.getElementById("ws-doc-title-input");
      const wsClassInput = document.getElementById("ws-doc-class-input");
      const wsNoteInput = document.getElementById("ws-doc-note-input");
      if (wsUrlInput) wsUrlInput.value = item.docUrl;
      if (wsTitleInput) wsTitleInput.value = item.title || "";
      if (wsClassInput) wsClassInput.value = item.classLabel || "";
      if (wsNoteInput) wsNoteInput.value = item.personalNote || "";
      selectWorkspaceTab("create", false);
      refreshWorkspaceQrPreview(item.title);
      upsertPersonalDocRecord({
        rawDocUrl: item.docUrl,
        status: item.status,
        incrementShare: true,
        preserveExistingNotes: true
      }).catch(() => {});
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-small btn-ghost";
    copyBtn.textContent = strings.docCopyStudentLinkBtn;
    copyBtn.addEventListener("click", async () => {
      const link = item.studentQrUrl || computeStudentUrlForWorkspace(item.docUrl);
      try {
        await navigator.clipboard.writeText(link);
        showHistoryToast(strings.copiedLinkToast, false);
      } catch (_e) {
        showHistoryToast(link, false);
      }
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-small btn-ghost";
    editBtn.textContent = strings.docEditDetailsBtn;
    editBtn.addEventListener("click", () => {
      editingDocKey = editingDocKey === item.docKey ? "" : item.docKey;
      renderPersonalDocsGrid();
    });

    const gdocLink = document.createElement("a");
    gdocLink.className = "btn btn-small btn-ghost";
    gdocLink.href = item.docUrl;
    gdocLink.target = "_blank";
    gdocLink.rel = "noopener noreferrer";
    gdocLink.textContent = strings.docOpenGoogleBtn;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-small btn-danger-ghost";
    delBtn.textContent = strings.docDeleteBtn;
    delBtn.addEventListener("click", async () => {
      delBtn.disabled = true;
      try {
        await deleteDoc(doc(db, "teachers", authState.email, "docs", item.docKey));
        showHistoryToast(strings.deletedDocToast, false);
      } catch (err) {
        delBtn.disabled = false;
        showHistoryToast(
          strings.genericSaveErrorPrefix + ((err && err.message) || String(err)),
          true
        );
      }
    });

    actionsRow.appendChild(openBtn);
    actionsRow.appendChild(qrBtn);
    actionsRow.appendChild(copyBtn);
    actionsRow.appendChild(editBtn);
    actionsRow.appendChild(gdocLink);
    actionsRow.appendChild(delBtn);

    card.appendChild(actionsRow);
    grid.appendChild(card);
  });
}

function renderAdminFeedback() {
  const feedbackEl = document.getElementById("admin-action-feedback");
  if (!feedbackEl) return;
  if (!adminFeedbackMessage) {
    feedbackEl.hidden = true;
    feedbackEl.textContent = "";
    return;
  }
  feedbackEl.hidden = false;
  feedbackEl.className =
    "api-ping-status admin-feedback" + (adminFeedbackIsError ? " is-error" : "");
  feedbackEl.textContent = adminFeedbackMessage;
}

function renderAdminPanelDirectory() {
  if (!authState.isSuperAdmin) return;
  const strings = t();

  // KPIs
  const totalCount = cachedTeachersList.length;
  const activeCount = cachedTeachersList.filter((m) => m.lastLoginAtMs > 0).length;
  const pendingCount = Math.max(0, totalCount - activeCount);

  const totalVal = document.getElementById("admin-kpi-total-val");
  const activeVal = document.getElementById("admin-kpi-active-val");
  const pendingVal = document.getElementById("admin-kpi-pending-val");
  if (totalVal) totalVal.textContent = String(totalCount);
  if (activeVal) activeVal.textContent = String(activeCount);
  if (pendingVal) pendingVal.textContent = String(pendingCount);

  const tbody = document.getElementById("admin-teachers-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const q = adminSearchQuery.trim().toLowerCase();
  const filtered = cachedTeachersList.filter((item) => {
    if (!q) return true;
    return [item.email, item.note, item.googleName].join(" ").toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "teacher-roster-empty";
    td.textContent = strings.emptyTeachersList;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach((item) => {
    const tr = document.createElement("tr");
    const isAdminItem = item.email === superAdminEmail || item.role === "super_admin";

    // Column 1: Sticky Row Header (<th>) — Teacher Email + Google Name
    const th = document.createElement("th");
    th.scope = "row";

    const identityCell = document.createElement("div");
    identityCell.className = "admin-table-identity";

    const emailStrong = document.createElement("strong");
    emailStrong.textContent = item.email;
    identityCell.appendChild(emailStrong);

    if (item.googleName) {
      const subName = document.createElement("span");
      subName.className = "admin-table-gname";
      subName.textContent = item.googleName;
      identityCell.appendChild(subName);
    }

    th.appendChild(identityCell);
    tr.appendChild(th);

    // Column 2: Note / Subject (with inline edit support)
    const tdNote = document.createElement("td");
    if (editingAdminTeacherEmail === item.email) {
      const inlineForm = document.createElement("form");
      inlineForm.className = "admin-inline-note-form";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = item.note || "";
      inp.maxLength = 160;
      inp.placeholder = strings.addNotePlaceholder;

      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "btn btn-small btn-primary";
      saveBtn.textContent = strings.saveChangesBtn;

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-small btn-ghost";
      cancelBtn.textContent = strings.cancelEditBtn;
      cancelBtn.addEventListener("click", () => {
        editingAdminTeacherEmail = "";
        renderAdminPanelDirectory();
      });

      inlineForm.appendChild(inp);
      inlineForm.appendChild(saveBtn);
      inlineForm.appendChild(cancelBtn);
      inlineForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        saveAdminTeacherNote(item.email, inp.value);
      });
      tdNote.appendChild(inlineForm);
    } else {
      tdNote.textContent = item.note || "—";
    }
    tr.appendChild(tdNote);

    // Column 3: Role
    const tdRole = document.createElement("td");
    const roleTag = document.createElement("span");
    roleTag.className = "teacher-role-tag" + (isAdminItem ? " is-admin" : "");
    roleTag.textContent = isAdminItem ? strings.roleSuperAdminTag : strings.roleTeacherTag;
    tdRole.appendChild(roleTag);
    tr.appendChild(tdRole);

    // Column 4: Status & Last Login
    const tdStatus = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className =
      "admin-status-pill" + (item.lastLoginAtMs > 0 ? " is-active" : " is-pending");
    statusPill.textContent =
      item.lastLoginAtMs > 0
        ? `${strings.statusLoggedBefore} · ${formatDateTime(item.lastLoginAtMs)}`
        : strings.statusInvitedPending;
    tdStatus.appendChild(statusPill);
    tr.appendChild(tdStatus);

    // Column 5: Actions
    const tdActions = document.createElement("td");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "admin-row-actions";

    const editNoteBtn = document.createElement("button");
    editNoteBtn.type = "button";
    editNoteBtn.className = "btn btn-small btn-ghost";
    editNoteBtn.textContent = strings.editTeacherNoteBtn;
    editNoteBtn.addEventListener("click", () => {
      editingAdminTeacherEmail =
        editingAdminTeacherEmail === item.email ? "" : item.email;
      renderAdminPanelDirectory();
    });
    actionsWrap.appendChild(editNoteBtn);

    if (!isAdminItem) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-small btn-danger-ghost";
      delBtn.textContent = strings.removeTeacherBtn;
      const srLabel = document.createElement("span");
      srLabel.className = "visually-hidden";
      srLabel.textContent = ` (${item.email})`;
      delBtn.appendChild(srLabel);
      delBtn.addEventListener("click", () => removeTeacherByEmail(item.email, delBtn));
      actionsWrap.appendChild(delBtn);
    } else {
      const lockSpan = document.createElement("span");
      lockSpan.className = "admin-protected-note";
      lockSpan.textContent = strings.protectedAdminLabel;
      actionsWrap.appendChild(lockSpan);
    }

    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

function renderLandingTeacherCardGate() {
  const gateBox = document.getElementById("landing-teacher-auth-gate");
  const unlockedBox = document.getElementById("landing-teacher-unlocked");
  const toolbarEl = document.getElementById("landing-teacher-account-bar");
  if (!gateBox || !unlockedBox) return;

  const strings = t();

  if (authState.isAuthorizedTeacher) {
    gateBox.hidden = true;
    unlockedBox.hidden = false;

    if (toolbarEl) {
      toolbarEl.innerHTML = "";
      toolbarEl.hidden = false;

      const identityWrap = document.createElement("div");
      identityWrap.className = "teacher-bar-identity";

      const badge = document.createElement("span");
      badge.className = "teacher-verified-pill" + (authState.isSuperAdmin ? " is-admin" : "");
      badge.textContent = authState.isSuperAdmin
        ? strings.verifiedAdminBadge
        : strings.verifiedTeacherBadge;

      const emailSpan = document.createElement("span");
      emailSpan.className = "teacher-bar-email";
      emailSpan.textContent = authState.email;

      identityWrap.appendChild(badge);
      identityWrap.appendChild(emailSpan);

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "teacher-bar-actions";

      const wsBtn = document.createElement("button");
      wsBtn.type = "button";
      wsBtn.className = "btn btn-small btn-primary";
      wsBtn.textContent = strings.openWorkspaceBtn;
      wsBtn.addEventListener("click", () => openWorkspaceView("history"));
      actionsWrap.appendChild(wsBtn);

      toolbarEl.appendChild(identityWrap);
      toolbarEl.appendChild(actionsWrap);
    }
    return;
  }

  unlockedBox.hidden = true;
  if (toolbarEl) toolbarEl.hidden = true;
  gateBox.hidden = false;
  gateBox.innerHTML = "";

  if (authState.status === "loading") {
    const p = document.createElement("p");
    p.className = "auth-gate-loading";
    p.textContent = strings.loadingAuth;
    gateBox.appendChild(p);
    return;
  }

  if (authState.status === "unauthorized") {
    const alertDiv = document.createElement("div");
    alertDiv.className = "auth-gate-box is-unauthorized";

    const badge = document.createElement("span");
    badge.className = "teacher-verified-pill is-unauth";
    badge.textContent = strings.unauthorizedBadge;

    const title = document.createElement("h3");
    title.className = "auth-gate-title";
    title.textContent = strings.gateUnauthTitle;

    const desc = document.createElement("p");
    desc.className = "auth-gate-desc";
    desc.appendChild(document.createTextNode(strings.gateUnauthBodyPrefix));
    const emailCode = document.createElement("strong");
    emailCode.textContent = authState.email;
    desc.appendChild(emailCode);
    desc.appendChild(document.createTextNode(strings.gateUnauthBodySuffix + " "));
    const adminCode = document.createElement("code");
    adminCode.textContent = superAdminEmail;
    desc.appendChild(adminCode);

    const btnRow = document.createElement("div");
    btnRow.className = "studio-btn-row auth-gate-actions";

    const switchBtn = document.createElement("button");
    switchBtn.type = "button";
    switchBtn.className = "btn btn-google";
    switchBtn.disabled = isSigningIn;
    switchBtn.appendChild(createGoogleLogoSvg());
    const switchText = document.createElement("span");
    switchText.textContent = strings.switchAccountBtn;
    switchBtn.appendChild(switchText);
    switchBtn.addEventListener("click", signInWithGoogle);

    const signOutBtn = document.createElement("button");
    signOutBtn.type = "button";
    signOutBtn.className = "btn btn-ghost";
    signOutBtn.textContent = strings.signOutBtn;
    signOutBtn.addEventListener("click", signOutTeacher);

    btnRow.appendChild(switchBtn);
    btnRow.appendChild(signOutBtn);

    alertDiv.appendChild(badge);
    alertDiv.appendChild(title);
    alertDiv.appendChild(desc);
    if (authState.authError) {
      const errP = document.createElement("p");
      errP.className = "field-error";
      errP.textContent = authState.authError;
      alertDiv.appendChild(errP);
    }
    alertDiv.appendChild(btnRow);
    gateBox.appendChild(alertDiv);
    return;
  }

  // Guest state
  const box = document.createElement("div");
  box.className = "auth-gate-box";

  const title = document.createElement("h3");
  title.className = "auth-gate-title";
  title.textContent = strings.gateGuestTitle;

  const desc = document.createElement("p");
  desc.className = "auth-gate-desc";
  desc.textContent = strings.gateGuestDesc;

  const googleBtn = document.createElement("button");
  googleBtn.type = "button";
  googleBtn.className = "btn btn-google btn-full";
  googleBtn.disabled = isSigningIn;
  googleBtn.appendChild(createGoogleLogoSvg());
  const btnSpan = document.createElement("span");
  btnSpan.textContent = strings.googleSignInBtn;
  googleBtn.appendChild(btnSpan);
  googleBtn.addEventListener("click", signInWithGoogle);

  const studentHint = document.createElement("p");
  studentHint.className = "field-hint auth-student-note";
  studentHint.textContent = strings.gateStudentNote;

  box.appendChild(title);
  box.appendChild(desc);
  if (authState.authError) {
    const errP = document.createElement("p");
    errP.className = "field-error";
    errP.textContent = authState.authError;
    box.appendChild(errP);
  }
  box.appendChild(googleBtn);
  box.appendChild(studentHint);
  gateBox.appendChild(box);
}

function renderRibbonTeacherButtons() {
  const regenBtn = document.getElementById("regenerate-doc-btn");
  const saveBtn = document.getElementById("save-to-workspace-btn");
  const wsBtn = document.getElementById("ribbon-workspace-btn");
  const strings = t();

  if (regenBtn) regenBtn.hidden = !authState.isAuthorizedTeacher;
  if (wsBtn) {
    wsBtn.hidden = !authState.isAuthorizedTeacher;
    wsBtn.textContent = strings.ribbonWorkspaceBtn;
  }

  if (saveBtn) {
    if (!authState.isAuthorizedTeacher) {
      saveBtn.hidden = true;
      return;
    }
    saveBtn.hidden = false;
    const ctx =
      window.SnowDayPortal && typeof window.SnowDayPortal.getActiveLessonContext === "function"
        ? window.SnowDayPortal.getActiveLessonContext()
        : { hasLesson: false, docKey: "" };
    const isAlreadySaved = Boolean(
      ctx.docKey && cachedPersonalDocs.some((d) => d.docKey === ctx.docKey)
    );
    saveBtn.textContent = isAlreadySaved ? strings.ribbonSavedBtn : strings.ribbonSaveBtn;
    saveBtn.classList.toggle("is-saved-doc", isAlreadySaved);
  }
}

function renderAuthDialogContent() {
  const kickerEl = document.getElementById("auth-dialog-kicker");
  const titleEl = document.getElementById("auth-dialog-title");
  const bodyEl = document.getElementById("auth-dialog-body");
  if (!titleEl || !bodyEl) return;

  const strings = t();
  if (kickerEl) kickerEl.textContent = strings.authModalKicker;
  bodyEl.innerHTML = "";

  if (authState.status === "unauthorized") {
    titleEl.textContent = strings.authModalTitleUnauth;

    const wrap = document.createElement("div");
    wrap.className = "auth-gate-box is-unauthorized";

    const desc = document.createElement("p");
    desc.className = "auth-gate-desc";
    desc.appendChild(document.createTextNode(strings.gateUnauthBodyPrefix));
    const strongEmail = document.createElement("strong");
    strongEmail.textContent = authState.email;
    desc.appendChild(strongEmail);
    desc.appendChild(document.createTextNode(strings.gateUnauthBodySuffix + " "));
    const adminCode = document.createElement("code");
    adminCode.textContent = superAdminEmail;
    desc.appendChild(adminCode);

    const actions = document.createElement("div");
    actions.className = "studio-btn-row auth-modal-actions";

    const switchBtn = document.createElement("button");
    switchBtn.type = "button";
    switchBtn.className = "btn btn-google";
    switchBtn.disabled = isSigningIn;
    switchBtn.appendChild(createGoogleLogoSvg());
    const switchSpan = document.createElement("span");
    switchSpan.textContent = strings.switchAccountBtn;
    switchBtn.appendChild(switchSpan);
    switchBtn.addEventListener("click", signInWithGoogle);

    const outBtn = document.createElement("button");
    outBtn.type = "button";
    outBtn.className = "btn btn-ghost";
    outBtn.textContent = strings.signOutBtn;
    outBtn.addEventListener("click", signOutTeacher);

    actions.appendChild(switchBtn);
    actions.appendChild(outBtn);

    wrap.appendChild(desc);
    if (authState.authError) {
      const errP = document.createElement("p");
      errP.className = "field-error";
      errP.textContent = authState.authError;
      wrap.appendChild(errP);
    }
    wrap.appendChild(actions);
    bodyEl.appendChild(wrap);
    return;
  }

  // Guest prompt
  titleEl.textContent = strings.authModalTitleGuest;

  const desc = document.createElement("p");
  desc.className = "auth-gate-desc";
  desc.textContent = strings.gateGuestDesc;

  const googleBtn = document.createElement("button");
  googleBtn.type = "button";
  googleBtn.className = "btn btn-google btn-full";
  googleBtn.disabled = isSigningIn;
  googleBtn.appendChild(createGoogleLogoSvg());
  const btnSpan = document.createElement("span");
  btnSpan.textContent = strings.googleSignInBtn;
  googleBtn.appendChild(btnSpan);
  googleBtn.addEventListener("click", signInWithGoogle);

  const note = document.createElement("p");
  note.className = "field-hint auth-student-note";
  note.textContent = strings.gateStudentNote;

  bodyEl.appendChild(desc);
  if (authState.authError) {
    const errP = document.createElement("p");
    errP.className = "field-error";
    errP.textContent = authState.authError;
    bodyEl.appendChild(errP);
  }
  bodyEl.appendChild(googleBtn);
  bodyEl.appendChild(note);
}

function renderAllAuthSurfaces() {
  renderHeaderAuthButton();
  renderLandingTeacherCardGate();
  renderRibbonTeacherButtons();
  renderAuthDialogContent();
  renderWorkspaceStaticLabels();

  if (authState.isAuthorizedTeacher) {
    renderWorkspaceBanner();
    renderPersonalDocsGrid();
    renderImportFromBrowserButton();
    refreshWorkspaceQrPreview();
    if (authState.isSuperAdmin) {
      renderAdminPanelDirectory();
    }
  }
}

// ============================================================================
// Event Binding & Lifecycle
// ============================================================================

function bindWorkspaceAndAuthEvents() {
  const headerBtn = document.getElementById("header-teacher-auth-btn");
  if (headerBtn) {
    headerBtn.addEventListener("click", () => {
      if (authState.isAuthorizedTeacher) {
        openWorkspaceView(authState.isSuperAdmin ? activeWorkspaceTab : "history");
      } else {
        openAuthDialog();
      }
    });
  }

  // Workspace Banner buttons
  const returnLessonBtn = document.getElementById("ws-return-lesson-btn");
  if (returnLessonBtn) {
    returnLessonBtn.addEventListener("click", () => {
      if (window.SnowDayPortal && typeof window.SnowDayPortal.returnToActiveLesson === "function") {
        window.SnowDayPortal.returnToActiveLesson();
      }
    });
  }

  const studentHubBtn = document.getElementById("ws-student-hub-btn");
  if (studentHubBtn) {
    studentHubBtn.addEventListener("click", () => {
      if (window.SnowDayPortal && typeof window.SnowDayPortal.showLandingHub === "function") {
        window.SnowDayPortal.showLandingHub(true, true);
      }
    });
  }

  const wsSignoutBtn = document.getElementById("ws-signout-btn");
  if (wsSignoutBtn) {
    wsSignoutBtn.addEventListener("click", signOutTeacher);
  }

  // Ribbon Workspace & Save buttons
  const ribbonWsBtn = document.getElementById("ribbon-workspace-btn");
  if (ribbonWsBtn) {
    ribbonWsBtn.addEventListener("click", () => openWorkspaceView("history"));
  }

  const ribbonSaveBtn = document.getElementById("save-to-workspace-btn");
  if (ribbonSaveBtn) {
    ribbonSaveBtn.addEventListener("click", async () => {
      if (!authState.isAuthorizedTeacher || !window.SnowDayPortal) return;
      const ctx = window.SnowDayPortal.getActiveLessonContext();
      if (!ctx.hasLesson || !ctx.docUrl) return;
      const lang = getLang();
      const title =
        (ctx.lesson &&
          ctx.lesson.meta &&
          ctx.lesson.meta.lessonTitle &&
          (ctx.lesson.meta.lessonTitle[lang] || ctx.lesson.meta.lessonTitle.ka)) ||
        "";
      const subject =
        (ctx.lesson &&
          ctx.lesson.meta &&
          ctx.lesson.meta.subject &&
          (ctx.lesson.meta.subject[lang] || ctx.lesson.meta.subject.ka)) ||
        "";
      try {
        await upsertPersonalDocRecord({
          rawDocUrl: ctx.docUrl,
          title,
          subject,
          status: "ai_generated",
          preserveExistingNotes: true
        });
        renderRibbonTeacherButtons();
      } catch (_e) {}
    });
  }

  // History Toolbar Controls
  const jumpCreateBtn = document.getElementById("ws-jump-create-btn");
  if (jumpCreateBtn) {
    jumpCreateBtn.addEventListener("click", () => selectWorkspaceTab("create", true));
  }

  const importLocalBtn = document.getElementById("ws-import-local-btn");
  if (importLocalBtn) {
    importLocalBtn.addEventListener("click", importRecentBrowserLessonsToSpace);
  }

  const historySearchInput = document.getElementById("ws-history-search");
  if (historySearchInput) {
    historySearchInput.addEventListener("input", () => {
      historySearchQuery = historySearchInput.value;
      renderPersonalDocsGrid();
    });
  }

  document.querySelectorAll("[data-doc-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      historyStatusFilter = btn.getAttribute("data-doc-filter") || "all";
      document.querySelectorAll("[data-doc-filter]").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderPersonalDocsGrid();
    });
  });

  // Workspace Create & QR Studio Form
  const createForm = document.getElementById("ws-create-doc-form");
  const wsUrlInput = document.getElementById("ws-doc-url-input");
  const wsUrlError = document.getElementById("ws-doc-url-error");
  const wsTitleInput = document.getElementById("ws-doc-title-input");
  const wsClassInput = document.getElementById("ws-doc-class-input");
  const wsNoteInput = document.getElementById("ws-doc-note-input");
  const wsSaveQrBtn = document.getElementById("ws-save-qr-btn");
  const wsGenOpenBtn = document.getElementById("ws-generate-open-btn");
  const wsCreateFeedback = document.getElementById("ws-create-feedback");
  const wsCopyToast = document.getElementById("ws-copy-toast");

  const showWsQrToast = (msg) => {
    if (!wsCopyToast) return;
    wsCopyToast.textContent = msg;
    setTimeout(() => {
      if (wsCopyToast.textContent === msg) wsCopyToast.textContent = "";
    }, 2800);
  };

  if (wsUrlInput) {
    wsUrlInput.addEventListener("input", () => {
      if (wsUrlError) wsUrlError.hidden = true;
      wsUrlInput.removeAttribute("aria-invalid");
      refreshWorkspaceQrPreview();
    });
  }
  if (wsTitleInput) {
    wsTitleInput.addEventListener("input", () => refreshWorkspaceQrPreview());
  }
  document.querySelectorAll('input[name="wsQrTarget"]').forEach((r) => {
    r.addEventListener("change", () => refreshWorkspaceQrPreview());
  });

  const wsFileInput = document.getElementById("ws-file-input");
  const wsFileBtn = document.getElementById("ws-upload-file-btn");
  const wsFileName = document.getElementById("ws-file-name");

  if (wsFileBtn && wsFileInput) {
    wsFileBtn.addEventListener("click", () => wsFileInput.click());
    wsFileInput.addEventListener("change", async () => {
      const file = wsFileInput.files && wsFileInput.files[0];
      if (!file) return;
      try {
        wsFileBtn.disabled = true;
        wsFileBtn.textContent = getLang() === "ka" ? "მუშავდება..." : "Processing...";
        let res = null;
        if (window.SnowDayPortal && typeof window.SnowDayPortal.extractFileText === "function") {
          res = await window.SnowDayPortal.extractFileText(file);
        }
        const localUrl = "local:" + encodeURIComponent(file.name);
        if (res && window.SnowDayPortal && typeof window.SnowDayPortal.setUploadedDoc === "function") {
          window.SnowDayPortal.setUploadedDoc(localUrl, res);
          try {
            sessionStorage.setItem("snowday_uploaded_doc_" + (window.SnowDayPortal.extractDocCacheKey ? window.SnowDayPortal.extractDocCacheKey(localUrl) : localUrl), JSON.stringify(res));
          } catch (_e) {}
        }
        if (wsUrlInput) {
          wsUrlInput.value = localUrl;
          if (wsUrlError) wsUrlError.hidden = true;
        }
        if (wsTitleInput && !wsTitleInput.value.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
          wsTitleInput.value = cleanName;
        }
        if (wsFileName) {
          wsFileName.textContent = `${(res ? res.format : "FILE").toUpperCase()} · ${file.name}`;
          wsFileName.hidden = false;
        }
        refreshWorkspaceQrPreview();
      } catch (err) {
        showHistoryToast((getLang() === "ka" ? "ფაილის წაკითხვა ვერ მოხერხდა: " : "Could not read file: ") + err.message, true);
      } finally {
        wsFileBtn.disabled = false;
        wsFileBtn.innerHTML = `📁 <span>${t().uploadFileBtn || "ფაილის ატვირთვა (PDF, DOCX, TXT)"}</span>`;
      }
    });
  }

  if (createForm && wsUrlInput) {
    createForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const normalized = normalizeHttpsDocUrl(wsUrlInput.value);
      if (!normalized) {
        if (wsUrlError) {
          wsUrlError.textContent = t().docUrlInvalid;
          wsUrlError.hidden = false;
        }
        wsUrlInput.setAttribute("aria-invalid", "true");
        wsUrlInput.focus();
        return;
      }

      refreshWorkspaceQrPreview();
      if (wsSaveQrBtn) {
        wsSaveQrBtn.disabled = true;
        wsSaveQrBtn.textContent = t().savingQrBtn;
      }
      if (wsCreateFeedback) wsCreateFeedback.hidden = true;

      try {
        await upsertPersonalDocRecord({
          rawDocUrl: normalized,
          title: wsTitleInput ? wsTitleInput.value : "",
          classLabel: wsClassInput ? wsClassInput.value : "",
          personalNote: wsNoteInput ? wsNoteInput.value : "",
          status: "qr_shared",
          incrementShare: true,
          preserveExistingNotes: false
        });
        if (wsCreateFeedback) {
          wsCreateFeedback.className = "api-ping-status";
          wsCreateFeedback.textContent = t().savedDocToast;
          wsCreateFeedback.hidden = false;
        }
      } catch (err) {
        if (wsCreateFeedback) {
          wsCreateFeedback.className = "api-ping-status is-error";
          wsCreateFeedback.textContent =
            t().genericSaveErrorPrefix + ((err && err.message) || String(err));
          wsCreateFeedback.hidden = false;
        }
      } finally {
        if (wsSaveQrBtn) {
          wsSaveQrBtn.disabled = false;
          wsSaveQrBtn.textContent = t().saveQrBtn;
        }
      }
    });
  }

  if (wsGenOpenBtn && wsUrlInput) {
    wsGenOpenBtn.addEventListener("click", async () => {
      const normalized = normalizeHttpsDocUrl(wsUrlInput.value);
      if (!normalized) {
        if (wsUrlError) {
          wsUrlError.textContent = t().docUrlInvalid;
          wsUrlError.hidden = false;
        }
        wsUrlInput.setAttribute("aria-invalid", "true");
        wsUrlInput.focus();
        return;
      }

      try {
        await upsertPersonalDocRecord({
          rawDocUrl: normalized,
          title: wsTitleInput ? wsTitleInput.value : "",
          classLabel: wsClassInput ? wsClassInput.value : "",
          personalNote: wsNoteInput ? wsNoteInput.value : "",
          status: "qr_shared",
          preserveExistingNotes: true
        });
      } catch (_e) {}

      if (window.SnowDayPortal && typeof window.SnowDayPortal.openDocUrlWithHistory === "function") {
        window.SnowDayPortal.openDocUrlWithHistory(normalized, false);
      }
    });
  }

  const wsDownloadQrBtn = document.getElementById("ws-download-qr-btn");
  if (wsDownloadQrBtn) {
    wsDownloadQrBtn.addEventListener("click", () => {
      const normalized = normalizeHttpsDocUrl(wsUrlInput ? wsUrlInput.value : "");
      if (!normalized || !window.SnowDayPortal) return;
      const studentUrl = computeStudentUrlForWorkspace(normalized);
      if (window.SnowDayPortal.downloadQrPngForUrl(studentUrl)) {
        showWsQrToast(t().qrPngDownloaded);
      }
    });
  }

  const wsCopyQrBtn = document.getElementById("ws-copy-qr-btn");
  if (wsCopyQrBtn) {
    wsCopyQrBtn.addEventListener("click", async () => {
      const normalized = normalizeHttpsDocUrl(wsUrlInput ? wsUrlInput.value : "");
      if (!normalized) return;
      const studentUrl = computeStudentUrlForWorkspace(normalized);
      try {
        await navigator.clipboard.writeText(studentUrl);
        showWsQrToast(t().copiedLinkToast);
      } catch (_e) {
        showWsQrToast(studentUrl);
      }
    });
  }

  const wsPrintQrBtn = document.getElementById("ws-print-qr-btn");
  if (wsPrintQrBtn) {
    wsPrintQrBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Also auto-save when teacher generates QR from the Student Hub preview card
  const landingTeacherForm = document.getElementById("landing-teacher-form");
  if (landingTeacherForm) {
    landingTeacherForm.addEventListener("submit", () => {
      const landingInput = document.getElementById("landing-teacher-doc-input");
      if (authState.isAuthorizedTeacher && landingInput && landingInput.value) {
        upsertPersonalDocRecord({
          rawDocUrl: landingInput.value,
          status: "qr_shared",
          incrementShare: true,
          preserveExistingNotes: true
        }).catch(() => {});
      }
    });
  }

  // Auto-enrich saved doc title & subject when AI lesson finishes loading
  window.addEventListener("snowday:lessonloaded", (ev) => {
    renderRibbonTeacherButtons();
    if (!authState.isAuthorizedTeacher || !ev.detail || !ev.detail.docUrl) return;
    const { docUrl, docKey, lesson } = ev.detail;
    const existsInHistory = cachedPersonalDocs.some((d) => d.docKey === docKey);
    if (!existsInHistory) return;

    const lang = getLang();
    const aiTitle =
      (lesson &&
        lesson.meta &&
        lesson.meta.lessonTitle &&
        (lesson.meta.lessonTitle[lang] || lesson.meta.lessonTitle.ka)) ||
      "";
    const aiSubject =
      (lesson &&
        lesson.meta &&
        lesson.meta.subject &&
        (lesson.meta.subject[lang] || lesson.meta.subject.ka)) ||
      "";

    const existingItem = cachedPersonalDocs.find((d) => d.docKey === docKey);
    const hasGenericTitle =
      !existingItem ||
      !existingItem.title ||
      existingItem.title.startsWith("Google Doc ");

    upsertPersonalDocRecord({
      rawDocUrl: docUrl,
      title: hasGenericTitle ? aiTitle : existingItem.title,
      subject: aiSubject || (existingItem && existingItem.subject) || "",
      status: "ai_generated",
      preserveExistingNotes: true
    }).catch(() => {});
  });

  // Admin Panel Search & Email Validation
  const adminSearchInput = document.getElementById("admin-teacher-search");
  if (adminSearchInput) {
    adminSearchInput.addEventListener("input", () => {
      adminSearchQuery = adminSearchInput.value;
      renderAdminPanelDirectory();
    });
  }
  setupAdminEmailValidation();

  // Settings Tab API Save & Cache Clear
  const wsSaveApiBtn = document.getElementById("ws-save-api-btn");
  if (wsSaveApiBtn) {
    wsSaveApiBtn.addEventListener("click", () => {
      const inp = document.getElementById("ws-agent-url-input");
      const statusEl = document.getElementById("ws-api-ping-status");
      if (window.SnowDayPortal && window.SnowDayPortal.saveAndTestAgentBaseUrl) {
        window.SnowDayPortal.saveAndTestAgentBaseUrl(inp ? inp.value : "", statusEl);
      }
    });
  }

  const wsClearCacheBtn = document.getElementById("ws-clear-cache-btn");
  if (wsClearCacheBtn) {
    wsClearCacheBtn.addEventListener("click", () => {
      const statusEl = document.getElementById("ws-api-ping-status");
      if (window.SnowDayPortal && window.SnowDayPortal.clearLocalLessonCache) {
        window.SnowDayPortal.clearLocalLessonCache(statusEl);
        renderImportFromBrowserButton();
      }
    });
  }

  setupWorkspaceTabsEvents();

  window.addEventListener("snowday:langchange", () => {
    renderAllAuthSurfaces();
  });
}

function bootTeacherAuth() {
  // Default QR host radio to current origin when running on localhost
  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const wsTargetCurrent = document.getElementById("ws-target-current");
  if (isLocalHost && wsTargetCurrent) {
    wsTargetCurrent.checked = true;
  }

  ensureFocusgroupSupport();
  bindWorkspaceAndAuthEvents();
  renderAllAuthSurfaces();

  getRedirectResult(auth).catch((err) => {
    if (err) {
      authState.authError = formatAuthError(err);
      renderAllAuthSurfaces();
    }
  });

  onAuthStateChanged(auth, (user) => {
    handleAuthUserChange(user);
  });
}

window.SnowDayTeacherAuth = {
  getState: () => ({ ...authState }),
  isAuthorizedTeacher: () => Boolean(authState.isAuthorizedTeacher),
  isSuperAdmin: () => Boolean(authState.isSuperAdmin),
  signInWithGoogle,
  signOutTeacher,
  requireTeacherAccess,
  openAuthDialog,
  openWorkspaceView,
  openAdminDialog: () => openWorkspaceView("admin")
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTeacherAuth);
} else {
  bootTeacherAuth();
}
