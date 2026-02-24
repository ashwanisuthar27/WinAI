// ==========================================
// 1. FIREBASE CONFIGURATION & IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️ PASTE YOUR FIREBASE CONFIG HERE ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyDUjEEGn1M2aPffcPtnFeevkTFrbQ7j1vI",
  authDomain: "fir-421a6.firebaseapp.com",
  databaseURL: "https://fir-421a6-default-rtdb.firebaseio.com",
  projectId: "fir-421a6",
  storageBucket: "fir-421a6.firebasestorage.app",
  messagingSenderId: "423073426054",
  appId: "1:423073426054:web:5caeddeb0fa352c2593f07",
  measurementId: "G-5Q41W61TJY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔒 GLOBAL STATE
let isSending = false;
let selectedImageBase64 = null;

// ==========================================
// 2. APP CONFIG & STATE
// ==========================================
const API_BASE = " https://catatonically-nonmedicinal-lorenza.ngrok-free.dev"; 
const AUTH_TOKEN = "my-secret-key"; 

// 🛠️ FIX: Defined the missing variable here
const USE_FIREBASE = true; 

let currentUser = sessionStorage.getItem('currentUser'); 
let isGuest = sessionStorage.getItem('isGuest') === 'true';

// Chat Data
let currentSessionId = "session-init"; 
let chatSessions = {}; 
let messageCache = {}; 

// Constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 20 * 60 * 1000;

// ==========================================
// 3. UI HELPER FUNCTIONS
// ==========================================

// ✨ HELPER: Toggle Preloader
function toggleLoader(show) {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    
    if (show) {
        preloader.classList.remove('loaded'); 
        preloader.style.visibility = 'visible';
        preloader.style.opacity = '1';
    } else {
        // Clear inline styles so CSS class can take over
        preloader.style.visibility = '';
        preloader.style.opacity = '';
        preloader.classList.add('loaded');
    }
}

function showModal(title, message) {
    const modal = document.getElementById("custom-modal");
    if (!modal) return alert(message);

    if (!document.getElementById("modal-title")) return location.reload(); 

    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerHTML = message.replace(/\n/g, "<br>");
    
    document.getElementById("modal-ok-btn").classList.remove("hidden");
    document.getElementById("modal-confirm-group").classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("active");
}

function showConfirm(title, message, onYesCallback) {
    const modal = document.getElementById("custom-modal");
    if (!modal) {
        if(confirm(message)) onYesCallback();
        return;
    }

    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerHTML = message.replace(/\n/g, "<br>");

    document.getElementById("modal-ok-btn").classList.add("hidden");
    const confirmGroup = document.getElementById("modal-confirm-group");
    confirmGroup.classList.remove("hidden");
    confirmGroup.style.display = "flex"; 

    const yesBtn = document.getElementById("modal-yes-btn");
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

    newYesBtn.onclick = () => {
        closeModal();
        onYesCallback(); 
    };

    modal.classList.remove("hidden");
    modal.classList.add("active");
}

function closeModal() {
    const modal = document.getElementById("custom-modal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => modal.classList.add("hidden"), 300);
    }
}

// ✨ SHOW SIGN-UP CREDENTIALS POPUP
function showSignUpSuccess(username, password) {
    const modal = document.getElementById("custom-modal");
    const mBox = modal.querySelector(".modal-box");
    const originalContent = mBox.innerHTML; // Backup

    mBox.innerHTML = `
        <div class="success-checkmark">
            <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="check-circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="check-tick" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
        </div>
        <h2 class="success-title">Account Created</h2>
        
        <div class="credential-box">
            <div class="cred-row">
                <span class="cred-label">Username:</span>
                <span class="cred-value">${username}</span>
            </div>
            <div class="cred-row">
                <span class="cred-label">Password:</span>
                <span class="cred-value highlight">${password}</span>
            </div>
        </div>

        <p class="warning-text">
            ⚠️ <b>WARNING:</b> Please remember your username and password. You will <u>not</u> be able to create a new account on this device. If you forget your credentials email the Admin for help at <a href="mailto:pranavsinghkia@gmail.com" style="color: #ffffff;">Send Email</a>.
        </p>

        <button id="signup-continue-btn" class="modal-btn-primary">Continue</button>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("active");

    document.getElementById("signup-continue-btn").onclick = () => {
        modal.classList.remove("active");
        setTimeout(() => {
            modal.classList.add("hidden");
            mBox.innerHTML = originalContent; // Restore modal
            
            // Trigger Loading Animation -> Login
            toggleLoader(true);
            setTimeout(() => {
                completeLogin(username, false);
                toggleLoader(false);
            }, 1500);
        }, 300);
    };
}

function showSuccessLogin(username) {
    const modal = document.getElementById("custom-modal");
    const mBox = modal.querySelector(".modal-box");
    const originalContent = mBox.innerHTML;

    mBox.innerHTML = `
        <div class="success-checkmark">
            <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="check-circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="check-tick" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
        </div>
        <h2 class="success-title">Login Successful</h2>
        <p style="color:white;">Welcome back, ${username}!</p>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("active");

    setTimeout(() => {
        modal.classList.remove("active");
        setTimeout(() => {
            modal.classList.add("hidden");
            mBox.innerHTML = originalContent;
            
            const okBtn = document.getElementById("modal-ok-btn");
            if(okBtn) okBtn.onclick = closeModal;
            
            completeLogin(username, false); 
        }, 300);
    }, 2000);
}

