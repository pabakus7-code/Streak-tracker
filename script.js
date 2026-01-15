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
    year: "numeric", month: "short", day: "numeric",
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

// name editor
const nameDisplay = $("nameDisplay");
const nameEditor = $("nameEditor");
const nameInput = $("nameInput");
const nameSave = $("nameSave");

// milestones
const milestoneRow = $("milestoneRow");
const nextMilestoneEl = $("nextMilestone");
const barFill = $("barFill");

// modal
const modal = $("milestoneModal");
const modalClose = $("modalClose");
const modalNum = $("modalNum");

// confetti
const confettiCanvas = $("confetti");
const ctx = confettiCanvas?.getContext?.("2d");

// reminders UI (basic: permission + save time + show next time)
const enableNotifs = $("enableNotifs");
const remindTime = $("remindTime");
const saveRemindTime = $("saveRemindTime");
const notifStatus = $("notifStatus");
const nextReminderEl = $("nextReminder");

// ---------- storage keys ----------
const KEYS = {
  count: "streak_count",
  last: "streak_last_checked",
  name: "streak_name",
  theme: "theme",
  remindTime: "remind_time",            // "HH:MM"
  lastMilestoneShown: "last_milestone", // number
};

// ---------- config ----------
const MILESTONES = [1, 5, 10, 30, 50, 100, 500, 1000];

// ---------- ui helpers ----------
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEYS.theme, theme);
  if (themeToggle) themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
}
function toggleTheme() {
  const cur = localStorage.getItem(KEYS.theme) || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
}

// name editor
function openNameEditor() {
  if (!nameEditor || !nameInput) return;
  nameEditor.classList.remove("hidden");
  nameInput.value = (localStorage.getItem(KEYS.name) || nameDisplay?.textContent || "").trim();
  nameInput.focus();
  nameInput.select();
}
function closeNameEditor() {
  nameEditor?.classList.add("hidden");
}
function saveName() {
  const val = (nameInput?.value || "").trim();
  if (!val) { setStatus("Type a name first."); return; }
  localStorage.setItem(KEYS.name, val);
  if (nameDisplay) nameDisplay.textContent = val;
  document.title = val;
  closeNameEditor();
  setStatus("Name saved ✅");
}

// ---------- milestone rendering ----------
function getNextMilestone(count) {
  return MILESTONES.find((m) => count < m) ?? null;
}
function getPrevMilestone(count) {
  let prev = 0;
  for (const m of MILESTONES) {
    if (m <= count) prev = m;
  }
  return prev;
}

function renderMilestones(count) {
  if (!milestoneRow) return;

  // chips row
  milestoneRow.innerHTML = "";
  const next = getNextMilestone(count);
  for (const m of MILESTONES) {
    const chip = document.createElement("div");
    chip.className = "mChip";
    chip.textContent = String(m);
    if (m <= count) chip.classList.add("hit");
    if (next === m) chip.classList.add("next");
    milestoneRow.appendChild(chip);
  }

  // "Next: X"
  if (nextMilestoneEl) nextMilestoneEl.textContent = next ? String(next) : "—";

  // bar progress
  const prev = getPrevMilestone(count);
  const nextM = next ?? prev; // if already past 1000, just full
  let pct = 100;

  if (next !== null) {
    // progress within prev->next segment
    const segmentStart = prev;
    const segmentEnd = nextM;
    const denom = Math.max(1, segmentEnd - segmentStart);
    const within = Math.min(denom, Math.max(0, count - segmentStart));
    // Map segment progress to full-bar progress across milestone list
    // Simple approach: overall percent to next milestone (feels good visually)
    pct = Math.round((count / nextM) * 100);
    pct = Math.min(100, Math.max(0, pct));
  }

  if (barFill) barFill.style.width = `${pct}%`;
}

// ---------- milestone modal + confetti ----------
function openMilestoneModal(m) {
  if (!modal || !modalNum) return;
  modalNum.textContent = String(m);
  modal.classList.remove("hidden");
}
function closeMilestoneModal() {
  modal?.classList.add("hidden");
}

function resizeConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth * devicePixelRatio;
  confettiCanvas.height = window.innerHeight * devicePixelRatio;
}
window.addEventListener("resize", resizeConfetti);

function confettiBurst() {
  if (!ctx || !confettiCanvas) return;

  resizeConfetti();

  const W = confettiCanvas.width;
  const H = confettiCanvas.height;

  // create particles
  const particles = [];
  const count = 140;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: W * 0.5,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 1.1) * 18,
      g: 0.55 + Math.random() * 0.35,
      r: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      life: 0,
      max: 70 + Math.random() * 45,
    });
  }

  let frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      p.life++;
      p.vy += p.g;
      p.x += p.vx * devicePixelRatio;
      p.y += p.vy * devicePixelRatio;
      p.rot += p.vr;

      const alpha = 1 - p.life / p.max;
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      // random bright-ish color (no hardcoding “one” brand color)
      ctx.fillStyle = `hsl(${Math.floor(Math.random() * 360)}, 90%, 60%)`;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    }

    if (frame < 90) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(tick);
}

