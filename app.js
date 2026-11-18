/**
 * SnowDay Class (თოვლის დღის კლასი) — answer.ge
 * Dynamic School Lesson Portal, QR Studio, Two-Tier Lesson Cache & Geosoft Headless AI Agent Client
 */
(function () {
  "use strict";

  const VISITOR_STORAGE_KEY = "snowday_visitor_id";
  const API_URL_STORAGE_KEY = "snowday_agent_base_url_override";
  const LESSON_CACHE_PREFIX = "snowday_lesson_v3_";
  const SHARED_CACHE_VISITOR_ID = "lesson_cache_bot";
  const POLL_INTERVAL_MS = 3000;

  const ALLOWED_ACCENTS = new Set(["royal", "amber", "forest", "teal", "terracotta", "slate"]);
  const OPTION_LABELS = {
    ka: ["ა", "ბ", "გ"],
    en: ["A", "B", "C"]
  };

  const UI_STRINGS = {
    ka: {
      skipToMain: "მთავარ შინაარსზე გადასვლა",
      brandTitle: "თოვლის დღის კლასი",
      brandSubtitle: "answer.ge · სკოლის AI გაკვეთილი QR კოდით",
      navTutor: "AI რეპეტიტორი",
      navCards: "სასწავლო ბარათები",
      navGlossary: "რთული სიტყვები",
      navQuiz: "კითხვარი",
      menuBtn: "მენიუ",
      teacherStudioBtn: "მასწავლებლის QR სტუდია",
      qrActiveLabel: "გენერირებულია მასწავლებლის დოკუმენტიდან",
      cachedBadge: "⚡ მყისიერი ქეშიდან",
      openOriginalDoc: "პირველწყაროს გახსნა ↗",
      regenerateBtn: "თავიდან გენერაცია",
      switchDocBtn: "სხვა დოკუმენტი / QR",
      generatingTitle: "AI აგენტი კითხულობს მასწავლებლის დოკუმენტს / ფაილს...",
      generatingBody:
        "იქმნება სასწავლო ბარათები, რთული სიტყვების ლექსიკონი და 3-ვარიანტიანი კითხვარი დოკუმენტისა და საგნის მიხედვით.",
      genErrorTitle: "დოკუმენტის ავტომატური გენერაცია ვერ შესრულდა",
      configureApiBtn: "QR და API პარამეტრები",
      retryGenBtn: "ხელახლა ცდა",
      landingEyebrow: "answer.ge · უწყვეტი სასკოლო განათლება",
      landingHeading: "გადააქციე მასწავლებლის დოკუმენტი ან Drive ფაილი AI გაკვეთილად",
      landingLead:
        "როდესაც დიდთოვლობის ან რთული მეტეოროლოგიური პირობების გამო მასწავლებელი სკოლაში ვერ მიდის, საკმარისია გაკვეთილის Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთული ფაილი: AI აგენტი ერთხელ აანალიზებს მასალას, ქმნის სრულ სასწავლო ვებგვერდს და ინახავს მას მყისიერი გამოყენებისთვის.",
      studentRoleBadge: "🎓 მოსწავლისთვის",
      studentHubTitle: "გახსენი დღევანდელი გაკვეთილი",
      studentHubDesc:
        "დაასკანერე მასწავლებლის მიერ გამოგზავნილი QR კოდი, ან ჩასვი გაკვეთილის ბმული (Google Docs / Drive) პირდაპირ ქვემოთ სასწავლო გვერდის გასახსნელად:",
      studentDocLabel: "მასწავლებლის გაკვეთილის ბმული (Doc, Drive PDF, DOCX, TXT)",
      studentDocHint:
        "მხარდაჭერილია Google Docs, Drive ფაილები (PDF, DOCX, TXT) და ვებ ბმულები.",
      openLessonBtn: "გაკვეთილის გახსნა",
      recentLessonsTitle: "⚡ ბოლოს გახსნილი გაკვეთილები (მყისიერი):",
      teacherRoleBadge: "👩‍🏫 მასწავლებლისთვის",
      teacherHubTitle: "შექმენი მოსწავლის QR კოდი",
      teacherHubDesc:
        "ატვირთეთ ან გააზიარეთ გაკვეთილის მასალა (Google Docs, Drive PDF, DOCX, TXT) და დააგენერირეთ QR კოდი მოსწავლეებისთვის:",
      createQrBtn: "QR კოდის შექმნა",
      previewAndWarmBtn: "გაკვეთილის შექმნა და გადახედვა",
      printAndOptionsBtn: "ამობეჭდვა / პარამეტრები",
      teacherNoteBadge: "მასწავლებლის დავალება (თოვლიანი დღის რეჟიმი)",
      viewTeacherDocBtn: "დოკუმენტის / ფაილის ტექსტის ნახვა",
      ctaAskTutor: "ჰკითხე AI რეპეტიტორს",
      ctaBrowseCards: "სასწავლო ბარათები",
      ctaTakeQuiz: "შემაჯამებელი კითხვარი",
      shareQrHeading: "QR კოდი მოსწავლეებისთვის",
      shareQrSub: "გააზიარე ამ გაკვეთილის QR კოდი answer.ge-ზე",
      showQrBtn: "QR ჩვენება",
      tutorKicker: "ინტერაქტიული დახმარება · დოკუმენტსა და საგანზე დაყრდნობით",
      demoModeBadge: "ლოკალური რეჟიმი",
      liveModeBadge: "Geosoft AI ჩართულია",
      chatSubline: "პასუხობს მასწავლებლის დოკუმენტის (Doc, PDF, DOCX, TXT) და პროგრამის მიხედვით",
      resetChat: "ახალი საუბარი",
      jumpinWaitingTitle: "შეტყობინება გაეგზავნა მასწავლებელს...",
      jumpinWaitingSub: "მასწავლებლის პასუხი პირდაპირ ამ ჩათში გამოჩნდება.",
      jumpinAssignedTitle: "მასწავლებელი შემოუერთდა საუბარს",
      continueWithAiBtn: "AI რეპეტიტორთან დაბრუნება",
      humanTeacherBadge: "მასწავლებელი",
      chatInputLabel: "დაუსვი კითხვა AI რეპეტიტორს",
      chatPlaceholder: "დაწერე კითხვა დღევანდელი გაკვეთილიდან...",
      sendBtn: "გაგზავნა",
      thinkingText: "AI რეპეტიტორი ამზადებს პასუხს...",
      cardsHeading: "გაკვეთილის სასწავლო ბარათები",
      searchLabel: "მოძებნე სასწავლო ბარათებში",
      searchPlaceholder: "მოძებნე თემა, თარიღი ან ტერმინი...",
      sourceBannerTitle: "როგორ იქმნება ბარათები:",
      sourceBannerBody:
        "AI აგენტი პირველ რიგში ეყრდნობა მასწავლებლის მიერ გაზიარებულ დოკუმენტს/ფაილს („დოკუმენტიდან“) და საჭიროებისას ავსებს შესაბამისი სასკოლო საგნის სანდო კონტექსტით („დოკუმენტი + საგანი“).",
      sourceTagDoc: "დოკუმენტიდან",
      sourceTagEnriched: "დოკუმენტი + საგანი",
      studyTipPrefix: "დაიმახსოვრე:",
      askAboutCardBtn: "ჰკითხე რეპეტიტორს",
      noCardsMatch: "ამ საძიებო სიტყვით სასწავლო ბარათი ვერ მოიძებნა.",
      glossaryKicker: "მარტივი ერთხაზიანი განმარტებები",
      glossaryHeading: "რთული სიტყვების ლექსიკონი",
      quizKicker: "ცოდნის შემოწმება · 3 სავარაუდო პასუხი",
      quizHeading: "გაკვეთილის შემაჯამებელი კითხვარი",
      nextQuestionBtn: "შემდეგი კითხვა",
      restartQuizBtn: "თავიდან დაწყება",
      footerTitle: "თოვლის დღის კლასი (SnowDay Class) · answer.ge",
      footerNote:
        "შექმნილია მთიანი რეგიონების სკოლების უწყვეტი განათლებისთვის: მასწავლებლის დოკუმენტი + QR კოდი → ავტომატური AI სასწავლო გვერდი და რეპეტიტორი.",
      studioKicker: "მასწავლებლის პანელი · answer.ge",
      studioTitle: "გაკვეთილის დოკუმენტი / ფაილი და QR კოდის გენერატორი",
      closeBtn: "დახურვა",
      howTeacherWorksTitle: "3 მარტივი ნაბიჯი მასწავლებლისთვის:",
      howStep1: "მოამზადეთ გაკვეთილი Google Docs-ში, Google Drive-ზე (PDF, DOCX, TXT) ან ატვირთეთ ფაილი.",
      howStep2:
        "Google-ში დააწკაპუნეთ <strong>Share (გაზიარება)</strong> → აირჩიეთ <strong>Anyone with the link (ნებისმიერი ბმულით — მნახველი)</strong>.",
      howStep3: "ჩასვით ბმული ან ატვირთეთ ფაილი ქვემოთ, შექმენით QR კოდი და გაუზიარეთ კლასს!",
      docLinkLabel: "Google Docs / Drive (PDF, DOCX, TXT) გაზიარების ბმული",
      docLinkHint: "მხარდაჭერილია Google Docs, Drive ფაილები (PDF, DOCX, TXT) და პირდაპირი ბმულები.",
      orUploadDirectly: "ან ატვირთეთ ფაილი:",
      uploadFileBtn: "ფაილის ატვირთვა (PDF, DOCX, TXT)",
      qrTargetLegend: "QR კოდის სამიზნე მისამართი",
      targetProdNote: "(საკონკურსო დომენი)",
      targetLocalNote: "(ლოკალური ტესტირებისთვის)",
      generateQrBtn: "QR კოდის განახლება",
      testLessonNowBtn: "ამ დოკუმენტით გაკვეთილის გახსნა",
      apiSettingsSummary: "Geosoft AI Agent API კავშირის პარამეტრები",
      apiSettingsDesc:
        "ჩასვით თქვენი გამოქვეყნებული Geosoft აგენტის მისამართი (ან გაწერეთ <code>chatbot-config.js</code>-ში):",
      saveApiBtn: "შენახვა და შემოწმება",
      clearCacheBtn: "ქეშის გასუფთავება",
      scanBadge: "დაასკანერე მობილურით",
      downloadPngBtn: "PNG ჩამოტვირთვა",
      copyLinkBtn: "ბმულის კოპირება",
      printQrBtn: "ამობეჭდვა",
      qrEmptyPrompt: "ჩასვით დოკუმენტის ბმული ან ატვირთეთ ფაილი QR კოდის შესაქმნელად",
      docViewerKicker: "პირველწყარო დოკუმენტი",
      docViewerTitle: "მასწავლებლის ატვირთული / გაზიარებული კონსპექტი",
      sourceLinePrefix: "წყარო: სასწავლო ბარათი – ",
      fallbackNotInLesson:
        "ეს საკითხი მიმდინარე გაკვეთილის მასალაში არ შედის. მკითხე დღევანდელი თემის, რთული სიტყვების ან ქვიზის შესახებ!",
      privacyWarning:
        "უსაფრთხოებისთვის ჩათში არ გააზიარო პირადი მონაცემები (გვარი, მისამართი, ტელეფონის ნომერი). მოდი, გაკვეთილის თემას დავუბრუნდეთ!",
      missingApiForDoc:
        "დოკუმენტის წასაკითხად და გაკვეთილის დასაგენერირებლად მიუთითეთ Geosoft AI Agent Base URL „მასწავლებლის QR სტუდიაში“ (ან chatbot-config.js-ში).",
      adminSignOutBtn: "ანგარიშიდან გასვლა"
    },
    en: {
      skipToMain: "Skip to main content",
      brandTitle: "SnowDay Class",
      brandSubtitle: "answer.ge · AI School Lesson via QR Code",
      navTutor: "AI Tutor",
      navCards: "Learning Cards",
      navGlossary: "Hard Words",
      navQuiz: "Questionnaire",
      menuBtn: "Menu",
      teacherStudioBtn: "Teacher QR Studio",
      qrActiveLabel: "Generated from Teacher's Document",
      cachedBadge: "⚡ Instant Cached",
      openOriginalDoc: "Open Original Document ↗",
      regenerateBtn: "Regenerate",
      switchDocBtn: "Switch Doc / QR",
      generatingTitle: "AI Agent is reading your teacher's document / file...",
      generatingBody:
        "Analyzing Google Doc / Drive PDF / DOCX / TXT to build learning cards, glossary, and questionnaire.",
      genErrorTitle: "Could not generate lesson from document or Drive file",
      configureApiBtn: "QR & API Settings",
      retryGenBtn: "Try Again",
      landingEyebrow: "answer.ge · Resilient School Continuity",
      landingHeading: "Turn Any Teacher's Document or Drive File into an Interactive AI Lesson",
      landingLead:
        "When heavy snow keeps a teacher from reaching school, sharing a lesson file (Google Docs, Drive PDF, DOCX, TXT) is all it takes: the AI Agent analyzes the material once, builds a complete bilingual lesson website, and caches it for instant zero-token reuse.",
      studentRoleBadge: "🎓 For Students",
      studentHubTitle: "Open Today's Lesson",
      studentHubDesc:
        "Scan the QR code shared by your teacher, or paste your teacher's lesson link (Google Docs / Drive) directly below to open the lesson website:",
      studentDocLabel: "Teacher's Lesson Link (Doc, Drive PDF, DOCX, TXT)",
      studentDocHint:
        "Supports Google Docs, Drive files (PDF, DOCX, TXT), and web links.",
      openLessonBtn: "Open Lesson",
      recentLessonsTitle: "⚡ Recently Opened Lessons (Instant):",
      teacherRoleBadge: "👩‍🏫 For Teachers",
      teacherHubTitle: "Generate a Student QR Code",
      teacherHubDesc:
        "Upload or share today's lesson notes (Google Docs, Drive PDF, DOCX, TXT) and create a scannable QR code for your students:",
      createQrBtn: "Generate QR Code",
      previewAndWarmBtn: "Generate & Preview Lesson",
      printAndOptionsBtn: "Print / Options",
      teacherNoteBadge: "Teacher's Assignment (Snow-Day Continuity)",
      viewTeacherDocBtn: "View Document / File Text",
      ctaAskTutor: "Ask AI Tutor",
      ctaBrowseCards: "Learning Cards",
      ctaTakeQuiz: "Take Questionnaire",
      shareQrHeading: "Student Lesson QR Code",
      shareQrSub: "Share this lesson's QR code hosted on answer.ge",
      showQrBtn: "Show QR",
      tutorKicker: "Interactive Help · Grounded in Doc & Subject",
      demoModeBadge: "Local Mode",
      liveModeBadge: "Geosoft AI Live",
      chatSubline: "Answers from teacher's shared file (Doc, PDF, DOCX, TXT) & curriculum",
      resetChat: "New Chat",
      jumpinWaitingTitle: "Message sent to your teacher...",
      jumpinWaitingSub: "Your teacher's live reply will appear right here in chat.",
      jumpinAssignedTitle: "Your teacher joined the conversation",
      continueWithAiBtn: "Continue with AI Tutor",
      humanTeacherBadge: "Teacher",
      chatInputLabel: "Ask the AI Lesson Tutor a question",
      chatPlaceholder: "Ask a question about today's lesson...",
      sendBtn: "Send",
      thinkingText: "AI Tutor is thinking...",
      cardsHeading: "Lesson Learning Cards",
      searchLabel: "Search learning cards",
      searchPlaceholder: "Search topic, date, or term...",
      sourceBannerTitle: "How cards are built:",
      sourceBannerBody:
        "The AI Agent prioritizes facts from the teacher's shared document or file ('From Doc') and enriches them with verified context from that school subject ('Doc + Subject').",
      sourceTagDoc: "From Doc",
      sourceTagEnriched: "Doc + Subject",
      studyTipPrefix: "Study tip:",
      askAboutCardBtn: "Ask Tutor",
      noCardsMatch: "No learning cards matched your search.",
      glossaryKicker: "Simple One-Line Explanations",
      glossaryHeading: "Hard Words Glossary",
      quizKicker: "Check Your Knowledge · 3 Choices",
      quizHeading: "Lesson Questionnaire",
      nextQuestionBtn: "Next Question",
      restartQuizBtn: "Restart Quiz",
      footerTitle: "SnowDay Class · answer.ge",
      footerNote:
        "Built for resilient education in mountain schools: Teacher's Document + QR Code → Automatic AI Lesson Website & Tutor.",
      studioKicker: "Teacher Panel · answer.ge",
      studioTitle: "Lesson Document / File & QR Code Generator",
      closeBtn: "Close",
      howTeacherWorksTitle: "3 Simple Steps for Teachers:",
      howStep1: "Prepare today's lesson in Google Docs, Google Drive (PDF, DOCX, TXT), or upload a file.",
      howStep2:
        "Click <strong>Share</strong> in Google → set access to <strong>Anyone with the link → Viewer</strong>.",
      howStep3: "Paste the link or upload a file below, generate the QR code, and share it with your class!",
      docLinkLabel: "Google Docs / Drive (PDF, DOCX, TXT) Link",
      docLinkHint: "Supports Google Docs, Drive files (PDF, DOCX, TXT), and public share links ('Anyone with the link').",
      orUploadDirectly: "Or upload a file:",
      uploadFileBtn: "Upload File (PDF, DOCX, TXT)",
      qrTargetLegend: "QR Code Destination Host",
      targetProdNote: "(Contest domain)",
      targetLocalNote: "(For local/staging testing)",
      generateQrBtn: "Update QR Code",
      testLessonNowBtn: "Open Lesson With This Document",
      apiSettingsSummary: "Geosoft AI Agent API Connection Settings",
      apiSettingsDesc:
        "Paste your published Geosoft Headless Agent URL (or configure it inside <code>chatbot-config.js</code>):",
      saveApiBtn: "Save & Test Connection",
      clearCacheBtn: "Clear Cached Lessons",
      scanBadge: "Scan with Phone Camera",
      downloadPngBtn: "Download PNG",
      copyLinkBtn: "Copy Student Link",
      printQrBtn: "Print QR Sheet",
      qrEmptyPrompt: "Paste a document link or upload a file to generate your QR code",
      docViewerKicker: "Primary Source Document",
      docViewerTitle: "Teacher's Uploaded / Shared Lesson Notes",
      sourceLinePrefix: "Source: learning card – ",
      fallbackNotInLesson:
        "That topic isn't part of today's lesson. Ask me about any learning card, difficult word, or start a chat quiz!",
      privacyWarning:
        "For your safety, please don't share personal info (surname, home address, phone number) in chat. Let's focus on today's lesson!",
      missingApiForDoc:
        "To generate a lesson from a document or Drive file, paste your Geosoft AI Agent Base URL inside 'Teacher QR Studio → AI Agent API Settings' (or chatbot-config.js).",
      adminSignOutBtn: "Sign Out"
    }
  };

  // Portal State
  let currentLang = "ka";
  let activeLesson = null;
  let activeExternalDocUrl = "";
  let loadedFromCache = false;
  let searchQuery = "";
  let lastLandingQrStudentUrl = "";

  // Standalone Questionnaire state
  let pageQuizIndex = 0;
  let pageQuizWrongTries = 0;
  let pageQuizResolved = false;
  let pageQuizScore = 0;
  let pageQuizScoredSet = new Set();

  // Local fallback chat quiz state
  let localChatActiveQuiz = null;
  let localChatQuizWrongTries = 0;
  let localChatQuizCursor = 0;

  // Geosoft Headless API Chat state
  let visitorId = "";
  let sessionId = "";
  let chatStatus = "ai"; // "ai" | "jumpin" | "solved"
  let chatAssigned = false;
  let chatLoading = false;
  let jumpinPollTimer = null;

  function getOrCreateVisitorId() {
    try {
      const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (existing && /^[A-Za-z0-9_-]{1,128}$/.test(existing)) return existing;
      const fresh =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "vis_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(VISITOR_STORAGE_KEY, fresh);
      return fresh;
    } catch (_e) {
      return "vis_" + Date.now();
    }
  }

  function getEffectiveAgentBaseUrl() {
    let url = "";
    try {
      url = (localStorage.getItem(API_URL_STORAGE_KEY) || "").trim();
    } catch (_e) {}
    if (!url && window.SNOWDAY_AGENT_CONFIG && window.SNOWDAY_AGENT_CONFIG.agentBaseUrl) {
      url = String(window.SNOWDAY_AGENT_CONFIG.agentBaseUrl).trim();
    }
    return url.replace(/\/+$/, "");
  }

  function isLocalCacheEnabled() {
    return !window.SNOWDAY_AGENT_CONFIG || window.SNOWDAY_AGENT_CONFIG.cacheGeneratedLessons !== false;
  }

  function isSharedServerCacheEnabled() {
    return !window.SNOWDAY_AGENT_CONFIG || window.SNOWDAY_AGENT_CONFIG.enableSharedServerCache !== false;
  }

  function getLessonSessionStorageKey() {
    const key = activeExternalDocUrl ? extractDocCacheKey(activeExternalDocUrl) : "default";
    return "snowday_chat_session_" + key;
  }

  function loadStoredSessionId() {
    try {
      const s = sessionStorage.getItem(getLessonSessionStorageKey()) || "";
      return /^[A-Za-z0-9_-]{1,128}$/.test(s) ? s : "";
    } catch (_e) {
      return "";
    }
  }

  function saveStoredSessionId(id) {
    sessionId = id || "";
    try {
      const storageKey = getLessonSessionStorageKey();
      if (sessionId) sessionStorage.setItem(storageKey, sessionId);
      else sessionStorage.removeItem(storageKey);
    } catch (_e) {}
  }

  function normalizeGoogleDocUrl(rawInput) {
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) return "";

    // Published-to-web Google Doc
    const pubMatch = trimmed.match(/docs\.google\.com\/document\/d\/e\/([a-zA-Z0-9_-]+)/i);
    if (pubMatch) {
      return "https://docs.google.com/document/d/e/" + pubMatch[1] + "/pub";
    }

    // Standard Google Doc ID in URL
    const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]{15,})/);
    if (docMatch) {
      return "https://docs.google.com/document/d/" + docMatch[1] + "/edit";
    }

    // Drive /file/d/<ID> (PDF, DOCX, TXT, or generic Drive file)
    const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
    if (driveMatch) {
      return "https://drive.google.com/file/d/" + driveMatch[1] + "/view";
    }

    // Drive open?id=<ID> or uc?id=<ID>
    const driveIdMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{15,})/i);
    if (driveIdMatch) {
      return "https://drive.google.com/file/d/" + driveIdMatch[1] + "/view";
    }

    // Bare Google Doc / Drive File ID
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
      return "https://docs.google.com/document/d/" + trimmed + "/edit";
    }

    // Local uploaded file reference
    if (trimmed.startsWith("local:") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
      return trimmed;
    }

    // ?id=<ID>
    try {
      const parsed = new URL(trimmed);
      const qId = parsed.searchParams.get("id");
      if (qId && /^[a-zA-Z0-9_-]{15,}$/.test(qId)) {
        if (parsed.hostname.includes("drive.google.com")) {
          return "https://drive.google.com/file/d/" + qId + "/view";
        }
        return "https://docs.google.com/document/d/" + qId + "/edit";
      }
      if (
        (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        (parsed.hostname.includes("docs.google.com") ||
          parsed.hostname.includes("drive.google.com") ||
          /\.(pdf|docx|txt)($|\?)/i.test(parsed.pathname))
      ) {
        return parsed.href;
      }
    } catch (_e) {}

    return "";
  }

  function detectDocFormat(docUrl, rawText) {
    const u = String(docUrl || "").toLowerCase();
    const t = String(rawText || "");
    if (u.endsWith(".pdf") || t.startsWith("%PDF-")) return "pdf";
    if (u.endsWith(".docx")) return "docx";
    if (u.endsWith(".txt")) return "txt";
    if (u.includes("drive.google.com/file/d/")) {
      // If we already know the underlying format or extension:
      if (t.startsWith("%PDF-")) return "pdf";
      return "drive";
    }
    if (u.includes("docs.google.com/document/")) return "gdoc";
    if (u.startsWith("local:")) {
      const ext = (u.split(".").pop() || "").toLowerCase();
      if (ext === "pdf" || ext === "docx" || ext === "txt") return ext;
    }
    return "doc";
  }

  function extractDocCacheKey(docUrl) {
    const raw = String(docUrl || "");
    if (raw.startsWith("local:")) {
      return "local_" + raw.slice(6).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
    }
    const m = raw.match(/\/(?:document|file)\/d\/(?:e\/)?([a-zA-Z0-9_-]{10,})/);
    if (m) return m[1].slice(0, 48);
    const qm = raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (qm) return qm[1].slice(0, 48);
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-48);
  }

  /**
   * Fast deterministic 32-bit FNV-1a hex hash (8 chars) so shared cache keys
   * automatically invalidate if a teacher edits their Google Doc text.
   */
  function computeTextHash8(text) {
    const str = String(text || "");
    if (!str) return "";
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  function buildSharedCacheSessionId(docKey, docText) {
    const cleanKey = String(docKey || "")
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 48);
    const hash = docText ? computeTextHash8(docText) : "";
    const rawId = hash ? `lessoncache_${cleanKey}_${hash}` : `lessoncache_${cleanKey}`;
    return rawId.slice(0, 120);
  }

  function saveLessonToLocalCache(cacheKey, lessonObj) {
    if (!isLocalCacheEnabled()) return;
    const serialized = JSON.stringify(lessonObj);
    try {
      localStorage.setItem(cacheKey, serialized);
      return;
    } catch (_quotaErr) {
      // Evict oldest cached lesson entries if localStorage is near quota, then retry
      try {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("snowday_lesson_")) {
            let savedAt = 0;
            try {
              const parsed = JSON.parse(localStorage.getItem(k) || "{}");
              savedAt = Number(parsed.savedAt) || 0;
            } catch (_e) {}
            entries.push({ key: k, savedAt });
          }
        }
        entries.sort((a, b) => a.savedAt - b.savedAt);
        for (let i = 0; i < Math.ceil(entries.length / 2); i++) {
          localStorage.removeItem(entries[i].key);
        }
        localStorage.setItem(cacheKey, serialized);
      } catch (_e2) {}
    }
  }

  function listRecentCachedLessons() {
    const found = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(LESSON_CACHE_PREFIX)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sampleDocUrl && parsed.meta && parsed.meta.lessonTitle) {
          found.push(parsed);
        }
      }
    } catch (_e) {}
    found.sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
    return found.slice(0, 5);
  }

  // In-memory store for files uploaded directly by teacher in this browser session
  const uploadedDocsMemory = new Map();

  async function decompressRawWeb(compressedBytes) {
    if (typeof DecompressionStream === "function") {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(compressedBytes);
      writer.close();
      const chunks = [];
      const reader = ds.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((a, b) => a + b.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return out;
    }
    throw new Error("DecompressionStream is not available.");
  }

  function findZipEntryInBytes(bytes, targetName) {
    let pos = 0;
    while (pos < bytes.length - 30) {
      if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4b && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
        const compMethod = bytes[pos + 8] | (bytes[pos + 9] << 8);
        const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
        const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
        const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
        const nameBytes = bytes.slice(pos + 30, pos + 30 + nameLen);
        const name = new TextDecoder("utf-8").decode(nameBytes);
        const dataOffset = pos + 30 + nameLen + extraLen;
        if (name === targetName) {
          return { compMethod, data: bytes.slice(dataOffset, dataOffset + compSize) };
        }
        pos = dataOffset + compSize;
      } else {
        pos++;
      }
    }
    return null;
  }

  function extractDocxXmlTextWeb(xml) {
    const paragraphs = [];
    const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[0];
      const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let tMatch;
      let pText = "";
      while ((tMatch = tRegex.exec(pContent)) !== null) {
        pText += tMatch[1];
      }
      if (pText.trim()) paragraphs.push(pText.trim());
    }
    return paragraphs.join("\n\n");
  }

  async function extractTextFromDocxWeb(arrayBuffer) {
    if (window.mammoth && typeof window.mammoth.extractRawText === "function") {
      try {
        const res = await window.mammoth.extractRawText({ arrayBuffer });
        if (res && res.value && res.value.trim()) return res.value.trim();
      } catch (_e) {}
    }
    const bytes = new Uint8Array(arrayBuffer);
    const entry = findZipEntryInBytes(bytes, "word/document.xml");
    if (!entry) throw new Error("Could not find word/document.xml inside DOCX file.");
    let xmlBytes;
    if (entry.compMethod === 0) {
      xmlBytes = entry.data;
    } else if (entry.compMethod === 8) {
      xmlBytes = await decompressRawWeb(entry.data);
    } else {
      throw new Error("Unsupported DOCX compression method: " + entry.compMethod);
    }
    const xml = new TextDecoder("utf-8").decode(xmlBytes);
    return extractDocxXmlTextWeb(xml);
  }

  async function extractTextFromPdfWeb(arrayBuffer) {
    if (window.pdfjsLib) {
      try {
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pagesText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageStr = content.items.map((item) => item.str).join(" ");
          if (pageStr.trim()) pagesText.push(pageStr.trim());
        }
        const combined = pagesText.join("\n\n").trim();
        if (combined) return combined;
      } catch (_e) {}
    }

    // Pure JS stream decoder fallback
    const bytes = new Uint8Array(arrayBuffer);
    const latin1 = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
    const textParts = [];
    const tjRegex = /\(([\s\S]*?)\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(latin1)) !== null) {
      const s = m[1].replace(/\\([()\\])/g, "$1").trim();
      if (s) textParts.push(s);
    }
    const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrRegex.exec(latin1)) !== null) {
      const inner = m[1];
      const subRegex = /\(([\s\S]*?)\)/g;
      let sm;
      let combined = "";
      while ((sm = subRegex.exec(inner)) !== null) {
        combined += sm[1].replace(/\\([()\\])/g, "$1");
      }
      if (combined.trim()) textParts.push(combined.trim());
    }

    // Try decompressing flate streams
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let sm;
    while ((sm = streamRegex.exec(latin1)) !== null) {
      const startIdx = sm.index + (sm[0].startsWith("stream\r\n") ? 8 : 7);
      const endIdx = startIdx + sm[1].length;
      const streamBytes = bytes.slice(startIdx, endIdx);
      try {
        const decompressed = await decompressRawWeb(streamBytes);
        const decStr = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);
        let tm;
        const decTj = /\(([\s\S]*?)\)\s*Tj/g;
        while ((tm = decTj.exec(decStr)) !== null) {
          const s = tm[1].replace(/\\([()\\])/g, "$1").trim();
          if (s) textParts.push(s);
        }
      } catch (_err) {}
    }

    const clean = textParts.join(" ").replace(/\s{2,}/g, " ").trim();
    if (!clean) {
      throw new Error("Could not extract readable text from PDF.");
    }
    return clean;
  }

  async function extractFileText(fileOrBuffer, fileName = "") {
    let buf;
    let name = fileName;
    if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
      name = fileOrBuffer.name || fileName || "lesson_file";
      buf = await fileOrBuffer.arrayBuffer();
    } else {
      buf = fileOrBuffer;
    }

    const ext = (name.split(".").pop() || "").toLowerCase();
    const bytes = new Uint8Array(buf);
    const head = String.fromCharCode(...bytes.slice(0, 8));

    let detectedFormat = "txt";
    if (ext === "pdf" || head.startsWith("%PDF-")) detectedFormat = "pdf";
    else if (ext === "docx" || (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) detectedFormat = "docx";
    else if (ext === "txt") detectedFormat = "txt";

    let text = "";
    if (detectedFormat === "pdf") {
      text = await extractTextFromPdfWeb(buf);
    } else if (detectedFormat === "docx") {
      text = await extractTextFromDocxWeb(buf);
    } else {
      text = new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/^\uFEFF/, "").trim();
    }

    text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return { name, format: detectedFormat, text };
  }

  /**
   * Fetches UTF-8 plain text from a teacher's shared Google Doc, Google Drive file,
   * uploaded local file, or direct document link.
   */
  async function fetchPublicGoogleDocText(docUrl) {
    if (!docUrl) return { ok: false, reason: "empty_url" };

    // 1. Check in-memory or sessionStorage uploaded doc
    const docKey = extractDocCacheKey(docUrl);
    if (uploadedDocsMemory.has(docUrl)) {
      const up = uploadedDocsMemory.get(docUrl);
      return { ok: true, text: up.text, format: up.format };
    }
    try {
      const stored = sessionStorage.getItem("snowday_uploaded_doc_" + docKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.text) {
          uploadedDocsMemory.set(docUrl, parsed);
          return { ok: true, text: parsed.text, format: parsed.format };
        }
      }
    } catch (_e) {}

    // 2. Published-to-web Google Doc
    const pubMatch = String(docUrl).match(/docs\.google\.com\/document\/d\/e\/([a-zA-Z0-9_-]+)/i);
    if (pubMatch) {
      try {
        const res = await fetch("https://docs.google.com/document/d/e/" + pubMatch[1] + "/pub", {
          credentials: "omit"
        });
        if (res.ok) {
          const html = await res.text();
          const clean = decodeHtmlEntities(html).slice(0, 42000);
          if (clean) return { ok: true, text: clean, format: "gdoc" };
        }
      } catch (_e) {}
    }

    // 3. Google Doc /export?format=txt
    const idMatch = String(docUrl).match(/\/document\/d\/(?!e\/)([a-zA-Z0-9_-]{15,})/);
    if (idMatch) {
      const docId = idMatch[1];
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      try {
        const res = await fetch(exportUrl, { method: "GET", credentials: "omit" });
        if (res.status === 401 || res.status === 403) return { ok: false, reason: "private" };
        if (res.status === 404) return { ok: false, reason: "not_found" };

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        const rawText = await res.text();
        if (
          contentType.includes("text/html") ||
          /^\s*<!doctype\s+html/i.test(rawText) ||
          /^\s*<html/i.test(rawText)
        ) {
          return { ok: false, reason: "private" };
        }
        if (!res.ok) return { ok: false, reason: "http_" + res.status };

        const cleaned = rawText
          .replace(/^\uFEFF/, "")
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
          .slice(0, 42000);

        if (!cleaned) return { ok: false, reason: "empty" };
        return { ok: true, text: cleaned, format: "gdoc" };
      } catch (_err) {
        return { ok: false, reason: "cors_or_network" };
      }
    }

    // 4. Google Drive file (/file/d/<id>)
    const driveMatch = String(docUrl).match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      // Try doc export first in case it is a Google Doc opened through Drive
      try {
        const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
        const res = await fetch(exportUrl, { method: "GET", credentials: "omit" });
        const cType = (res.headers.get("content-type") || "").toLowerCase();
        if (res.ok && !cType.includes("text/html")) {
          const rawText = await res.text();
          const clean = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 42000);
          if (clean) return { ok: true, text: clean, format: "gdoc" };
        }
      } catch (_e) {}

      // If browser CORS prevents direct fetch of Drive PDF/DOCX/TXT, return cors_or_network
      // so AI Agent server custom tool (which has no CORS restrictions) downloads and analyzes it!
      return { ok: false, reason: "cors_or_network", fileId };
    }

    // 5. Direct URL to .pdf, .docx, or .txt
    try {
      const parsed = new URL(docUrl);
      const path = parsed.pathname.toLowerCase();
      if (path.endsWith(".pdf") || path.endsWith(".docx") || path.endsWith(".txt")) {
        const res = await fetch(docUrl, { credentials: "omit" });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const extracted = await extractFileText(buf, parsed.pathname.split("/").pop());
          if (extracted && extracted.text) {
            return { ok: true, text: extracted.text, format: extracted.format };
          }
        }
      }
    } catch (_e) {}

    return { ok: false, reason: "unsupported_direct_export" };
  }

  function bi(obj, fallbackKa, fallbackEn) {
    if (!obj) return { ka: fallbackKa || "", en: fallbackEn || fallbackKa || "" };
    if (typeof obj === "string") return { ka: obj, en: obj };
    const ka = String(obj.ka || obj.en || fallbackKa || "").trim();
    const en = String(obj.en || obj.ka || fallbackEn || ka).trim();
    return { ka, en };
  }

  function biArr(obj, fallbackKaArr, fallbackEnArr) {
    if (Array.isArray(obj)) {
      const clean = obj.map((x) => String(x)).filter(Boolean);
      return { ka: clean, en: clean };
    }
    const ka = Array.isArray(obj && obj.ka)
      ? obj.ka.map((x) => String(x)).filter(Boolean)
      : fallbackKaArr || [];
    const en = Array.isArray(obj && obj.en)
      ? obj.en.map((x) => String(x)).filter(Boolean)
      : fallbackEnArr || ka;
    return { ka: ka.length ? ka : en, en: en.length ? en : ka };
  }

  function parseAndNormalizeLessonJson(rawReply, docUrl) {
    let cleaned = String(rawReply || "").trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("AI response did not contain a valid JSON lesson object.");
    }
    const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonSlice);

    if (parsed.error) {
      const errObj = bi(
        parsed.error,
        "მასწავლებლის Google Doc ვერ წაიკითხა. შეამოწმეთ გაზიარების უფლებები.",
        "Could not read the teacher's Google Doc. Check Share permissions."
      );
      const err = new Error(errObj[currentLang] || errObj.ka);
      err.bilingual = errObj;
      throw err;
    }

    if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      throw new Error("Generated lesson JSON contained zero learning cards.");
    }

    const metaIn = parsed.meta || {};
    const guideIn = parsed.studyGuide || {};

    const cards = parsed.cards.map((c, idx) => {
      const accent = ALLOWED_ACCENTS.has(c.accent)
        ? c.accent
        : ["royal", "amber", "forest", "teal", "terracotta", "slate"][idx % 6];
      const title = bi(c.title, "სასწავლო ბარათი " + (idx + 1), "Learning Card " + (idx + 1));
      return {
        id: String(c.id || "card-" + (idx + 1)),
        chip: bi(c.chip, title.ka.slice(0, 22), title.en.slice(0, 22)),
        title,
        category: bi(c.category, "სასწავლო თემა", "Lesson Topic"),
        sourceTag: c.sourceTag === "doc+field" ? "doc+field" : "doc",
        accent,
        summary: bi(c.summary, "", ""),
        facts: biArr(c.facts, [], []),
        studyTip: bi(c.studyTip, "", ""),
        keywords: Array.isArray(c.keywords) ? c.keywords.map(String) : []
      };
    });

    const glossary = Array.isArray(parsed.glossary)
      ? parsed.glossary
          .map((g) => ({
            term: bi(g.term, "", ""),
            definition: bi(g.definition, "", "")
          }))
          .filter((g) => g.term.ka || g.term.en)
      : [];

    const quiz = Array.isArray(parsed.quiz)
      ? parsed.quiz
          .map((q, idx) => {
            const opts = biArr(
              q.options,
              ["ვარიანტი ა", "ვარიანტი ბ", "ვარიანტი გ"],
              ["Option A", "Option B", "Option C"]
            );
            const cIdx = Math.min(2, Math.max(0, parseInt(q.correctIndex, 10) || 0));
            return {
              id: String(q.id || "q" + (idx + 1)),
              cardId: String(q.cardId || (cards[0] && cards[0].id) || "card-1"),
              question: bi(q.question, "", ""),
              options: {
                ka: opts.ka.slice(0, 3),
                en: opts.en.slice(0, 3)
              },
              correctIndex: cIdx,
              hint: bi(
                q.hint,
                "მინიშნება: გადახედე შესაბამის სასწავლო ბარათს და კიდევ ერთხელ სცადე!",
                "Hint: Review the matching learning card and try once more!"
              ),
              funFact: bi(q.funFact, "", "")
            };
          })
          .filter((q) => q.question.ka && q.options.ka.length === 3)
      : [];

    const defaultChipsKa = cards.slice(0, 4).map((c) => c.chip.ka).concat(["ჩათ-ქვიზი"]);
    const defaultChipsEn = cards.slice(0, 4).map((c) => c.chip.en).concat(["Chat Quiz"]);

    return {
      id: "generated-" + extractDocCacheKey(docUrl),
      sampleDocUrl: docUrl,
      savedAt: Date.now(),
      teacherDocRaw: bi(
        parsed.docExcerpt || parsed.teacherDocRaw,
        "წყარო Google Doc: " + docUrl,
        "Source Google Doc: " + docUrl
      ),
      meta: {
        subject: bi(metaIn.subject, "სასკოლო გაკვეთილი", "School Lesson"),
        gradeRange: bi(metaIn.gradeRange, "სკოლის კლასი", "School Grade"),
        lessonTitle: bi(metaIn.lessonTitle, cards[0].title.ka, cards[0].title.en),
        heroLead: bi(metaIn.heroLead, cards[0].summary.ka, cards[0].summary.en),
        teacherNote: bi(
          metaIn.teacherNote,
          "გაეცანით მასწავლებლის დოკუმენტზე დაფუძნებულ ბარათებს, ლექსიკონს და შეასრულეთ კითხვარი.",
          "Study the learning cards and glossary generated from your teacher's Google Doc, then complete the quiz."
        ),
        assistantName: bi(metaIn.assistantName, "გაკვეთილის AI რეპეტიტორი", "AI Lesson Tutor"),
        greeting: bi(
          metaIn.greeting,
          "გამარჯობა! მე ვარ დღევანდელი გაკვეთილის AI რეპეტიტორი. რა საკითხში დაგეხმარო?",
          "Hello! I am today's AI Lesson Tutor. What part of the lesson would you like help with?"
        ),
        quickReplies: biArr(metaIn.quickReplies, defaultChipsKa, defaultChipsEn)
      },
      studyGuide: {
        heading: bi(guideIn.heading, "როგორ იმუშაო დღევანდელ გაკვეთილზე", "How to Complete Today's Lesson"),
        summary: bi(
          guideIn.summary,
          "ეს გვერდი ავტომატურად დაგენერირდა მასწავლებლის Google Doc-ისა და საგნის მიხედვით.",
          "Automatically generated from your teacher's Google Doc and related subject curriculum."
        ),
        steps: biArr(
          guideIn.steps,
          [
            "წაიკითხე სასწავლო ბარათები.",
            "გადახედე რთულ სიტყვებს ლექსიკონში.",
            "ჰკითხე AI რეპეტიტორს და შეასრულე კითხვარი."
          ],
          [
            "Read the learning cards carefully.",
            "Review difficult terms in the glossary.",
            "Ask the AI Tutor questions and complete the quiz."
          ]
        )
      },
      cards,
      glossary,
      quiz
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatSafeMarkdownText(rawText) {
    const escaped = escapeHtml(rawText);
    const withLinks = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return withBold
      .split(/\n{2,}/)
      .map((para) => "<p>" + para.replace(/\n/g, "<br>") + "</p>")
      .join("");
  }

  function stripInternalLessonHeader(text) {
    let s = String(text || "");
    if (s.includes("[TEACHER_DOC_END]")) {
      s = s.replace(/^[\s\S]*?\[TEACHER_DOC_END\]\s*/, "");
    }
    return s.replace(/^\[LESSON_CONTEXT[\s\S]*?\]\s*/i, "").trim();
  }

  // =========================================================================
  // Static i18n, View Switching & Recent Cached Lessons
  // =========================================================================

  function applyStaticTranslations() {
    const t = UI_STRINGS[currentLang];
    document.documentElement.lang = currentLang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) {
        if (key === "howStep2" || key === "apiSettingsDesc") {
          el.innerHTML = t[key];
        } else {
          el.textContent = t[key];
        }
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (t[key] !== undefined) {
        el.setAttribute("placeholder", t[key]);
      }
    });

    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      const active = btn.getAttribute("data-lang-btn") === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    updateConnectionBadge();
    updateActiveDocRibbon();
    renderRecentCachedLessons();
    refreshStudioQrPreview();
  }

  function updateConnectionBadge() {
    const badge = document.getElementById("chatbot-mode-badge");
    if (!badge) return;
    const t = UI_STRINGS[currentLang];
    const hasLiveApi = Boolean(getEffectiveAgentBaseUrl());
    badge.textContent = hasLiveApi ? t.liveModeBadge : t.demoModeBadge;
    badge.classList.toggle("is-live", hasLiveApi);
  }

  function updateActiveDocRibbon() {
    const ribbon = document.getElementById("active-doc-ribbon");
    const mainNav = document.getElementById("main-nav");
    const cacheBadge = document.getElementById("cache-hit-badge");
    const formatBadge = document.getElementById("active-doc-format-badge");
    const extLink = document.getElementById("external-doc-link");
    const docModalLink = document.getElementById("doc-modal-external-link");
    const workspaceSec = document.getElementById("teacher-workspace-view");
    const isWorkspaceOpen = Boolean(workspaceSec && !workspaceSec.hidden);

    const hasLesson = Boolean(activeLesson && activeExternalDocUrl && !isWorkspaceOpen);
    if (ribbon) ribbon.hidden = !hasLesson;
    if (mainNav) mainNav.hidden = !hasLesson;
    if (cacheBadge) cacheBadge.hidden = !(hasLesson && loadedFromCache);

    if (formatBadge) {
      if (hasLesson) {
        const rawT = activeLesson.teacherDocRaw && (activeLesson.teacherDocRaw.ka || activeLesson.teacherDocRaw.en);
        const fmt = detectDocFormat(activeExternalDocUrl, rawT);
        formatBadge.hidden = false;
        formatBadge.className = "doc-format-badge is-" + fmt;
        formatBadge.textContent = fmt === "gdoc" ? "Google Doc" : fmt.toUpperCase();
      } else {
        formatBadge.hidden = true;
      }
    }

    if (extLink) {
      if (hasLesson && /^https?:\/\//i.test(activeExternalDocUrl)) {
        extLink.href = activeExternalDocUrl;
        extLink.hidden = false;
      } else {
        extLink.hidden = true;
      }
    }
    if (docModalLink) {
      if (hasLesson && /^https?:\/\//i.test(activeExternalDocUrl)) {
        docModalLink.href = activeExternalDocUrl;
        docModalLink.hidden = false;
      } else {
        docModalLink.hidden = true;
      }
    }

    syncHeaderNavLayout(true);
  }

  // =========================================================================
  // Responsive Single-Line Navbar & Popover Collapse (Modern Web Guidance)
  // =========================================================================

  let lastMeasuredHeaderWidth = 0;

  function ensurePopoverSupport() {
    if (typeof HTMLElement === "undefined") return;
    if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
      import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(() => {});
    }
  }

  function syncHeaderNavLayout(force) {
    const siteHeader = document.getElementById("site-header");
    const headerInner = document.getElementById("header-inner");
    const mainNav = document.getElementById("main-nav");
    const siteMenu = document.getElementById("site-menu");
    if (!siteHeader || !headerInner || !mainNav || !siteMenu) return;

    const currentWidth = headerInner.clientWidth;
    const isCurrentlyWide = siteHeader.classList.contains("is-wide");

    // Avoid thrashing when already collapsed and viewport only shrunk further
    if (!force && !isCurrentlyWide && currentWidth <= lastMeasuredHeaderWidth) {
      lastMeasuredHeaderWidth = currentWidth;
      return;
    }
    lastMeasuredHeaderWidth = currentWidth;

    if (mainNav.hidden) {
      siteHeader.classList.add("is-wide");
      siteMenu.removeAttribute("popover");
      return;
    }

    const wasOpen =
      siteMenu.hasAttribute("popover") &&
      siteMenu.matches(":is(:popover-open, .\\:popover-open)");

    siteHeader.classList.add("is-measuring", "is-wide");
    siteMenu.removeAttribute("popover");

    const fitsSingleLine = headerInner.scrollWidth <= headerInner.clientWidth + 1;

    if (fitsSingleLine) {
      siteHeader.classList.add("is-wide");
      siteMenu.removeAttribute("popover");
    } else {
      siteHeader.classList.remove("is-wide");
      siteMenu.setAttribute("popover", "auto");
      if (wasOpen && typeof siteMenu.showPopover === "function") {
        try {
          siteMenu.showPopover();
        } catch (_e) {}
      }
    }

    requestAnimationFrame(() => {
      siteHeader.classList.remove("is-measuring");
    });
  }

  function setupResponsiveNavbar() {
    ensurePopoverSupport();
    const siteHeader = document.getElementById("site-header");
    const siteMenu = document.getElementById("site-menu");
    if (!siteHeader || !siteMenu) return;

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        syncHeaderNavLayout(false);
      });
      ro.observe(siteHeader);
      ro.observe(siteMenu);
    } else {
      window.addEventListener("resize", () => syncHeaderNavLayout(true));
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => syncHeaderNavLayout(true)).catch(() => {});
    }

    // Close collapsed mobile popover automatically after selecting a section link
    siteMenu.querySelectorAll("a[href^='#']").forEach((link) => {
      link.addEventListener("click", () => {
        if (
          siteMenu.hasAttribute("popover") &&
          siteMenu.matches(":is(:popover-open, .\\:popover-open)") &&
          typeof siteMenu.hidePopover === "function"
        ) {
          try {
            siteMenu.hidePopover();
          } catch (_e) {}
        }
      });
    });

    // Active section indicator via IntersectionObserver
    if (typeof IntersectionObserver !== "undefined") {
      const sectionIds = ["tutor-section", "cards-section", "glossary-section", "quiz-section"];
      const navLinks = new Map();
      sectionIds.forEach((id) => {
        const a = siteMenu.querySelector(`a[href="#${id}"]`);
        if (a) navLinks.set(id, a);
      });

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              navLinks.forEach((link, id) => {
                if (id === entry.target.id) {
                  link.setAttribute("aria-current", "true");
                } else {
                  link.removeAttribute("aria-current");
                }
              });
            }
          });
        },
        { rootMargin: "-22% 0px -62% 0px", threshold: 0 }
      );

      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
  }

  function renderRecentCachedLessons() {
    const box = document.getElementById("recent-lessons-box");
    const listEl = document.getElementById("recent-lessons-list");
    if (!box || !listEl) return;

    const recents = listRecentCachedLessons();
    listEl.innerHTML = "";

    if (recents.length === 0) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    recents.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "recent-lesson-btn";

      const metaDiv = document.createElement("div");
      metaDiv.className = "recent-lesson-meta";

      const titleStrong = document.createElement("strong");
      titleStrong.textContent = item.meta.lessonTitle[currentLang] || item.meta.lessonTitle.ka;

      const subSpan = document.createElement("span");
      subSpan.textContent = item.meta.subject[currentLang] || item.meta.subject.ka;

      metaDiv.appendChild(titleStrong);
      metaDiv.appendChild(subSpan);

      const arrowSpan = document.createElement("span");
      arrowSpan.setAttribute("aria-hidden", "true");
      arrowSpan.textContent = "→";

      btn.appendChild(metaDiv);
      btn.appendChild(arrowSpan);

      btn.addEventListener("click", () => {
        openDocUrlWithHistory(item.sampleDocUrl, false);
      });

      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function showLandingHub(clearUrlQuery, forceStudentView) {
    stopJumpinPolling();
    activeLesson = null;
    activeExternalDocUrl = "";
    loadedFromCache = false;

    if (clearUrlQuery) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("doc")) {
          url.searchParams.delete("doc");
          window.history.pushState({}, "", url.pathname + url.search);
        }
      } catch (_e) {}
    }

    if (
      !forceStudentView &&
      window.SnowDayTeacherAuth &&
      typeof window.SnowDayTeacherAuth.isAuthorizedTeacher === "function" &&
      window.SnowDayTeacherAuth.isAuthorizedTeacher() &&
      typeof window.SnowDayTeacherAuth.openWorkspaceView === "function"
    ) {
      window.SnowDayTeacherAuth.openWorkspaceView();
      return;
    }

    const wsEl = document.getElementById("teacher-workspace-view");
    if (wsEl) wsEl.hidden = true;
    document.getElementById("generation-loading").hidden = true;
    document.getElementById("generation-error").hidden = true;
    document.getElementById("lesson-portal-view").hidden = true;
    document.getElementById("landing-hub").hidden = false;

    updateActiveDocRibbon();
    renderRecentCachedLessons();
  }

  function returnToActiveLesson() {
    if (!activeLesson || !activeExternalDocUrl) {
      showLandingHub(false, false);
      return;
    }
    const wsEl = document.getElementById("teacher-workspace-view");
    if (wsEl) wsEl.hidden = true;
    document.getElementById("landing-hub").hidden = true;
    document.getElementById("lesson-portal-view").hidden = false;
    updateActiveDocRibbon();
  }

  function openDocUrlWithHistory(docUrl, forceRefresh) {
    const normalized = normalizeGoogleDocUrl(docUrl);
    if (!normalized) return;
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("doc", normalized);
      window.history.pushState({}, "", nextUrl.pathname + nextUrl.search);
    } catch (_e) {}
    loadLessonFromDocParam(normalized, Boolean(forceRefresh));
  }

  // =========================================================================
  // Render Active Lesson Portal (Hero, Cards, Glossary, Quiz, Chat)
  // =========================================================================

  function renderLessonPortal(resetQuizAndChat) {
    if (!activeLesson) return;
    const lang = currentLang;

    const wsEl = document.getElementById("teacher-workspace-view");
    if (wsEl) wsEl.hidden = true;
    document.getElementById("landing-hub").hidden = true;
    document.getElementById("lesson-portal-view").hidden = false;

    // Hero & Study Guide
    document.getElementById("lesson-subject-pill").textContent = activeLesson.meta.subject[lang];
    document.getElementById("lesson-grade-pill").textContent = activeLesson.meta.gradeRange[lang];
    document.getElementById("lesson-title").textContent = activeLesson.meta.lessonTitle[lang];
    document.getElementById("lesson-hero-lead").textContent = activeLesson.meta.heroLead[lang];
    document.getElementById("lesson-teacher-note").textContent = activeLesson.meta.teacherNote[lang];

    document.getElementById("guide-card-heading").textContent = activeLesson.studyGuide.heading[lang];
    document.getElementById("guide-card-summary").textContent = activeLesson.studyGuide.summary[lang];

    const stepsList = document.getElementById("guide-steps-list");
    stepsList.innerHTML = "";
    (activeLesson.studyGuide.steps[lang] || []).forEach((stepText) => {
      const li = document.createElement("li");
      li.textContent = stepText;
      stepsList.appendChild(li);
    });

    // Tutor section titles
    document.getElementById("tutor-heading").textContent = activeLesson.meta.assistantName[lang];
    document.getElementById("chat-tutor-name").textContent = activeLesson.meta.assistantName[lang];

    // Doc viewer text
    const docPre = document.getElementById("doc-viewer-pre");
    if (docPre && activeLesson.teacherDocRaw) {
      docPre.textContent = activeLesson.teacherDocRaw[lang] || activeLesson.teacherDocRaw.ka || "";
    }

    // Cards kicker
    const count = activeLesson.cards.length;
    document.getElementById("cards-kicker").textContent =
      lang === "ka" ? `სასწავლო მასალა · ${count} ბარათი` : `Study Material · ${count} Cards`;

    renderCardsGrid();
    renderGlossary();

    if (resetQuizAndChat) {
      pageQuizIndex = 0;
      pageQuizWrongTries = 0;
      pageQuizResolved = false;
      pageQuizScore = 0;
      pageQuizScoredSet = new Set();
      localChatActiveQuiz = null;
      localChatQuizWrongTries = 0;
      initChatForActiveLesson();
    } else {
      renderChatSuggestions();
    }

    renderPageQuiz();
    updateActiveDocRibbon();

    if (activeExternalDocUrl) {
      window.dispatchEvent(
        new CustomEvent("snowday:lessonloaded", {
          detail: {
            docUrl: activeExternalDocUrl,
            docKey: extractDocCacheKey(activeExternalDocUrl),
            lesson: activeLesson
          }
        })
      );
    }
  }

  function renderCardsGrid() {
    const grid = document.getElementById("cards-grid");
    if (!grid || !activeLesson) return;
    const lang = currentLang;
    const t = UI_STRINGS[lang];
    const q = searchQuery.trim().toLowerCase();

    const filtered = activeLesson.cards.filter((card) => {
      if (!q) return true;
      const haystack = [
        card.title.ka,
        card.title.en,
        card.category.ka,
        card.category.en,
        card.summary.ka,
        card.summary.en,
        ...(card.facts.ka || []),
        ...(card.facts.en || []),
        ...(card.keywords || [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    grid.innerHTML = "";

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = t.noCardsMatch;
      grid.appendChild(empty);
      return;
    }

    filtered.forEach((card) => {
      const article = document.createElement("article");
      article.className = "learning-card";
      article.setAttribute("data-accent", card.accent || "royal");

      const header = document.createElement("header");
      const metaRow = document.createElement("div");
      metaRow.className = "card-meta-row";

      const catSpan = document.createElement("span");
      catSpan.className = "card-category";
      catSpan.textContent = card.category[lang];

      const srcSpan = document.createElement("span");
      const isEnriched = card.sourceTag === "doc+field";
      srcSpan.className = "card-source-badge" + (isEnriched ? " is-enriched" : "");
      srcSpan.textContent = isEnriched ? t.sourceTagEnriched : t.sourceTagDoc;

      metaRow.appendChild(catSpan);
      metaRow.appendChild(srcSpan);

      const h3 = document.createElement("h3");
      h3.textContent = card.title[lang];

      header.appendChild(metaRow);
      header.appendChild(h3);

      const contentDiv = document.createElement("div");
      contentDiv.className = "card-content";

      if (card.summary[lang]) {
        const sumP = document.createElement("p");
        sumP.className = "card-summary";
        sumP.textContent = card.summary[lang];
        contentDiv.appendChild(sumP);
      }

      const ul = document.createElement("ul");
      ul.className = "card-facts";
      (card.facts[lang] || []).forEach((f) => {
        const li = document.createElement("li");
        li.textContent = f;
        ul.appendChild(li);
      });
      contentDiv.appendChild(ul);

      if (card.studyTip && card.studyTip[lang]) {
        const tipP = document.createElement("p");
        tipP.className = "card-tip-note";
        const strong = document.createElement("strong");
        strong.textContent = t.studyTipPrefix + " ";
        tipP.appendChild(strong);
        tipP.appendChild(document.createTextNode(card.studyTip[lang]));
        contentDiv.appendChild(tipP);
      }

      const footer = document.createElement("footer");
      const askBtn = document.createElement("button");
      askBtn.type = "button";
      askBtn.className = "btn btn-secondary btn-small";
      askBtn.textContent = t.askAboutCardBtn;
      const srSpan = document.createElement("span");
      srSpan.className = "visually-hidden";
      srSpan.textContent = " — " + card.title[lang];
      askBtn.appendChild(srSpan);

      askBtn.addEventListener("click", () => {
        const prompt =
          lang === "ka"
            ? `ამიხსენი უფრო მარტივად: ${card.title.ka}`
            : `Explain this topic simply: ${card.title.en}`;
        document.getElementById("tutor-section").scrollIntoView({ behavior: "smooth" });
        handleUserChatSubmit(prompt);
      });
      footer.appendChild(askBtn);

      article.appendChild(header);
      article.appendChild(contentDiv);
      article.appendChild(footer);
      grid.appendChild(article);
    });
  }

  function renderGlossary() {
    const dl = document.getElementById("glossary-grid");
    if (!dl || !activeLesson) return;
    const lang = currentLang;
    dl.innerHTML = "";

    (activeLesson.glossary || []).forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "glossary-item";
      const dt = document.createElement("dt");
      dt.textContent = item.term[lang];
      const dd = document.createElement("dd");
      dd.textContent = item.definition[lang];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });
  }

  // Standalone 3-Option Questionnaire
  function renderPageQuiz() {
    if (!activeLesson || !activeLesson.quiz || activeLesson.quiz.length === 0) return;
    const lang = currentLang;
    const quizList = activeLesson.quiz;
    const total = quizList.length;
    if (pageQuizIndex >= total) pageQuizIndex = 0;

    const qItem = quizList[pageQuizIndex];
    const progressEl = document.getElementById("quiz-progress");
    const scoreEl = document.getElementById("quiz-score-pill");
    const qTextEl = document.getElementById("quiz-question-text");
    const optsEl = document.getElementById("quiz-options");
    const feedbackEl = document.getElementById("quiz-feedback");

    progressEl.textContent =
      lang === "ka"
        ? `კითხვა ${pageQuizIndex + 1} / ${total}`
        : `Question ${pageQuizIndex + 1} of ${total}`;
    scoreEl.textContent =
      lang === "ka" ? `ქულა: ${pageQuizScore} / ${total}` : `Score: ${pageQuizScore} / ${total}`;

    qTextEl.textContent = qItem.question[lang];
    optsEl.innerHTML = "";
    feedbackEl.hidden = true;
    feedbackEl.className = "quiz-feedback";

    const labels = OPTION_LABELS[lang];
    (qItem.options[lang] || []).forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option-btn";

      const badge = document.createElement("span");
      badge.className = "option-letter";
      badge.textContent = labels[idx] || String(idx + 1);

      const textSpan = document.createElement("span");
      textSpan.textContent = optText;

      btn.appendChild(badge);
      btn.appendChild(textSpan);

      btn.addEventListener("click", () => handlePageQuizChoice(idx, btn));
      optsEl.appendChild(btn);
    });
  }

  function handlePageQuizChoice(chosenIdx, clickedBtn) {
    if (pageQuizResolved || !activeLesson) return;
    const lang = currentLang;
    const qItem = activeLesson.quiz[pageQuizIndex];
    const feedbackEl = document.getElementById("quiz-feedback");
    const allBtns = document.querySelectorAll("#quiz-options .quiz-option-btn");

    if (chosenIdx === qItem.correctIndex) {
      pageQuizResolved = true;
      if (!pageQuizScoredSet.has(qItem.id) && pageQuizWrongTries === 0) {
        pageQuizScore++;
        pageQuizScoredSet.add(qItem.id);
      } else if (!pageQuizScoredSet.has(qItem.id)) {
        pageQuizScoredSet.add(qItem.id);
      }
      clickedBtn.classList.add("is-correct");
      allBtns.forEach((b) => (b.disabled = true));

      const praise = lang === "ka" ? "სწორია! ყოჩაღ! " : "Correct! Great job! ";
      feedbackEl.className = "quiz-feedback";
      feedbackEl.textContent = praise + (qItem.funFact[lang] || "");
      feedbackEl.hidden = false;

      document.getElementById("quiz-score-pill").textContent =
        lang === "ka"
          ? `ქულა: ${pageQuizScore} / ${activeLesson.quiz.length}`
          : `Score: ${pageQuizScore} / ${activeLesson.quiz.length}`;
    } else {
      pageQuizWrongTries++;
      clickedBtn.classList.add("is-wrong");
      clickedBtn.disabled = true;

      if (pageQuizWrongTries === 1) {
        feedbackEl.className = "quiz-feedback is-hint";
        feedbackEl.textContent = qItem.hint[lang];
        feedbackEl.hidden = false;
      } else {
        pageQuizResolved = true;
        pageQuizScoredSet.add(qItem.id);
        allBtns.forEach((b, i) => {
          b.disabled = true;
          if (i === qItem.correctIndex) b.classList.add("is-correct");
        });
        const rightOpt = qItem.options[lang][qItem.correctIndex];
        feedbackEl.className = "quiz-feedback";
        feedbackEl.textContent =
          lang === "ka"
            ? `სწორი პასუხია: „${rightOpt}“. ${qItem.funFact.ka || ""}`
            : `The right answer is: "${rightOpt}". ${qItem.funFact.en || ""}`;
        feedbackEl.hidden = false;
      }
    }
  }

  // =========================================================================
  // AI Lesson Tutor Chat (Geosoft Headless API + JumpIn + Local Fallback)
  // =========================================================================

  function stopJumpinPolling() {
    if (jumpinPollTimer) {
      clearInterval(jumpinPollTimer);
      jumpinPollTimer = null;
    }
  }

  function updateJumpinBanner() {
    const banner = document.getElementById("jumpin-banner");
    const cancelBtn = document.getElementById("cancel-handoff-btn");
    const titleEl = document.getElementById("jumpin-title");
    const t = UI_STRINGS[currentLang];

    if (chatStatus === "jumpin") {
      banner.hidden = false;
      titleEl.textContent = chatAssigned ? t.jumpinAssignedTitle : t.jumpinWaitingTitle;
      cancelBtn.hidden = Boolean(chatAssigned);
    } else {
      banner.hidden = true;
    }
  }

  function renderChatSuggestions() {
    const box = document.getElementById("chat-suggestions");
    if (!box || !activeLesson) return;
    box.innerHTML = "";
    const chips = activeLesson.meta.quickReplies[currentLang] || [];
    chips.forEach((chipText) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.textContent = chipText;
      btn.addEventListener("click", () => handleUserChatSubmit(chipText));
      box.appendChild(btn);
    });
  }

  function appendChatBubble(opts) {
    const container = document.getElementById("chat-messages");
    if (!container) return null;

    const div = document.createElement("div");
    const roleClass =
      opts.role === "user"
        ? "chat-msg-user"
        : opts.role === "human"
          ? "chat-msg-human"
          : "chat-msg-assistant";
    div.className = "chat-msg " + roleClass;

    if (opts.role === "human") {
      const tag = document.createElement("span");
      tag.className = "chat-role-tag";
      tag.textContent = "👩‍🏫 " + UI_STRINGS[currentLang].humanTeacherBadge;
      div.appendChild(tag);
    }

    const bodyWrap = document.createElement("div");
    if (opts.role === "user") {
      const p = document.createElement("p");
      p.textContent = stripInternalLessonHeader(opts.text);
      bodyWrap.appendChild(p);
    } else if (opts.allowHtml) {
      bodyWrap.innerHTML = opts.text;
    } else {
      bodyWrap.innerHTML = formatSafeMarkdownText(opts.text);
    }
    div.appendChild(bodyWrap);

    if (opts.sourceCardTitle) {
      const src = document.createElement("span");
      src.className = "chat-source-line";
      src.textContent = UI_STRINGS[currentLang].sourceLinePrefix + opts.sourceCardTitle;
      div.appendChild(src);
    }

    if (opts.role === "model" && opts.messageId && getEffectiveAgentBaseUrl()) {
      const fbRow = document.createElement("div");
      fbRow.className = "chat-feedback-row";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "feedback-btn";
      upBtn.textContent = "👍";
      upBtn.setAttribute("aria-label", "Helpful answer");

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "feedback-btn";
      downBtn.textContent = "👎";
      downBtn.setAttribute("aria-label", "Needs improvement");

      const sendRating = async (rating, activeBtn, otherBtn) => {
        activeBtn.classList.add("is-selected");
        otherBtn.classList.remove("is-selected");
        const baseUrl = getEffectiveAgentBaseUrl();
        if (!baseUrl || !sessionId) return;
        try {
          await fetch(baseUrl + "/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              messageId: opts.messageId,
              rating
            })
          });
        } catch (_e) {}
      };

      upBtn.addEventListener("click", () => sendRating("up", upBtn, downBtn));
      downBtn.addEventListener("click", () => sendRating("down", downBtn, upBtn));

      fbRow.appendChild(upBtn);
      fbRow.appendChild(downBtn);
      div.appendChild(fbRow);
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  async function syncRemoteConversation() {
    const baseUrl = getEffectiveAgentBaseUrl();
    if (!baseUrl || !sessionId || !activeLesson) return;

    try {
      const res = await fetch(`${baseUrl}/conversations/${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.messages) || data.messages.length === 0) return;

      chatStatus = data.status || "ai";
      const hasHumanMsg = data.messages.some((m) => m.role === "human");
      chatAssigned = Boolean(data.assigned || hasHumanMsg);
      updateJumpinBanner();

      if (chatStatus === "jumpin" && !jumpinPollTimer) {
        startJumpinPolling();
      } else if (chatStatus !== "jumpin") {
        stopJumpinPolling();
      }

      const container = document.getElementById("chat-messages");
      container.innerHTML = "";
      appendChatBubble({
        role: "model",
        text: activeLesson.meta.greeting[currentLang]
      });

      data.messages.forEach((m) => {
        appendChatBubble({
          role: m.role,
          text: m.text,
          allowHtml: Boolean(m.allowHtml),
          messageId: m.messageId
        });
      });
    } catch (_e) {}
  }

  function startJumpinPolling() {
    stopJumpinPolling();
    jumpinPollTimer = setInterval(() => {
      if (!document.hidden && chatStatus === "jumpin" && sessionId) {
        syncRemoteConversation();
      }
    }, POLL_INTERVAL_MS);
  }

  function initChatForActiveLesson() {
    stopJumpinPolling();
    chatStatus = "ai";
    chatAssigned = false;
    sessionId = loadStoredSessionId();
    updateJumpinBanner();

    const container = document.getElementById("chat-messages");
    container.innerHTML = "";
    appendChatBubble({
      role: "model",
      text: activeLesson.meta.greeting[currentLang]
    });
    renderChatSuggestions();

    if (sessionId && getEffectiveAgentBaseUrl()) {
      syncRemoteConversation();
    }
  }

  function buildFirstTurnContextPrefix() {
    const subj = activeLesson.meta.subject.ka;
    const title = activeLesson.meta.lessonTitle.ka;
    const rawTeacherNotes =
      activeLesson.teacherDocRaw && (activeLesson.teacherDocRaw.ka || activeLesson.teacherDocRaw.en)
        ? String(activeLesson.teacherDocRaw.ka || activeLesson.teacherDocRaw.en).trim()
        : "";

    if (activeExternalDocUrl && activeLesson.hasDirectDocText && rawTeacherNotes) {
      return (
        `[LESSON_CONTEXT docUrl="DEMO_INLINE_FETCHED_DOC" originalDocUrl="${activeExternalDocUrl}" subject="${subj}" title="${title}"]\n` +
        `[TEACHER_DOC_START]\n${rawTeacherNotes.slice(0, 14000)}\n[TEACHER_DOC_END]\n`
      );
    }

    const docRef = activeExternalDocUrl || activeLesson.sampleDocUrl || "lesson";
    return `[LESSON_CONTEXT docUrl="${docRef}" subject="${subj}" title="${title}"]\n`;
  }

  async function handleUserChatSubmit(rawMessage) {
    const trimmed = String(rawMessage || "").trim();
    if (!trimmed || chatLoading || !activeLesson) return;

    const inputEl = document.getElementById("chat-input");
    const submitBtn = document.getElementById("chat-submit-btn");
    if (inputEl && inputEl.value.trim() === trimmed) {
      inputEl.value = "";
    }

    appendChatBubble({ role: "user", text: trimmed });

    const baseUrl = getEffectiveAgentBaseUrl();
    if (!baseUrl) {
      respondWithLocalLessonAssistant(trimmed);
      return;
    }

    chatLoading = true;
    if (submitBtn) submitBtn.disabled = true;

    const loadingBubble = appendChatBubble({
      role: "model",
      text: UI_STRINGS[currentLang].thinkingText
    });

    const outboundMessage = !sessionId ? buildFirstTurnContextPrefix() + trimmed : trimmed;

    try {
      const payload = {
        message: outboundMessage,
        visitorId,
        pageUrl: window.location.href
      };
      if (sessionId) payload.sessionId = sessionId;

      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (loadingBubble) loadingBubble.remove();

      if (!res.ok) {
        throw new Error((data && data.error) || "HTTP " + res.status);
      }

      if (data.sessionId) {
        saveStoredSessionId(data.sessionId);
      }

      chatStatus = data.status || "ai";
      chatAssigned = Boolean(data.assigned);
      updateJumpinBanner();

      if (chatStatus === "jumpin") {
        startJumpinPolling();
      } else {
        stopJumpinPolling();
      }

      if (data.reply !== null && data.reply !== undefined && data.reply !== "") {
        appendChatBubble({
          role: "model",
          text: data.reply,
          allowHtml: Boolean(data.allowHtml),
          messageId: data.messageId || ""
        });
      } else if (chatStatus === "jumpin") {
        await syncRemoteConversation();
      }
    } catch (_err) {
      if (loadingBubble) loadingBubble.remove();
      respondWithLocalLessonAssistant(trimmed);
    } finally {
      chatLoading = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function detectMsgLanguage(text) {
    if (/[ა-ჰ]/.test(text)) return "ka";
    if (/[a-zA-Z]/.test(text)) {
      const latinGeorgianHints = /\b(ra|vin|aris|iyo|rogor|ratom|sad|rodis|kvizi)\b/i;
      if (latinGeorgianHints.test(text)) return "ka";
      return "en";
    }
    return currentLang;
  }

  function respondWithLocalLessonAssistant(userText) {
    if (!activeLesson) return;
    const replyLang = detectMsgLanguage(userText);
    const t = UI_STRINGS[replyLang];
    const lower = userText.toLowerCase();

    if (/\b\d{9}\b/.test(lower) || /@/.test(lower)) {
      appendChatBubble({ role: "model", text: t.privacyWarning });
      return;
    }

    if (/(ქვიზ|კითხვარ|შემამოწმე|quiz|test me)/i.test(lower)) {
      startLocalChatQuiz(replyLang);
      return;
    }

    for (const g of activeLesson.glossary || []) {
      const tKa = g.term.ka.toLowerCase();
      const tEn = g.term.en.toLowerCase();
      if ((tKa && lower.includes(tKa)) || (tEn && lower.includes(tEn))) {
        appendChatBubble({
          role: "model",
          text: `**${g.term[replyLang]}** — ${g.definition[replyLang]}`
        });
        return;
      }
    }

    const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
    let bestCard = null;
    let bestScore = 0;

    for (const card of activeLesson.cards) {
      let score = 0;
      const chipKa = card.chip.ka.toLowerCase();
      const chipEn = card.chip.en.toLowerCase();
      if (lower.includes(chipKa) || lower.includes(chipEn)) score += 6;
      if (lower.includes(card.title.ka.toLowerCase()) || lower.includes(card.title.en.toLowerCase())) {
        score += 8;
      }

      const blob = [
        card.title.ka,
        card.title.en,
        card.summary.ka,
        card.summary.en,
        ...(card.facts.ka || []),
        ...(card.facts.en || []),
        ...(card.keywords || [])
      ]
        .join(" ")
        .toLowerCase();

      tokens.forEach((tok) => {
        if (blob.includes(tok)) score += 2;
      });

      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    if (bestCard && bestScore >= 2) {
      const facts = (bestCard.facts[replyLang] || []).slice(0, 3).map((f) => "• " + f).join("\n");
      const reply = `**${bestCard.title[replyLang]}**\n${bestCard.summary[replyLang]}\n\n${facts}`;
      appendChatBubble({
        role: "model",
        text: reply,
        sourceCardTitle: bestCard.title[replyLang]
      });
      return;
    }

    if (/(გამარჯობა|სალამი|hello|hi\b|gamarjoba)/i.test(lower)) {
      appendChatBubble({
        role: "model",
        text: activeLesson.meta.greeting[replyLang]
      });
      return;
    }

    appendChatBubble({
      role: "model",
      text: t.fallbackNotInLesson
    });
  }

  function startLocalChatQuiz(lang) {
    if (!activeLesson.quiz || activeLesson.quiz.length === 0) return;
    localChatActiveQuiz = activeLesson.quiz[localChatQuizCursor % activeLesson.quiz.length];
    localChatQuizCursor++;
    localChatQuizWrongTries = 0;

    const q = localChatActiveQuiz;
    const bubble = appendChatBubble({
      role: "model",
      text: `**${lang === "ka" ? "სწრაფი კითხვა:" : "Quick Quiz:"}** ${q.question[lang]}`
    });

    const optsWrap = document.createElement("div");
    optsWrap.className = "chat-quiz-options";
    const labels = OPTION_LABELS[lang];

    (q.options[lang] || []).forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-quiz-btn";
      btn.textContent = `${labels[idx]}) ${optText}`;
      btn.addEventListener("click", () => {
        if (idx === q.correctIndex) {
          optsWrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
          appendChatBubble({
            role: "model",
            text:
              (lang === "ka" ? "სწორია! ყოჩაღ! " : "Correct! Well done! ") +
              (q.funFact[lang] || "")
          });
          localChatActiveQuiz = null;
        } else {
          btn.disabled = true;
          localChatQuizWrongTries++;
          if (localChatQuizWrongTries === 1) {
            appendChatBubble({ role: "model", text: q.hint[lang] });
          } else {
            optsWrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
            appendChatBubble({
              role: "model",
              text:
                lang === "ka"
                  ? `სწორი პასუხია: **${q.options.ka[q.correctIndex]}**. ${q.funFact.ka || ""}`
                  : `The correct answer is: **${q.options.en[q.correctIndex]}**. ${q.funFact.en || ""}`
            });
            localChatActiveQuiz = null;
          }
        }
      });
      optsWrap.appendChild(btn);
    });

    bubble.appendChild(optsWrap);
    const container = document.getElementById("chat-messages");
    container.scrollTop = container.scrollHeight;
  }

  // =========================================================================
  // Two-Tier Cached Google Doc Lesson Loader (`?doc=...`)
  //   Tier 1: Browser localStorage (0ms instant refresh)
  //   Tier 2: Shared Geosoft Conversation Cache (0 AI tokens across all students!)
  // =========================================================================

  async function tryFetchSharedServerCachedLesson(baseUrl, sharedCacheSessionId, normalizedDoc, fetchedDoc) {
    if (!isSharedServerCacheEnabled() || !baseUrl || !sharedCacheSessionId) return null;

    try {
      const res = await fetch(`${baseUrl}/conversations/${encodeURIComponent(sharedCacheSessionId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.messages) || data.messages.length === 0) return null;

      for (let i = data.messages.length - 1; i >= 0; i--) {
        const msg = data.messages[i];
        if (msg && msg.role === "model" && msg.text) {
          try {
            const lesson = parseAndNormalizeLessonJson(msg.text, normalizedDoc);
            if (fetchedDoc && fetchedDoc.ok && fetchedDoc.text) {
              lesson.teacherDocRaw = { ka: fetchedDoc.text, en: fetchedDoc.text };
              lesson.hasDirectDocText = true;
            }
            lesson.savedAt = Date.now();
            return lesson;
          } catch (_parseErr) {
            // Continue searching older model turns if any
          }
        }
      }
    } catch (_err) {}

    return null;
  }

  async function loadLessonFromDocParam(rawDocParam, forceRefresh) {
    const normalizedDoc = normalizeGoogleDocUrl(rawDocParam);
    const loadingCard = document.getElementById("generation-loading");
    const errorCard = document.getElementById("generation-error");
    const errorBody = document.getElementById("generation-error-body");

    errorCard.hidden = true;

    if (!normalizedDoc) {
      showLandingHub(false);
      errorBody.textContent =
        currentLang === "ka"
          ? "მითითებული ბმული არ არის სწორი Google Docs ან Drive ფაილის მისამართი. გთხოვთ, ჩასვათ სწორი ბმული."
          : "The provided URL is not a valid Google Docs or Drive file link. Please paste a valid share link.";
      errorCard.hidden = false;
      return;
    }

    activeExternalDocUrl = normalizedDoc;
    const docKey = extractDocCacheKey(normalizedDoc);
    const cacheKey = LESSON_CACHE_PREFIX + docKey;

    // TIER 1: Instant 0ms Browser localStorage Cache (page refresh / repeat visit)
    if (!forceRefresh && isLocalCacheEnabled()) {
      try {
        const cachedJson = localStorage.getItem(cacheKey);
        if (cachedJson) {
          const parsedCached = JSON.parse(cachedJson);
          if (parsedCached && Array.isArray(parsedCached.cards) && parsedCached.cards.length > 0) {
            activeLesson = parsedCached;
            loadedFromCache = true;
            renderLessonPortal(true);
            return;
          }
        }
      } catch (_e) {}
    }

    const baseUrl = getEffectiveAgentBaseUrl();
    if (!baseUrl) {
      showLandingHub(false);
      activeExternalDocUrl = normalizedDoc;
      errorBody.textContent = UI_STRINGS[currentLang].missingApiForDoc;
      errorCard.hidden = false;
      return;
    }

    const wsEl = document.getElementById("teacher-workspace-view");
    if (wsEl) wsEl.hidden = true;
    loadingCard.hidden = false;
    try {
      // 1. Fetch public Google Doc plain text via CORS (0 AI tokens)
      const fetchedDoc = await fetchPublicGoogleDocText(normalizedDoc);

      if (!fetchedDoc.ok) {
        if (fetchedDoc.reason === "private") {
          throw new Error(
            currentLang === "ka"
              ? "მასწავლებლის დოკუმენტი ან Drive ფაილი დახურულია. გახსენით ფაილი → Share (გაზიარება) → ჩართეთ 'Anyone with the link / ნებისმიერი მომხმარებელი ბმულით — მნახველი'."
              : "This document or Drive file is restricted. Open the file → click Share → set General access to 'Anyone with the link → Viewer'."
          );
        }
        if (fetchedDoc.reason === "not_found") {
          throw new Error(
            currentLang === "ka"
              ? "მითითებული დოკუმენტი ან Drive ფაილი ვერ მოიძებნა (404). გთხოვთ, გადაამოწმოთ ბმული."
              : "Document or Drive file not found (404). Please verify the shared URL."
          );
        }
        if (fetchedDoc.reason === "empty") {
          throw new Error(
            currentLang === "ka"
              ? "მასწავლებლის დოკუმენტი ცარიელია. დაამატეთ გაკვეთილის მასალა და სცადეთ ხელახლა."
              : "The teacher's document appears to be empty. Please add lesson content and try again."
          );
        }
      }

      const sharedCacheSessionId = buildSharedCacheSessionId(
        docKey,
        fetchedDoc.ok ? fetchedDoc.text : ""
      );

      // TIER 2: Cross-Student Shared Geosoft Server Cache (0 AI tokens if ANY student/teacher already generated this doc!)
      if (!forceRefresh) {
        const sharedCached = await tryFetchSharedServerCachedLesson(
          baseUrl,
          sharedCacheSessionId,
          normalizedDoc,
          fetchedDoc
        );
        if (sharedCached) {
          activeLesson = sharedCached;
          loadedFromCache = true;
          saveLessonToLocalCache(cacheKey, sharedCached);
          renderLessonPortal(true);
          return;
        }
      } else if (isSharedServerCacheEnabled()) {
        // Clear old shared cache entry before deliberate regeneration
        await fetch(
          `${baseUrl}/conversations/${encodeURIComponent(sharedCacheSessionId)}?visitorId=${encodeURIComponent(SHARED_CACHE_VISITOR_ID)}`,
          { method: "DELETE" }
        ).catch(() => {});
      }

      // 3. First-time AI Generation (stored under sharedCacheSessionId for reuse by everyone else!)
      const generationPrompt = fetchedDoc.ok
        ? `[[MODE:GENERATE_LESSON]]\ndocUrl: ${normalizedDoc}\nstatus: ALREADY_FETCHED_BY_CLIENT (use the exact teacher document content below directly; do NOT call Google Doc Lesson Reader)\n\nFetched Teacher Document Content (already retrieved directly):\n---\n${fetchedDoc.text}\n---`
        : `[[MODE:GENERATE_LESSON]]\ndocUrl: ${normalizedDoc}`;

      const chatPayload = {
        message: generationPrompt,
        visitorId: isSharedServerCacheEnabled() ? SHARED_CACHE_VISITOR_ID : visitorId,
        pageUrl: window.location.href
      };
      if (isSharedServerCacheEnabled()) {
        chatPayload.sessionId = sharedCacheSessionId;
      }

      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatPayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) || "HTTP " + res.status);
      }

      // If shared server cache is disabled, clean up temporary session; otherwise keep it so all future scans reuse it!
      if (!isSharedServerCacheEnabled() && data && data.sessionId) {
        fetch(
          `${baseUrl}/conversations/${encodeURIComponent(data.sessionId)}?visitorId=${encodeURIComponent(visitorId)}`,
          { method: "DELETE" }
        ).catch(() => {});
      }

      let generated;
      try {
        generated = parseAndNormalizeLessonJson(data.reply, normalizedDoc);
      } catch (parseErr) {
        // Never keep a failed/non-JSON response inside the shared cache session
        if (data && data.sessionId) {
          fetch(
            `${baseUrl}/conversations/${encodeURIComponent(data.sessionId)}?visitorId=${encodeURIComponent(chatPayload.visitorId)}`,
            { method: "DELETE" }
          ).catch(() => {});
        }
        throw parseErr;
      }

      if (fetchedDoc.ok && fetchedDoc.text) {
        generated.teacherDocRaw = {
          ka: fetchedDoc.text,
          en: fetchedDoc.text
        };
        generated.hasDirectDocText = true;
      }
      generated.savedAt = Date.now();

      activeLesson = generated;
      loadedFromCache = false;
      saveLessonToLocalCache(cacheKey, generated);
      renderLessonPortal(true);
    } catch (err) {
      if (!activeLesson) {
        document.getElementById("lesson-portal-view").hidden = true;
        document.getElementById("landing-hub").hidden = false;
        updateActiveDocRibbon();
      }
      errorBody.textContent = err instanceof Error ? err.message : String(err);
      errorCard.hidden = false;
    } finally {
      loadingCard.hidden = true;
    }
  }

  // =========================================================================
  // Teacher QR Studio & Landing QR Helpers
  // =========================================================================

  function buildStudentQrUrlForDoc(normalizedDoc, useCurrentOrigin) {
    const prodHost =
      (window.SNOWDAY_AGENT_CONFIG && window.SNOWDAY_AGENT_CONFIG.publicSiteBaseUrl) ||
      "https://answer.ge";

    let base = prodHost.replace(/\/+$/, "");
    if (useCurrentOrigin && window.location.protocol.startsWith("http")) {
      base =
        window.location.origin +
        window.location.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "");
    }

    return `${base}/?doc=${encodeURIComponent(normalizedDoc)}`;
  }

  function computeStudioQrLink() {
    const rawDoc = document.getElementById("qr-doc-url-input").value.trim();
    const normalizedDoc = normalizeGoogleDocUrl(rawDoc) || activeExternalDocUrl;
    if (!normalizedDoc) return "";

    const useCurrentOrigin = document.getElementById("target-current-host").checked;
    return buildStudentQrUrlForDoc(normalizedDoc, useCurrentOrigin);
  }

  function refreshStudioQrPreview() {
    const svgBox = document.getElementById("qr-svg-box");
    const urlText = document.getElementById("qr-encoded-url");
    const actionsRow = document.getElementById("studio-qr-actions");
    if (!svgBox || !window.SnowDayQR) return;

    const studentUrl = computeStudioQrLink();
    if (!studentUrl) {
      svgBox.innerHTML = `<div class="qr-empty-placeholder">${escapeHtml(UI_STRINGS[currentLang].qrEmptyPrompt)}</div>`;
      urlText.textContent = "";
      if (actionsRow) actionsRow.hidden = true;
      return;
    }

    urlText.textContent = studentUrl;
    if (actionsRow) actionsRow.hidden = false;
    try {
      svgBox.innerHTML = window.SnowDayQR.toSvgString(studentUrl, {
        pixelSize: 236,
        eccLevel: "M"
      });
    } catch (err) {
      svgBox.textContent = err.message;
    }
  }

  function requireTeacherOrPrompt(onAuthorized) {
    if (
      window.SnowDayTeacherAuth &&
      typeof window.SnowDayTeacherAuth.requireTeacherAccess === "function"
    ) {
      return window.SnowDayTeacherAuth.requireTeacherAccess(onAuthorized);
    }
    return false;
  }

  function openStudioModal(prefillDocUrl) {
    requireTeacherOrPrompt(() => {
      const dialog = document.getElementById("teacher-studio-dialog");
      const docInput = document.getElementById("qr-doc-url-input");
      const apiInput = document.getElementById("agent-base-url-input");
      const originLabel = document.getElementById("current-origin-text");

      if (originLabel && window.location.protocol.startsWith("http")) {
        originLabel.textContent = window.location.origin;
      }

      if (typeof prefillDocUrl === "string" && prefillDocUrl.trim()) {
        docInput.value = prefillDocUrl.trim();
      } else if (!docInput.value.trim() && activeExternalDocUrl) {
        docInput.value = activeExternalDocUrl;
      }

      if (apiInput) {
        apiInput.value = getEffectiveAgentBaseUrl();
      }

      refreshStudioQrPreview();
      if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
        dialog.showModal();
      }
    });
  }

  function downloadQrPngForUrl(studentUrl) {
    if (!studentUrl || !window.SnowDayQR) return false;
    const dataUrl = window.SnowDayQR.toPngDataUrl(studentUrl, { scale: 12, eccLevel: "M" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "answer-ge-lesson-qr.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  function setupDialogLightDismissFallback() {
    if (typeof HTMLDialogElement === "undefined") return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
      let pressedOutside = false;
      dialog.addEventListener("pointerdown", (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener("pointerup", (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    });
  }

  // =========================================================================
  // Event Listeners & Boot
  // =========================================================================

  function bindEvents() {
    // Brand logo & Switch Doc button -> return to Landing Hub
    const homeBrandLink = document.getElementById("home-brand-link");
    if (homeBrandLink) {
      homeBrandLink.addEventListener("click", (e) => {
        e.preventDefault();
        showLandingHub(true);
      });
    }

    const switchDocBtn = document.getElementById("switch-doc-btn");
    if (switchDocBtn) {
      switchDocBtn.addEventListener("click", () => {
        showLandingHub(true);
      });
    }

    // Browser Back/Forward navigation support
    window.addEventListener("popstate", () => {
      let docParam = "";
      try {
        docParam = new URLSearchParams(window.location.search).get("doc") || "";
      } catch (_e) {}
      if (docParam) {
        loadLessonFromDocParam(docParam, false);
      } else {
        showLandingHub(false);
      }
    });

    // Language switcher
    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextLang = btn.getAttribute("data-lang-btn");
        if (nextLang && nextLang !== currentLang) {
          currentLang = nextLang;
          applyStaticTranslations();
          if (activeLesson) {
            renderLessonPortal(false);
          }
          window.dispatchEvent(
            new CustomEvent("snowday:langchange", { detail: { lang: currentLang } })
          );
        }
      });
    });

    // Open full-page Teacher Workspace (or quick lesson QR modal from active hero)
    ["open-studio-btn", "footer-studio-btn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", () => {
          requireTeacherOrPrompt(() => {
            if (
              window.SnowDayTeacherAuth &&
              typeof window.SnowDayTeacherAuth.openWorkspaceView === "function"
            ) {
              window.SnowDayTeacherAuth.openWorkspaceView("create", activeExternalDocUrl);
            } else {
              openStudioModal();
            }
          });
        });
      }
    });

    const errStudioBtn = document.getElementById("error-open-studio-btn");
    if (errStudioBtn) {
      errStudioBtn.addEventListener("click", () => {
        requireTeacherOrPrompt(() => {
          if (
            window.SnowDayTeacherAuth &&
            typeof window.SnowDayTeacherAuth.openWorkspaceView === "function"
          ) {
            window.SnowDayTeacherAuth.openWorkspaceView("settings");
          } else {
            openStudioModal();
          }
        });
      });
    }

    const heroQrBtn = document.getElementById("hero-qr-btn");
    if (heroQrBtn) {
      heroQrBtn.addEventListener("click", () => openStudioModal(activeExternalDocUrl));
    }

    // Landing Hub — Student Form
    const studentForm = document.getElementById("landing-student-form");
    const studentInput = document.getElementById("landing-student-doc-input");
    const studentErr = document.getElementById("landing-student-error");

    if (studentInput && studentForm) {
      studentInput.addEventListener("input", () => {
        studentInput.setCustomValidity("");
        studentInput.removeAttribute("aria-invalid");
        studentErr.hidden = true;
      });

      studentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const normalized = normalizeGoogleDocUrl(studentInput.value);
        if (!normalized) {
          const msg =
            currentLang === "ka"
              ? "გთხოვთ, შეიყვანოთ სწორი Google Docs ან Drive (PDF, DOCX, TXT) ბმული."
              : "Please enter a valid Google Docs or Drive (PDF, DOCX, TXT) share URL.";
          studentInput.setCustomValidity(msg);
          studentInput.setAttribute("aria-invalid", "true");
          studentErr.textContent = msg;
          studentErr.hidden = false;
          studentInput.focus();
          return;
        }
        openDocUrlWithHistory(normalized, false);
      });
    }

    // Landing Hub — Teacher Form (Inline QR + Preview & Cache Warmup)
    const teacherForm = document.getElementById("landing-teacher-form");
    const teacherInput = document.getElementById("landing-teacher-doc-input");
    const teacherErr = document.getElementById("landing-teacher-error");
    const landingQrResult = document.getElementById("landing-qr-result");
    const landingQrSvg = document.getElementById("landing-qr-svg");
    const landingQrUrl = document.getElementById("landing-qr-url");
    const landingToast = document.getElementById("landing-copy-toast");

    const landingFileInput = document.getElementById("landing-teacher-file-input");
    const landingFileBtn = document.getElementById("landing-teacher-file-btn");
    const landingFileName = document.getElementById("landing-teacher-file-name");

    if (landingFileBtn && landingFileInput) {
      landingFileBtn.addEventListener("click", () => landingFileInput.click());
      landingFileInput.addEventListener("change", async () => {
        const file = landingFileInput.files && landingFileInput.files[0];
        if (!file) return;
        try {
          landingFileBtn.disabled = true;
          landingFileBtn.textContent = currentLang === "ka" ? "მუშავდება..." : "Processing...";
          const res = await extractFileText(file);
          const localUrl = "local:" + encodeURIComponent(file.name);
          uploadedDocsMemory.set(localUrl, res);
          try {
            sessionStorage.setItem("snowday_uploaded_doc_" + extractDocCacheKey(localUrl), JSON.stringify(res));
          } catch (_e) {}
          if (teacherInput) {
            teacherInput.value = localUrl;
            teacherInput.setCustomValidity("");
            teacherErr.hidden = true;
          }
          if (landingFileName) {
            landingFileName.textContent = `${res.format.toUpperCase()} · ${file.name}`;
            landingFileName.hidden = false;
          }
          lastLandingQrStudentUrl = buildStudentQrUrlForDoc(localUrl, window.location.hostname === "localhost");
          if (landingQrSvg && window.SnowDayQR) {
            landingQrSvg.innerHTML = window.SnowDayQR.toSvgString(lastLandingQrStudentUrl, { pixelSize: 210, eccLevel: "M" });
            if (landingQrUrl) landingQrUrl.textContent = lastLandingQrStudentUrl;
            if (landingQrResult) landingQrResult.hidden = false;
          }
          const studioInput = document.getElementById("qr-doc-url-input");
          if (studioInput) studioInput.value = localUrl;
        } catch (err) {
          alert((currentLang === "ka" ? "ფაილის წაკითხვა ვერ მოხერხდა: " : "Could not read file: ") + err.message);
        } finally {
          landingFileBtn.disabled = false;
          landingFileBtn.innerHTML = `📁 <span data-i18n="uploadFileBtn">${UI_STRINGS[currentLang].uploadFileBtn}</span>`;
        }
      });
    }

    const showLandingToast = (msg) => {
      if (!landingToast) return;
      landingToast.textContent = msg;
      setTimeout(() => {
        if (landingToast.textContent === msg) landingToast.textContent = "";
      }, 2600);
    };

    const validateLandingTeacherDoc = () => {
      const normalized = normalizeGoogleDocUrl(teacherInput.value);
      if (!normalized) {
        const msg =
          currentLang === "ka"
            ? "გთხოვთ, შეიყვანოთ სწორი Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთოთ ფაილი."
            : "Please enter a valid Google Docs, Drive (PDF, DOCX, TXT) share URL, or upload a file.";
        teacherInput.setCustomValidity(msg);
        teacherInput.setAttribute("aria-invalid", "true");
        teacherErr.textContent = msg;
        teacherErr.hidden = false;
        teacherInput.focus();
        return "";
      }
      return normalized;
    };

    if (teacherInput && teacherForm) {
      teacherInput.addEventListener("input", () => {
        teacherInput.setCustomValidity("");
        teacherInput.removeAttribute("aria-invalid");
        teacherErr.hidden = true;
      });

      teacherForm.addEventListener("submit", (e) => {
        e.preventDefault();
        requireTeacherOrPrompt(() => {
          const normalized = validateLandingTeacherDoc();
          if (!normalized) return;

          // Default to current host when testing locally on localhost, otherwise https://answer.ge
          const isLocalHost =
            window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          lastLandingQrStudentUrl = buildStudentQrUrlForDoc(normalized, isLocalHost);

          landingQrSvg.innerHTML = window.SnowDayQR.toSvgString(lastLandingQrStudentUrl, {
            pixelSize: 210,
            eccLevel: "M"
          });
          landingQrUrl.textContent = lastLandingQrStudentUrl;
          landingQrResult.hidden = false;

          // Sync Studio modal input as well
          const studioInput = document.getElementById("qr-doc-url-input");
          if (studioInput) studioInput.value = normalized;
        });
      });

      document.getElementById("landing-teacher-preview-btn").addEventListener("click", () => {
        requireTeacherOrPrompt(() => {
          const normalized = validateLandingTeacherDoc();
          if (!normalized) return;
          openDocUrlWithHistory(normalized, false);
        });
      });

      document.getElementById("landing-qr-download-btn").addEventListener("click", () => {
        if (downloadQrPngForUrl(lastLandingQrStudentUrl)) {
          showLandingToast(currentLang === "ka" ? "PNG ფაილი ჩამოიტვირთა!" : "QR PNG downloaded!");
        }
      });

      document.getElementById("landing-qr-copy-btn").addEventListener("click", async () => {
        if (!lastLandingQrStudentUrl) return;
        try {
          await navigator.clipboard.writeText(lastLandingQrStudentUrl);
          showLandingToast(currentLang === "ka" ? "მოსწავლის ბმული დაკოპირდა!" : "Student link copied!");
        } catch (_e) {
          showLandingToast(lastLandingQrStudentUrl);
        }
      });

      document.getElementById("landing-qr-studio-btn").addEventListener("click", () => {
        const normalized = normalizeGoogleDocUrl(teacherInput.value);
        openStudioModal(normalized);
      });
    }

    // Open Teacher Doc Text Viewer modal
    const viewDocBtn = document.getElementById("open-doc-preview-btn");
    if (viewDocBtn) {
      viewDocBtn.addEventListener("click", () => {
        const dlg = document.getElementById("doc-viewer-dialog");
        if (dlg && !dlg.open) dlg.showModal();
      });
    }

    // Regenerate / Retry external Google Doc
    const regenBtn = document.getElementById("regenerate-doc-btn");
    if (regenBtn) {
      regenBtn.addEventListener("click", () => {
        requireTeacherOrPrompt(() => {
          if (activeExternalDocUrl) loadLessonFromDocParam(activeExternalDocUrl, true);
        });
      });
    }
    const retryBtn = document.getElementById("error-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        if (activeExternalDocUrl) loadLessonFromDocParam(activeExternalDocUrl, true);
      });
    }

    // Card search filter
    const searchInput = document.getElementById("card-search-input");
    const searchForm = document.getElementById("card-filter-form");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value;
        renderCardsGrid();
      });
    }
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => e.preventDefault());
    }

    // Standalone Questionnaire Next & Restart
    document.getElementById("quiz-next-btn").addEventListener("click", () => {
      if (!activeLesson || !activeLesson.quiz.length) return;
      pageQuizIndex = (pageQuizIndex + 1) % activeLesson.quiz.length;
      pageQuizWrongTries = 0;
      pageQuizResolved = false;
      renderPageQuiz();
    });

    document.getElementById("quiz-restart-btn").addEventListener("click", () => {
      pageQuizIndex = 0;
      pageQuizWrongTries = 0;
      pageQuizResolved = false;
      pageQuizScore = 0;
      pageQuizScoredSet = new Set();
      renderPageQuiz();
    });

    // Chat submit & IME-safe Enter check
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleUserChatSubmit(chatInput.value);
    });
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        handleUserChatSubmit(chatInput.value);
      }
    });

    // Reset Chat
    document.getElementById("reset-chat-btn").addEventListener("click", () => {
      saveStoredSessionId("");
      initChatForActiveLesson();
    });

    // Cancel JumpIn Handoff
    document.getElementById("cancel-handoff-btn").addEventListener("click", async () => {
      const baseUrl = getEffectiveAgentBaseUrl();
      if (!baseUrl || !sessionId) return;
      try {
        const res = await fetch(`${baseUrl}/conversations/${encodeURIComponent(sessionId)}/cancel-handoff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId })
        });
        if (res.status === 409) {
          await syncRemoteConversation();
          return;
        }
        if (res.ok) {
          chatStatus = "ai";
          stopJumpinPolling();
          updateJumpinBanner();
        }
      } catch (_e) {}
    });

    // Studio Modal QR Generator Form & Live Controls
    const qrForm = document.getElementById("qr-generator-form");
    const docUrlInput = document.getElementById("qr-doc-url-input");
    const docErrorEl = document.getElementById("doc-url-error");

    docUrlInput.addEventListener("input", () => {
      docUrlInput.setCustomValidity("");
      docUrlInput.removeAttribute("aria-invalid");
      docErrorEl.hidden = true;
    });

    const qrFileInput = document.getElementById("qr-file-input");
    const qrFileBtn = document.getElementById("qr-upload-file-btn");
    const qrFileName = document.getElementById("qr-file-name");

    if (qrFileBtn && qrFileInput) {
      qrFileBtn.addEventListener("click", () => qrFileInput.click());
      qrFileInput.addEventListener("change", async () => {
        const file = qrFileInput.files && qrFileInput.files[0];
        if (!file) return;
        try {
          qrFileBtn.disabled = true;
          qrFileBtn.textContent = currentLang === "ka" ? "მუშავდება..." : "Processing...";
          const res = await extractFileText(file);
          const localUrl = "local:" + encodeURIComponent(file.name);
          uploadedDocsMemory.set(localUrl, res);
          try {
            sessionStorage.setItem("snowday_uploaded_doc_" + extractDocCacheKey(localUrl), JSON.stringify(res));
          } catch (_e) {}
          if (docUrlInput) {
            docUrlInput.value = localUrl;
            docUrlInput.setCustomValidity("");
            docErrorEl.hidden = true;
          }
          if (qrFileName) {
            qrFileName.textContent = `${res.format.toUpperCase()} · ${file.name}`;
            qrFileName.hidden = false;
          }
          refreshStudioQrPreview();
        } catch (err) {
          alert((currentLang === "ka" ? "ფაილის წაკითხვა ვერ მოხერხდა: " : "Could not read file: ") + err.message);
        } finally {
          qrFileBtn.disabled = false;
          qrFileBtn.innerHTML = `📁 <span data-i18n="uploadFileBtn">${UI_STRINGS[currentLang].uploadFileBtn}</span>`;
        }
      });
    }

    document.querySelectorAll('input[name="qrTarget"]').forEach((r) => {
      r.addEventListener("change", refreshStudioQrPreview);
    });

    qrForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const normalized = normalizeGoogleDocUrl(docUrlInput.value);
      if (!normalized) {
        const msg =
          currentLang === "ka"
            ? "გთხოვთ, შეიყვანოთ სწორი Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთოთ ფაილი."
            : "Please enter a valid Google Docs, Drive (PDF, DOCX, TXT) share URL, or upload a file.";
        docUrlInput.setCustomValidity(msg);
        docUrlInput.setAttribute("aria-invalid", "true");
        docErrorEl.textContent = msg;
        docErrorEl.hidden = false;
        docUrlInput.focus();
        return;
      }
      refreshStudioQrPreview();
    });

    document.getElementById("open-generated-lesson-btn").addEventListener("click", () => {
      const normalized = normalizeGoogleDocUrl(docUrlInput.value);
      if (!normalized) {
        qrForm.requestSubmit();
        return;
      }
      const dlg = document.getElementById("teacher-studio-dialog");
      if (dlg && dlg.open) dlg.close();
      openDocUrlWithHistory(normalized, false);
    });

    // Studio Download PNG, Copy Link, Print QR
    const toastEl = document.getElementById("copy-toast");
    const showToast = (msg) => {
      toastEl.textContent = msg;
      setTimeout(() => {
        if (toastEl.textContent === msg) toastEl.textContent = "";
      }, 2600);
    };

    document.getElementById("download-qr-png-btn").addEventListener("click", () => {
      const studentUrl = computeStudioQrLink();
      if (downloadQrPngForUrl(studentUrl)) {
        showToast(currentLang === "ka" ? "PNG ფაილი ჩამოიტვირთა!" : "QR PNG downloaded!");
      }
    });

    document.getElementById("copy-qr-link-btn").addEventListener("click", async () => {
      const studentUrl = computeStudioQrLink();
      if (!studentUrl) return;
      try {
        await navigator.clipboard.writeText(studentUrl);
        showToast(currentLang === "ka" ? "მოსწავლის ბმული დაკოპირდა!" : "Student link copied!");
      } catch (_e) {
        showToast(studentUrl);
      }
    });

    document.getElementById("print-qr-btn").addEventListener("click", () => {
      window.print();
    });

    // Geosoft Agent API Save & Test Ping
    document.getElementById("save-api-url-btn").addEventListener("click", () => {
      const apiInput = document.getElementById("agent-base-url-input");
      const statusEl = document.getElementById("api-ping-status");
      saveAndTestAgentBaseUrl(apiInput ? apiInput.value : "", statusEl);
    });

    document.getElementById("clear-cache-btn").addEventListener("click", () => {
      const statusEl = document.getElementById("api-ping-status");
      clearLocalLessonCache(statusEl);
    });
  }

  async function saveAndTestAgentBaseUrl(rawVal, statusEl) {
    const val = String(rawVal || "").trim().replace(/\/+$/, "");

    try {
      if (val) localStorage.setItem(API_URL_STORAGE_KEY, val);
      else localStorage.removeItem(API_URL_STORAGE_KEY);
    } catch (_e) {}

    updateConnectionBadge();
    if (!statusEl) return;

    if (!val) {
      statusEl.className = "api-ping-status";
      statusEl.textContent =
        currentLang === "ka" ? "API მისამართი გასუფთავდა." : "API URL override cleared.";
      return;
    }

    statusEl.className = "api-ping-status";
    statusEl.textContent = currentLang === "ka" ? "მოწმდება კავშირი..." : "Testing connection...";

    try {
      const res = await fetch(val);
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || "HTTP " + res.status);
      statusEl.className = "api-ping-status";
      statusEl.textContent =
        currentLang === "ka"
          ? `✓ წარმატებით დაუკავშირდა აგენტს: ${data.name || data.agentId}`
          : `✓ Connected to Geosoft Agent: ${data.name || data.agentId}`;
    } catch (err) {
      statusEl.className = "api-ping-status is-error";
      statusEl.textContent =
        (currentLang === "ka" ? "კავშირის შეცდომა: " : "Connection error: ") +
        (err instanceof Error ? err.message : String(err));
    }
  }

  function clearLocalLessonCache(statusEl) {
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("snowday_lesson_")) localStorage.removeItem(k);
      });
    } catch (_e) {}
    renderRecentCachedLessons();
    if (statusEl) {
      statusEl.className = "api-ping-status";
      statusEl.textContent =
        currentLang === "ka"
          ? "✓ გენერირებული გაკვეთილების ქეში გასუფთავდა."
          : "✓ Cached generated lessons cleared.";
    }
  }

  function init() {
    visitorId = getOrCreateVisitorId();
    setupDialogLightDismissFallback();
    setupResponsiveNavbar();
    bindEvents();
    applyStaticTranslations();

    let docParam = "";
    try {
      docParam = new URLSearchParams(window.location.search).get("doc") || "";
    } catch (_e) {}

    if (docParam) {
      loadLessonFromDocParam(docParam, false);
    } else {
      showLandingHub(false);
    }
  }

  window.SnowDayPortal = {
    getLang: () => currentLang,
    syncHeader: () => syncHeaderNavLayout(true),
    openStudioModal,
    normalizeGoogleDocUrl,
    normalizeDocumentUrl: normalizeGoogleDocUrl,
    detectDocFormat,
    extractDocCacheKey,
    extractFileText,
    setUploadedDoc: (url, data) => uploadedDocsMemory.set(url, data),
    getUploadedDoc: (url) => uploadedDocsMemory.get(url),
    buildStudentQrUrlForDoc,
    downloadQrPngForUrl,
    openDocUrlWithHistory,
    showLandingHub,
    returnToActiveLesson,
    getActiveLessonContext: () => ({
      hasLesson: Boolean(activeLesson && activeExternalDocUrl),
      docUrl: activeExternalDocUrl,
      docKey: activeExternalDocUrl ? extractDocCacheKey(activeExternalDocUrl) : "",
      lesson: activeLesson
    }),
    listRecentCachedLessons,
    getEffectiveAgentBaseUrl,
    saveAndTestAgentBaseUrl,
    clearLocalLessonCache
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