// ==========================================
// 4. AUTHENTICATION & LOCKOUT
// ==========================================

function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'dev-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

function validateInputs(username, password) {
    // 1. Username Validation
    const usernameRegex = /^[a-zA-Z]/; // Must start with a letter
    if (!usernameRegex.test(username)) return "Username must start with a letter.";
    if (username.length < 5) return "Username must be at least 5 characters.";
    
    // 2. Password Validation
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password needs at least 1 Uppercase letter.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password needs at least 1 Special Character.";
    return null; 
}

function getLockoutStatus() {
    const lockoutStart = localStorage.getItem('lockout_start');
    const failedAttempts = parseInt(localStorage.getItem('failed_attempts') || '0');

    if (lockoutStart) {
        const timePassed = Date.now() - parseInt(lockoutStart);
        if (timePassed < LOCKOUT_TIME) {
            const minutesLeft = Math.ceil((LOCKOUT_TIME - timePassed) / 60000);
            return { locked: true, timeLeft: minutesLeft };
        } else {
            localStorage.removeItem('lockout_start');
            localStorage.setItem('failed_attempts', '0');
            return { locked: false, attempts: 0 };
        }
    }
    return { locked: false, attempts: failedAttempts };
}

function registerFailure() {
    let attempts = parseInt(localStorage.getItem('failed_attempts') || '0');
    attempts++;
    localStorage.setItem('failed_attempts', attempts);
    if (attempts >= MAX_ATTEMPTS) {
        localStorage.setItem('lockout_start', Date.now());
        return true; 
    }
    return false;
}

async function handleLogin() {
    const user = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value.trim();
    const errorMsg = document.getElementById("auth-error");
    const deviceId = getDeviceId();

    const status = getLockoutStatus();
    if (status.locked) {
        errorMsg.textContent = `Locked (${status.timeLeft}m left)`;
        showModal("Account Locked", `Please wait <b>${status.timeLeft} minutes</b>.`);
        return;
    }

    if (!user || !pass) { errorMsg.textContent = "Please fill in all fields."; return; }
    errorMsg.textContent = "Verifying...";

    try {
        const devSnap = await get(child(ref(db), `devices/${deviceId}`));
        if (devSnap.exists()) {
            const owner = devSnap.val();
            if (owner !== user) {
                errorMsg.textContent = "Access Denied.";
                showModal("Access Denied", `Device linked to: <b>'${owner}'</b>.`);
                return;
            }
        } 

        const snapshot = await get(child(ref(db), `users/${user}`));
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === pass) {
                localStorage.removeItem('failed_attempts');
                localStorage.removeItem('lockout_start');
                showSuccessLogin(user); 
            } else {
                const isNowLocked = registerFailure();
                const attemptsLeft = MAX_ATTEMPTS - (status.attempts + 1);
                if (isNowLocked) {
                    errorMsg.textContent = "Locked for 20m.";
                    showModal("Security Alert", "Account locked for 20 minutes.");
                } else {
                    errorMsg.textContent = `Incorrect password.`;
                    showModal("Login Failed", `Incorrect Password.<br><b>${attemptsLeft}</b> attempts remaining.`);
                }
            }
        } else {
            errorMsg.textContent = "User not found.";
        }
    } catch (e) {
        errorMsg.textContent = "Connection error.";
        console.error(e);
    }
}

