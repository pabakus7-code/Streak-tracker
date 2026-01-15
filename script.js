// ---------- helpers ----------
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
const $ = (id) => document.getElementById(id);

// ---------- elements ----------
const streakEl = $("streak");
const lastCheckedEl = $("lastChecked");
const statusEl = $("status");

const checkInBtn = $("checkIn");
const resetBtn = $("reset");

const themeToggle = $("themeToggle");

const nameDisplay = $("nameDisplay");
const nameEditor = $("nameEditor");
const nameInput = $("nameInput");
const nameSave = $("nameSave");

const milestoneRow = $("milestoneRow");
const nextMilestoneEl = $("nextMilestone");
const progressFill = $("progressFill");
const progressText = $("progressText");

const enableNotifsBtn = $("enableNotifs");
const notifStatus = $("notifStatus");

const remindMode = $("remindMode");
const remindTime = $("remindTime");
const timeField = $("timeField");
const saveReminder = $("saveReminder");
const nextReminderText = $("nextReminderText");

const milestoneModal = $("milestoneModal");
const modalBig = $("modalBig");
const closeModal = $("closeModal");

// ---------- storage ----------
const KEYS = {
  count: "streak_count",
  last: "streak_last_checked",
  name: "streak_name",
  theme: "theme",
  remindMode: "remind_mode",   // daily | 30min
  remindTime: "remind_time",   // HH:MM
};

const MILESTONES = [1, 5, 10, 30, 50, 100, 500, 1000];

let localIntervalTimer = null;

// ---------- UI helpers ----------
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}
function setNotifStatus(msg) {
  if (notifStatus) notifStatus.textContent = msg || "";
}
function showModalForMilestone(n) {
  if (!milestoneModal || !modalBig) return;
  modalBig.textContent = String(n);

  milestoneModal.classList.remove("hidden");
  milestoneModal.setAttribute("aria-hidden", "false");

  fireConfetti(140);
}
function hideModal() {
  if (!milestoneModal) return;
  milestoneModal.classList.add("hidden");
  milestoneModal.setAttribute("aria-hidden", "true");
}

