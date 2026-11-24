/**
 * SnowDay Class (თოვლის დღის კლასი)
 * Teacher Username + Password Authentication, Mandatory One-Time Password Change,
 * Personal Lesson History Workspace & Full-Page Super Admin Panel
 * Powered by Firebase Auth + Cloud Run Firebase Admin API + Cloud Firestore Security Rules
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const AUTH_I18N = {
  ka: {
    headerSignInFull: "შესვლა (მასწავლებელი)",
    headerSignInShort: "შესვლა",
    headerSuperAdminFull: "ადმინ პანელი · ჩემი სივრცე",
    headerSuperAdminShort: "ადმინი",
    headerTeacherFull: "ჩემი პირადი სივრცე",
    headerTeacherShort: "სივრცე",
    headerMustChangeFull: "პაროლის შეცვლა სავალდებულოა",
    headerMustChangeShort: "პაროლი",
    headerUnauthorizedFull: "წვდომა შეზღუდულია",
    headerUnauthorizedShort: "სტატუსი",
    loadingAuth: "მოწმდება მასწავლებლის ავტორიზაცია...",

    // Login Form
    loginUsernameLabel: "მომხმარებლის სახელი (Username)",
    loginUsernamePlaceholder: "მაგ.: nino.beridze",
    loginPasswordLabel: "პაროლი",
    loginPasswordPlaceholder: "შეიყვანეთ თქვენი პაროლი",
    showPasswordBtn: "ჩვენება",
    hidePasswordBtn: "დამალვა",
    signInBtn: "შესვლა",
    signingInBtn: "მოწმდება...",
    signOutBtn: "გასვლა",
    forgotPasswordHint:
      "დაგავიწყდათ პაროლი? მიმართეთ სკოლის მთავარ ადმინისტრატორს ერთჯერადი პაროლის აღსადგენად.",

    openWorkspaceBtn: "ჩემს პირად სივრცეში გადასვლა →",
    openAdminPanelBtn: "ადმინ პანელის გახსნა",
    changePasswordBtn: "🔑 პაროლის შეცვლა",
    verifiedTeacherBadge: "✓ ავტორიზებული მასწავლებელი",
    verifiedAdminBadge: "★ მთავარი ადმინი (Super Admin)",
    mustChangeBadge: "🔒 ერთჯერადი პაროლი",
    unauthorizedBadge: "წვდომა შეზღუდულია",

    gateGuestTitle: "მასწავლებლის შესვლა (Username + პაროლი)",
    gateGuestDesc:
      "შედით მთავარი ადმინისტრატორის მიერ გადმოცემული მომხმარებლის სახელითა და პაროლით, რომ გახსნათ პირადი სივრცე და შექმნათ მოსწავლის QR კოდები.",
    gateStudentNote:
      "მოსწავლეებს ავტორიზაცია არ სჭირდებათ — გაკვეთილი იხსნება პირდაპირ QR კოდით ან მარცხენა ბარათიდან.",
    gateUnauthTitle: "ეს ანგარიში არ არის რეგისტრირებული მასწავლებლებში",
    gateUnauthBodyPrefix: "მომხმარებელი ",
    gateUnauthBodySuffix:
      " ვერ მოიძებნა სკოლის მასწავლებლების სიაში. მიმართეთ მთავარ ადმინისტრატორს.",

    authModalKicker: "მასწავლებლის ავტორიზაცია",
    authModalTitleGuest: "შესვლა მასწავლებლის ანგარიშით",
    authModalTitleMustChange: "შეცვალეთ ერთჯერადი პაროლი",
    authModalTitleVoluntaryChange: "პაროლის განახლება",
    authModalTitleUnauth: "წვდომა მხოლოდ რეგისტრირებული მასწავლებლებისთვის",

    // One-Time / Strong Password Change UI
    mustChangeTitle: "სავალდებულოა ერთჯერადი პაროლის შეცვლა",
    mustChangeDescFmt: (username) =>
      `თქვენ შეხვედით როგორც „${username}“ ადმინისტრატორის მიერ გენერირებული ერთჯერადი პაროლით. გასაგრძელებლად გთხოვთ, დააყენოთ თქვენი ახალი ძლიერი პაროლი.`,
    voluntaryChangeDescFmt: (username) =>
      `განაახლეთ ანგარიშის „${username}“ პაროლი. ახალი პაროლი უნდა აკმაყოფილებდეს უსაფრთხოების ყველა მოთხოვნას.`,
    currentPasswordLabel: "მიმდინარე (ან ერთჯერადი) პაროლი",
    currentPasswordPlaceholder: "შეიყვანეთ მიმდინარე პაროლი",
    newPasswordLabel: "ახალი ძლიერი პაროლი",
    newPasswordPlaceholder: "შეიყვანეთ ახალი პაროლი",
    confirmPasswordLabel: "გაიმეორეთ ახალი პაროლი",
    confirmPasswordPlaceholder: "გაიმეორეთ ახალი პაროლი",
    pwdRuleMinLen: "მინიმუმ 8 სიმბოლო",
    pwdRuleUpper: "მინიმუმ 1 დიდი ლათინური ასო (A–Z)",
    pwdRuleLower: "მინიმუმ 1 პატარა ლათინური ასო (a–z)",
    pwdRuleDigit: "მინიმუმ 1 ციფრი (0–9)",
    pwdRuleSpecial: "მინიმუმ 1 სპეციალური სიმბოლო (!@#$%...)",
    pwdComplexityError:
      "პაროლი არ აკმაყოფილებს ზემოთ ჩამოთვლილ ყველა მოთხოვნას.",
    pwdMismatchError: "ახალი პაროლები ერთმანეთს არ ემთხვევა.",
    pwdSameAsOldError:
      "ახალი პაროლი უნდა განსხვავდებოდეს ერთჯერადი / ძველი პაროლისგან.",
    pwdCurrentMissingError: "გთხოვთ, შეიყვანოთ მიმდინარე (ერთჯერადი) პაროლი.",
    pwdCurrentWrongError: "მიმდინარე პაროლი არასწორია.",
    saveNewPasswordBtn: "ახალი პაროლის შენახვა და გაგრძელება",
    savingNewPasswordBtn: "ინახება...",
    passwordChangedToast: "✓ პაროლი წარმატებით შეიცვალა!",

    // Workspace Banner & Tabs
    wsWelcomeDefault: "მასწავლებლის პირადი სივრცე",
    wsWelcomeNamedFmt: (name) => `${name} — პირადი სივრცე`,
    wsWelcomeSubTeacher:
      "შეინახეთ და მართეთ თქვენი გაზიარებული გაკვეთილები, კლასის მინიშნებები, პირადი ჩანაწერები და QR კოდები.",
    wsWelcomeSubAdmin:
      "თქვენი მასწავლებლის პირადი სივრცე და სკოლის მასწავლებლების ანგარიშების მართვის ადმინ პანელი.",
    wsStatDocsLabel: "შენახული დოკუმენტი",
    wsStatAiLabel: "AI გაკვეთილი",
    wsStatTeachersLabel: "ანგარიში სისტემაში",
    wsReturnLessonBtn: "← გაკვეთილზე დაბრუნება",
    wsStudentHubBtn: "🎓 მოსწავლის საწყისი",
    tabHistoryLabel: "ჩემი დოკუმენტების ისტორია",
    tabCreateLabel: "ახალი გაკვეთილი და QR",
    tabAdminLabel: "ადმინ პანელი · მასწავლებლები",
    tabSettingsLabel: "AI კავშირი და ქეში",
    tabHistoryShort: "ისტორია",
    tabCreateShort: "ახალი",
    tabAdminShort: "ადმინი",
    tabSettingsShort: "AI",

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
    historySearchPlaceholder:
      "მოძებნე სათაურით, საგნით, კლასით ან ჩანაწერით...",
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
    docDeleteConfirmBtn: "დიახ, წაშლა",
    docMoreActionsLabel: "სხვა მოქმედებები",
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
    importedDocsToastFmt: (n) =>
      `✓ იმპორტირებულია ${n} გაკვეთილი თქვენს პირად სივრცეში!`,
    copiedLinkToast: "✓ მოსწავლის ბმული დაკოპირდა!",
    untitledDocFmt: (shortId) => `გაკვეთილის დოკუმენტი (${shortId})`,

    // Create & QR Tab
    createHeading: "ახალი გაკვეთილის დამატება და QR კოდის შექმნა",
    createDesc:
      "ჩასვით საჯარო Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთეთ ფაილი — გაკვეთილი ავტომატურად შეინახება თქვენს პირად ისტორიაში.",
    docUrlLabel: "Google Docs / Drive (PDF, DOCX, TXT) ბმული",
    docUrlHint:
      "Share → Anyone with the link (Viewer) — მხარდაჭერილია Google Docs, Drive PDF, DOCX, TXT.",
    docUrlInvalid:
      "გთხოვთ, შეიყვანოთ სწორი Google Docs, Drive (PDF, DOCX, TXT) ბმული ან ატვირთოთ ფაილი.",
    docTitleLabel: "სათაური (არასავალდებულო)",
    docTitlePlaceholder:
      "მაგ.: დავით აღმაშენებლის რეფორმები (ან AI შეავსებს ავტომატურად)",
    docClassLabel: "კლასი / ჯგუფი (არასავალდებულო)",
    docClassPlaceholder: "მაგ.: IX კლასი · ისტორია",
    docNoteLabel: "პირადი ჩანაწერი — რა დაამატეთ ან რა დაავალეთ კლასს",
    docNotePlaceholder:
      "მაგ.: დავამატე მე-4 პარაგრაფის ტერმინები და 3 საშინაო კითხვა თოვლიანი დღისთვის...",
    qrTargetLegend: "QR კოდის სამიზნე მისამართი",
    saveQrBtn: "QR შექმნა და ისტორიაში შენახვა",
    savingQrBtn: "ინახება...",
    generateOpenBtn: "AI გაკვეთილის გენერაცია და გახსნა",
    qrEmptyPrompt:
      "ჩასვით დოკუმენტის ბმული ან ატვირთეთ ფაილი QR კოდის შესაქმნელად",
    qrPngDownloaded: "PNG ფაილი ჩამოიტვირთა!",
    uploadFileBtn: "ფაილის ატვირთვა (PDF, DOCX, TXT)",

    // Admin Panel Tab
    adminPanelTitle: "მასწავლებლების მართვის ადმინ პანელი",
    adminPanelLead:
      "შექმენით მასწავლებლის მომხმარებლის სახელი (Username) და სისტემა ავტომატურად დააგენერირებს ძლიერ ერთჯერად პაროლს. პირველი შესვლისას მასწავლებელს მოეთხოვება პაროლის შეცვლა, ხოლო საჭიროებისას შეგიძლიათ პაროლის აღდგენა.",
    kpiTotalLabel: "სულ ანგარიში",
    kpiActiveLabel: "აქტიური (პაროლი დაყენებულია)",
    kpiPendingLabel: "ერთჯერადი პაროლით (შესაცვლელი)",
    inviteHeading:
      "ახალი მასწავლებლის შექმნა (ავტომატური ძლიერი ერთჯერადი პაროლით)",
    addUsernameLabel: "მასწავლებლის მომხმარებლის სახელი (Username)",
    addUsernameHint:
      "3–32 სიმბოლო: ლათინური პატარა ასოები, ციფრები, წერტილი (.), ტირე (-) ან ქვედა ტირე (_)",
    addUsernamePlaceholder: "nino.beridze",
    addUsernameError:
      "მომხმარებლის სახელი უნდა შეიცავდეს 3–32 სიმბოლოს (ლათინური ასოები, ციფრები, ., -, _).",
    addNoteLabel: "სახელი, გვარი და საგანი (არასავალდებულო)",
    addNoteHint: "გამოჩნდება მასწავლებლების ცხრილში იდენტიფიკაციისთვის",
    addNotePlaceholder: "მაგ.: ნინო ბერიძე — ისტორია (VIII–X კლ.)",
    addTeacherSubmitBtn: "+ შექმნა და პაროლის გენერაცია",
    addingTeacherBtn: "იქმნება...",
    teachersListHeading: "რეგისტრირებული მასწავლებლების სია",
    adminSearchPlaceholder: "მოძებნე username-ით ან სახელით...",
    colTeacher: "მომხმარებელი (Username)",
    colNote: "სახელი და საგანი",
    colRole: "როლი",
    colStatus: "პაროლი და სტატუსი",
    colActions: "მართვა",
    roleSuperAdminTag: "მთავარი ადმინი",
    roleTeacherTag: "მასწავლებელი",
    statusActiveReady: "აქტიური",
    statusOneTimePending: "⏳ ერთჯერადი პაროლი (შესაცვლელი)",
    actionsMenuBtn: "მოქმედებები",
    editTeacherNoteBtn: "შეცვლა",
    resetPasswordBtn: "🔑 პაროლის აღდგენა",
    resetConfirmPrompt: "აღდგეს პაროლი?",
    confirmYesBtn: "დიახ",
    resettingBtn: "ახლდება...",
    removeTeacherBtn: "წაშლა",
    deleteConfirmPrompt: "წაიშალოს?",
    removingBtn: "იშლება...",
    protectedAdminLabel: "ძირითადი ადმინი",
    addedSuccessFmt: (u) =>
      `✓ შეიქმნა მასწავლებელი „${u}“ ერთჯერადი ძლიერი პაროლით.`,
    resetSuccessFmt: (u) =>
      `✓ მასწავლებლის „${u}“ პაროლი განულდა ახალი ერთჯერადი პაროლით.`,
    updatedTeacherFmt: (u) => `✓ განახლდა მასწავლებლის ჩანაწერი: ${u}`,
    removedSuccessFmt: (u) => `✓ წაიშალა ანგარიში: ${u}`,
    usernameExistsFmt: (u) =>
      `მომხმარებლის სახელი „${u}“ უკვე არსებობს. პაროლის შესაცვლელად გამოიყენეთ „პაროლის აღდგენა“.`,
    emptyTeachersList: "ამ საძიებო სიტყვით მასწავლებელი ვერ მოიძებნა.",

    // Generated Credentials Banner
    credCreatedTitleFmt: (u) =>
      `✓ მასწავლებლის ანგარიში „${u}“ მზადაა — ერთჯერადი პაროლი`,
    credResetTitleFmt: (u) =>
      `✓ პაროლი აღდგენილია ანგარიშისთვის „${u}“ — ახალი ერთჯერადი პაროლი`,
    credWarningText:
      "გადაეცით ეს მონაცემები მასწავლებელს. უსაფრთხოების მიზნით ერთჯერადი პაროლი მხოლოდ ახლა ჩანს — შესვლისთანავე მასწავლებელს მოეთხოვება საკუთარი ძლიერი პაროლის დაყენება.",
    credUsernameLabel: "მომხმარებელი (Username)",
    credPasswordLabel: "ერთჯერადი ძლიერი პაროლი",
    copyBtnShort: "კოპირება",
    copiedBtnShort: "✓ დაკოპირდა",
    copyBothCredsBtn: "📋 მონაცემების ერთად კოპირება",
    dismissCredsBtn: "დახურვა",

    // Settings Tab
    settingsHeading: "Geosoft AI Agent კავშირი და ლოკალური ქეში",
    settingsDesc:
      "შეამოწმეთ ან განაახლეთ გამოქვეყნებული Geosoft AI აგენტის ბმული და მართეთ ამ მოწყობილობაზე დაქეშილი გაკვეთილები.",

    // Errors
    invalidLoginMsg: "არასწორი მომხმარებლის სახელი (Username) ან პაროლი.",
    tooManyRequestsMsg:
      "ძალიან ბევრი მცდელობა. გთხოვთ, სცადოთ რამდენიმე წუთში.",
    genericAuthErrorPrefix: "ავტორიზაციის შეცდომა: ",
    genericSaveErrorPrefix: "შეცდომა: ",
  },
  en: {
    headerSignInFull: "Teacher Sign In",
    headerSignInShort: "Sign In",
    headerSuperAdminFull: "Admin Panel · My Space",
    headerSuperAdminShort: "Admin",
    headerTeacherFull: "My Teacher Space",
    headerTeacherShort: "My Space",
    headerMustChangeFull: "Password Change Required",
    headerMustChangeShort: "Password",
    headerUnauthorizedFull: "Access Restricted",
    headerUnauthorizedShort: "Status",
    loadingAuth: "Checking teacher authentication...",

    // Login Form
    loginUsernameLabel: "Username",
    loginUsernamePlaceholder: "e.g., nino.beridze",
    loginPasswordLabel: "Password",
    loginPasswordPlaceholder: "Enter your password",
    showPasswordBtn: "Show",
    hidePasswordBtn: "Hide",
    signInBtn: "Sign In",
    signingInBtn: "Signing in...",
    signOutBtn: "Sign Out",
    forgotPasswordHint:
      "Forgot your password? Contact your school's Super Admin to receive a new one-time reset password.",

    openWorkspaceBtn: "Open My Personal Workspace →",
    openAdminPanelBtn: "Open Admin Panel",
    changePasswordBtn: "🔑 Change Password",
    verifiedTeacherBadge: "✓ Authorized Teacher",
    verifiedAdminBadge: "★ Super Admin",
    mustChangeBadge: "🔒 One-Time Password",
    unauthorizedBadge: "Access Restricted",

    gateGuestTitle: "Teacher Sign In (Username + Password)",
    gateGuestDesc:
      "Sign in with the username and password provided by your Super Admin to open your personal workspace and generate student QR codes.",
    gateStudentNote:
      "Students do not need to sign in — open lessons directly via QR code or the Student card.",
    gateUnauthTitle: "Account Not Registered in Teachers Directory",
    gateUnauthBodyPrefix: "Username ",
    gateUnauthBodySuffix:
      " was not found in the authorized school teachers directory. Please contact your Super Admin.",

    authModalKicker: "Teacher Authentication",
    authModalTitleGuest: "Sign In to Teacher Account",
    authModalTitleMustChange: "Change Your One-Time Password",
    authModalTitleVoluntaryChange: "Change Account Password",
    authModalTitleUnauth: "Restricted to Registered School Teachers",

    // One-Time / Strong Password Change UI
    mustChangeTitle: "One-Time Password Change Required",
    mustChangeDescFmt: (username) =>
      `You signed in as "${username}" using a one-time password generated by your Super Admin. Please choose your own strong password to continue.`,
    voluntaryChangeDescFmt: (username) =>
      `Update the password for "${username}". Your new password must satisfy all strength requirements below.`,
    currentPasswordLabel: "Current (or One-Time) Password",
    currentPasswordPlaceholder: "Enter current password",
    newPasswordLabel: "New Strong Password",
    newPasswordPlaceholder: "Enter new strong password",
    confirmPasswordLabel: "Confirm New Password",
    confirmPasswordPlaceholder: "Re-enter new password",
    pwdRuleMinLen: "At least 8 characters",
    pwdRuleUpper: "One uppercase letter (A–Z)",
    pwdRuleLower: "One lowercase letter (a–z)",
    pwdRuleDigit: "One number (0–9)",
    pwdRuleSpecial: "One special character (!@#$%...)",
    pwdComplexityError:
      "Password doesn't meet all the strength requirements listed above.",
    pwdMismatchError: "New password and confirmation do not match.",
    pwdSameAsOldError:
      "Your new password must be different from the one-time / current password.",
    pwdCurrentMissingError: "Please enter your current (one-time) password.",
    pwdCurrentWrongError: "Current password is incorrect.",
    saveNewPasswordBtn: "Save New Password & Continue",
    savingNewPasswordBtn: "Saving...",
    passwordChangedToast: "✓ Password updated successfully!",

    // Workspace Banner & Tabs
    wsWelcomeDefault: "Teacher Personal Workspace",
    wsWelcomeNamedFmt: (name) => `${name}'s Workspace`,
    wsWelcomeSubTeacher:
      "Keep track of every lesson document you added or shared with classes, personal teaching notes, and printable student QR codes.",
    wsWelcomeSubAdmin:
      "Your personal teaching history plus the full school Teachers Account & Password Admin Panel.",
    wsStatDocsLabel: "Saved Docs",
    wsStatAiLabel: "AI Lessons",
    wsStatTeachersLabel: "Accounts",
    wsReturnLessonBtn: "← Back to Open Lesson",
    wsStudentHubBtn: "🎓 Student Hub",
    tabHistoryLabel: "My Docs & History",
    tabCreateLabel: "New Lesson & QR",
    tabAdminLabel: "Admin Panel · Teachers",
    tabSettingsLabel: "AI Agent & Cache",
    tabHistoryShort: "Docs",
    tabCreateShort: "New",
    tabAdminShort: "Teachers",
    tabSettingsShort: "AI",

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
    historySearchPlaceholder:
      "Search by title, subject, class, or personal note...",
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
    docDeleteConfirmBtn: "Yes, remove",
    docMoreActionsLabel: "More actions",
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
    importedDocsToastFmt: (n) =>
      `✓ Imported ${n} lessons into your personal space!`,
    copiedLinkToast: "✓ Student link copied to clipboard!",
    untitledDocFmt: (shortId) => `Lesson Document (${shortId})`,

    // Create & QR Tab
    createHeading: "Add Lesson Document & Create QR Code",
    createDesc:
      "Paste a public Google Docs or Drive (PDF, DOCX, TXT) link or upload a file, add an optional class tag or note, and save it directly to your personal history.",
    docUrlLabel: "Google Docs / Drive (PDF, DOCX, TXT) Link",
    docUrlHint:
      "Share → Anyone with the link (Viewer) — Supports Google Docs, Drive PDF, DOCX, TXT, and web files.",
    docUrlInvalid:
      "Please enter a valid Google Docs or Drive (PDF, DOCX, TXT) share URL, or upload a file.",
    docTitleLabel: "Lesson Title (Optional)",
    docTitlePlaceholder:
      "e.g., Reforms of David the Builder (or auto-filled by AI)",
    docClassLabel: "Class / Group (Optional)",
    docClassPlaceholder: "e.g., Grade 9 · History",
    docNoteLabel: "Personal Note — what you added or assigned",
    docNotePlaceholder:
      "e.g., Added chapter 4 vocabulary terms and 3 snow-day review prompts...",
    qrTargetLegend: "QR Code Destination Host",
    saveQrBtn: "Create QR & Save to History",
    savingQrBtn: "Saving...",
    generateOpenBtn: "Generate & Open AI Lesson",
    qrEmptyPrompt:
      "Paste a document link or upload a file to preview its QR code",
    qrPngDownloaded: "QR PNG downloaded!",
    uploadFileBtn: "Upload File (PDF, DOCX, TXT)",

    // Admin Panel Tab
    adminPanelTitle: "Teachers Account & Password Admin Panel",
    adminPanelLead:
      "Create teacher usernames with automatically generated strong one-time passwords. Teachers are required to set their own strong password on first login, and you can reset any teacher's password at any time.",
    kpiTotalLabel: "Total Accounts",
    kpiActiveLabel: "Active (Password Set)",
    kpiPendingLabel: "One-Time Password (Pending Change)",
    inviteHeading:
      "Create New Teacher (Auto-Generated Strong One-Time Password)",
    addUsernameLabel: "Teacher Username",
    addUsernameHint:
      "3–32 characters: lowercase letters, numbers, dots (.), hyphens (-), or underscores (_)",
    addUsernamePlaceholder: "nino.beridze",
    addUsernameError:
      "Username must be 3–32 characters using letters, numbers, '.', '-', or '_'.",
    addNoteLabel: "Full Name & Subject (Optional)",
    addNoteHint: "Shown in the teachers directory for easy identification",
    addNotePlaceholder: "e.g., Nino Beridze — History (Grades 8–10)",
    addTeacherSubmitBtn: "+ Create & Generate Password",
    addingTeacherBtn: "Creating...",
    teachersListHeading: "Registered Teachers Directory",
    adminSearchPlaceholder: "Filter by username or teacher name...",
    colTeacher: "Username",
    colNote: "Name & Subject",
    colRole: "Role",
    colStatus: "Password & Status",
    colActions: "Manage",
    roleSuperAdminTag: "Super Admin",
    roleTeacherTag: "Teacher",
    statusActiveReady: "Active",
    statusOneTimePending: "⏳ One-time password (must change)",
    actionsMenuBtn: "Actions",
    editTeacherNoteBtn: "Edit Note",
    resetPasswordBtn: "🔑 Reset Password",
    resetConfirmPrompt: "Reset password?",
    confirmYesBtn: "Yes",
    resettingBtn: "Resetting...",
    removeTeacherBtn: "Remove",
    deleteConfirmPrompt: "Delete?",
    removingBtn: "Removing...",
    protectedAdminLabel: "Super Admin",
    addedSuccessFmt: (u) =>
      `✓ Created teacher "${u}" with a strong one-time password.`,
    resetSuccessFmt: (u) =>
      `✓ Reset password for "${u}" with a new one-time password.`,
    updatedTeacherFmt: (u) => `✓ Updated teacher record: ${u}`,
    removedSuccessFmt: (u) => `✓ Removed teacher account: ${u}`,
    usernameExistsFmt: (u) =>
      `Username "${u}" already exists. Use "Reset Password" in the table if they need a new password.`,
    emptyTeachersList: "No teachers matched your search.",

    // Generated Credentials Banner
    credCreatedTitleFmt: (u) =>
      `✓ Teacher Account "${u}" Created — One-Time Credentials`,
    credResetTitleFmt: (u) =>
      `✓ Password Reset for "${u}" — New One-Time Credentials`,
    credWarningText:
      "Share these credentials with the teacher now. For security, this one-time password is shown only once — the teacher will be required to change it to their own strong password immediately upon signing in.",
    credUsernameLabel: "Username",
    credPasswordLabel: "One-Time Strong Password",
    copyBtnShort: "Copy",
    copiedBtnShort: "✓ Copied",
    copyBothCredsBtn: "📋 Copy Username & Password",
    dismissCredsBtn: "Dismiss",

    // Settings Tab
    settingsHeading: "Geosoft AI Agent Connection & Local Cache",
    settingsDesc:
      "Test or update your published Geosoft Headless Agent URL and manage cached lessons stored in this browser.",

    // Errors
    invalidLoginMsg: "Incorrect username or password.",
    tooManyRequestsMsg:
      "Too many attempts. Please wait a few minutes and try again.",
    genericAuthErrorPrefix: "Authentication error: ",
    genericSaveErrorPrefix: "Error: ",
  },
};

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const STRONG_PASSWORD_HTML_PATTERN =
  "(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,128}";

const cfg = window.SNOWDAY_AUTH_CONFIG || {};
const AUTH_EMAIL_DOMAIN = String(cfg.authEmailDomain || "teachers.tsutskhvati.app")
  .trim()
  .toLowerCase();

const firebaseApp = initializeApp(cfg.firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const authState = {
  ready: false,
  status: "loading", // "loading" | "guest" | "must_change_password" | "unauthorized" | "teacher" | "super_admin"
  uid: "",
  username: "",
  displayName: "",
  note: "",
  mustChangePassword: false,
  isAuthorizedTeacher: false,
  isSuperAdmin: false,
  authError: "",
};

// Held strictly in closure memory between 1-time password login and immediate password change
let ephemeralLoginPassword = "";
let voluntaryPasswordModalOpen = false;

let pendingTeacherAction = null;
let selfTeacherUnsubscribe = null;
let teachersUnsubscribe = null;
let personalDocsUnsubscribe = null;

let cachedTeachersList = [];
let cachedPersonalDocs = [];
let editingDocKey = "";
let editingAdminTeacherUsername = "";
let confirmingResetUsername = "";
let confirmingDeleteUsername = "";
let latestGeneratedCredentials = null; // { mode: "created" | "reset", username, oneTimePassword }

let activeWorkspaceTab = "history"; // "history" | "create" | "admin" | "settings"
let historySearchQuery = "";
let historyStatusFilter = "all"; // "all" | "ai_generated" | "qr_shared"
let adminSearchQuery = "";

let adminFeedbackMessage = "";
let adminFeedbackIsError = false;
let historyToastMessage = "";
let isSigningIn = false;
let isChangingPassword = false;

function getLang() {
  if (
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.getLang === "function"
  ) {
    const l = window.SnowDayPortal.getLang();
    if (l === "en" || l === "ka") return l;
  }
  return document.documentElement.lang === "en" ? "en" : "ka";
}

function t() {
  return AUTH_I18N[getLang()] || AUTH_I18N.ka;
}

function normalizeUsername(raw) {
  let s = String(raw || "")
    .trim()
    .toLowerCase();
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (s.endsWith(suffix)) {
    s = s.slice(0, -suffix.length);
  }
  return s;
}

function isValidUsername(username) {
  return typeof username === "string" && USERNAME_REGEX.test(username);
}

function usernameToAuthEmail(username) {
  const clean = normalizeUsername(username);
  if (!isValidUsername(clean)) return "";
  return `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

function authEmailToUsername(email) {
  const s = String(email || "")
    .trim()
    .toLowerCase();
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (!s.endsWith(suffix)) return "";
  const uname = s.slice(0, -suffix.length);
  return isValidUsername(uname) ? uname : "";
}

function evaluatePasswordStrength(password) {
  const pwd = typeof password === "string" ? password : "";
  const checks = {
    minLength: pwd.length >= 8,
    maxLength: pwd.length <= 128,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasDigit: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  };
  const valid =
    checks.minLength &&
    checks.maxLength &&
    checks.hasUpper &&
    checks.hasLower &&
    checks.hasDigit &&
    checks.hasSpecial;
  return { valid, checks };
}

function sanitizeHttpUrl(raw, maxLen = 1024) {
  const s = String(raw || "").trim();
  if (/^https?:\/\//i.test(s)) return s.slice(0, maxLen);
  return "";
}

function normalizeHttpsDocUrl(rawInput) {
  let normalized = "";
  if (
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.normalizeGoogleDocUrl === "function"
  ) {
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
  if (
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.extractDocCacheKey === "function"
  ) {
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
      minute: "2-digit",
    }).format(new Date(ms));
  } catch (_e) {
    return new Date(ms).toLocaleDateString();
  }
}

async function callBackendApi(
  path,
  { method = "POST", body = null, withAuth = true } = {},
) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth && auth.currentUser) {
    const idToken = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${idToken}`;
  }
  const resp = await fetch(path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await resp.json();
  } catch (_e) {}
  return { ok: resp.ok, status: resp.status, data };
}

// ============================================================================
// Focusgroup Progressive Enhancement Polyfill (Modern Web Guidance `tabs`)
// ============================================================================

async function ensureFocusgroupSupport() {
  if (typeof HTMLElement === "undefined") return;
  if (!Object.hasOwn(HTMLElement.prototype, "focusGroup")) {
    try {
      const mod =
        await import("https://cdn.jsdelivr.net/npm/@microsoft/focusgroup-polyfill/+esm");
      if (mod && typeof mod.polyfill === "function") {
        mod.polyfill();
      }
    } catch (_e) {}
  }
}

// ============================================================================
// Firestore Real-Time Subscriptions (Self Profile + Personal Docs + Admin Roster)
// ============================================================================

function stopWorkspaceSubscriptions() {
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

function stopAllSubscriptions() {
  if (typeof selfTeacherUnsubscribe === "function") {
    selfTeacherUnsubscribe();
    selfTeacherUnsubscribe = null;
  }
  stopWorkspaceSubscriptions();
}

function startPersonalDocsSubscription(username) {
  if (!username) return;
  if (typeof personalDocsUnsubscribe === "function") {
    personalDocsUnsubscribe();
    personalDocsUnsubscribe = null;
  }

  const docsCol = collection(db, "teachers", username, "docs");
  personalDocsUnsubscribe = onSnapshot(
    docsCol,
    (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const createdAtMs =
          d.createdAt && typeof d.createdAt.toMillis === "function"
            ? d.createdAt.toMillis()
            : 0;
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
          updatedAtMs,
        });
      });

      list.sort(
        (a, b) =>
          b.updatedAtMs - a.updatedAtMs || b.createdAtMs - a.createdAtMs,
      );
      cachedPersonalDocs = list;

      renderWorkspaceBanner();
      renderPersonalDocsGrid();
      renderImportFromBrowserButton();
      renderRibbonTeacherButtons();
    },
    (_err) => {},
  );
}

function startTeachersSubscription() {
  if (teachersUnsubscribe) return;
  const colRef = collection(db, "teachers");
  teachersUnsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const uname = d.username || docSnap.id;
        items.push({
          id: docSnap.id,
          username: uname,
          role: d.role === "super_admin" ? "super_admin" : "teacher",
          mustChangePassword: Boolean(d.mustChangePassword),
          note: d.note || "",
          displayName: d.displayName || "",
          addedBy: d.addedBy || "",
          addedAtMs:
            d.addedAt && typeof d.addedAt.toMillis === "function"
              ? d.addedAt.toMillis()
              : 0,
          lastLoginAtMs:
            d.lastLoginAt && typeof d.lastLoginAt.toMillis === "function"
              ? d.lastLoginAt.toMillis()
              : 0,
          passwordChangedAtMs:
            d.passwordChangedAt &&
            typeof d.passwordChangedAt.toMillis === "function"
              ? d.passwordChangedAt.toMillis()
              : 0,
        });
      });

      items.sort((a, b) => {
        if (a.role === "super_admin" && b.role !== "super_admin") return -1;
        if (b.role === "super_admin" && a.role !== "super_admin") return 1;
        return (
          b.addedAtMs - a.addedAtMs || a.username.localeCompare(b.username)
        );
      });

      cachedTeachersList = items;
      renderWorkspaceBanner();
      renderAdminPanelDirectory();
    },
    (err) => {
      adminFeedbackIsError = true;
      adminFeedbackMessage =
        t().genericSaveErrorPrefix +
        (err && err.message ? err.message : String(err));
      renderAdminFeedback();
    },
  );
}

async function performServerCheckin() {
  try {
    await callBackendApi("/api/auth/checkin", {
      method: "POST",
      body: {},
      withAuth: true,
    });
  } catch (_e) {
    // Fallback client self-checkin timestamp if allowed
    if (authState.isAuthorizedTeacher && authState.username) {
      try {
        await updateDoc(doc(db, "teachers", authState.username), {
          lastLoginAt: serverTimestamp(),
        });
      } catch (_e2) {}
    }
  }
}

function applyTeacherSnapshot(username, snapExists, data) {
  if (!snapExists) {
    stopWorkspaceSubscriptions();
    authState.ready = true;
    authState.status = "unauthorized";
    authState.mustChangePassword = false;
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    closeWorkspaceIfLocked();
    renderAllAuthSurfaces();
    return;
  }

  const role = data.role === "super_admin" ? "super_admin" : "teacher";
  const mustChange = Boolean(data.mustChangePassword);
  authState.note = String(data.note || "").trim();
  authState.displayName = String(data.displayName || data.note || "").trim();
  authState.mustChangePassword = mustChange;

  if (mustChange) {
    stopWorkspaceSubscriptions();
    authState.ready = true;
    authState.status = "must_change_password";
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    closeWorkspaceIfLocked();
    renderAllAuthSurfaces();
    openAuthDialog();
    return;
  }

  // Active authorized teacher or Super Admin
  ephemeralLoginPassword = "";
  const wasAlreadyAuthed = authState.isAuthorizedTeacher;
  authState.ready = true;
  authState.status = role === "super_admin" ? "super_admin" : "teacher";
  authState.isAuthorizedTeacher = true;
  authState.isSuperAdmin = role === "super_admin";

  if (!authState.isSuperAdmin && activeWorkspaceTab === "admin") {
    activeWorkspaceTab = "history";
  }

  startPersonalDocsSubscription(username);
  if (authState.isSuperAdmin) {
    startTeachersSubscription();
  } else if (typeof teachersUnsubscribe === "function") {
    teachersUnsubscribe();
    teachersUnsubscribe = null;
    cachedTeachersList = [];
  }

  if (!wasAlreadyAuthed) {
    performServerCheckin();
  }

  if (!voluntaryPasswordModalOpen) {
    const authDlg = document.getElementById("teacher-auth-dialog");
    if (authDlg && authDlg.open) authDlg.close();
  }

  renderAllAuthSurfaces();
  if (!wasAlreadyAuthed) {
    autoEnterWorkspaceIfAtLanding();
  }
  runPendingTeacherActionIfAuthorized();
}

function handleAuthUserChange(user) {
  authState.authError = "";

  if (!user || !user.email) {
    stopAllSubscriptions();
    ephemeralLoginPassword = "";
    voluntaryPasswordModalOpen = false;
    authState.ready = true;
    authState.status = "guest";
    authState.uid = "";
    authState.username = "";
    authState.displayName = "";
    authState.note = "";
    authState.mustChangePassword = false;
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    closeWorkspaceIfLocked();
    renderAllAuthSurfaces();
    return;
  }

  const username = authEmailToUsername(user.email);
  if (!username) {
    stopAllSubscriptions();
    authState.ready = true;
    authState.status = "unauthorized";
    authState.uid = user.uid || "";
    authState.username = String(user.email || "");
    authState.isAuthorizedTeacher = false;
    authState.isSuperAdmin = false;
    closeWorkspaceIfLocked();
    renderAllAuthSurfaces();
    return;
  }

  authState.uid = user.uid || "";
  authState.username = username;

  if (typeof selfTeacherUnsubscribe === "function") {
    selfTeacherUnsubscribe();
    selfTeacherUnsubscribe = null;
  }

  const selfRef = doc(db, "teachers", username);
  selfTeacherUnsubscribe = onSnapshot(
    selfRef,
    (snap) => {
      applyTeacherSnapshot(username, snap.exists(), snap.data() || {});
    },
    (err) => {
      stopWorkspaceSubscriptions();
      authState.ready = true;
      authState.status = "unauthorized";
      authState.isAuthorizedTeacher = false;
      authState.isSuperAdmin = false;
      authState.authError = err && err.message ? err.message : String(err);
      closeWorkspaceIfLocked();
      renderAllAuthSurfaces();
    },
  );
}

function autoEnterWorkspaceIfAtLanding() {
  if (!authState.isAuthorizedTeacher) return;
  let hasDocParam = false;
  try {
    hasDocParam = Boolean(
      new URLSearchParams(window.location.search).get("doc"),
    );
  } catch (_e) {}

  const lessonCtx =
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.getActiveLessonContext === "function"
      ? window.SnowDayPortal.getActiveLessonContext()
      : { hasLesson: false };

  if (!hasDocParam && !lessonCtx.hasLesson) {
    openWorkspaceView(activeWorkspaceTab);
  }
}

function closeWorkspaceIfLocked() {
  const wsSec = document.getElementById("teacher-workspace-view");
  if (!wsSec || wsSec.hidden) return;
  wsSec.hidden = true;
  const lessonCtx =
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.getActiveLessonContext === "function"
      ? window.SnowDayPortal.getActiveLessonContext()
      : { hasLesson: false };
  if (lessonCtx.hasLesson && window.SnowDayPortal.returnToActiveLesson) {
    window.SnowDayPortal.returnToActiveLesson();
  } else if (window.SnowDayPortal && window.SnowDayPortal.showLandingHub) {
    window.SnowDayPortal.showLandingHub(false, true);
  }
}

function runPendingTeacherActionIfAuthorized() {
  if (
    !authState.isAuthorizedTeacher ||
    typeof pendingTeacherAction !== "function"
  )
    return;
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
  if (
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-email"
  ) {
    return strings.invalidLoginMsg;
  }
  if (code === "auth/too-many-requests") {
    return strings.tooManyRequestsMsg;
  }
  return strings.genericAuthErrorPrefix + ((err && err.message) || String(err));
}

// ============================================================================
// Username + Password Login & Password Change Actions
// ============================================================================

async function signInWithUsernamePassword(rawUsername, rawPassword) {
  if (isSigningIn) return false;
  const strings = t();
  const username = normalizeUsername(rawUsername);
  const password = String(rawPassword || "");

  if (!isValidUsername(username) || !password) {
    authState.authError = strings.invalidLoginMsg;
    renderAllAuthSurfaces();
    return false;
  }

  isSigningIn = true;
  authState.authError = "";
  renderAllAuthSurfaces();

  const authEmail = usernameToAuthEmail(username);

  try {
    ephemeralLoginPassword = password;
    await signInWithEmailAndPassword(auth, authEmail, password);
    return true;
  } catch (err) {
    const code = (err && err.code) || "";
    const mayNeedBootstrap =
      code === "auth/user-not-found" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials";

    if (mayNeedBootstrap) {
      try {
        const boot = await callBackendApi("/api/auth/bootstrap-login", {
          method: "POST",
          body: { username, password },
          withAuth: false,
        });
        if (boot.ok && boot.data && boot.data.bootstrapped) {
          await signInWithEmailAndPassword(auth, authEmail, password);
          return true;
        }
      } catch (_bootErr) {}
    }

    ephemeralLoginPassword = "";
    authState.authError = formatAuthError(err);
    return false;
  } finally {
    isSigningIn = false;
    renderAllAuthSurfaces();
  }
}

async function submitPasswordChange({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  if (isChangingPassword) return false;
  const strings = t();
  authState.authError = "";

  const effectiveCurrent = String(
    currentPassword || ephemeralLoginPassword || "",
  );
  if (!effectiveCurrent) {
    authState.authError = strings.pwdCurrentMissingError;
    renderAllAuthSurfaces();
    return false;
  }

  const strength = evaluatePasswordStrength(newPassword);
  if (!strength.valid) {
    authState.authError = strings.pwdComplexityError;
    renderAllAuthSurfaces();
    return false;
  }

  if (newPassword !== confirmPassword) {
    authState.authError = strings.pwdMismatchError;
    renderAllAuthSurfaces();
    return false;
  }

  if (newPassword === effectiveCurrent) {
    authState.authError = strings.pwdSameAsOldError;
    renderAllAuthSurfaces();
    return false;
  }

  isChangingPassword = true;
  renderAllAuthSurfaces();

  try {
    const res = await callBackendApi("/api/auth/change-password", {
      method: "POST",
      body: {
        currentPassword: effectiveCurrent,
        newPassword,
      },
      withAuth: true,
    });

    if (!res.ok) {
      const errCode = (res.data && res.data.error) || "";
      if (errCode === "WRONG_CURRENT_PASSWORD") {
        ephemeralLoginPassword = "";
        authState.authError = strings.pwdCurrentWrongError;
      } else if (errCode === "SAME_PASSWORD") {
        authState.authError = strings.pwdSameAsOldError;
      } else if (errCode === "WEAK_PASSWORD") {
        authState.authError = strings.pwdComplexityError;
      } else if (errCode === "TOO_MANY_ATTEMPTS") {
        authState.authError = strings.tooManyRequestsMsg;
      } else {
        authState.authError =
          strings.genericSaveErrorPrefix +
          ((res.data && res.data.message) || res.status);
      }
      return false;
    }

    ephemeralLoginPassword = "";
    voluntaryPasswordModalOpen = false;

    // Re-sign in immediately so Firebase client receives fresh tokens for the updated password
    const authEmail = usernameToAuthEmail(authState.username);
    if (authEmail) {
      await signInWithEmailAndPassword(auth, authEmail, newPassword);
    }

    const dlg = document.getElementById("teacher-auth-dialog");
    if (dlg && dlg.open) dlg.close();

    openWorkspaceView(activeWorkspaceTab || "history");
    showHistoryToast(strings.passwordChangedToast, false);
    return true;
  } catch (err) {
    authState.authError =
      strings.genericSaveErrorPrefix + ((err && err.message) || String(err));
    return false;
  } finally {
    isChangingPassword = false;
    renderAllAuthSurfaces();
  }
}

async function signOutTeacher() {
  pendingTeacherAction = null;
  ephemeralLoginPassword = "";
  voluntaryPasswordModalOpen = false;
  latestGeneratedCredentials = null;
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
  closeWorkspaceIfLocked();
  renderAllAuthSurfaces();
}

function openAuthDialog() {
  voluntaryPasswordModalOpen = false;
  authState.authError = "";
  renderAuthDialogContent();
  const dlg = document.getElementById("teacher-auth-dialog");
  if (dlg && typeof dlg.showModal === "function" && !dlg.open) {
    dlg.showModal();
  }
}

function openChangePasswordDialog() {
  if (!authState.isAuthorizedTeacher) {
    openAuthDialog();
    return;
  }
  voluntaryPasswordModalOpen = true;
  authState.authError = "";
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
  if (
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.syncHeader === "function"
  ) {
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
  pendingTeacherAction =
    typeof onAuthorized === "function" ? onAuthorized : null;
  openAuthDialog();
  return false;
}

// ============================================================================
// Teacher Personal Docs History CRUD (`/teachers/{username}/docs/{docKey}`)
// ============================================================================

function computeStudentUrlForWorkspace(normalizedDoc) {
  const useCurrentEl = document.getElementById("ws-target-current");
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const useCurrent = useCurrentEl ? useCurrentEl.checked : isLocalHost;
  if (
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.buildStudentQrUrlForDoc === "function"
  ) {
    return window.SnowDayPortal.buildStudentQrUrlForDoc(
      normalizedDoc,
      useCurrent,
    );
  }
  return `https://tsutskhvati-web-617054738609.europe-west1.run.app/?doc=${encodeURIComponent(normalizedDoc)}`;
}

async function upsertPersonalDocRecord({
  rawDocUrl,
  title = "",
  subject = "",
  classLabel = "",
  personalNote = "",
  status = "qr_shared",
  incrementShare = false,
  preserveExistingNotes = true,
}) {
  if (!authState.isAuthorizedTeacher || !authState.username) return null;

  const normalizedUrl = normalizeHttpsDocUrl(rawDocUrl);
  if (!normalizedUrl) return null;

  const docKey = getSafeDocKey(normalizedUrl);
  const studentQrUrl = sanitizeHttpUrl(
    computeStudentUrlForWorkspace(normalizedUrl),
    1200,
  );
  if (!studentQrUrl) return null;

  const docRef = doc(db, "teachers", authState.username, "docs", docKey);
  const existingSnap = await getDoc(docRef);

  const cleanTitle = String(title || "")
    .trim()
    .slice(0, 200);
  const cleanSubject = String(subject || "")
    .trim()
    .slice(0, 120);
  const cleanClass = String(classLabel || "")
    .trim()
    .slice(0, 80);
  const cleanNote = String(personalNote || "")
    .trim()
    .slice(0, 300);

  if (existingSnap.exists()) {
    const prev = existingSnap.data() || {};
    const nextTitle =
      cleanTitle || prev.title || t().untitledDocFmt(docKey.slice(0, 8));
    const nextSubject = cleanSubject || prev.subject || "";
    const nextClass = preserveExistingNotes
      ? cleanClass || prev.classLabel || ""
      : cleanClass;
    const nextNote = preserveExistingNotes
      ? cleanNote || prev.personalNote || ""
      : cleanNote;
    const nextStatus =
      status === "ai_generated" || prev.status === "ai_generated"
        ? "ai_generated"
        : "qr_shared";
    const prevShares =
      typeof prev.shareCount === "number" ? prev.shareCount : 1;
    const nextShares = incrementShare
      ? Math.min(100000, prevShares + 1)
      : prevShares;

    await updateDoc(docRef, {
      studentQrUrl,
      title: nextTitle.slice(0, 200),
      subject: nextSubject.slice(0, 120),
      classLabel: nextClass.slice(0, 80),
      personalNote: nextNote.slice(0, 300),
      status: nextStatus,
      shareCount: nextShares,
      updatedAt: serverTimestamp(),
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
      updatedAt: serverTimestamp(),
    });
  }

  return { docKey, docUrl: normalizedUrl, studentQrUrl };
}

function showHistoryToast(msg, isError = false) {
  historyToastMessage = msg;
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
  }, 4200);
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
      (item.meta &&
        item.meta.lessonTitle &&
        (item.meta.lessonTitle[lang] || item.meta.lessonTitle.ka)) ||
      "";
    const subject =
      (item.meta &&
        item.meta.subject &&
        (item.meta.subject[lang] || item.meta.subject.ka)) ||
      "";

    try {
      await upsertPersonalDocRecord({
        rawDocUrl: normalized,
        title: lessonTitle,
        subject,
        status: "ai_generated",
        preserveExistingNotes: true,
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
// Super Admin Teacher Creation, Password Reset, Note Edit & Removal
// ============================================================================

async function handleAddTeacherSubmit(event) {
  event.preventDefault();
  if (!authState.isSuperAdmin) return;

  const strings = t();
  const usernameInput = document.getElementById("admin-teacher-username-input");
  const noteInput = document.getElementById("admin-teacher-note-input");
  const submitBtn = document.getElementById("admin-add-teacher-btn");
  if (!usernameInput || !submitBtn) return;

  const targetUsername = normalizeUsername(usernameInput.value);
  const noteClean = String((noteInput && noteInput.value) || "")
    .trim()
    .slice(0, 160);

  if (!isValidUsername(targetUsername)) {
    usernameInput.classList.add("user-invalid-fallback");
    usernameInput.setAttribute("aria-invalid", "true");
    syncFieldErrorDescribe(usernameInput, true);
    usernameInput.focus();
    return;
  }

  usernameInput.classList.remove("user-invalid-fallback");
  usernameInput.setAttribute("aria-invalid", "false");
  syncFieldErrorDescribe(usernameInput, false);

  submitBtn.disabled = true;
  submitBtn.textContent = strings.addingTeacherBtn;
  adminFeedbackMessage = "";
  adminFeedbackIsError = false;
  renderAdminFeedback();

  try {
    const res = await callBackendApi("/api/admin/teachers", {
      method: "POST",
      body: { username: targetUsername, note: noteClean },
      withAuth: true,
    });

    if (!res.ok) {
      adminFeedbackIsError = true;
      if (res.data && res.data.error === "USERNAME_EXISTS") {
        adminFeedbackMessage = strings.usernameExistsFmt(targetUsername);
      } else {
        adminFeedbackMessage =
          strings.genericSaveErrorPrefix +
          ((res.data && res.data.message) || res.status);
      }
      return;
    }

    latestGeneratedCredentials = {
      mode: "created",
      username: res.data.username || targetUsername,
      oneTimePassword: res.data.oneTimePassword,
    };
    renderAdminCredentialsCard(true);

    adminFeedbackIsError = false;
    adminFeedbackMessage = strings.addedSuccessFmt(targetUsername);
    usernameInput.value = "";
    usernameInput.dataset.touched = "false";
    if (noteInput) noteInput.value = "";
  } catch (err) {
    adminFeedbackIsError = true;
    adminFeedbackMessage =
      strings.genericSaveErrorPrefix + ((err && err.message) || String(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t().addTeacherSubmitBtn;
    renderAdminFeedback();
  }
}

async function resetTeacherPasswordByAdmin(targetUsername, btnEl) {
  if (!authState.isSuperAdmin || !targetUsername) return;
  const strings = t();
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = strings.resettingBtn;
  }

  try {
    const res = await callBackendApi(
      `/api/admin/teachers/${encodeURIComponent(targetUsername)}/reset-password`,
      {
        method: "POST",
        body: {},
        withAuth: true,
      },
    );

    if (!res.ok) {
      adminFeedbackIsError = true;
      adminFeedbackMessage =
        strings.genericSaveErrorPrefix +
        ((res.data && res.data.message) || res.status);
      renderAdminFeedback();
      confirmingResetUsername = "";
      renderAdminPanelDirectory();
      return;
    }

    confirmingResetUsername = "";
    latestGeneratedCredentials = {
      mode: "reset",
      username: res.data.username || targetUsername,
      oneTimePassword: res.data.oneTimePassword,
    };
    renderAdminCredentialsCard(true);

    adminFeedbackIsError = false;
    adminFeedbackMessage = strings.resetSuccessFmt(targetUsername);
    renderAdminFeedback();
    renderAdminPanelDirectory();
  } catch (err) {
    confirmingResetUsername = "";
    adminFeedbackIsError = true;
    adminFeedbackMessage =
      strings.genericSaveErrorPrefix + ((err && err.message) || String(err));
    renderAdminFeedback();
    renderAdminPanelDirectory();
  }
}

async function saveAdminTeacherNote(targetUsername, nextNote) {
  if (!authState.isSuperAdmin || !targetUsername) return;
  const clean = String(nextNote || "")
    .trim()
    .slice(0, 160);
  try {
    await updateDoc(doc(db, "teachers", targetUsername), {
      note: clean,
      displayName: clean.slice(0, 120),
    });
    editingAdminTeacherUsername = "";
    adminFeedbackIsError = false;
    adminFeedbackMessage = t().updatedTeacherFmt(targetUsername);
    renderAdminFeedback();
    renderAdminPanelDirectory();
  } catch (err) {
    adminFeedbackIsError = true;
    adminFeedbackMessage =
      t().genericSaveErrorPrefix + ((err && err.message) || String(err));
    renderAdminFeedback();
  }
}

async function removeTeacherByUsername(targetUsername, btnEl) {
  if (
    !authState.isSuperAdmin ||
    !targetUsername ||
    targetUsername === authState.username
  )
    return;
  const strings = t();
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = strings.removingBtn;
  }
  try {
    const res = await callBackendApi(
      `/api/admin/teachers/${encodeURIComponent(targetUsername)}`,
      {
        method: "DELETE",
        withAuth: true,
      },
    );
    if (!res.ok) {
      throw new Error((res.data && res.data.message) || `HTTP ${res.status}`);
    }
    confirmingDeleteUsername = "";
    if (
      latestGeneratedCredentials &&
      latestGeneratedCredentials.username === targetUsername
    ) {
      latestGeneratedCredentials = null;
      renderAdminCredentialsCard(false);
    }
    adminFeedbackIsError = false;
    adminFeedbackMessage = strings.removedSuccessFmt(targetUsername);
    renderAdminFeedback();
  } catch (err) {
    confirmingDeleteUsername = "";
    adminFeedbackIsError = true;
    adminFeedbackMessage =
      strings.genericSaveErrorPrefix + ((err && err.message) || String(err));
    renderAdminFeedback();
    renderAdminPanelDirectory();
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
        tab.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          container: "nearest",
        });
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
    Array.from(tablist.querySelectorAll("[data-ws-tab]")).filter(
      (el) => !el.hidden,
    );

  tablist.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ws-tab]");
    if (!btn || btn.hidden) return;
    selectWorkspaceTab(btn.getAttribute("data-ws-tab"), false);
  });

  tablist.addEventListener("focusin", (e) => {
    const btn = e.target.closest("[data-ws-tab]");
    if (!btn || btn.hidden) return;
    const nextId = btn.getAttribute("data-ws-tab");
    if (nextId && nextId !== activeWorkspaceTab) {
      selectWorkspaceTab(nextId, false);
    }
  });

  tablist.addEventListener("keydown", (e) => {
    if (Object.hasOwn(HTMLElement.prototype, "focusGroup")) return;
    if (
      ![
        "ArrowRight",
        "ArrowLeft",
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    const tabs = getVisibleTabs();
    if (!tabs.length) return;
    const idx = tabs.indexOf(document.activeElement);
    if (idx === -1) return;

    e.preventDefault();
    let nextIdx = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    selectWorkspaceTab(tabs[nextIdx].getAttribute("data-ws-tab"), true);
  });

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
  const labelTitle = String(
    customTitle || (titleInput && titleInput.value) || "",
  ).trim();
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
      eccLevel: "M",
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

function setupAdminUsernameValidation() {
  const usernameInput = document.getElementById("admin-teacher-username-input");
  const form = document.getElementById("admin-add-teacher-form");
  if (!usernameInput || !form) return;

  usernameInput.setAttribute("aria-invalid", "false");

  const updateValidity = () => {
    const val = normalizeUsername(usernameInput.value);
    const valid = isValidUsername(val);
    const matchesNativeInvalid =
      typeof CSS !== "undefined" &&
      CSS.supports("selector(:user-invalid)") &&
      usernameInput.matches(":user-invalid");

    if (
      matchesNativeInvalid ||
      (!valid && usernameInput.dataset.touched === "true")
    ) {
      usernameInput.classList.add("user-invalid-fallback");
      usernameInput.setAttribute("aria-invalid", "true");
      syncFieldErrorDescribe(usernameInput, true);
    } else {
      usernameInput.classList.remove("user-invalid-fallback");
      usernameInput.setAttribute("aria-invalid", "false");
      syncFieldErrorDescribe(usernameInput, false);
    }
  };

  usernameInput.addEventListener("blur", () => {
    if (usernameInput.value.trim()) {
      usernameInput.dataset.touched = "true";
      updateValidity();
    }
  });

  usernameInput.addEventListener("input", () => {
    if (usernameInput.getAttribute("aria-invalid") === "true") {
      updateValidity();
    }
  });

  usernameInput.addEventListener("invalid", () => {
    usernameInput.dataset.touched = "true";
    updateValidity();
  });

  form.addEventListener("submit", handleAddTeacherSubmit);
}

// ============================================================================
// Reusable DOM Form Builders (Sign-In Form & Strong Password Change Form)
// ============================================================================

function createPasswordInputWithToggle({
  id,
  name,
  autocomplete,
  placeholder,
  enterkeyhint = "done",
  minLength = 0,
  maxLength = 128,
  pattern = "",
  ariaDescribedBy = "",
  dataError = "",
}) {
  const strings = t();
  const wrap = document.createElement("div");
  wrap.className = "password-input-wrap";

  const inp = document.createElement("input");
  inp.type = "password";
  inp.id = id;
  inp.name = name;
  inp.autocomplete = autocomplete;
  inp.placeholder = placeholder;
  inp.enterKeyHint = enterkeyhint;
  inp.required = true;
  inp.maxLength = maxLength;
  inp.setAttribute("aria-invalid", "false");
  if (minLength > 0) inp.minLength = minLength;
  if (pattern) inp.pattern = pattern;
  if (ariaDescribedBy) inp.setAttribute("aria-describedby", ariaDescribedBy);
  if (dataError) inp.dataset.error = dataError;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "password-toggle-btn";
  toggleBtn.setAttribute("aria-pressed", "false");
  toggleBtn.textContent = strings.showPasswordBtn;
  toggleBtn.addEventListener("click", () => {
    const showing = inp.type === "text";
    inp.type = showing ? "password" : "text";
    toggleBtn.setAttribute("aria-pressed", showing ? "false" : "true");
    toggleBtn.textContent = showing ? t().showPasswordBtn : t().hidePasswordBtn;
    inp.focus({ preventScroll: true });
  });

  wrap.appendChild(inp);
  wrap.appendChild(toggleBtn);
  return { wrap, inp, toggleBtn };
}

function buildSignInFormElement(prefixId) {
  const strings = t();
  const form = document.createElement("form");
  form.className = "auth-login-form";
  form.id = `${prefixId}-login-form`;

  // Username field
  const userGroup = document.createElement("div");
  userGroup.className = "field-group";
  const userLabel = document.createElement("label");
  userLabel.htmlFor = `${prefixId}-username`;
  userLabel.textContent = strings.loginUsernameLabel;
  const userInput = document.createElement("input");
  userInput.type = "text";
  userInput.id = `${prefixId}-username`;
  userInput.name = "username";
  userInput.autocomplete = "username";
  userInput.setAttribute("autocorrect", "off");
  userInput.setAttribute("autocapitalize", "none");
  userInput.spellcheck = false;
  userInput.enterKeyHint = "next";
  userInput.placeholder = strings.loginUsernamePlaceholder;
  userInput.required = true;
  userInput.maxLength = 64;
  userGroup.appendChild(userLabel);
  userGroup.appendChild(userInput);

  // Password field
  const passGroup = document.createElement("div");
  passGroup.className = "field-group";
  const passLabel = document.createElement("label");
  passLabel.htmlFor = `${prefixId}-password`;
  passLabel.textContent = strings.loginPasswordLabel;
  const passCtrl = createPasswordInputWithToggle({
    id: `${prefixId}-password`,
    name: "password",
    autocomplete: "current-password",
    placeholder: strings.loginPasswordPlaceholder,
    enterkeyhint: "done",
  });
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passCtrl.wrap);

  form.appendChild(userGroup);
  form.appendChild(passGroup);

  if (authState.authError) {
    const errP = document.createElement("p");
    errP.className = "field-error";
    errP.setAttribute("role", "alert");
    errP.textContent = authState.authError;
    form.appendChild(errP);
  }

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-primary btn-full";
  submitBtn.disabled = isSigningIn;
  submitBtn.textContent = isSigningIn
    ? strings.signingInBtn
    : strings.signInBtn;
  form.appendChild(submitBtn);

  const forgotNote = document.createElement("p");
  forgotNote.className = "field-hint auth-student-note";
  forgotNote.textContent = strings.forgotPasswordHint;
  form.appendChild(forgotNote);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await signInWithUsernamePassword(userInput.value, passCtrl.inp.value);
  });

  return form;
}

function buildPasswordChangeFormElement(prefixId, isMandatory) {
  const strings = t();
  const box = document.createElement("div");
  box.className = "auth-gate-box is-password-change";

  const badge = document.createElement("span");
  badge.className = "teacher-verified-pill is-warning";
  badge.textContent = strings.mustChangeBadge;
  box.appendChild(badge);

  if (isMandatory) {
    const h3 = document.createElement("h3");
    h3.className = "auth-gate-title";
    h3.textContent = strings.mustChangeTitle;
    box.appendChild(h3);
  }

  const desc = document.createElement("p");
  desc.className = "auth-gate-desc";
  desc.textContent = isMandatory
    ? strings.mustChangeDescFmt(authState.username)
    : strings.voluntaryChangeDescFmt(authState.username);
  box.appendChild(desc);

  const form = document.createElement("form");
  form.className = "auth-password-change-form";
  form.id = `${prefixId}-pwd-change-form`;
  form.noValidate = true;

  // Hidden username field so browser password managers associate the new password properly
  const hiddenUser = document.createElement("input");
  hiddenUser.type = "text";
  hiddenUser.name = "username";
  hiddenUser.autocomplete = "username";
  hiddenUser.value = authState.username;
  hiddenUser.readOnly = true;
  hiddenUser.tabIndex = -1;
  hiddenUser.className = "visually-hidden";
  form.appendChild(hiddenUser);

  // Current / One-Time Password input (shown when voluntary change OR if page was reloaded)
  let currentPassCtrl = null;
  const needsCurrentInput = !isMandatory || !ephemeralLoginPassword;
  if (needsCurrentInput) {
    const curGroup = document.createElement("div");
    curGroup.className = "field-group";
    const curLabel = document.createElement("label");
    curLabel.htmlFor = `${prefixId}-current-pwd`;
    curLabel.textContent = strings.currentPasswordLabel;
    currentPassCtrl = createPasswordInputWithToggle({
      id: `${prefixId}-current-pwd`,
      name: "current-password",
      autocomplete: "current-password",
      placeholder: strings.currentPasswordPlaceholder,
      enterkeyhint: "next",
    });
    curGroup.appendChild(curLabel);
    curGroup.appendChild(currentPassCtrl.wrap);
    form.appendChild(curGroup);
  }

  // New Strong Password field + checklist above input (Modern Web Guidance `validate-input-after-interaction`)
  const newGroup = document.createElement("div");
  newGroup.className = "field-group";
  const newLabel = document.createElement("label");
  newLabel.htmlFor = `${prefixId}-new-pwd`;
  newLabel.textContent = strings.newPasswordLabel;

  const rulesId = `${prefixId}-pwd-rules`;
  const newErrorId = `${prefixId}-new-pwd-error`;
  const rulesList = document.createElement("ul");
  rulesList.id = rulesId;
  rulesList.className = "password-rules-list";

  const ruleDefs = [
    { key: "minLength", text: strings.pwdRuleMinLen },
    { key: "hasUpper", text: strings.pwdRuleUpper },
    { key: "hasLower", text: strings.pwdRuleLower },
    { key: "hasDigit", text: strings.pwdRuleDigit },
    { key: "hasSpecial", text: strings.pwdRuleSpecial },
  ];
  const ruleDomMap = {};
  ruleDefs.forEach((r) => {
    const li = document.createElement("li");
    li.className = "password-rule-item";
    const icon = document.createElement("span");
    icon.className = "password-rule-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "•";
    const txt = document.createElement("span");
    txt.textContent = r.text;
    li.appendChild(icon);
    li.appendChild(txt);
    rulesList.appendChild(li);
    ruleDomMap[r.key] = { li, icon };
  });

  const newPassCtrl = createPasswordInputWithToggle({
    id: `${prefixId}-new-pwd`,
    name: "new-password",
    autocomplete: "new-password",
    placeholder: strings.newPasswordPlaceholder,
    enterkeyhint: "next",
    minLength: 8,
    maxLength: 128,
    pattern: STRONG_PASSWORD_HTML_PATTERN,
    ariaDescribedBy: rulesId,
    dataError: newErrorId,
  });

  const newErrorDiv = document.createElement("div");
  newErrorDiv.id = newErrorId;
  newErrorDiv.className = "password-field-error";
  newErrorDiv.innerHTML = `<span role="img" aria-label="Error">❌</span> ${escapeText(strings.pwdComplexityError)}`;

  newGroup.appendChild(newLabel);
  newGroup.appendChild(rulesList);
  newGroup.appendChild(newPassCtrl.wrap);
  newGroup.appendChild(newErrorDiv);
  form.appendChild(newGroup);

  // Confirm New Password field
  const confirmGroup = document.createElement("div");
  confirmGroup.className = "field-group";
  const confirmLabel = document.createElement("label");
  confirmLabel.htmlFor = `${prefixId}-confirm-pwd`;
  confirmLabel.textContent = strings.confirmPasswordLabel;
  const confirmErrorId = `${prefixId}-confirm-pwd-error`;
  const confirmPassCtrl = createPasswordInputWithToggle({
    id: `${prefixId}-confirm-pwd`,
    name: "confirm-password",
    autocomplete: "new-password",
    placeholder: strings.confirmPasswordPlaceholder,
    enterkeyhint: "done",
    dataError: confirmErrorId,
  });
  const confirmErrorDiv = document.createElement("div");
  confirmErrorDiv.id = confirmErrorId;
  confirmErrorDiv.className = "password-field-error";
  confirmErrorDiv.innerHTML = `<span role="img" aria-label="Error">❌</span> ${escapeText(strings.pwdMismatchError)}`;

  confirmGroup.appendChild(confirmLabel);
  confirmGroup.appendChild(confirmPassCtrl.wrap);
  confirmGroup.appendChild(confirmErrorDiv);
  form.appendChild(confirmGroup);

  // Live checklist & post-interaction validation
  const syncLiveChecklist = (showInvalidIfDirty = false) => {
    const val = newPassCtrl.inp.value;
    const { valid, checks } = evaluatePasswordStrength(val);
    Object.keys(ruleDomMap).forEach((k) => {
      const met = Boolean(checks[k]);
      ruleDomMap[k].li.classList.toggle("is-met", met);
      ruleDomMap[k].icon.textContent = met ? "✓" : "•";
    });

    if (showInvalidIfDirty || newPassCtrl.inp.dataset.touched === "true") {
      newPassCtrl.inp.classList.toggle("user-invalid-fallback", !valid);
      newPassCtrl.inp.classList.toggle("user-valid-fallback", valid);
      newPassCtrl.inp.setAttribute("aria-invalid", valid ? "false" : "true");
      newErrorDiv.classList.toggle("is-visible", !valid);
      syncFieldErrorDescribe(newPassCtrl.inp, !valid);
    }

    if (
      confirmPassCtrl.inp.dataset.touched === "true" &&
      confirmPassCtrl.inp.value
    ) {
      const match = confirmPassCtrl.inp.value === val;
      confirmPassCtrl.inp.classList.toggle("user-invalid-fallback", !match);
      confirmPassCtrl.inp.classList.toggle(
        "user-valid-fallback",
        match && valid,
      );
      confirmPassCtrl.inp.setAttribute(
        "aria-invalid",
        match ? "false" : "true",
      );
      confirmErrorDiv.classList.toggle("is-visible", !match);
      syncFieldErrorDescribe(confirmPassCtrl.inp, !match);
    }
  };

  newPassCtrl.inp.addEventListener("input", () => syncLiveChecklist(false));
  newPassCtrl.inp.addEventListener("blur", () => {
    if (newPassCtrl.inp.value) {
      newPassCtrl.inp.dataset.touched = "true";
      syncLiveChecklist(true);
    }
  });

  confirmPassCtrl.inp.addEventListener("input", () => {
    if (confirmPassCtrl.inp.dataset.touched === "true")
      syncLiveChecklist(false);
  });
  confirmPassCtrl.inp.addEventListener("blur", () => {
    if (confirmPassCtrl.inp.value) {
      confirmPassCtrl.inp.dataset.touched = "true";
      syncLiveChecklist(false);
    }
  });

  if (authState.authError) {
    const errP = document.createElement("p");
    errP.className = "field-error";
    errP.setAttribute("role", "alert");
    errP.textContent = authState.authError;
    form.appendChild(errP);
  }

  const actionsRow = document.createElement("div");
  actionsRow.className = "studio-btn-row auth-modal-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn btn-primary";
  saveBtn.disabled = isChangingPassword;
  saveBtn.textContent = isChangingPassword
    ? strings.savingNewPasswordBtn
    : strings.saveNewPasswordBtn;
  actionsRow.appendChild(saveBtn);

  if (isMandatory) {
    const outBtn = document.createElement("button");
    outBtn.type = "button";
    outBtn.className = "btn btn-ghost";
    outBtn.textContent = strings.signOutBtn;
    outBtn.addEventListener("click", signOutTeacher);
    actionsRow.appendChild(outBtn);
  } else {
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = strings.cancelEditBtn;
    cancelBtn.addEventListener("click", () => {
      voluntaryPasswordModalOpen = false;
      const dlg = document.getElementById("teacher-auth-dialog");
      if (dlg && dlg.open) dlg.close();
    });
    actionsRow.appendChild(cancelBtn);
  }

  form.appendChild(actionsRow);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    newPassCtrl.inp.dataset.touched = "true";
    confirmPassCtrl.inp.dataset.touched = "true";
    syncLiveChecklist(true);

    const strength = evaluatePasswordStrength(newPassCtrl.inp.value);
    if (!strength.valid) {
      newPassCtrl.inp.focus();
      return;
    }
    if (confirmPassCtrl.inp.value !== newPassCtrl.inp.value) {
      confirmErrorDiv.classList.add("is-visible");
      confirmPassCtrl.inp.setAttribute("aria-invalid", "true");
      confirmPassCtrl.inp.focus();
      return;
    }

    await submitPasswordChange({
      currentPassword: currentPassCtrl ? currentPassCtrl.inp.value : "",
      newPassword: newPassCtrl.inp.value,
      confirmPassword: confirmPassCtrl.inp.value,
    });
  });

  box.appendChild(form);
  return box;
}

// ============================================================================
// UI Rendering: Header, Workspace Banner, History Cards, Admin Table, Modals
// ============================================================================

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
    btn.title = `${authState.username} (${strings.roleSuperAdminTag})`;
    if (dot) dot.hidden = false;
  } else if (authState.status === "teacher") {
    btn.classList.add("is-authed");
    fullLabel.textContent = strings.headerTeacherFull;
    shortLabel.textContent = strings.headerTeacherShort;
    btn.title = authState.username;
    if (dot) dot.hidden = false;
  } else if (authState.status === "must_change_password") {
    btn.classList.add("is-super-admin");
    fullLabel.textContent = strings.headerMustChangeFull;
    shortLabel.textContent = strings.headerMustChangeShort;
    btn.title = authState.username;
    if (dot) dot.hidden = false;
  } else if (authState.status === "unauthorized") {
    btn.classList.add("is-unauth");
    fullLabel.textContent = strings.headerUnauthorizedFull;
    shortLabel.textContent = strings.headerUnauthorizedShort;
    btn.title = authState.username;
    if (dot) dot.hidden = false;
  } else {
    fullLabel.textContent = strings.headerSignInFull;
    shortLabel.textContent = strings.headerSignInShort;
    btn.title = strings.headerSignInFull;
    if (dot) dot.hidden = true;
  }

  if (
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.syncHeader === "function"
  ) {
    window.SnowDayPortal.syncHeader();
  }
}

function renderWorkspaceBanner() {
  if (!authState.isAuthorizedTeacher) return;
  const strings = t();

  const avatarEl = document.getElementById("ws-user-avatar");
  if (avatarEl) {
    avatarEl.innerHTML = "";
    const initial = (authState.displayName || authState.username || "T")
      .charAt(0)
      .toUpperCase();
    avatarEl.textContent = initial;
  }

  const rolePill = document.getElementById("ws-role-pill");
  if (rolePill) {
    rolePill.className =
      "teacher-verified-pill" + (authState.isSuperAdmin ? " is-admin" : "");
    rolePill.textContent = authState.isSuperAdmin
      ? strings.verifiedAdminBadge
      : strings.verifiedTeacherBadge;
  }

  const emailChip = document.getElementById("ws-user-email");
  if (emailChip) emailChip.textContent = `@${authState.username}`;

  const headingEl = document.getElementById("ws-welcome-heading");
  if (headingEl) {
    headingEl.textContent = authState.displayName
      ? strings.wsWelcomeNamedFmt(authState.displayName)
      : strings.wsWelcomeNamedFmt(authState.username);
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
    const aiTotal = cachedPersonalDocs.filter(
      (d) => d.status === "ai_generated",
    ).length;
    aiCountEl.textContent = String(aiTotal);
  }
  if (teachersWrap) {
    teachersWrap.hidden = !authState.isSuperAdmin;
    if (teachersCountEl)
      teachersCountEl.textContent = String(cachedTeachersList.length);
  }

  const returnLessonBtn = document.getElementById("ws-return-lesson-btn");
  if (returnLessonBtn) {
    const ctx =
      window.SnowDayPortal &&
      typeof window.SnowDayPortal.getActiveLessonContext === "function"
        ? window.SnowDayPortal.getActiveLessonContext()
        : { hasLesson: false };
    returnLessonBtn.hidden = !ctx.hasLesson;
    returnLessonBtn.textContent = strings.wsReturnLessonBtn;
  }

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
  setTxt("ws-change-password-btn", strings.changePasswordBtn);
  setTxt("ws-signout-btn", strings.signOutBtn);

  setTxt("ws-tab-history-label", strings.tabHistoryLabel);
  setTxt("ws-tab-create-label", strings.tabCreateLabel);
  setTxt("ws-tab-admin-label", strings.tabAdminLabel);
  setTxt("ws-tab-settings-label", strings.tabSettingsLabel);
  setTxt("ws-tab-history-short", strings.tabHistoryShort);
  setTxt("ws-tab-create-short", strings.tabCreateShort);
  setTxt("ws-tab-admin-short", strings.tabAdminShort);
  setTxt("ws-tab-settings-short", strings.tabSettingsShort);

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
  setTxt("admin-username-label-text", strings.addUsernameLabel);
  setTxt("admin-teacher-username-hint", strings.addUsernameHint);
  setPh("admin-teacher-username-input", strings.addUsernamePlaceholder);
  setTxt("admin-username-error-text", strings.addUsernameError);
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

  const tableEl = document.getElementById("ws-admin-table");
  if (tableEl) {
    tableEl.style.setProperty("--label-2", JSON.stringify(strings.colNote));
    tableEl.style.setProperty("--label-3", JSON.stringify(strings.colRole));
    tableEl.style.setProperty("--label-4", JSON.stringify(strings.colStatus));
    tableEl.style.setProperty("--label-5", JSON.stringify(strings.colActions));
  }

  renderAdminCredentialsCard(false);

  // Settings panel
  setTxt("ws-settings-heading", strings.settingsHeading);
  setTxt("ws-settings-desc", strings.settingsDesc);
}

function renderImportFromBrowserButton() {
  const btn = document.getElementById("ws-import-local-btn");
  if (!btn || !authState.isAuthorizedTeacher) return;

  const recents =
    window.SnowDayPortal &&
    typeof window.SnowDayPortal.listRecentCachedLessons === "function"
      ? window.SnowDayPortal.listRecentCachedLessons() || []
      : [];
  const existingKeys = new Set(cachedPersonalDocs.map((d) => d.docKey));
  const unsavedCount = recents.filter((r) => {
    const norm =
      r && r.sampleDocUrl ? normalizeHttpsDocUrl(r.sampleDocUrl) : "";
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
    const hay = [
      item.title,
      item.subject,
      item.classLabel,
      item.personalNote,
      item.docUrl,
    ]
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

    const metaTop = document.createElement("div");
    metaTop.className = "ws-doc-meta-top";

    const statusBadge = document.createElement("span");
    statusBadge.className =
      "ws-doc-status-pill" +
      (item.status === "ai_generated" ? " is-ai" : " is-qr");
    statusBadge.textContent =
      item.status === "ai_generated"
        ? strings.statusAiBadge
        : strings.statusQrBadge;
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

    const titleEl = document.createElement("h3");
    titleEl.className = "ws-doc-title";
    titleEl.textContent =
      item.title || strings.untitledDocFmt(item.docKey.slice(0, 8));
    card.appendChild(titleEl);

    const timeLine = document.createElement("p");
    timeLine.className = "ws-doc-timeline";
    timeLine.textContent = `${strings.updatedLabelPrefix}${formatDateTime(item.updatedAtMs)} · ${strings.sharedCountFmt(item.shareCount)}`;
    card.appendChild(timeLine);

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
            preserveExistingNotes: false,
          });
          editingDocKey = "";
          showHistoryToast(strings.updatedDocToast, false);
        } catch (err) {
          showHistoryToast(
            strings.genericSaveErrorPrefix +
              ((err && err.message) || String(err)),
            true,
          );
          saveBtn.disabled = false;
        }
      });

      card.appendChild(editForm);
    }

    const actionsRow = document.createElement("footer");
    actionsRow.className = "ws-doc-actions";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn btn-small btn-primary";
    openBtn.textContent = strings.docOpenLessonBtn;
    openBtn.addEventListener("click", () => {
      if (
        window.SnowDayPortal &&
        typeof window.SnowDayPortal.openDocUrlWithHistory === "function"
      ) {
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
        preserveExistingNotes: true,
      }).catch(() => {});
    });

    // Secondary actions live in a compact overflow menu (keeps cards tidy on phones)
    const moreMenu = document.createElement("details");
    moreMenu.className = "ws-doc-more";
    const moreSummary = document.createElement("summary");
    moreSummary.className = "btn btn-small btn-ghost ws-doc-more-btn";
    moreSummary.setAttribute("aria-label", strings.docMoreActionsLabel);
    moreSummary.title = strings.docMoreActionsLabel;
    moreSummary.textContent = "⋯";
    const moreList = document.createElement("div");
    moreList.className = "ws-doc-more-menu";
    moreMenu.appendChild(moreSummary);
    moreMenu.appendChild(moreList);

    const makeMenuItem = (label, tagName = "button") => {
      const el = document.createElement(tagName);
      if (tagName === "button") el.type = "button";
      el.className = "ws-menu-item";
      el.textContent = label;
      moreList.appendChild(el);
      return el;
    };

    const copyBtn = makeMenuItem(strings.docCopyStudentLinkBtn);
    copyBtn.addEventListener("click", async () => {
      moreMenu.open = false;
      const link =
        item.studentQrUrl || computeStudentUrlForWorkspace(item.docUrl);
      try {
        await navigator.clipboard.writeText(link);
        showHistoryToast(strings.copiedLinkToast, false);
      } catch (_e) {
        showHistoryToast(link, false);
      }
    });

    const editBtn = makeMenuItem(strings.docEditDetailsBtn);
    editBtn.addEventListener("click", () => {
      editingDocKey = editingDocKey === item.docKey ? "" : item.docKey;
      renderPersonalDocsGrid();
    });

    if (item.docUrl && item.docUrl.startsWith("https://")) {
      const gdocLink = makeMenuItem(strings.docOpenGoogleBtn, "a");
      gdocLink.href = item.docUrl;
      gdocLink.target = "_blank";
      gdocLink.rel = "noopener noreferrer";
      gdocLink.addEventListener("click", () => {
        moreMenu.open = false;
      });
    }

    const delBtn = makeMenuItem(strings.docDeleteBtn);
    delBtn.classList.add("is-danger");
    delBtn.addEventListener("click", async () => {
      // Two-step confirmation: first click arms the button, second click deletes
      if (delBtn.dataset.armed !== "true") {
        delBtn.dataset.armed = "true";
        delBtn.textContent = strings.docDeleteConfirmBtn;
        return;
      }
      delBtn.disabled = true;
      try {
        await deleteDoc(
          doc(db, "teachers", authState.username, "docs", item.docKey),
        );
        showHistoryToast(strings.deletedDocToast, false);
      } catch (err) {
        delBtn.disabled = false;
        showHistoryToast(
          strings.genericSaveErrorPrefix +
            ((err && err.message) || String(err)),
          true,
        );
      }
    });
    moreMenu.addEventListener("toggle", () => {
      if (!moreMenu.open && delBtn.dataset.armed === "true") {
        delBtn.dataset.armed = "false";
        delBtn.textContent = strings.docDeleteBtn;
      }
    });

    actionsRow.appendChild(openBtn);
    actionsRow.appendChild(qrBtn);
    actionsRow.appendChild(moreMenu);

    card.appendChild(actionsRow);
    grid.appendChild(card);
  });
}

function renderAdminCredentialsCard(scrollIntoViewNow = false) {
  const card = document.getElementById("admin-credentials-card");
  if (!card) return;

  if (!authState.isSuperAdmin || !latestGeneratedCredentials) {
    card.hidden = true;
    card.innerHTML = "";
    return;
  }

  const strings = t();
  const { mode, username, oneTimePassword } = latestGeneratedCredentials;
  card.hidden = false;
  card.innerHTML = "";

  const hdr = document.createElement("div");
  hdr.className = "admin-cred-header";

  const title = document.createElement("h3");
  title.className = "admin-cred-title";
  title.textContent =
    mode === "reset"
      ? strings.credResetTitleFmt(username)
      : strings.credCreatedTitleFmt(username);

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "btn btn-small btn-ghost";
  dismissBtn.textContent = strings.dismissCredsBtn;
  dismissBtn.addEventListener("click", () => {
    latestGeneratedCredentials = null;
    renderAdminCredentialsCard(false);
  });

  hdr.appendChild(title);
  hdr.appendChild(dismissBtn);
  card.appendChild(hdr);

  const warn = document.createElement("p");
  warn.className = "admin-cred-warning";
  warn.textContent = strings.credWarningText;
  card.appendChild(warn);

  const grid = document.createElement("div");
  grid.className = "admin-cred-grid";

  const makeCredField = (labelText, codeVal) => {
    const field = document.createElement("div");
    field.className = "admin-cred-field";

    const info = document.createElement("div");
    info.className = "admin-cred-field-info";
    const lbl = document.createElement("span");
    lbl.className = "admin-cred-label";
    lbl.textContent = labelText;
    const code = document.createElement("code");
    code.className = "admin-cred-code";
    code.textContent = codeVal;
    info.appendChild(lbl);
    info.appendChild(code);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-small btn-secondary";
    copyBtn.textContent = strings.copyBtnShort;
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeVal);
        copyBtn.textContent = t().copiedBtnShort;
        setTimeout(() => {
          copyBtn.textContent = t().copyBtnShort;
        }, 2000);
      } catch (_e) {}
    });

    field.appendChild(info);
    field.appendChild(copyBtn);
    return field;
  };

  grid.appendChild(makeCredField(strings.credUsernameLabel, username));
  grid.appendChild(makeCredField(strings.credPasswordLabel, oneTimePassword));
  card.appendChild(grid);

  const actions = document.createElement("div");
  actions.className = "admin-cred-actions";

  const copyBothBtn = document.createElement("button");
  copyBothBtn.type = "button";
  copyBothBtn.className = "btn btn-small btn-primary";
  copyBothBtn.textContent = strings.copyBothCredsBtn;
  copyBothBtn.addEventListener("click", async () => {
    const textBlock =
      `SnowDay Class\n` +
      `Username: ${username}\n` +
      `One-Time Password: ${oneTimePassword}`;
    try {
      await navigator.clipboard.writeText(textBlock);
      copyBothBtn.textContent = t().copiedBtnShort;
      setTimeout(() => {
        copyBothBtn.textContent = t().copyBothCredsBtn;
      }, 2200);
    } catch (_e) {}
  });

  actions.appendChild(copyBothBtn);
  card.appendChild(actions);

  if (scrollIntoViewNow) {
    try {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      copyBothBtn.focus({ preventScroll: true });
    } catch (_e) {}
  }
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
    "api-ping-status admin-feedback" +
    (adminFeedbackIsError ? " is-error" : "");
  feedbackEl.textContent = adminFeedbackMessage;
}

function renderAdminPanelDirectory() {
  if (!authState.isSuperAdmin) return;
  const strings = t();

  const totalCount = cachedTeachersList.length;
  const pendingCount = cachedTeachersList.filter(
    (m) => m.mustChangePassword,
  ).length;
  const activeCount = Math.max(0, totalCount - pendingCount);

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
    return [item.username, item.note, item.displayName]
      .join(" ")
      .toLowerCase()
      .includes(q);
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
    const isAdminItem = item.role === "super_admin";

    // Column 1: Sticky Row Header (<th>) — Username
    const th = document.createElement("th");
    th.scope = "row";

    const identityCell = document.createElement("div");
    identityCell.className = "admin-table-identity";

    const unameStrong = document.createElement("strong");
    unameStrong.textContent = item.username;
    identityCell.appendChild(unameStrong);

    th.appendChild(identityCell);
    tr.appendChild(th);

    // Column 2: Note / Subject (with inline edit)
    const tdNote = document.createElement("td");
    if (editingAdminTeacherUsername === item.username) {
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
        editingAdminTeacherUsername = "";
        renderAdminPanelDirectory();
      });

      inlineForm.appendChild(inp);
      inlineForm.appendChild(saveBtn);
      inlineForm.appendChild(cancelBtn);
      inlineForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        saveAdminTeacherNote(item.username, inp.value);
      });
      tdNote.appendChild(inlineForm);
      requestAnimationFrame(() => inp.focus());
    } else {
      tdNote.textContent = item.note || "—";
    }
    tr.appendChild(tdNote);

    // Column 3: Role
    const tdRole = document.createElement("td");
    const roleTag = document.createElement("span");
    roleTag.className = "teacher-role-tag" + (isAdminItem ? " is-admin" : "");
    roleTag.textContent = isAdminItem
      ? strings.roleSuperAdminTag
      : strings.roleTeacherTag;
    tdRole.appendChild(roleTag);
    tr.appendChild(tdRole);

    // Column 4: Password & Login Status
    const tdStatus = document.createElement("td");
    const statusPill = document.createElement("span");
    if (item.mustChangePassword) {
      statusPill.className = "admin-status-pill is-pending";
      statusPill.textContent = strings.statusOneTimePending;
    } else {
      statusPill.className = "admin-status-pill is-active";
      statusPill.textContent =
        item.lastLoginAtMs > 0
          ? `✓ ${strings.statusActiveReady} · ${formatDateTime(item.lastLoginAtMs)}`
          : `✓ ${strings.statusActiveReady}`;
    }
    tdStatus.appendChild(statusPill);
    tr.appendChild(tdStatus);

    // Column 5: Actions (Revealed via three-dotted menu to keep table neat and un-squished)
    const tdActions = document.createElement("td");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "admin-row-actions";

    if (!isAdminItem && confirmingResetUsername === item.username) {
      const confirmBox = document.createElement("div");
      confirmBox.className = "admin-inline-confirm is-reset";
      const lbl = document.createElement("span");
      lbl.className = "admin-inline-confirm-label";
      lbl.textContent = strings.resetConfirmPrompt;

      const yesBtn = document.createElement("button");
      yesBtn.type = "button";
      yesBtn.className = "btn btn-small btn-primary";
      yesBtn.textContent = strings.confirmYesBtn;
      yesBtn.addEventListener("click", () =>
        resetTeacherPasswordByAdmin(item.username, yesBtn),
      );

      const noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "btn btn-small btn-ghost";
      noBtn.textContent = strings.cancelEditBtn;
      noBtn.addEventListener("click", () => {
        confirmingResetUsername = "";
        renderAdminPanelDirectory();
      });

      confirmBox.appendChild(lbl);
      confirmBox.appendChild(yesBtn);
      confirmBox.appendChild(noBtn);
      actionsWrap.appendChild(confirmBox);
    } else if (!isAdminItem && confirmingDeleteUsername === item.username) {
      const delConfirm = document.createElement("div");
      delConfirm.className = "admin-inline-confirm";
      const lbl = document.createElement("span");
      lbl.className = "admin-inline-confirm-label";
      lbl.textContent = strings.deleteConfirmPrompt;

      const yesDelBtn = document.createElement("button");
      yesDelBtn.type = "button";
      yesDelBtn.className = "btn btn-small btn-danger-ghost";
      yesDelBtn.textContent = strings.confirmYesBtn;
      yesDelBtn.addEventListener("click", () =>
        removeTeacherByUsername(item.username, yesDelBtn),
      );

      const noDelBtn = document.createElement("button");
      noDelBtn.type = "button";
      noDelBtn.className = "btn btn-small btn-ghost";
      noDelBtn.textContent = strings.cancelEditBtn;
      noDelBtn.addEventListener("click", () => {
        confirmingDeleteUsername = "";
        renderAdminPanelDirectory();
      });

      delConfirm.appendChild(lbl);
      delConfirm.appendChild(yesDelBtn);
      delConfirm.appendChild(noDelBtn);
      actionsWrap.appendChild(delConfirm);
    } else {
      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "btn btn-small btn-ghost admin-row-menu-btn";
      const menuLabel = `${strings.actionsMenuBtn || strings.colActions} (${item.username})`;
      menuBtn.setAttribute("aria-label", menuLabel);
      menuBtn.title = strings.actionsMenuBtn || strings.colActions;
      menuBtn.setAttribute("aria-haspopup", "menu");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="10" cy="4" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="10" cy="16" r="1.8"/></svg>`;

      const menuEl = document.createElement("div");
      menuEl.className = "admin-actions-menu";
      menuEl.setAttribute("popover", "auto");
      menuEl.setAttribute("role", "menu");
      menuEl.setAttribute("aria-label", menuLabel);

      const closeMenu = () => {
        if (menuEl.hidePopover) {
          try {
            menuEl.hidePopover();
          } catch (_e) {}
        }
        menuEl.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      };

      const positionMenu = () => {
        const rect = menuBtn.getBoundingClientRect();
        const menuWidth = menuEl.offsetWidth || 190;
        const menuHeight = menuEl.offsetHeight || 120;

        let left = rect.right - menuWidth;
        if (left < 8) left = 8;
        if (left + menuWidth > window.innerWidth - 8) {
          left = window.innerWidth - menuWidth - 8;
        }

        let top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight - 8) {
          top = Math.max(8, rect.top - menuHeight - 4);
        }

        menuEl.style.position = "fixed";
        menuEl.style.top = `${Math.round(top)}px`;
        menuEl.style.left = `${Math.round(left)}px`;
        menuEl.style.margin = "0";
      };

      // 1. Edit Note / "შეცვლა"
      const editNoteBtn = document.createElement("button");
      editNoteBtn.type = "button";
      editNoteBtn.className = "btn btn-small btn-ghost admin-menu-item";
      editNoteBtn.innerHTML = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-7"/><path d="M15.5 2.5a2.121 2.121 0 0 1 3 3L10 14l-4 1 1-4 8.5-8.5z"/></svg><span>${strings.editTeacherNoteBtn}</span>`;
      editNoteBtn.addEventListener("click", () => {
        closeMenu();
        editingAdminTeacherUsername =
          editingAdminTeacherUsername === item.username ? "" : item.username;
        renderAdminPanelDirectory();
      });
      menuEl.appendChild(editNoteBtn);

      if (!isAdminItem) {
        // 2. Reset Password
        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "btn btn-small btn-warning-ghost admin-menu-item";
        resetBtn.innerHTML = `<span>${strings.resetPasswordBtn}</span>`;
        resetBtn.addEventListener("click", () => {
          closeMenu();
          confirmingDeleteUsername = "";
          confirmingResetUsername = item.username;
          renderAdminPanelDirectory();
        });
        menuEl.appendChild(resetBtn);

        // 3. Remove Teacher
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-small btn-danger-ghost admin-menu-item";
        delBtn.innerHTML = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h14M8 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2M5 6v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6"/></svg><span>${strings.removeTeacherBtn}</span>`;
        const srLabel = document.createElement("span");
        srLabel.className = "visually-hidden";
        srLabel.textContent = ` (${item.username})`;
        delBtn.appendChild(srLabel);
        delBtn.addEventListener("click", () => {
          closeMenu();
          confirmingResetUsername = "";
          confirmingDeleteUsername = item.username;
          renderAdminPanelDirectory();
        });
        menuEl.appendChild(delBtn);
      } else {
        const lockSpan = document.createElement("div");
        lockSpan.className = "admin-menu-item admin-protected-note";
        lockSpan.innerHTML = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/></svg><span>${strings.protectedAdminLabel}</span>`;
        menuEl.appendChild(lockSpan);
      }

      menuBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        document.querySelectorAll(".admin-actions-menu").forEach((other) => {
          if (other !== menuEl) {
            if (other.hidePopover) {
              try {
                other.hidePopover();
              } catch (_e) {}
            }
            other.classList.remove("is-open");
            const otherBtn = other.parentElement?.querySelector(
              ".admin-row-menu-btn",
            );
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          }
        });

        if (menuEl.togglePopover) {
          try {
            menuEl.togglePopover();
          } catch (_e) {
            const isOpen = menuEl.classList.toggle("is-open");
            menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
            if (isOpen) {
              positionMenu();
              requestAnimationFrame(positionMenu);
            }
          }
        } else {
          const isOpen = menuEl.classList.toggle("is-open");
          menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
          if (isOpen) {
            positionMenu();
            requestAnimationFrame(positionMenu);
          }
        }
      });

      menuEl.addEventListener("beforetoggle", (ev) => {
        if (ev.newState === "open") {
          menuBtn.setAttribute("aria-expanded", "true");
          positionMenu();
          requestAnimationFrame(positionMenu);
        } else {
          menuBtn.setAttribute("aria-expanded", "false");
        }
      });

      menuEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.stopPropagation();
          closeMenu();
          menuBtn.focus();
        }
      });

      actionsWrap.appendChild(menuBtn);
      actionsWrap.appendChild(menuEl);
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
      badge.className =
        "teacher-verified-pill" + (authState.isSuperAdmin ? " is-admin" : "");
      badge.textContent = authState.isSuperAdmin
        ? strings.verifiedAdminBadge
        : strings.verifiedTeacherBadge;

      const unameSpan = document.createElement("span");
      unameSpan.className = "teacher-bar-email";
      unameSpan.textContent = `@${authState.username}`;

      identityWrap.appendChild(badge);
      identityWrap.appendChild(unameSpan);

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

  if (authState.status === "must_change_password") {
    gateBox.appendChild(buildPasswordChangeFormElement("gate", true));
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
    const unameStrong = document.createElement("strong");
    unameStrong.textContent = authState.username;
    desc.appendChild(unameStrong);
    desc.appendChild(document.createTextNode(strings.gateUnauthBodySuffix));

    const signOutBtn = document.createElement("button");
    signOutBtn.type = "button";
    signOutBtn.className = "btn btn-secondary";
    signOutBtn.textContent = strings.signOutBtn;
    signOutBtn.addEventListener("click", signOutTeacher);

    alertDiv.appendChild(badge);
    alertDiv.appendChild(title);
    alertDiv.appendChild(desc);
    alertDiv.appendChild(signOutBtn);
    gateBox.appendChild(alertDiv);
    return;
  }

  // Guest Username + Password Login Box
  const box = document.createElement("div");
  box.className = "auth-gate-box";

  const title = document.createElement("h3");
  title.className = "auth-gate-title";
  title.textContent = strings.gateGuestTitle;

  const desc = document.createElement("p");
  desc.className = "auth-gate-desc";
  desc.textContent = strings.gateGuestDesc;

  const studentHint = document.createElement("p");
  studentHint.className = "field-hint auth-student-note";
  studentHint.textContent = strings.gateStudentNote;

  box.appendChild(title);
  box.appendChild(desc);
  box.appendChild(buildSignInFormElement("landing"));
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
      window.SnowDayPortal &&
      typeof window.SnowDayPortal.getActiveLessonContext === "function"
        ? window.SnowDayPortal.getActiveLessonContext()
        : { hasLesson: false, docKey: "" };
    const isAlreadySaved = Boolean(
      ctx.docKey && cachedPersonalDocs.some((d) => d.docKey === ctx.docKey),
    );
    saveBtn.textContent = isAlreadySaved
      ? strings.ribbonSavedBtn
      : strings.ribbonSaveBtn;
    saveBtn.classList.toggle("is-saved-doc", isAlreadySaved);
  }
}

function renderAuthDialogContent() {
  const kickerEl = document.getElementById("auth-dialog-kicker");
  const titleEl = document.getElementById("auth-dialog-title");
  const bodyEl = document.getElementById("auth-dialog-body");
  const closeForm = document.getElementById("auth-dialog-close-form");
  if (!titleEl || !bodyEl) return;

  const strings = t();
  if (kickerEl) kickerEl.textContent = strings.authModalKicker;
  bodyEl.innerHTML = "";

  // Mandatory 1-time password change state
  if (authState.status === "must_change_password") {
    titleEl.textContent = strings.authModalTitleMustChange;
    if (closeForm) closeForm.hidden = true;
    bodyEl.appendChild(
      buildPasswordChangeFormElement("dialog-mandatory", true),
    );
    return;
  }

  if (closeForm) closeForm.hidden = false;

  // Voluntary password change requested by an active teacher / Super Admin
  if (voluntaryPasswordModalOpen && authState.isAuthorizedTeacher) {
    titleEl.textContent = strings.authModalTitleVoluntaryChange;
    bodyEl.appendChild(
      buildPasswordChangeFormElement("dialog-voluntary", false),
    );
    return;
  }

  if (authState.status === "unauthorized") {
    titleEl.textContent = strings.authModalTitleUnauth;

    const wrap = document.createElement("div");
    wrap.className = "auth-gate-box is-unauthorized";

    const desc = document.createElement("p");
    desc.className = "auth-gate-desc";
    desc.appendChild(document.createTextNode(strings.gateUnauthBodyPrefix));
    const strongName = document.createElement("strong");
    strongName.textContent = authState.username;
    desc.appendChild(strongName);
    desc.appendChild(document.createTextNode(strings.gateUnauthBodySuffix));

    const outBtn = document.createElement("button");
    outBtn.type = "button";
    outBtn.className = "btn btn-secondary";
    outBtn.textContent = strings.signOutBtn;
    outBtn.addEventListener("click", signOutTeacher);

    wrap.appendChild(desc);
    wrap.appendChild(outBtn);
    bodyEl.appendChild(wrap);
    return;
  }

  // Guest Username + Password Login Modal
  titleEl.textContent = strings.authModalTitleGuest;

  const desc = document.createElement("p");
  desc.className = "auth-gate-desc";
  desc.textContent = strings.gateGuestDesc;

  const note = document.createElement("p");
  note.className = "field-hint auth-student-note";
  note.textContent = strings.gateStudentNote;

  bodyEl.appendChild(desc);
  bodyEl.appendChild(buildSignInFormElement("dialog"));
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
        openWorkspaceView(
          authState.isSuperAdmin ? activeWorkspaceTab : "history",
        );
      } else {
        openAuthDialog();
      }
    });
  }

  // Prevent Esc closing the dialog while mandatory 1-time password change is active
  const authDlg = document.getElementById("teacher-auth-dialog");
  if (authDlg) {
    authDlg.addEventListener("cancel", (ev) => {
      if (authState.status === "must_change_password") {
        ev.preventDefault();
      } else {
        voluntaryPasswordModalOpen = false;
      }
    });
    authDlg.addEventListener("close", () => {
      voluntaryPasswordModalOpen = false;
    });
  }

  const returnLessonBtn = document.getElementById("ws-return-lesson-btn");
  if (returnLessonBtn) {
    returnLessonBtn.addEventListener("click", () => {
      if (
        window.SnowDayPortal &&
        typeof window.SnowDayPortal.returnToActiveLesson === "function"
      ) {
        window.SnowDayPortal.returnToActiveLesson();
      }
    });
  }

  const studentHubBtn = document.getElementById("ws-student-hub-btn");
  if (studentHubBtn) {
    studentHubBtn.addEventListener("click", () => {
      if (
        window.SnowDayPortal &&
        typeof window.SnowDayPortal.showLandingHub === "function"
      ) {
        window.SnowDayPortal.showLandingHub(true, true);
      }
    });
  }

  const wsChangePwdBtn = document.getElementById("ws-change-password-btn");
  if (wsChangePwdBtn) {
    wsChangePwdBtn.addEventListener("click", openChangePasswordDialog);
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
          (ctx.lesson.meta.lessonTitle[lang] ||
            ctx.lesson.meta.lessonTitle.ka)) ||
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
          preserveExistingNotes: true,
        });
        renderRibbonTeacherButtons();
      } catch (_e) {}
    });
  }

  // History Toolbar Controls
  const jumpCreateBtn = document.getElementById("ws-jump-create-btn");
  if (jumpCreateBtn) {
    jumpCreateBtn.addEventListener("click", () =>
      selectWorkspaceTab("create", true),
    );
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
        wsFileInput.value = "";
        wsFileBtn.disabled = true;
        wsFileBtn.textContent =
          getLang() === "ka" ? "იტვირთება..." : "Uploading...";
        if (
          !window.SnowDayPortal ||
          typeof window.SnowDayPortal.uploadLessonFile !== "function"
        ) {
          throw new Error("Portal is still loading. Please try again.");
        }
        const up = await window.SnowDayPortal.uploadLessonFile(file);
        if (wsUrlInput) {
          wsUrlInput.value = up.url;
          if (wsUrlError) wsUrlError.hidden = true;
        }
        if (wsTitleInput && !wsTitleInput.value.trim()) {
          const cleanName = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[_-]+/g, " ")
            .trim();
          wsTitleInput.value = cleanName;
        }
        if (wsFileName) {
          wsFileName.textContent =
            window.SnowDayPortal.describeUploadResult(up);
          wsFileName.hidden = false;
        }
        refreshWorkspaceQrPreview();
      } catch (err) {
        showHistoryToast(
          (getLang() === "ka"
            ? "ფაილის წაკითხვა ვერ მოხერხდა: "
            : "Could not read file: ") + err.message,
          true,
        );
      } finally {
        wsFileBtn.disabled = false;
        wsFileBtn.innerHTML = `📁 <span>${t().uploadFileBtn}</span>`;
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
          preserveExistingNotes: false,
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
          preserveExistingNotes: true,
        });
      } catch (_e) {}

      if (
        window.SnowDayPortal &&
        typeof window.SnowDayPortal.openDocUrlWithHistory === "function"
      ) {
        window.SnowDayPortal.openDocUrlWithHistory(normalized, false);
      }
    });
  }

  const wsDownloadQrBtn = document.getElementById("ws-download-qr-btn");
  if (wsDownloadQrBtn) {
    wsDownloadQrBtn.addEventListener("click", () => {
      const normalized = normalizeHttpsDocUrl(
        wsUrlInput ? wsUrlInput.value : "",
      );
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
      const normalized = normalizeHttpsDocUrl(
        wsUrlInput ? wsUrlInput.value : "",
      );
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

  const landingTeacherForm = document.getElementById("landing-teacher-form");
  if (landingTeacherForm) {
    landingTeacherForm.addEventListener("submit", () => {
      const landingInput = document.getElementById("landing-teacher-doc-input");
      if (authState.isAuthorizedTeacher && landingInput && landingInput.value) {
        upsertPersonalDocRecord({
          rawDocUrl: landingInput.value,
          status: "qr_shared",
          incrementShare: true,
          preserveExistingNotes: true,
        }).catch(() => {});
      }
    });
  }

  window.addEventListener("snowday:lessonloaded", (ev) => {
    renderRibbonTeacherButtons();
    if (!authState.isAuthorizedTeacher || !ev.detail || !ev.detail.docUrl)
      return;
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
      existingItem.title.startsWith("Google Doc ") ||
      existingItem.title.startsWith("Lesson Document ") ||
      existingItem.title.startsWith("გაკვეთილის დოკუმენტი ");

    upsertPersonalDocRecord({
      rawDocUrl: docUrl,
      title: hasGenericTitle ? aiTitle : existingItem.title,
      subject: aiSubject || (existingItem && existingItem.subject) || "",
      status: "ai_generated",
      preserveExistingNotes: true,
    }).catch(() => {});
  });

  const adminSearchInput = document.getElementById("admin-teacher-search");
  if (adminSearchInput) {
    adminSearchInput.addEventListener("input", () => {
      adminSearchQuery = adminSearchInput.value;
      renderAdminPanelDirectory();
    });
  }
  setupAdminUsernameValidation();

  const wsSaveApiBtn = document.getElementById("ws-save-api-btn");
  if (wsSaveApiBtn) {
    wsSaveApiBtn.addEventListener("click", () => {
      const inp = document.getElementById("ws-agent-url-input");
      const statusEl = document.getElementById("ws-api-ping-status");
      if (
        window.SnowDayPortal &&
        window.SnowDayPortal.saveAndTestAgentBaseUrl
      ) {
        window.SnowDayPortal.saveAndTestAgentBaseUrl(
          inp ? inp.value : "",
          statusEl,
        );
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

  // Dismiss any open admin row popovers when clicking outside, pressing Escape, or scrolling
  document.addEventListener("click", (ev) => {
    if (
      !ev.target.closest(".admin-actions-menu") &&
      !ev.target.closest(".admin-row-menu-btn")
    ) {
      document.querySelectorAll(".admin-actions-menu.is-open").forEach((el) => {
        el.classList.remove("is-open");
        const btn = el.parentElement?.querySelector(".admin-row-menu-btn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      document.querySelectorAll(".admin-actions-menu.is-open").forEach((el) => {
        el.classList.remove("is-open");
        const btn = el.parentElement?.querySelector(".admin-row-menu-btn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }
  });
  window.addEventListener(
    "scroll",
    () => {
      document.querySelectorAll(".admin-actions-menu").forEach((el) => {
        if (el.matches?.(":popover-open")) {
          try {
            el.hidePopover();
          } catch (_e) {}
        }
        if (el.classList.contains("is-open")) {
          el.classList.remove("is-open");
          const btn = el.parentElement?.querySelector(".admin-row-menu-btn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    },
    { passive: true, capture: true },
  );

  window.addEventListener("snowday:langchange", () => {
    renderAllAuthSurfaces();
  });
}

function bootTeacherAuth() {
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const wsTargetCurrent = document.getElementById("ws-target-current");
  if (isLocalHost && wsTargetCurrent) {
    wsTargetCurrent.checked = true;
  }

  ensureFocusgroupSupport();
  bindWorkspaceAndAuthEvents();
  renderAllAuthSurfaces();

  onAuthStateChanged(auth, (user) => {
    handleAuthUserChange(user);
  });
}

window.SnowDayTeacherAuth = {
  getState: () => ({ ...authState }),
  getIdToken: async () =>
    auth.currentUser ? auth.currentUser.getIdToken() : "",
  isAuthorizedTeacher: () => Boolean(authState.isAuthorizedTeacher),
  isSuperAdmin: () => Boolean(authState.isSuperAdmin),
  signInWithUsernamePassword,
  signOutTeacher,
  requireTeacherAccess,
  openAuthDialog,
  openChangePasswordDialog,
  openWorkspaceView,
  openAdminDialog: () => openWorkspaceView("admin"),
  __setTestState: (teachers, isSuperAdmin = true) => {
    authState.isSuperAdmin = isSuperAdmin;
    authState.isAuthorizedTeacher = true;
    authState.username = "admin";
    cachedTeachersList = teachers;
    renderAdminPanelDirectory();
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTeacherAuth);
} else {
  bootTeacherAuth();
}