async function handleSignUp() {
    const user = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value.trim();
    const errorMsg = document.getElementById("auth-error");
    const deviceId = getDeviceId();

    const validationError = validateInputs(user, pass);
    if (validationError) {
        errorMsg.textContent = "Invalid input.";
        showModal("Invalid Input", validationError);
        return;
    }

    errorMsg.textContent = "Checking device...";

    try {
        const devSnap = await get(child(ref(db), `devices/${deviceId}`));
        if (devSnap.exists()) {
            const owner = devSnap.val();
            errorMsg.textContent = `Device locked.`;
            showModal("Registration Failed", `This device is strictly registered to <b>'${owner}'</b>.<br>You cannot create another account on this device.`);
            return;
        }

        const userSnap = await get(child(ref(db), `users/${user}`));
        if (userSnap.exists()) {
            errorMsg.textContent = "Username taken.";
            return;
        }

        await set(ref(db, `users/${user}`), { password: pass, device_id: deviceId });
        await set(ref(db, `devices/${deviceId}`), user);
        
        showSignUpSuccess(user, pass);

    } catch (e) {
        errorMsg.textContent = "Signup failed.";
        console.error(e);
    }
}

// 🌀 ANIMATED GUEST LOGIN
function handleGuestLogin() {
    toggleLoader(true);
    setTimeout(() => {
        completeLogin("Guest", true);
        toggleLoader(false);
    }, 1500);
}

function completeLogin(username, guestMode) {
    currentUser = username;
    isGuest = guestMode;
    sessionStorage.setItem('currentUser', username);
    sessionStorage.setItem('isGuest', guestMode);
    document.getElementById("auth-modal").classList.add("hidden");
    initializeAppState();
}

function logout() {
    showConfirm("Log Out?", "Are you sure you want to log out?", () => {
        toggleLoader(true);
        setTimeout(() => {
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('isGuest');
            currentUser = null;
            isGuest = false;
            currentSessionId = null;
            chatSessions = {};
            firebaseLoadedOnce = false;

            document.getElementById("chat-list").innerHTML = "";
            document.getElementById("chat-box").innerHTML = "";
            document.getElementById("auth-username").value = "";
            document.getElementById("auth-password").value = "";
            
            document.getElementById("auth-modal").classList.remove("hidden");
            document.getElementById("sidebar").classList.remove("mobile-open");

            toggleLoader(false);
        }, 1500);
    });
}

// ==========================================
// 5. MAIN APP LOGIC
// ==========================================

async function initializeAppState() {
    chatSessions = {};
    messageCache = {};
    document.getElementById("chat-list").innerHTML = "";
    document.getElementById("chat-box").innerHTML = "";

    if (isGuest) {
        currentSessionId = generateSessionId();
        chatSessions[currentSessionId] = { name: "Guest Chat", timestamp: Date.now() };
        messageCache[currentSessionId] = []; 
        renderChatList();
    } else {
        await loadSessionsFromFirebase();
    }
}

function toggleSidebar(e) {
    if (e && e.stopPropagation) {
        e.stopPropagation();
        e.preventDefault();
    }

    const sidebar = document.getElementById("sidebar");
    const openBtn = document.getElementById("open-sidebar-btn");
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle("mobile-open");
    } else {
        sidebar.classList.toggle("hidden");
        if (sidebar.classList.contains("hidden")) {
            openBtn.style.display = "block";
        } else {
            openBtn.style.display = "none";
        }
    }
}

async function createNewChat(shouldSave = true) {
    if (isSending) return;
    currentSessionId = generateSessionId();
    chatSessions[currentSessionId] = { name: "New Chat", timestamp: Date.now() };
    messageCache[currentSessionId] = [];
    renderChatList();
    renderMessagesFromCache(currentSessionId);
    if (shouldSave && !isGuest) await saveSessionMetaToFirebase();
}

async function switchChat(id) {
    if (isSending) return;
    if (id === currentSessionId) return;
    currentSessionId = id;
    updateActiveChatHighlight(id);
    
    // Always try to load if cache is empty
    if (!messageCache[id] || messageCache[id].length === 0) {
        await loadHistory(id);
    } else {
        renderMessagesFromCache(id);
    }
    if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("mobile-open");
}

