// ---- helpers ----
const pad2 = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const isoToPretty = (iso) => {
  if (!iso) return "never";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
const daysBetween = (a, b) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((t2 - t1) / 86400000);
};

// Safe getter (prevents crashing)
const $ = (id) => document.getElementById(id);

// ---- elements ----
const streakEl = $("streak");
const lastCheckedEl = $("lastChecked");
const statusEl = $("status");

const checkInBtn = $("checkIn");
const resetBtn = $("reset");
const themeToggle = $("themeToggle");

// Name click-to-edit UI
const nameDisplay = $("nameDisplay");
const nameEditor = $("nameEditor");
const nameInput = $("nameInput");
const nameSave = $("nameSave");

// Reminders UI
const enableNotifsBtn = $("enableNotifs");
const remindTimeInput = $("remindTimeInput");
const saveRemindTimeBtn = $("saveRemindTime");
const notifStatusEl = $("notifStatus");

// ---- storage keys ----
const KEYS = {
  count: "streak_count",
  last: "streak_last_checked", // YYYY-MM-DD
  name: "streak_name",
  theme: "theme",              // "light" | "dark"
  remindTime: "remind_time_local" // "HH:MM"
};

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}
function setNotifStatus(msg) {
  if (notifStatusEl) notifStatusEl.textContent = msg || "";
}

// ---- theme ----
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEYS.theme, theme);
  // show the opposite icon (what you'll switch to)
  if (themeToggle) themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}
function toggleTheme() {
  const cur = localStorage.getItem(KEYS.theme) || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
}

// ---- name editor ----
function openNameEditor() {
  if (!nameEditor || !nameInput) return;
  nameEditor.classList.remove("hidden");
  nameInput.value = (localStorage.getItem(KEYS.name) || nameDisplay?.textContent || "").trim();
  nameInput.focus();
  nameInput.select();
}
function closeNameEditor() {
  if (!nameEditor) return;
  nameEditor.classList.add("hidden");
}
function saveName() {
  const val = (nameInput?.value || "").trim();
  if (!val) {
    setStatus("Type a name first.");
    return;
  }
  localStorage.setItem(KEYS.name, val);
  if (nameDisplay) nameDisplay.textContent = val;
  document.title = val;
  closeNameEditor();
  setStatus("Name saved ✅");
}

// ---- streak logic ----
function render() {
  const count = Number(localStorage.getItem(KEYS.count) || "0");
  const last = localStorage.getItem(KEYS.last) || "";
  const name = localStorage.getItem(KEYS.name) || "Streak Tracker";
  const theme = localStorage.getItem(KEYS.theme) || "light";
  const savedTime = localStorage.getItem(KEYS.remindTime) || "";

  if (nameDisplay) nameDisplay.textContent = name;
  document.title = name;

  if (streakEl) streakEl.textContent = String(count);
  if (lastCheckedEl) lastCheckedEl.textContent = `Last checked: ${isoToPretty(last)}`;

  applyTheme(theme);

  // lock check-in to once/day
  const today = todayISO();
  if (checkInBtn) {
    if (last === today) {
      checkInBtn.disabled = true;
      checkInBtn.textContent = "Checked in ✅";
    } else {
      checkInBtn.disabled = false;
      checkInBtn.textContent = "Check in today";
    }
  }

  // restore time input
  if (remindTimeInput && savedTime && remindTimeInput.value !== savedTime) {
    remindTimeInput.value = savedTime;
  }
}

function checkIn() {
  const today = todayISO();
  const last = localStorage.getItem(KEYS.last) || "";
  let count = Number(localStorage.getItem(KEYS.count) || "0");

  if (last === today) {
    setStatus("Already checked in today ✅");
    render();
    return;
  }

  if (!last) {
    count = 1;
    setStatus("Started! Nice 👏");
  } else {
    const diff = daysBetween(last, today);
    if (diff === 1) {
      count += 1;
      setStatus("Kept the streak going 🔥");
    } else {
      count = 1;
      setStatus("Missed a day — reset to 1 💪");
    }
  }

  localStorage.setItem(KEYS.count, String(count));
  localStorage.setItem(KEYS.last, today);
  render();
}

