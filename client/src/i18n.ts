/**
 * i18n 初始化（繁體中文 + English）。
 *
 * 涵蓋：app 介面字串、表單畫面、以及 @oa-agent/ui 的 Dialog / DatePicker 所需 key。
 * 語系切換用 i18n.changeLanguage('zh-Hant' | 'en')，並記憶在 localStorage。
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const LANG_KEY = "oa-lang";

const zhHant = {
  common: { confirm: "確認", cancel: "取消" },
  datePicker: {
    selectDate: "選擇日期",
    today: "今天",
    headerMonth: "{{year}} 年 {{month}}",
    headerYear: "{{year}} 年",
    months: {
      1: "1 月",
      2: "2 月",
      3: "3 月",
      4: "4 月",
      5: "5 月",
      6: "6 月",
      7: "7 月",
      8: "8 月",
      9: "9 月",
      10: "10 月",
      11: "11 月",
      12: "12 月",
    },
    weekdays: { 0: "日", 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六" },
  },
  app: {
    title: "OA Agent",
    greeting: "你好，我是 OA 小幫手。直接用自然語言描述你的需求即可 👋",
    user: "使用者",
    statusLabel: "狀態",
    statusInitial: "尚未開始",
    status: {
      collecting: "蒐集中",
      confirming: "待確認",
      submitting: "送出中",
      submitted: "已送出",
      cancelled: "已取消",
      failed: "失敗",
    },
    reset: "重新開始",
    confirm: "確認",
    cancel: "取消",
    send: "送出",
    typing: "AI 回覆中…",
    inputPlaceholder: "描述你的需求，例如：我下週一到週二要請特休，家裡有事",
    filledFields: "已填欄位",
    result: "送出結果",
    oaNo: "OA 單號",
    statusField: "狀態",
    viewForm: "檢視請假單",
    noData: "尚無資料",
    notSubmitted: "尚未送出",
    restarted: "已重新開始，請輸入新的需求。",
    sessionExpired:
      "對話連線已重置（伺服器可能重新啟動或逾時），已清空目前進度。請直接輸入需求重新開始。",
    cancelledMsg: "已取消這張表單。可按「重新開始」建立新的需求。",
    cancelFailed: "取消失敗：",
    loadFormFailed: "無法載入表單畫面：",
    requestFailed: "請求失敗",
    theme: "主題",
    language: "語言",
    menu: "選單",
  },
  auth: {
    subtitle: "請登入以使用 OA 小幫手",
    userId: "帳號",
    password: "密碼",
    login: "登入",
    loggingIn: "登入中…",
    loginFailed: "登入失敗",
    logout: "登出",
    devHint: "測試帳號：kevin / eason ，密碼：oa1234",
  },
  settings: {
    title: "設定",
    appearance: "外觀模式",
    fontSize: "系統字級",
    fontSmaller: "縮小字級",
    fontLarger: "放大字級",
    language: "切換語言",
  },
  form: {
    confirmTitle: "請確認{{title}}",
    totalHours: "共計 {{hours}} 小時",
    remainingHours: "今年度剩餘 {{hours}} 小時",
    submitted: "已送出",
    hint: "請核對並可直接修改，確認無誤後送出。",
    complete: "完成",
    submit: "確認送出",
    submitting: "送出中…",
    incomplete: "尚有必填欄位未完成，請補齊後再送出。",
    next: "下一步",
    previous: "上一步",
    steps: "表單步驟",
    step: "步驟 {{index}}",
    requiredMissing: "請先填寫必填欄位：{{fields}}",
    selectPlaceholder: "請選擇…",
  },
};

const en = {
  common: { confirm: "Confirm", cancel: "Cancel" },
  datePicker: {
    selectDate: "Select date",
    today: "Today",
    headerMonth: "{{month}} {{year}}",
    headerYear: "{{year}}",
    months: {
      1: "Jan",
      2: "Feb",
      3: "Mar",
      4: "Apr",
      5: "May",
      6: "Jun",
      7: "Jul",
      8: "Aug",
      9: "Sep",
      10: "Oct",
      11: "Nov",
      12: "Dec",
    },
    weekdays: {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    },
  },
  app: {
    title: "OA Agent",
    greeting:
      "Hi, I'm the OA assistant. Just describe your request in your own words 👋",
    user: "User",
    statusLabel: "Status",
    statusInitial: "Not started",
    status: {
      collecting: "Collecting",
      confirming: "Awaiting confirm",
      submitting: "Submitting",
      submitted: "Submitted",
      cancelled: "Cancelled",
      failed: "Failed",
    },
    reset: "Restart",
    confirm: "Confirm",
    cancel: "Cancel",
    send: "Send",
    typing: "AI is replying…",
    inputPlaceholder:
      "Describe your request, e.g. I need annual leave next Mon–Tue for personal reasons",
    filledFields: "Filled fields",
    result: "Submission",
    oaNo: "OA No.",
    statusField: "Status",
    viewForm: "View form",
    noData: "No data yet",
    notSubmitted: "Not submitted",
    restarted: "Restarted. Please enter a new request.",
    sessionExpired:
      "The conversation was reset (the server may have restarted or timed out); current progress was cleared. Just type your request to start over.",
    cancelledMsg:
      "This form has been cancelled. Click “Restart” to begin a new request.",
    cancelFailed: "Cancel failed: ",
    loadFormFailed: "Failed to load form view: ",
    requestFailed: "Request failed",
    theme: "Theme",
    language: "Language",
    menu: "Menu",
  },
  auth: {
    subtitle: "Sign in to use the OA assistant",
    userId: "Account",
    password: "Password",
    login: "Sign in",
    loggingIn: "Signing in…",
    loginFailed: "Sign-in failed",
    logout: "Sign out",
    devHint: "Test accounts: kevin / eason, password: oa1234",
  },
  settings: {
    title: "Settings",
    appearance: "Appearance",
    fontSize: "Font size",
    fontSmaller: "Smaller font",
    fontLarger: "Larger font",
    language: "Language",
  },
  form: {
    confirmTitle: "Confirm {{title}}",
    totalHours: "Total {{hours}} hours",
    remainingHours: "{{hours}} hours remaining this year",
    submitted: "Submitted",
    hint: "Please review and edit if needed, then submit.",
    complete: "Done",
    submit: "Confirm & submit",
    submitting: "Submitting…",
    incomplete:
      "Some required fields are incomplete. Please complete them before submitting.",
    next: "Next",
    previous: "Previous",
    steps: "Form steps",
    step: "Step {{index}}",
    requiredMissing: "Please complete required fields: {{fields}}",
    selectPlaceholder: "Select…",
  },
};

const stored =
  typeof localStorage !== "undefined" ? localStorage.getItem(LANG_KEY) : null;

void i18n.use(initReactI18next).init({
  resources: {
    "zh-Hant": { translation: zhHant },
    en: { translation: en },
  },
  lng: stored ?? "zh-Hant",
  fallbackLng: "zh-Hant",
  interpolation: { escapeValue: false },
});

export function changeLanguage(lng: string): void {
  void i18n.changeLanguage(lng);
  if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, lng);
}

export default i18n;