async function sendMessage(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    if (isSending) {
        console.warn("⛔ BLOCKED: Wait for AI response.");
        return;
    }

    const input = document.getElementById("msg-input");
    const sendBtn = document.getElementById("send-btn");
    const text = input.value.trim();
    const hasImage = !!selectedImageBase64;

    if (!text && !hasImage) return;

    isSending = true;
    input.disabled = true;
    input.value = ""; 
    if(sendBtn) {
        sendBtn.classList.add("disabled");
        sendBtn.style.pointerEvents = "none";
    }

    try {
        const imageBase64ToSend = selectedImageBase64;
        const userContent = text || "[Image]";
        const userMsg = { role: "user", content: userContent, timestamp: Date.now() };
        addMessageToUI(userContent, "user", imageBase64ToSend);
        addToCache(currentSessionId, userMsg);
        saveMessageToFirebase(currentSessionId, userMsg);

        const loadingId = "loading-" + Date.now();
        addMessageToUI("Thinking...", "model loading-pulse", null, loadingId);

        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "x-auth": AUTH_TOKEN,
                "ngrok-skip-browser-warning": "true"
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                message: text,
                image_base64: imageBase64ToSend
            })
        });

        document.getElementById(loadingId)?.remove();

        if (!response.ok) throw new Error("Server Error");
        const data = await response.json();

        if (data.response) {
            const botMsg = { role: "model", content: data.response, timestamp: Date.now() };
            addMessageToUI(data.response, "model"); 
            addToCache(currentSessionId, botMsg);
            saveMessageToFirebase(currentSessionId, botMsg);
        }

        if (imageBase64ToSend) {
            clearSelectedImage();
        }

    } catch (err) {
        document.getElementById(loadingId)?.remove();
        addMessageToUI("Error: " + err.message, "model");
    } finally {
        isSending = false;
        input.disabled = false;
        input.focus();
        if(sendBtn) {
            sendBtn.classList.remove("disabled");
            sendBtn.style.pointerEvents = "auto";
        }
    }
}

function clearSelectedImage() {
    selectedImageBase64 = null;
    const preview = document.getElementById("preview");
    const imgInput = document.getElementById("img-input");

    if (preview) {
        preview.src = "";
        preview.style.display = "none";
    }
    if (imgInput) {
        imgInput.value = "";
    }
}

function handleImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showModal("Invalid File", "Please select a valid image file.");
        clearSelectedImage();
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        selectedImageBase64 = reader.result;
        const preview = document.getElementById("preview");
        if (preview && typeof selectedImageBase64 === "string") {
            preview.src = selectedImageBase64;
            preview.style.display = "block";
        }
    };
    reader.onerror = () => {
        showModal("Image Error", "Could not read the selected image.");
        clearSelectedImage();
    };

    reader.readAsDataURL(file);
}

// ==========================================
// 6. FIREBASE SYNC FUNCTIONS
// ==========================================

let firebaseLoadedOnce = false;

async function loadSessionsFromFirebase() {
    if (isGuest) return;
    if (firebaseLoadedOnce) return; 
    firebaseLoadedOnce = true;

    try {
        const snapshot = await get(child(ref(db), `chats/${currentUser}/meta`));
        if (snapshot.exists()) {
            chatSessions = snapshot.val();
            const ids = Object.keys(chatSessions).sort((a, b) => chatSessions[b].timestamp - chatSessions[a].timestamp);
            
            if (ids.length > 0) {
                currentSessionId = ids[0];
            } else {
                await createNewChat(false);
                return;
            }
        } else {
            await createNewChat(false);
            return;
        }
        
        renderChatList();
        
        // Force load history for the initial session
        console.log("Loading history for initial session:", currentSessionId);
        await loadHistory(currentSessionId);
        
    } catch (e) { console.error("Firebase Error:", e); }
}

async function saveSessionMetaToFirebase() {
    if (isGuest) return;
    await set(ref(db, `chats/${currentUser}/meta`), chatSessions);
}

async function saveMessageToFirebase(sessionId, msgObj) {
    if (!USE_FIREBASE || isGuest) return;
    try {
        const messagesRef = child(ref(db), `chats/${currentUser}/${sessionId}/messages`);
        const snapshot = await get(messagesRef);
        if (snapshot.exists()) {
            const messages = snapshot.val();
            const msgKeys = Object.keys(messages);
            if (msgKeys.length >= 15) {
                const sortedKeys = msgKeys.sort((a, b) => messages[a].timestamp - messages[b].timestamp);
                const deleteCount = (msgKeys.length + 1) - 15; 
                for (let i = 0; i < deleteCount; i++) {
                    await remove(child(messagesRef, sortedKeys[i]));
                }
            }
        }
        const uniqueKey = Date.now() + Math.random().toString(36).substr(2, 5);
        await update(child(messagesRef, uniqueKey), msgObj);
    } catch (e) { console.warn("DB Error:", e.message); }
}