function resetStreak() {
  localStorage.setItem(KEYS.count, "0");
  localStorage.removeItem(KEYS.last);
  setStatus("Reset done.");
  render();
}

// ---- OneSignal helpers ----
function withOneSignal(fn) {
  try {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await fn(OneSignal);
    });
  } catch (e) {
    console.error(e);
    setNotifStatus("Notifications not available in this browser.");
  }
}

function formatNextReminder(timeHHMM) {
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const pretty = next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = next.toLocaleDateString([], { weekday: "short" });
  return `Next reminder: ${pretty} (${day}) ✅`;
}

function snapTo30Minutes(timeHHMM) {
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const snapped = mm < 15 ? 0 : mm < 45 ? 30 : 0;
  let hour = hh;
  if (mm >= 45) hour = (hh + 1) % 24;
  return `${pad2(hour)}:${pad2(snapped)}`;
}

async function enableNotifications() {
  const perm = typeof Notification !== "undefined" ? Notification.permission : "default";

  if (perm === "granted") {
    const savedTime = localStorage.getItem(KEYS.remindTime) || "";
    setNotifStatus(savedTime ? formatNextReminder(savedTime) : "Reminders enabled ✅ Pick a time below.");
    return;
  }

  if (perm === "denied") {
    setNotifStatus("Notifications are blocked ❌ Allow them in browser settings to use reminders.");
    return;
  }

  setNotifStatus("Opening permission prompt…");
  withOneSignal(async (OneSignal) => {
    await OneSignal.Notifications.requestPermission();

    const after = typeof Notification !== "undefined" ? Notification.permission : "default";
    if (after === "granted") {
      const savedTime = localStorage.getItem(KEYS.remindTime) || "";
      setNotifStatus(savedTime ? formatNextReminder(savedTime) : "Reminders enabled ✅ Pick a time below.");
    } else {
      setNotifStatus("Permission not granted. If you want reminders, click Allow next time.");
    }
  });
}

async function saveReminderTimeTag(rawTime) {
  if (!rawTime) return;

  const time = snapTo30Minutes(rawTime);

  if (remindTimeInput && remindTimeInput.value !== time) {
    remindTimeInput.value = time;
  }

  localStorage.setItem(KEYS.remindTime, time);
  setNotifStatus("Saving reminder time…");

  withOneSignal(async (OneSignal) => {
    await OneSignal.User.addTag("remind_time", time);
    setNotifStatus(formatNextReminder(time));
  });
}

// ---- wire events ----
if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
if (checkInBtn) checkInBtn.addEventListener("click", checkIn);
if (resetBtn) resetBtn.addEventListener("click", resetStreak);

if (nameDisplay) {
  nameDisplay.addEventListener("click", openNameEditor);
  nameDisplay.addEventListener("keydown", (e) => {
    if (e.key === "Enter") openNameEditor();
  });
}
if (nameSave) nameSave.addEventListener("click", saveName);
if (nameInput) {
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveName();
    if (e.key === "Escape") closeNameEditor();
  });
}

// Click outside editor closes it
document.addEventListener("click", (e) => {
  if (!nameEditor || nameEditor.classList.contains("hidden")) return;
  const clickedInside =
    nameEditor.contains(e.target) || (nameDisplay && nameDisplay.contains(e.target));
  if (!clickedInside) closeNameEditor();
});

// Reminders UI wiring
if (enableNotifsBtn) {
  enableNotifsBtn.addEventListener("click", () => {
    enableNotifications();
  });
}

if (saveRemindTimeBtn) {
  saveRemindTimeBtn.addEventListener("click", () => {
    saveReminderTimeTag(remindTimeInput?.value || "");
  });
}

// Optional: auto-save on change
if (remindTimeInput) {
  remindTimeInput.addEventListener("change", (e) => {
    saveReminderTimeTag(e.target.value);
  });
}

// Init
render();

// Show reminder status on load if already granted
if (typeof Notification !== "undefined" && Notification.permission === "granted") {
  const savedTime = localStorage.getItem(KEYS.remindTime) || "";
  setNotifStatus(savedTime ? formatNextReminder(savedTime) : "Reminders enabled ✅ Pick a time below.");
}
