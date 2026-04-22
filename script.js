// ═══════════════════════════════════════════════════════════════
// ChestGuard AI — script.js
// Full Grok-style UI with Firebase auth, medical model integration
// ═══════════════════════════════════════════════════════════════

import { initializeApp }                            from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ── Firebase Config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDUjEEGn1M2aPffcPtnFeevkTFrbQ7j1vI",
  authDomain:        "fir-421a6.firebaseapp.com",
  databaseURL:       "https://fir-421a6-default-rtdb.firebaseio.com",
  projectId:         "fir-421a6",
  storageBucket:     "fir-421a6.firebasestorage.app",
  messagingSenderId: "423073426054",
  appId:             "1:423073426054:web:5caeddeb0fa352c2593f07",
  measurementId:     "G-5Q41W61TJY",
};
const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

// ── Constants ────────────────────────────────────────────────────
const API_BASE     = "https://catatonically-nonmedicinal-lorenza.ngrok-free.dev";
const AUTH_TOKEN   = "my-secret-key";
const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" };
const USE_FIREBASE = true;
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 20 * 60 * 1000; // 20 minutes

// ── State ────────────────────────────────────────────────────────
let currentUser      = sessionStorage.getItem("currentUser");
let isGuest          = sessionStorage.getItem("isGuest") === "true";
let currentSessionId = sessionStorage.getItem("currentSessionId");
let selectedImageB64 = null;
let selectedModelId  = null;
let availableModels  = [];
let isSending        = false;
let fbLoadedOnce     = false;
let isPrivateMode    = false;

let chatSessions = {};   // { [id]: { name, timestamp } }
let messageCache = {};   // { [id]: Message[] }