function maybeTriggerMilestone(count) {
  // Trigger ONLY if count is exactly a milestone
  const isMilestone = MILESTONES.includes(count);
  if (!isMilestone) return;

  const lastShown = Number(localStorage.getItem(KEYS.lastMilestoneShown) || "0");

  // Prevent re-show on refresh / repeated renders
  if (count <= lastShown) return;

  localStorage.setItem(KEYS.lastMilestoneShown, String(count));
  openMilestoneModal(count);
  confettiBurst();
}

// ---------- streak logic ----------
function render() {
  const count = Number(localStorage.getItem(KEYS.count) || "0");
  const last = localStorage.getItem(KEYS.last) || "";
  const name = localStorage.getItem(KEYS.name) || "Streak Tracker";
  const theme = localStorage.getItem(KEYS.theme) || "dark";
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

  // milestones UI
  renderMilestones(count);

  // reminders UI
  if (remindTime) remindTime.value = savedTime;
  updateReminderText();

  // keep editor hidden unless opened
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

  // Milestone trigger happens on ACTUAL new count
  maybeTriggerMilestone(count);

  render();
}

function resetStreak() {
  localStorage.setItem(KEYS.count, "0");
  localStorage.removeItem(KEYS.last);
  // also reset milestone memory if you want it to re-celebrate in future
  localStorage.setItem(KEYS.lastMilestoneShown, "0");

  setStatus("Reset done.");
  closeMilestoneModal();
  render();
}

// ---------- reminders (basic UI state) ----------
function getNotifPermission() {
  return Notification?.permission || "default";
}

function updateReminderText() {
  if (!notifStatus || !nextReminderEl) return;

  const perm = getNotifPermission();
  if (perm === "granted") {
    notifStatus.textContent = "Notifications already allowed ✅";
  } else if (perm === "denied") {
    notifStatus.textContent = "Notifications blocked ❌ (check browser settings)";
  } else {
    notifStatus.textContent = "Notifications not enabled yet.";
  }

  const t = localStorage.getItem(KEYS.remindTime) || "";
  if (!t) {
    nextReminderEl.textContent = "";
    return;
  }

  // show “Next reminder” time locally (not actually scheduling a real push here)
  const now = new Date();
  const [hh, mm] = t.split(":").map(Number);
  const next = new Date();
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const pretty = next.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  nextReminderEl.textContent = `Next reminder: ${pretty}`;
}

async function enableNotifications() {
  if (!notifStatus) return;

  // If already granted, don’t hang on “opening prompt”
  if (getNotifPermission() === "granted") {
    notifStatus.textContent = "Notifications already allowed ✅";
    return;
  }

  notifStatus.textContent = "Opening permission prompt…";
  try {
    // Ask browser permission (OneSignal prompt will also happen when needed)
    const res = await Notification.requestPermission();
    if (res === "granted") notifStatus.textContent = "Enabled ✅";
    else if (res === "denied") notifStatus.textContent = "Blocked ❌";
    else notifStatus.textContent = "Dismissed.";
  } catch (e) {
    notifStatus.textContent = "Couldn’t open prompt.";
  }
  updateReminderText();
}

function saveReminderTime() {
  const t = (remindTime?.value || "").trim(); // "HH:MM"
  if (!t) {
    notifStatus.textContent = "Pick a time first.";
    return;
  }
  localStorage.setItem(KEYS.remindTime, t);
  notifStatus.textContent = "Saved ✅";
  updateReminderText();
}

// ---------- wire events ----------
themeToggle?.addEventListener("click", toggleTheme);
checkInBtn?.addEventListener("click", checkIn);
resetBtn?.addEventListener("click", resetStreak);

nameDisplay?.addEventListener("click", openNameEditor);
nameDisplay?.addEventListener("keydown", (e) => { if (e.key === "Enter") openNameEditor(); });
nameSave?.addEventListener("click", saveName);
nameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveName();
  if (e.key === "Escape") closeNameEditor();
});

// click outside editor closes it
document.addEventListener("click", (e) => {
  if (!nameEditor || nameEditor.classList.contains("hidden")) return;
  const clickedInside = nameEditor.contains(e.target) || nameDisplay?.contains(e.target);
  if (!clickedInside) closeNameEditor();
});

// modal close behaviors (fixes your “can’t exit”)
modalClose?.addEventListener("click", closeMilestoneModal);
modal?.addEventListener("click", (e) => {
  // clicking the dark overlay closes; clicking the card does not
  if (e.target === modal) closeMilestoneModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMilestoneModal();
});

// reminders
enableNotifs?.addEventListener("click", enableNotifications);
saveRemindTime?.addEventListener("click", saveReminderTime);

// ---------- init ----------
render();
