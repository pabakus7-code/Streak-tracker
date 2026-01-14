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
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const $ = (id) => document.getElementById(id);

// ---- config ----
const MILESTONES = [1, 5, 10, 30, 50, 100, 500, 1000];

// ---- storage keys ----
const KEYS = {
  count: "streak_count",
  last: "streak_last_checked",
  name: "streak_name",
  theme: "theme",
  remindTime: "remind_time", // "HH:MM"
};

function init() {
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

  const milestoneTicksEl = $("milestoneTicks");
  const milestoneFillEl = $("milestoneFill");
  const milestoneNextEl = $("milestoneNext");

  const milestoneModal = $("milestoneModal");
  const milestoneNumber = $("milestoneNumber");
  const milestoneClose = $("milestoneClose");
  const confettiLayer = $("confettiLayer");

  const enableNotifs = $("enableNotifs");
  const remindTime = $("remindTime");
  const saveRemindTime = $("saveRemindTime");
  const notifStatus = $("notifStatus");

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg || "";
  };

  // ---- theme ----
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEYS.theme, theme);
    if (themeToggle) themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
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
    if (!val) return;
    localStorage.setItem(KEYS.name, val);
    if (nameDisplay) nameDisplay.textContent = val;
    document.title = val;
    closeNameEditor();
  }

  // ---- milestone helpers ----
  const getNextMilestone = (count) => MILESTONES.find((m) => count < m) || null;

  function updateMilestones(count) {
    const next = getNextMilestone(count);

    if (milestoneNextEl) {
      milestoneNextEl.textContent = next === null ? "Next: Completed 🎉" : `Next: ${next}`;
    }

    if (milestoneTicksEl) {
      const ticks = milestoneTicksEl.querySelectorAll(".tick");
      ticks.forEach((t) => {
        const m = Number(t.dataset.m || "0");
        t.classList.toggle("done", count >= m);
        t.classList.toggle("next", next !== null && m === next);
      });
    }

    if (!milestoneFillEl) return;

    if (next === null) {
      milestoneFillEl.style.width = "100%";
      return;
    }

    const idxNext = MILESTONES.indexOf(next);
    const idxPrev = Math.max(0, idxNext - 1);
    const prev = MILESTONES[idxPrev];

    const span = Math.max(1, next - prev);
    const frac = clamp((count - prev) / span, 0, 1);

    const totalSegments = MILESTONES.length - 1;
    const segmentProgress = (idxPrev + frac) / totalSegments;

    milestoneFillEl.style.width = `${clamp(segmentProgress * 100, 0, 100)}%`;
  }

  // ---- confetti + modal ----
  function burstConfetti() {
    if (!confettiLayer) return;
    const pieces = 110;
    const colors = [
      "rgba(139,115,255,0.95)",
      "rgba(255,92,92,0.90)",
      "rgba(46,213,115,0.90)",
      "rgba(255,206,86,0.95)",
      "rgba(0,206,255,0.90)",
    ];
    const w = window.innerWidth;

    for (let i = 0; i < pieces; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = `${Math.random() * w}px`;
      c.style.top = `${-20 - Math.random() * 60}px`;
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = `${850 + Math.random() * 650}ms`;
      confettiLayer.appendChild(c);
      setTimeout(() => c.remove(), 1500);
    }
  }

  function openMilestoneModal(m) {
    if (!milestoneModal || !milestoneNumber) return;
    milestoneNumber.textContent = String(m);
    milestoneModal.classList.remove("hidden");
  }
  function closeMilestoneModal() {
    if (!milestoneModal) return;
    milestoneModal.classList.add("hidden");
  }

  // ---- streak logic ----
  function render() {
    const count = Number(localStorage.getItem(KEYS.count) || "0");
    const last = localStorage.getItem(KEYS.last) || "";
    const name = localStorage.getItem(KEYS.name) || "Streak Tracker";
    const theme = localStorage.getItem(KEYS.theme) || "light";

    if (nameDisplay) nameDisplay.textContent = name;
    document.title = name;

    if (streakEl) streakEl.textContent = String(count);
    if (lastCheckedEl) lastCheckedEl.textContent = `Last checked: ${isoToPretty(last)}`;

    applyTheme(theme);
    updateMilestones(count);

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

    // reminder time load
    if (remindTime) {
      const saved = localStorage.getItem(KEYS.remindTime) || "";
      if (!remindTime.value) remindTime.value = saved;
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

    render();

    // milestone celebration
    if (MILESTONES.includes(count) && count !== before) {
      burstConfetti();
      openMilestoneModal(count);
    }
  }

  function resetStreak() {
    localStorage.setItem(KEYS.count, "0");
    localStorage.removeItem(KEYS.last);
    setStatus("Reset done.");
    render();
  }

  // ---- reminders (basic UI feedback + saves time) ----
  function setNotifStatus(msg) {
    if (notifStatus) notifStatus.textContent = msg || "";
  }

  async function enableReminders() {
    try {
      setNotifStatus("Opening permission prompt…");
      if (!window.OneSignalDeferred) {
        setNotifStatus("OneSignal not loaded yet. Refresh and try again.");
        return;
      }

      window.OneSignalDeferred.push(async function(OneSignal) {
        const perm = await OneSignal.Notifications.permission;
        if (perm === true) {
          setNotifStatus("Notifications already allowed ✅");
        } else {
          // This triggers the browser prompt (if allowed to show)
          await OneSignal.Notifications.requestPermission();
          const perm2 = await OneSignal.Notifications.permission;
          setNotifStatus(perm2 === true ? "Notifications allowed ✅" : "Notifications not allowed.");
        }
      });
    } catch (e) {
      setNotifStatus("Notifications error. Check console.");
    }
  }

  function saveTime() {
    const val = (remindTime?.value || "").trim();
    if (!val) {
      setNotifStatus("Pick a time first.");
      return;
    }
    localStorage.setItem(KEYS.remindTime, val);
    setNotifStatus(`Saved ✅ Daily reminder time: ${val}`);
  }

  // ---- wire events (THIS is what was missing for you before) ----
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

  document.addEventListener("click", (e) => {
    if (!nameEditor || nameEditor.classList.contains("hidden")) return;
    const clickedInside = nameEditor.contains(e.target) || nameDisplay?.contains(e.target);
    if (!clickedInside) closeNameEditor();
  });

  milestoneClose?.addEventListener("click", closeMilestoneModal);
  milestoneModal?.addEventListener("click", (e) => { if (e.target === milestoneModal) closeMilestoneModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMilestoneModal(); });

  enableNotifs?.addEventListener("click", enableReminders);
  saveRemindTime?.addEventListener("click", saveTime);

  render();
}

// ✅ This makes sure it always runs AFTER the HTML exists
document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (err) {
    const status = document.getElementById("status");
    if (status) status.textContent = "JS crashed. Open Console and screenshot the error.";
  }
});