// ── Model icon mapping ───────────────────────────────────────────
const MODEL_ICONS = {
  pneumonia:   { icon: "coronavirus",       color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  tb:          { icon: "biotech",            color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  pneumothorax:{ icon: "air",               color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  cardiomegaly:{ icon: "favorite",          color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
  emphysema:   { icon: "cloud",             color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  mass_nodule: { icon: "bubble_chart",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  rib_fracture:{ icon: "accessibility_new", color: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
};

function getModelMeta(modelId) {
  const id = (modelId || "").toLowerCase();
  for (const [key, val] of Object.entries(MODEL_ICONS)) {
    if (id.includes(key.split("_")[0])) return val;
  }
  return { icon: "neurology", color: "#71717a", bg: "rgba(113,113,122,0.12)" };
}

// ── Element Cache ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const els = {};

function bindElements() {
  Object.assign(els, {
    preloader:               $("preloader"),
    authModal:               $("auth-modal"),
    authUsername:            $("auth-username"),
    authPassword:            $("auth-password"),
    authError:               $("auth-error"),
    sidebar:                 $("sidebar"),
    sidebarScrim:            $("sidebar-scrim"),
    chatList:                $("chat-list"),
    chatSearch:              $("chat-search"),
    heroState:               $("hero-state"),
    chatBox:                 $("chat-box"),
    messagesContainer:       $("messages-container"),
    imgInput:                $("img-input"),
    imagePreviewStrip:       $("image-preview-strip"),
    previewImg:              $("preview-img"),
    previewModelLabel:       $("preview-model-label"),
    composer:                $("composer"),
    msgInput:                $("msg-input"),
    modelTrigger:            $("model-trigger"),
    modelTriggerIcon:        $("model-trigger-icon"),
    selectedModelLabel:      $("selected-model-label"),
    modelMenu:               $("model-menu"),
    modelMenuList:           $("model-menu-list"),
    sendBtn:                 $("send-btn"),
    attachBtn:               $("attach-btn"),
    privateModeBtnTop:       $("private-mode-btn"),
    privateModeBtnChip:      $("private-mode-chip"),
    settingsPanel:           $("settings-panel"),
    settingsModelStatus:     $("settings-model-status"),
    profileAvatar:           $("profile-avatar"),
    profileName:             $("profile-name"),
    profileMode:             $("profile-mode"),
    topbarAvatarBtn:         $("topbar-avatar-btn"),
    settingsAvatar:          $("settings-avatar"),
    settingsUserName:        $("settings-user-name"),
    settingsUserMode:        $("settings-user-mode"),
    modal:                   $("custom-modal"),
    modalTitle:              $("modal-title"),
    modalMessage:            $("modal-message"),
    modalOkBtn:              $("modal-ok-btn"),
    modalCancelBtn:          $("modal-cancel-btn"),
    nameModal:               $("name-modal"),
    nameInput:               $("name-input"),
    themeToggleBtn:          $("theme-toggle-btn"),
    themeStatusText:         $("theme-status-text"),
    changeNameBtn:           $("change-name-btn"),
    clearHistoryBtn:         $("clear-history-settings-btn"),
    sidebarNewChatBtn:       $("sidebar-new-chat-btn"),
    newChatIconBtn:          $("new-chat-icon-btn"),
    logoutBtn:               $("logout-btn"),
    removeImageBtn:          $("remove-image-btn"),
    appNameDisplay:          $("app-name-display"),
    sidebarAppName:          $("sidebar-app-name"),
  });
}

// ════════════════════════════════════════════════════
// PRELOADER
// ════════════════════════════════════════════════════
function hidePreloader() {
  if (!els.preloader) return;
  els.preloader.classList.add("fade-out");
  setTimeout(() => els.preloader.style.display = "none", 600);
}

// ════════════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════════════
function openModal(title, message, onConfirm = null) {
  if (!els.modal) return;
  els.modalTitle.textContent   = title;
  els.modalMessage.innerHTML   = String(message).replace(/\n/g, "<br>");
  els.modal.classList.remove("hidden");

  if (onConfirm) {
    els.modalCancelBtn.classList.remove("hidden");
    els.modalOkBtn.onclick = () => { closeModal(); onConfirm(); };
  } else {
    els.modalCancelBtn.classList.add("hidden");
    els.modalOkBtn.onclick = closeModal;
  }
}

function closeModal() {
  if (!els.modal) return;
  els.modal.classList.add("hidden");
  els.modalCancelBtn.classList.add("hidden");
  els.modalOkBtn.onclick = closeModal;
}

// ════════════════════════════════════════════════════
// AUTH — Login lockout helpers
// ════════════════════════════════════════════════════
function getDeviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) { id = `dev-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`; localStorage.setItem("device_id", id); }
  return id;
}

function getLockoutStatus() {
  const start    = localStorage.getItem("lockout_start");
  const attempts = parseInt(localStorage.getItem("failed_attempts") || "0", 10);
  if (!start) return { locked: false, attempts };
  const elapsed = Date.now() - parseInt(start, 10);
  if (elapsed >= LOCKOUT_TIME) {
    localStorage.removeItem("lockout_start");
    localStorage.setItem("failed_attempts", "0");
    return { locked: false, attempts: 0 };
  }
  return { locked: true, timeLeft: Math.ceil((LOCKOUT_TIME - elapsed) / 60000) };
}

function registerFailure() {
  const n = parseInt(localStorage.getItem("failed_attempts") || "0", 10) + 1;
  localStorage.setItem("failed_attempts", String(n));
  if (n >= MAX_ATTEMPTS) { localStorage.setItem("lockout_start", String(Date.now())); return true; }
  return false;
}

function validateInputs(user, pass) {
  if (!/^[a-zA-Z]/.test(user))        return "Username must start with a letter.";
  if (user.length < 5)                 return "Username must be at least 5 characters.";
  if (pass.length < 8)                 return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pass))             return "Password needs at least 1 uppercase letter.";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Password needs at least 1 special character.";
  return null;
}

function showAuthError(msg) {
  if (!els.authError) return;
  els.authError.textContent = msg;
  els.authError.classList.remove("hidden");
}

async function handleLogin() {
  const user = els.authUsername.value.trim();
  const pass = els.authPassword.value.trim();
  els.authError?.classList.add("hidden");

  const status = getLockoutStatus();
  if (status.locked) {
    openModal("Account Locked", `Too many attempts. Try again in ${status.timeLeft} minute(s).`);
    return;
  }
  if (!user || !pass) { showAuthError("Please enter username and password."); return; }

  try {
    const devId    = getDeviceId();
    const devSnap  = await get(child(ref(db), `devices/${devId}`));
    if (devSnap.exists() && devSnap.val() !== user) {
      openModal("Access Denied", `This device is linked to another account.`); return;
    }
    const userSnap = await get(child(ref(db), `users/${user}`));
    if (!userSnap.exists())             { showAuthError("User not found."); return; }
    if (userSnap.val().password !== pass) {
      const locked = registerFailure();
      locked
        ? openModal("Account Locked", "Too many failed attempts. Locked for 20 minutes.")
        : showAuthError("Incorrect password.");
      return;
    }
    localStorage.removeItem("failed_attempts");
    localStorage.removeItem("lockout_start");
    completeLogin(user, false);
  } catch (err) {
    console.error(err);
    showAuthError("Connection error. Try again.");
  }
}

async function handleSignUp() {
  const user = els.authUsername.value.trim();
  const pass = els.authPassword.value.trim();
  els.authError?.classList.add("hidden");

  const err = validateInputs(user, pass);
  if (err) { openModal("Invalid Input", err); return; }

  try {
    const devId   = getDeviceId();
    const devSnap = await get(child(ref(db), `devices/${devId}`));
    if (devSnap.exists()) { openModal("Already Registered", `This device is registered to ${devSnap.val()}.`); return; }

    const userSnap = await get(child(ref(db), `users/${user}`));
    if (userSnap.exists()) { showAuthError("Username already taken."); return; }

    await set(ref(db, `users/${user}`), { password: pass, device_id: devId });
    await set(ref(db, `devices/${devId}`), user);
    completeLogin(user, false);
  } catch (err2) {
    console.error(err2);
    showAuthError("Signup failed. Try again.");
  }
}

function handleGuestLogin() { completeLogin("Guest", true); }

function completeLogin(username, guestMode) {
  currentUser = username;
  isGuest     = guestMode;
  sessionStorage.setItem("currentUser", username);
  sessionStorage.setItem("isGuest", String(guestMode));
  if (els.authModal) els.authModal.classList.add("hidden");
  syncProfileUI();
  initializeAppState();
}

function logout() {
  openModal("Sign out?", "Do you want to sign out from ChestGuard AI?", () => {
    currentUser = null; isGuest = false; currentSessionId = null;
    selectedImageB64 = null; selectedModelId = null;
    chatSessions = {}; messageCache = {}; fbLoadedOnce = false;
    sessionStorage.clear();
    if (els.authUsername) els.authUsername.value = "";
    if (els.authPassword) els.authPassword.value = "";
    if (els.messagesContainer) els.messagesContainer.innerHTML = "";
    if (els.chatList) els.chatList.innerHTML = "";
    clearSelectedImage();
    showHeroState();
    syncProfileUI();
    if (els.authModal) els.authModal.classList.remove("hidden");
    closeSidebar();
    closeSettings();
  });
}

// ════════════════════════════════════════════════════
// PROFILE UI SYNC
// ════════════════════════════════════════════════════
function syncProfileUI() {
  const display = currentUser || "Guest";
  const badge   = display.charAt(0).toUpperCase();
  const mode    = isGuest ? "Guest mode" : isPrivateMode ? "Private mode" : "Signed in";

  [els.profileAvatar, els.settingsAvatar, els.topbarAvatarBtn].forEach(el => { if (el) el.textContent = badge; });
  if (els.profileName)       els.profileName.textContent    = display;
  if (els.settingsUserName)  els.settingsUserName.textContent = display;
  if (els.profileMode)       els.profileMode.textContent    = mode;
  if (els.settingsUserMode)  els.settingsUserMode.textContent = mode;
}

// ════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════
function openSidebar() {
  if (!els.sidebar) return;
  els.sidebar.classList.remove("-translate-x-full");
  if (els.sidebarScrim) els.sidebarScrim.classList.remove("hidden");
}
function closeSidebar() {
  if (!els.sidebar) return;
  els.sidebar.classList.add("-translate-x-full");
  if (els.sidebarScrim) els.sidebarScrim.classList.add("hidden");
}

// ════════════════════════════════════════════════════
// SETTINGS PANEL
// ════════════════════════════════════════════════════
function openSettings() {
  if (!els.settingsPanel) return;
  els.settingsPanel.classList.remove("hidden");
  els.settingsPanel.classList.remove("settings-exit");
  els.settingsPanel.classList.add("settings-enter");
  renderSettingsModels();
}
function closeSettings() {
  if (!els.settingsPanel) return;
  els.settingsPanel.classList.remove("settings-enter");
  els.settingsPanel.classList.add("settings-exit");
  setTimeout(() => els.settingsPanel.classList.add("hidden"), 260);
}

// ════════════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════════════
function applyTheme(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  if (els.themeStatusText) els.themeStatusText.textContent = isDark ? "Dark Mode" : "Light Mode";
  localStorage.setItem("theme", isDark ? "dark" : "light");
}
function toggleTheme() {
  applyTheme(!document.documentElement.classList.contains("dark"));
}
function initTheme() {
  const saved = localStorage.getItem("theme");
  applyTheme(saved !== "light"); // dark by default
}

// ════════════════════════════════════════════════════
// APP NAME
// ════════════════════════════════════════════════════
function setAppName(name) {
  const n = name.trim() || "ChestGuard AI";
  document.title = n;
  const titleEl = $("app-title");     if (titleEl) titleEl.textContent = n;
  if (els.appNameDisplay) els.appNameDisplay.textContent   = n;
  if (els.sidebarAppName) els.sidebarAppName.textContent   = n;
  localStorage.setItem("app_name", n);
}
function openNameModal() {
  if (!els.nameModal) return;
  if (els.nameInput) els.nameInput.value = localStorage.getItem("app_name") || "ChestGuard AI";
  els.nameModal.classList.remove("hidden");
  els.nameInput?.focus();
}
function closeNameModal() {
  if (els.nameModal) els.nameModal.classList.add("hidden");
}

// ════════════════════════════════════════════════════
// HERO STATE
// ════════════════════════════════════════════════════
function showHeroState() {
  if (!els.heroState) return;
  els.heroState.classList.remove("hidden");
}
function hideHeroState() {
  if (!els.heroState) return;
  els.heroState.classList.add("hidden");
}
function updateHeroVisibility() {
  const msgs = messageCache[currentSessionId] || [];
  msgs.length > 0 ? hideHeroState() : showHeroState();
}

// ════════════════════════════════════════════════════
// MODEL CATALOG
// ════════════════════════════════════════════════════
async function loadModelCatalog() {
  try {
    const res  = await fetch(`${API_BASE}/models`, { headers: { "x-auth": AUTH_TOKEN, ...NGROK_HEADER } });
    const data = await res.json();
    availableModels = data.models || [];

    // Default to first available
    if (!selectedModelId) {
      const first = availableModels.find(m => m.available);
      if (first) selectedModelId = first.id;
    }
    renderModelMenu();
    syncModelTriggerUI();
  } catch (e) {
    console.warn("Could not load model catalog:", e);
    availableModels = [];
    renderModelMenu();
  }
}

function renderModelMenu() {
  if (!els.modelMenuList) return;
  els.modelMenuList.innerHTML = "";

  if (!availableModels.length) {
    els.modelMenuList.innerHTML = `<p class="text-xs text-zinc-400 text-center py-6 px-4">No models loaded</p>`;
    return;
  }

  availableModels.forEach(model => {
    const meta      = getModelMeta(model.id);
    const isActive  = model.id === selectedModelId;
    const disabled  = !model.available;

    const btn = document.createElement("button");
    btn.className = `model-menu-item ${isActive ? "selected" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`;
    btn.disabled  = disabled;
    btn.innerHTML = `
      <div class="model-icon-wrap" style="background:${meta.bg}">
        <span class="material-symbols-rounded text-[18px]" style="color:${meta.color}">${meta.icon}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="model-menu-label text-zinc-900 dark:text-zinc-100">${model.label}</p>
        <p class="model-menu-sub text-zinc-500">${disabled ? (model.error || "Unavailable") : model.task}</p>
      </div>
      ${isActive ? `<span class="material-symbols-rounded text-[18px] text-teal-500">check_circle</span>` : ""}
    `;
    btn.addEventListener("click", () => {
      selectedModelId = model.id;
      syncModelTriggerUI();
      renderModelMenu();
      closeModelMenu();
      syncPreviewLabel();
    });
    els.modelMenuList.appendChild(btn);
  });
}

function syncModelTriggerUI() {
  const model = availableModels.find(m => m.id === selectedModelId);
  if (!model) return;
  const meta = getModelMeta(model.id);
  if (els.selectedModelLabel) els.selectedModelLabel.textContent = model.label;
  if (els.modelTriggerIcon) {
    els.modelTriggerIcon.textContent = meta.icon;
    els.modelTriggerIcon.style.color = meta.color;
  }
  syncPreviewLabel();
}

function syncPreviewLabel() {
  const model = availableModels.find(m => m.id === selectedModelId);
  if (els.previewModelLabel)
    els.previewModelLabel.textContent = model ? `Model: ${model.label}` : "No model selected";
}

function openModelMenu()  { if (els.modelMenu) els.modelMenu.classList.remove("hidden"); }
function closeModelMenu() { if (els.modelMenu) els.modelMenu.classList.add("hidden"); }
function toggleModelMenu(e) { e.stopPropagation(); els.modelMenu?.classList.toggle("hidden"); }

// ════════════════════════════════════════════════════
// IMAGE HANDLING
// ════════════════════════════════════════════════════
function handleImageSelection(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    openModal("Invalid File", "Please select a valid image file (JPG, PNG, DICOM-derived images)."); return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedImageB64 = reader.result;
    if (els.previewImg) els.previewImg.src = selectedImageB64;
    if (els.imagePreviewStrip) els.imagePreviewStrip.classList.remove("hidden");
    syncPreviewLabel();
  };
  reader.onerror = () => openModal("Image Error", "Could not read the selected image.");
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  selectedImageB64 = null;
  if (els.imgInput) els.imgInput.value = "";
  if (els.previewImg) els.previewImg.src = "";
  if (els.imagePreviewStrip) els.imagePreviewStrip.classList.add("hidden");
}

// ════════════════════════════════════════════════════
// CHAT SESSIONS
// ════════════════════════════════════════════════════
function generateSessionId() {
  return `sess-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderChatList() {
  if (!els.chatList) return;
  const query = (els.chatSearch?.value || "").trim().toLowerCase();
  const sorted = Object.entries(chatSessions)
    .filter(([, m]) => !query || (m.name || "").toLowerCase().includes(query))
    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

  els.chatList.innerHTML = "";

  if (!sorted.length) {
    els.chatList.innerHTML = `<p class="text-xs text-zinc-400 text-center py-4 px-2">No conversations yet</p>`;
    return;
  }

  sorted.forEach(([id, meta]) => {
    const isActive = id === currentSessionId;
    const item = document.createElement("div");
    item.className = `chat-item ${isActive ? "active" : ""}`;
    item.innerHTML = `
      <div class="chat-item-text">
        <p class="chat-item-title text-zinc-800 dark:text-zinc-200">${escapeHtml(meta.name || "New analysis")}</p>
        <p class="chat-item-time">${formatTimestamp(meta.timestamp)}</p>
      </div>
      <button class="delete-chat-btn w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-all flex-shrink-0" data-id="${id}">
        <span class="material-symbols-rounded text-[15px]">delete</span>
      </button>
    `;
    item.addEventListener("click", e => {
      if (e.target.closest(".delete-chat-btn")) {
        const cid = e.target.closest(".delete-chat-btn").dataset.id;
        openModal("Delete Chat?", `Delete "${meta.name || "this chat"}"?`, () => deleteChat(cid));
        return;
      }
      switchChat(id);
    });

    // Show delete on hover
    item.addEventListener("mouseenter", () => item.querySelector(".delete-chat-btn")?.classList.remove("opacity-0"));
    item.addEventListener("mouseleave", () => item.querySelector(".delete-chat-btn")?.classList.add("opacity-0"));

    els.chatList.appendChild(item);
  });
}

async function createNewChat(shouldSave = true) {
  if (isSending) return;
  const id = generateSessionId();
  currentSessionId = id;
  sessionStorage.setItem("currentSessionId", id);
  chatSessions[id] = { name: "New analysis", timestamp: Date.now() };
  messageCache[id] = [];
  renderChatList();
  renderMessages(id);
  showHeroState();
  clearSelectedImage();
  if (els.msgInput) els.msgInput.value = "";

  if (shouldSave && !isGuest) await saveSessionMeta();
  closeSidebar();
}

async function switchChat(id) {
  if (isSending || id === currentSessionId) { closeSidebar(); return; }
  currentSessionId = id;
  sessionStorage.setItem("currentSessionId", id);
  clearSelectedImage();
  if (!messageCache[id]) await loadHistory(id);
  else renderMessages(id);
  renderChatList();
  closeSidebar();
}

async function deleteChat(id) {
  delete chatSessions[id];
  delete messageCache[id];
  if (!isGuest && USE_FIREBASE && currentUser) {
    try {
      await remove(ref(db, `chats/${currentUser}/${id}`));
      await saveSessionMeta();
    } catch (e) { console.warn(e); }
  }
  if (id === currentSessionId) {
    const remaining = Object.keys(chatSessions);
    remaining.length ? await switchChat(remaining[0]) : await createNewChat();
  } else {
    renderChatList();
  }
}

// ════════════════════════════════════════════════════
// FIREBASE PERSISTENCE
// ════════════════════════════════════════════════════
async function saveSessionMeta() {
  if (isGuest || !USE_FIREBASE || !currentUser) return;
  try { await set(ref(db, `chats/${currentUser}/meta`), chatSessions); } catch (e) { console.warn(e); }
}

async function saveMessageToFirebase(sessionId, message) {
  if (isGuest || !USE_FIREBASE || !currentUser) return;
  const key = `msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  try { await set(ref(db, `chats/${currentUser}/${sessionId}/messages/${key}`), message); } catch (e) { console.warn(e); }
}

async function loadSessionsFromFirebase() {
  if (isGuest || fbLoadedOnce) return;
  fbLoadedOnce = true;
  try {
    const snap = await get(child(ref(db), `chats/${currentUser}/meta`));
    if (snap.exists()) chatSessions = snap.val() || {};
    const ids = Object.keys(chatSessions).sort((a,b) => (chatSessions[b].timestamp||0) - (chatSessions[a].timestamp||0));
    if (!ids.length) { await createNewChat(false); return; }

    currentSessionId = (currentSessionId && chatSessions[currentSessionId]) ? currentSessionId : ids[0];
    sessionStorage.setItem("currentSessionId", currentSessionId);
    renderChatList();
    await loadHistory(currentSessionId);
  } catch (e) { console.error("Firebase load failed:", e); }
}

async function loadHistory(sessionId) {
  messageCache[sessionId] = [];
  if (isGuest) { renderMessages(sessionId); return; }
  try {
    const snap = await get(child(ref(db), `chats/${currentUser}/${sessionId}/messages`));
    const msgs = snap.exists() ? Object.values(snap.val()) : [];
    msgs.sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
    messageCache[sessionId] = msgs;
    renderMessages(sessionId);
  } catch (e) {
    console.error("History load failed:", e);
    renderMessages(sessionId);
  }
}

// ════════════════════════════════════════════════════
// RENDER MESSAGES
// ════════════════════════════════════════════════════
function renderMessages(sessionId) {
  if (!els.messagesContainer) return;
  els.messagesContainer.innerHTML = "";
  (messageCache[sessionId] || []).forEach(m => appendMessageBubble(m));
  updateHeroVisibility();
  scrollToBottom();
}

function appendMessageBubble(message, animate = false) {
  if (!els.messagesContainer) return null;
  const isUser = message.role === "user";

  const wrapper = document.createElement("div");
  wrapper.className = `flex w-full ${isUser ? "justify-end" : "justify-start"} ${animate ? "message-bubble" : ""}`;

  if (isUser) {
    // User message — right aligned bubble
    const inner = document.createElement("div");
    inner.className = "flex flex-col gap-2 max-w-[80%] md:max-w-[65%]";

    // X-ray image (if any)
    if (message.image) {
      const wrap = document.createElement("div");
      wrap.className = "xray-preview-wrap";
      const img = document.createElement("img");
      img.src = message.image;
      img.alt = "Uploaded X-ray";
      wrap.appendChild(img);
      inner.appendChild(wrap);
    }

    // Text bubble
    if (message.content) {
      const bubble = document.createElement("div");
      bubble.className = "user-bubble";
      bubble.textContent = message.content;
      inner.appendChild(bubble);
    }

    wrapper.appendChild(inner);
  } else {
    // Assistant message — left aligned
    const inner = document.createElement("div");
    inner.className = "flex gap-3 max-w-[90%] md:max-w-[75%]";

    // Avatar
    const avatar = document.createElement("div");
    avatar.className = "w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5";
    avatar.innerHTML = `<img src="/static/MYLOGO.png" alt="AI" class="w-5 h-5 rounded-full object-cover">`;

    const content = document.createElement("div");
    content.className = "flex flex-col gap-1 min-w-0";

    // Medical result badge
    if (message.medicalResult) {
      const mr  = message.medicalResult;
      const isPositive = mr.label && !mr.label.toLowerCase().startsWith("normal");
      const badgeClass = isPositive ? "positive" : "negative";
      const conf = mr.confidence_percent || "";

      const badge = document.createElement("div");
      badge.className = `medical-badge ${badgeClass}`;
      badge.innerHTML = `
        <span class="material-symbols-rounded text-[14px]">${isPositive ? "warning" : "check_circle"}</span>
        <span>${mr.model_label}: ${mr.label}</span>
        ${conf ? `<span class="opacity-70">· ${conf}</span>` : ""}
      `;
      content.appendChild(badge);

      // Confidence bar
      if (mr.confidence !== undefined) {
        const pct = Math.round(mr.confidence * 100);
        const barTrack = document.createElement("div");
        barTrack.className = "confidence-bar-track";
        const barFill = document.createElement("div");
        barFill.className = "confidence-bar-fill";
        barFill.style.width = "0%";
        barTrack.appendChild(barFill);
        content.appendChild(barTrack);
        setTimeout(() => { barFill.style.width = `${pct}%`; }, 150);
      }
    }

    // Text content
    const txt = document.createElement("div");
    txt.className = "assistant-bubble";
    txt.innerHTML = formatAssistantText(message.content || "");
    content.appendChild(txt);

    inner.appendChild(avatar);
    inner.appendChild(content);
    wrapper.appendChild(inner);
  }

  els.messagesContainer.appendChild(wrapper);
  return wrapper;
}

// ── Inline escaper ──────────────────────────────────────────────
function escText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Inline markdown (bold, italic, code, links) ──────────────────
function formatInline(raw) {
  return escText(raw)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/`([^`]+)`/g,     '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ── Block markdown renderer ──────────────────────────────────────
function formatAssistantText(text) {
  if (!text) return "";
  const lines  = text.split("\n");
  let html     = "";
  let inList   = false;
  let inOl     = false;

  const closeList = () => {
    if (inList) { html += "</ul>"; inList = false; }
    if (inOl)   { html += "</ol>"; inOl   = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      closeList();
      html += `<h3 class="font-semibold text-sm mt-3 mb-1 text-zinc-900 dark:text-zinc-100">${formatInline(trimmed.slice(4))}</h3>`;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      html += `<h2 class="font-bold text-base mt-4 mb-1 text-zinc-900 dark:text-zinc-100">${formatInline(trimmed.slice(3))}</h2>`;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      html += `<h1 class="font-bold text-lg mt-4 mb-2 text-zinc-900 dark:text-zinc-100">${formatInline(trimmed.slice(2))}</h1>`;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      closeList();
      html += '<hr class="border-zinc-200 dark:border-zinc-700 my-3">';
      continue;
    }

    // Unordered list
    if (/^[*\-] /.test(trimmed)) {
      if (inOl) { html += "</ol>"; inOl = false; }
      if (!inList) { html += '<ul class="list-disc ml-5 my-1.5 space-y-0.5">'; inList = true; }
      html += `<li>${formatInline(trimmed.slice(2))}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (olMatch) {
      if (inList) { html += "</ul>"; inList = false; }
      if (!inOl)  { html += '<ol class="list-decimal ml-5 my-1.5 space-y-0.5">'; inOl = true; }
      html += `<li>${formatInline(olMatch[2])}</li>`;
      continue;
    }

    // Blank line
    if (trimmed === "") {
      closeList();
      html += '<div class="h-2"></div>';
      continue;
    }

    // Normal paragraph line
    closeList();
    html += `<p class="leading-relaxed">${formatInline(trimmed)}</p>`;
  }

  closeList();
  return html || `<p>${escText(text)}</p>`;
}