async function loadHistory(sessionId) {
    console.log("Fetching history for:", sessionId);
    const chatBox = document.getElementById("chat-box");
    // Only clear if switching sessions
    if(currentSessionId !== sessionId && chatBox) chatBox.innerHTML = "";
    
    messageCache[sessionId] = [];
    if (isGuest) return;

    try {
        const snapshot = await get(child(ref(db), `chats/${currentUser}/${sessionId}/messages`));
        if (snapshot.exists()) {
            const msgs = snapshot.val();
            const sortedMsgs = Object.values(msgs).sort((a, b) => a.timestamp - b.timestamp);
            
            // Clear again to be safe before rendering
            if(chatBox) chatBox.innerHTML = "";
            
            sortedMsgs.forEach(msg => {
                addToCache(sessionId, msg);
                addMessageToUI(msg.content, msg.role);
            });
            console.log("History loaded successfully.");
        } else {
            console.log("No messages found in Firebase for this session.");
        }
    } catch (e) { console.error("Load History Error:", e); }
}

// ==========================================
// 7. UTILS & UI HELPERS
// ==========================================

function startRenaming(id) {
    const item = document.querySelector(`.chat-item[data-id="${id}"]`);
    if (!item) return;
    const currentName = chatSessions[id].name;
    const container = item.querySelector(".chat-name-container");
    item.classList.add("editing");
    container.innerHTML = `
        <div style="display:flex; width:100%; gap:5px;">
            <input id="rename-${id}" type="text" placeholder="${currentName}" 
                   onkeydown="if(event.key==='Enter') finishRenaming('${id}', this.value)"
                     style="flex:1; padding:4px; border-radius:4px; border:1px solid #ffffff; color:#000000;">
                 <button onclick="finishRenaming('${id}', document.getElementById('rename-${id}').value)" style="color:#ffffff; background:none; border:none; cursor:pointer;">✔</button>
                 <button onclick="renderChatList()" style="color:#b8b8b8; background:none; border:none; cursor:pointer;">✖</button>
        </div>
    `;
    setTimeout(() => document.getElementById(`rename-${id}`).focus(), 50);
}

function finishRenaming(id, newName) {
    if (newName && newName.trim()) {
        chatSessions[id].name = newName.trim();
        saveSessionMetaToFirebase(); 
    }
    renderChatList();
}

async function deleteChat(id) {
    showConfirm("Delete Chat?", "Are you sure you want to delete this chat? This cannot be undone.", async () => {
        delete chatSessions[id];
        delete messageCache[id];
        if (!isGuest) {
            await remove(ref(db, `chats/${currentUser}/${id}`)); 
            await saveSessionMetaToFirebase(); 
        }
        if (id === currentSessionId) {
            const remaining = Object.keys(chatSessions);
            if (remaining.length > 0) switchChat(remaining[0]);
            else createNewChat();
        } else {
            renderChatList();
        }
    });
}

function renderChatList() {
    const list = document.getElementById("chat-list");
    list.innerHTML = "";
    Object.keys(chatSessions)
        .sort((a,b) => chatSessions[b].timestamp - chatSessions[a].timestamp)
        .forEach(id => {
            const div = document.createElement("div");
            div.className = `chat-item ${id === currentSessionId ? 'active' : ''}`;
            div.dataset.id = id;
            div.onclick = (e) => {
                if(!e.target.closest('button') && !e.target.closest('input')) switchChat(id);
            };
            div.innerHTML = `
                <div class="chat-name-container"><span class="chat-name-text" ondblclick="startRenaming('${id}')">${chatSessions[id].name}</span></div>
                <div class="chat-actions">
                    <button onclick="startRenaming('${id}')">✏️</button>
                    <button onclick="deleteChat('${id}')">🗑️</button>
                </div>`;
            list.appendChild(div);
        });
}

function renderMessagesFromCache(sessionId) {
    if (sessionId !== currentSessionId) return;
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    if (!messageCache[sessionId]) return;
    messageCache[sessionId].forEach(msg => {
        addMessageToUI(msg.content, msg.role);
    });
}