// confetti (simple DOM particles)
function fireConfetti(count = 120) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.style.position = "fixed";
    p.style.left = Math.random() * 100 + "vw";
    p.style.top = "-10px";
    p.style.width = (6 + Math.random() * 6) + "px";
    p.style.height = (10 + Math.random() * 10) + "px";
    p.style.borderRadius = "3px";
    p.style.zIndex = "999999";
    p.style.opacity = "0.95";
    p.style.background = `hsl(${Math.random() * 360}, 90%, 60%)`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;

    const fall = 900 + Math.random() * 900;
    const drift = (Math.random() - 0.5) * 300;

    p.animate([
      { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${drift}px, ${fall}px) rotate(540deg)`, opacity: 0.0 }
    ], { duration: 1400 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.2,1)" });

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2200);
  }
}

// ---------- theme ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEYS.theme, theme);
  if (themeToggle) themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
}
function toggleTheme() {
  const cur = localStorage.getItem(KEYS.theme) || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
}

// ---------- name editor ----------
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

// ---------- milestones ----------
function getNextMilestone(count) {
  return MILESTONES.find(m => m > count) ?? null;
}
function renderMilestones(count) {
  if (!milestoneRow) return;

  milestoneRow.innerHTML = "";
  const next = getNextMilestone(count);
  if (nextMilestoneEl) nextMilestoneEl.textContent = next ? String(next) : "—";

  for (const m of MILESTONES) {
    const el = document.createElement("div");
    el.className = "milestone";
    el.textContent = String(m);

    if (count >= m) el.classList.add("hit");
    else if (m === next) el.classList.add("next");

    milestoneRow.appendChild(el);
  }

  const base = next ?? MILESTONES[MILESTONES.length - 1];
  const pct = Math.max(0, Math.min(100, (count / base) * 100));
  if (progressFill) progressFill.style.width = pct + "%";
  if (progressText) progressText.textContent = `${count} / ${base}`;
}

// ---------- streak logic ----------
function render() {
  const count = Number(localStorage.getItem(KEYS.count) || "0");
  const last = localStorage.getItem(KEYS.last) || "";
  const name = localStorage.getItem(KEYS.name) || "Streak Tracker";
  const theme = localStorage.getItem(KEYS.theme) || "dark";

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

  renderMilestones(count);
  renderReminderUI();
}

function maybeCelebrate(countBefore, countAfter) {
  // celebrate if you just HIT a milestone
  for (const m of MILESTONES) {
    if (countBefore < m && countAfter >= m) {
      showModalForMilestone(m);
      break;
    }
  }
}

function checkIn() {
  const today = todayISO();
  const last = localStorage.getItem(KEYS.last) || "";
  let count = Number(localStorage.getItem(KEYS.count) || "0");
  const before = count;

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

  maybeCelebrate(before, count);
  render();
}

function resetStreak() {
  localStorage.setItem(KEYS.count, "0");
  localStorage.removeItem(KEYS.last);
  setStatus("Reset done.");
  render();
}

// ---------- OneSignal + reminders ----------
async function withOneSignal(fn) {
  // OneSignal loads async; the official pattern is deferred init
  if (!window.OneSignalDeferred) return null;

  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        const out = await fn(OneSignal);
        resolve(out);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function refreshNotifState() {
  return withOneSignal(async (OneSignal) => {
    // v16: request permission
    // docs show OneSignal.Notifications.requestPermission() :contentReference[oaicite:2]{index=2}
    const supported = await OneSignal.Notifications.isPushSupported();
    if (!supported) {
      setNotifStatus("Push not supported on this browser.");
      return;
    }

    const optedIn = OneSignal.User?.PushSubscription?.optedIn;
    if (optedIn) {
      setNotifStatus("Notifications already allowed ✅");
    } else {
      setNotifStatus("Not enabled yet.");
    }
  });
}

async function enableNotifications() {
  setNotifStatus("Opening permission prompt…");

  await withOneSignal(async (OneSignal) => {
    const supported = await OneSignal.Notifications.isPushSupported();
    if (!supported) {
      setNotifStatus("Push not supported on this browser.");
      return;
    }

    const optedIn = OneSignal.User?.PushSubscription?.optedIn;
    if (optedIn) {
      setNotifStatus("Notifications already allowed ✅");
      return;
    }

    // request permission (v16)
    await OneSignal.Notifications.requestPermission(); // :contentReference[oaicite:3]{index=3}
  });

  // after request, refresh
  setTimeout(refreshNotifState, 600);
}

function renderReminderUI() {
  const mode = localStorage.getItem(KEYS.remindMode) || "daily";
  const time = localStorage.getItem(KEYS.remindTime) || "";

  if (remindMode) remindMode.value = mode;
  if (remindTime) remindTime.value = time;

  if (timeField) timeField.style.display = mode === "daily" ? "block" : "none";

  updateNextReminderText();
}

function updateNextReminderText() {
  const mode = localStorage.getItem(KEYS.remindMode) || "daily";
  const time = localStorage.getItem(KEYS.remindTime) || "";

  if (!nextReminderText) return;

  if (mode === "30min") {
    nextReminderText.textContent =
      "Every 30 minutes reminders only work while this page is open.";
    return;
  }

  if (!time) {
    nextReminderText.textContent = "Pick a time, then hit Save.";
    return;
  }

  // show next reminder time locally
  const now = new Date();
  const [hh, mm] = time.split(":").map(Number);
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const nice = next.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  nextReminderText.textContent = `Next reminder: ${nice} ✅ (requires a scheduled push to arrive when you're offline)`;
}

async function saveReminderSettings() {
  const mode = remindMode?.value || "daily";
  const time = remindTime?.value || "";

  localStorage.setItem(KEYS.remindMode, mode);

  if (mode === "daily") {
    if (!time) {
      setNotifStatus("Pick a time first.");
      return;
    }
    localStorage.setItem(KEYS.remindTime, time);
  } else {
    localStorage.removeItem(KEYS.remindTime);
  }

  // Tag the user in OneSignal so you can target/schedule later in dashboard
  await withOneSignal(async (OneSignal) => {
    // The mapping doc shows tags exist and the User model supports them. :contentReference[oaicite:4]{index=4}
    // (Exact tag helpers vary across versions, but this works in v16 user model.)
    const optedIn = OneSignal.User?.PushSubscription?.optedIn;

    if (optedIn && OneSignal.User?.addTags) {
      await OneSignal.User.addTags({
        remind_mode: mode,
        remind_time: mode === "daily" ? time : "",
      });
    }
  });

  // Local-only fallback (ONLY while page is open)
  startLocalReminderTimer();

  setNotifStatus("Saved ✅");
  updateNextReminderText();
}

function startLocalReminderTimer() {
  if (localIntervalTimer) {
    clearInterval(localIntervalTimer);
    localIntervalTimer = null;
  }

  const mode = localStorage.getItem(KEYS.remindMode) || "daily";
  const time = localStorage.getItem(KEYS.remindTime) || "";

  if (mode === "30min") {
    localIntervalTimer = setInterval(() => {
      setStatus("Reminder: check in today 👀");
    }, 30 * 60 * 1000);
    return;
  }

  if (mode === "daily" && time) {
    // check once a minute
    localIntervalTimer = setInterval(() => {
      const now = new Date();
      const [hh, mm] = time.split(":").map(Number);
      if (now.getHours() === hh && now.getMinutes() === mm) {
        setStatus("Reminder: check in today 👀");
      }
    }, 60 * 1000);
  }
}

// ---------- wire events ----------
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

document.addEventListener("click", (e) => {
  if (!nameEditor || nameEditor.classList.contains("hidden")) return;
  const clickedInside =
    nameEditor.contains(e.target) || (nameDisplay && nameDisplay.contains(e.target));
  if (!clickedInside) closeNameEditor();
});

if (enableNotifsBtn) enableNotifsBtn.addEventListener("click", enableNotifications);
if (saveReminder) saveReminder.addEventListener("click", saveReminderSettings);

if (remindMode) {
  remindMode.addEventListener("change", () => {
    localStorage.setItem(KEYS.remindMode, remindMode.value);
    renderReminderUI();
    startLocalReminderTimer();
  });
}

if (closeModal) closeModal.addEventListener("click", hideModal);
if (milestoneModal) {
  milestoneModal.addEventListener("click", (e) => {
    if (e.target === milestoneModal) hideModal();
  });
}

// ---------- init ----------
render();
refreshNotifState();
startLocalReminderTimer();