function createThinkingBubble() {
  const wrapper = document.createElement("div");
  wrapper.className = "flex w-full justify-start message-bubble";
  wrapper.innerHTML = `
    <div class="flex gap-3">
      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <img src="/static/MYLOGO.png" alt="AI" class="w-5 h-5 rounded-full object-cover">
      </div>
      <div class="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
        <div class="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
        <div class="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
        <div class="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
      </div>
    </div>
  `;
  els.messagesContainer?.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function scrollToBottom() {
  if (els.chatBox) els.chatBox.scrollTop = els.chatBox.scrollHeight;
}

// ════════════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════════════
async function sendMessage(e) {
  e?.preventDefault();
  if (isSending || !currentSessionId) return;

  const text     = (els.msgInput?.value || "").trim();
  const hasImage = !!selectedImageB64;
  if (!text && !hasImage) return;

  if (hasImage && !selectedModelId) {
    openModal("Select a Model", "Please select one of the medical AI models before uploading a chest X-ray for analysis.");
    return;
  }

  isSending = true;
  if (els.sendBtn) els.sendBtn.disabled = true;

  const imageToSend = selectedImageB64;

  // Build user message
  const userMsg = {
    role: "user",
    content: text || (imageToSend ? "Please analyze this chest X-ray." : ""),
    image: imageToSend,
    timestamp: Date.now(),
  };

  // Update cache & UI
  if (!messageCache[currentSessionId]) messageCache[currentSessionId] = [];
  messageCache[currentSessionId].push(userMsg);
  appendMessageBubble(userMsg, true);
  hideHeroState();

  // Update session name
  if (!chatSessions[currentSessionId]) chatSessions[currentSessionId] = { name: "New analysis", timestamp: Date.now() };
  if (chatSessions[currentSessionId].name === "New analysis") {
    const modelLabel = availableModels.find(m => m.id === selectedModelId)?.label || "";
    chatSessions[currentSessionId].name = (text || (modelLabel ? `${modelLabel} analysis` : "Image analysis")).slice(0, 45);
  }
  chatSessions[currentSessionId].timestamp = Date.now();
  renderChatList();

  // Clear input
  if (els.msgInput) { els.msgInput.value = ""; autoResize(); }
  clearSelectedImage();

  // Save to firebase
  await saveSessionMeta();
  await saveMessageToFirebase(currentSessionId, userMsg);

  // Show thinking
  const thinkEl = createThinkingBubble();

  try {
    const resp = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth": AUTH_TOKEN, ...NGROK_HEADER },
      body: JSON.stringify({
        session_id:     currentSessionId,
        message:        text,
        image_base64:   imageToSend,
        selected_model: selectedModelId,
      }),
    });

    thinkEl?.remove();
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || "Server error");

    const assistantMsg = {
      role: "assistant",
      content: data.response,
      medicalResult: data.medical_result || null,
      timestamp: Date.now(),
    };
    messageCache[currentSessionId].push(assistantMsg);
    appendMessageBubble(assistantMsg, true);
    await saveMessageToFirebase(currentSessionId, assistantMsg);

  } catch (err) {
    thinkEl?.remove();
    const errMsg = {
      role: "assistant",
      content: `⚠️ Error: ${err.message}.\n\nPlease make sure the server is running and Ollama is available.`,
      timestamp: Date.now(),
    };
    messageCache[currentSessionId].push(errMsg);
    appendMessageBubble(errMsg, true);
  } finally {
    isSending = false;
    if (els.sendBtn) els.sendBtn.disabled = false;
    scrollToBottom();
  }
}