function addMessageToUI(text, role, img, id) {
    const box = document.getElementById("chat-box");
    if (!box) return;
    const div = document.createElement("div");
    div.className = `message ${role}`;
    if (id) div.id = id;

    if (img) {
        const imageEl = document.createElement("img");
        imageEl.src = img;
        imageEl.alt = "Sent image";
        imageEl.style.maxWidth = "220px";
        imageEl.style.maxHeight = "220px";
        imageEl.style.borderRadius = "10px";
        imageEl.style.display = "block";
        div.appendChild(imageEl);

        if (text) {
            const captionEl = document.createElement("div");
            captionEl.textContent = text;
            captionEl.style.marginTop = "8px";
            div.appendChild(captionEl);
        }
    } else {
        div.textContent = text;
    }

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function addToCache(sid, msg) {
    if (!messageCache[sid]) messageCache[sid] = [];
    messageCache[sid].push(msg);
}

function updateActiveChatHighlight(id) {
    document.querySelectorAll('.chat-item').forEach(e => e.classList.remove('active'));
    document.querySelector(`.chat-item[data-id="${id}"]`)?.classList.add('active');
}

function generateSessionId() { return "sess-" + Math.random().toString(36).substr(2, 9); }

// ==========================================
// 8. INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App Initialized");

    // 🌀 PRELOADER LOGIC
    const preloader = document.getElementById('preloader');
    if (preloader) {
        window.addEventListener('load', () => {
            setTimeout(() => toggleLoader(false), 1500); 
        });
        setTimeout(() => toggleLoader(false), 3000); // Fallback
    }

    // 1. CHECK LOGIN
    if (currentUser) {
        document.getElementById("auth-modal").classList.add("hidden");
        initializeAppState();
    } else {
        document.getElementById("auth-modal").classList.remove("hidden");
    }

    // 2. SETUP SEND BUTTON
    const oldBtn = document.getElementById("send-btn");
    if (oldBtn) {
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        newBtn.addEventListener("click", (e) => {
            e.preventDefault(); 
            e.stopImmediatePropagation();
            if (isSending) return; // Guard
            sendMessage(e);
        });
    }

    // 3. SETUP INPUT KEY LISTENER
    const msgInput = document.getElementById("msg-input");
    if (msgInput) {
        const newInput = msgInput.cloneNode(true);
        msgInput.parentNode.replaceChild(newInput, msgInput);
        newInput.id = "msg-input";
        newInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) { 
                e.preventDefault();
                e.stopImmediatePropagation();
                if (isSending) return; // Guard
                sendMessage(e);
            }
        });
    }

    const imgInput = document.getElementById("img-input");
    if (imgInput) {
        imgInput.addEventListener("change", handleImageSelection);
    }

    // 4. SETUP SIDEBAR BUTTONS
    const openSidebarBtn = document.getElementById("open-sidebar-btn");
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener("click", (e) => toggleSidebar(e));
    }

    const closeSidebarBtn = document.getElementById("close-sidebar-btn");
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener("click", (e) => toggleSidebar(e));
    }

    const newChatBtn = document.getElementById("new-chat-btn");
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => createNewChat());
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            logout();
        });
    }

    // 5. MOBILE AUTO-SCROLL
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const chatBox = document.getElementById("chat-box");
            if (chatBox) chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
            if (document.activeElement.tagName === "TEXTAREA") {
                document.activeElement.scrollIntoView({ block: "center", behavior: "smooth" });
            }
        });
    }

    // 6. OUTSIDE CLICK (Close Sidebar on Mobile)
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById("sidebar");
        
        if (window.innerWidth <= 768 && sidebar.classList.contains("mobile-open")) {
            if (!sidebar.contains(e.target)) {
                sidebar.classList.remove("mobile-open");
            }
        }
    });
});

// ==========================================
// 9. EXPORTS
// ==========================================
window.handleLogin = handleLogin;
window.handleSignUp = handleSignUp;
window.handleGuestLogin = handleGuestLogin;
window.createNewChat = createNewChat;
window.switchChat = switchChat;
window.sendMessage = sendMessage;
window.toggleSidebar = toggleSidebar; 
window.startRenaming = startRenaming;
window.finishRenaming = finishRenaming;
window.deleteChat = deleteChat;
window.closeModal = closeModal;
window.API_BASE = API_BASE;
window.AUTH_TOKEN = AUTH_TOKEN;