// ════════════════════════════════════════════════════
// TEXTAREA AUTO-RESIZE
// ════════════════════════════════════════════════════
function autoResize() {
  if (!els.msgInput) return;
  els.msgInput.style.height = "auto";
  const maxH = 160; // ~7 lines max
  const newH = Math.min(els.msgInput.scrollHeight, maxH);
  els.msgInput.style.height = `${newH}px`;
  els.msgInput.style.overflowY = els.msgInput.scrollHeight > maxH ? "auto" : "hidden";
}

// ════════════════════════════════════════════════════
// SETTINGS — MODEL STATUS
// ════════════════════════════════════════════════════
function renderSettingsModels() {
  if (!els.settingsModelStatus) return;
  if (!availableModels.length) {
    els.settingsModelStatus.innerHTML = `<p class="text-xs text-zinc-400 text-center py-2">Models not loaded</p>`;
    return;
  }
  els.settingsModelStatus.innerHTML = availableModels.map(m => {
    const meta = getModelMeta(m.id);
    return `
      <div class="flex items-center gap-3 py-1.5">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:${meta.bg}">
          <span class="material-symbols-rounded text-[15px]" style="color:${meta.color}">${meta.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${m.label}</p>
          <p class="text-xs text-zinc-400 truncate">${m.available ? m.task : (m.error || "Unavailable")}</p>
        </div>
        <div class="model-status-dot ${m.available ? "online" : "offline"}"></div>
      </div>
    `;
  }).join('<div class="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>');
}

// ════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
async function initializeAppState() {
  await loadModelCatalog();
  if (isGuest) {
    if (!currentSessionId) await createNewChat(false);
    else {
      if (!chatSessions[currentSessionId]) chatSessions[currentSessionId] = { name: "New analysis", timestamp: Date.now() };
      if (!messageCache[currentSessionId]) messageCache[currentSessionId] = [];
      renderChatList();
      renderMessages(currentSessionId);
    }
  } else {
    await loadSessionsFromFirebase();
  }
  hidePreloader();
}

// ════════════════════════════════════════════════════
// EVENT SETUP
// ════════════════════════════════════════════════════
function setupEvents() {
  // Auth
  $("login-btn")?.addEventListener("click",  handleLogin);
  $("signup-btn")?.addEventListener("click", handleSignUp);
  $("guest-btn")?.addEventListener("click",  handleGuestLogin);

  // Enter key on password
  els.authPassword?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
  els.authUsername?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });

  // Logout
  els.logoutBtn?.addEventListener("click", logout);

  // New Chat
  els.sidebarNewChatBtn?.addEventListener("click", () => createNewChat());
  els.newChatIconBtn?.addEventListener("click",    () => createNewChat());

  // Sidebar
  $("open-sidebar-btn")?.addEventListener("click",         openSidebar);
  $("mobile-sidebar-close")?.addEventListener("click",     closeSidebar);
  els.sidebarScrim?.addEventListener("click",              closeSidebar);

  // Settings
  els.openSettingsBtn = $("settings-open-btn");
  els.openSettingsBtn?.addEventListener("click",            openSettings);
  els.topbarAvatarBtn?.addEventListener("click",            openSettings);
  $("settings-close-btn")?.addEventListener("click",       closeSettings);

  // Theme
  els.themeToggleBtn?.addEventListener("click", toggleTheme);

  // App Name
  els.changeNameBtn?.addEventListener("click", openNameModal);
  $("name-save-btn")?.addEventListener("click", () => { setAppName(els.nameInput?.value || ""); closeNameModal(); });
  $("name-cancel-btn")?.addEventListener("click", closeNameModal);
  els.nameInput?.addEventListener("keydown", e => { if (e.key === "Enter") { setAppName(els.nameInput.value); closeNameModal(); } });

  // Clear History
  els.clearHistoryBtn?.addEventListener("click", () => {
    openModal("Clear History", "Are you sure you want to delete all conversations? This cannot be undone.", async () => {
      const ids = Object.keys(chatSessions);
      chatSessions = {};
      messageCache = {};
      if (!isGuest && USE_FIREBASE && currentUser) {
        try {
          for (const id of ids) await remove(ref(db, `chats/${currentUser}/${id}`));
          await saveSessionMeta();
        } catch(e) { console.warn(e); }
      }
      renderChatList();
      await createNewChat();
    });
  });

  // Model selector
  els.modelTrigger?.addEventListener("click", toggleModelMenu);
  document.addEventListener("click", e => {
    if (!e.target.closest(".model-picker")) closeModelMenu();
  });

  // Attach / Upload
  els.attachBtn?.addEventListener("click", () => els.imgInput?.click());
  els.imgInput?.addEventListener("change", handleImageSelection);
  els.removeImageBtn?.addEventListener("click", clearSelectedImage);

  // Send
  els.sendBtn?.addEventListener("click", sendMessage);
  els.msgInput?.addEventListener("input", autoResize);
  els.msgInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Search
  els.chatSearch?.addEventListener("input", renderChatList);

  // Modal
  els.modalCancelBtn?.addEventListener("click", closeModal);
  $("custom-modal")?.addEventListener("click", e => { if (e.target === $("custom-modal")) closeModal(); });
  $("name-modal")?.addEventListener("click", e => { if (e.target === $("name-modal")) closeNameModal(); });

  // Private Mode
  els.privateModeBtnTop?.addEventListener("click", togglePrivateMode);
  els.privateModeBtnChip?.addEventListener("click", togglePrivateMode);

  // Quick prompts
  document.querySelectorAll(".quick-prompt").forEach(btn => {
    btn.addEventListener("click", () => {
      const title = btn.querySelector(".font-medium")?.textContent || "";
      if (els.msgInput) { els.msgInput.value = title; autoResize(); els.msgInput.focus(); }
    });
  });
}

function togglePrivateMode() {
  isPrivateMode = !isPrivateMode;
  const chip = els.privateModeBtnChip;
  if (chip) { isPrivateMode ? chip.classList.remove("hidden") : chip.classList.add("hidden"); }
  syncProfileUI();
  openModal(
    isPrivateMode ? "Private Mode On" : "Private Mode Off",
    isPrivateMode
      ? "Your messages will not be saved to Firebase in this session."
      : "Chat history will now be saved as usual.",
  );
}

// ════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  setupEvents();
  initTheme();

  // Restore saved app name
  const savedName = localStorage.getItem("app_name");
  if (savedName) setAppName(savedName);

  syncProfileUI();

  if (currentUser) {
    if (els.authModal) els.authModal.classList.add("hidden");
    await initializeAppState();
  } else {
    // Show auth after a short delay (nice UX)
    setTimeout(() => {
      hidePreloader();
      if (els.authModal) els.authModal.classList.remove("hidden");
    }, 1000);
  }
});

// Expose globalally for inline onclick="" fallbacks
window.closeModal = closeModal;
