// FocusLens — Background Service Worker
const SERVER_URL = "http://localhost:3000";
const IDLE_THRESHOLD_SECONDS = 180;
const FLUSH_INTERVAL_MINUTES = 5;

let activeSession = null;

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function isTrackable(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function startSession(url, tabId, pageTitle) {
  if (!isTrackable(url)) return;
  const domain = getDomain(url);
  if (!domain) return;
  activeSession = { url, domain, pageTitle: pageTitle || "", tabId, startTime: Date.now() };
  console.log("[FocusLens] Started:", domain);
}

async function endSession() {
  if (!activeSession) return;
  const duration = Math.round((Date.now() - activeSession.startTime) / 1000);
  if (duration < 2) { activeSession = null; return; }

  const date = todayDate();
  const key  = `${activeSession.domain}__${date}`;

  const result      = await chrome.storage.local.get("accumulated");
  const accumulated = result.accumulated || {};

  if (accumulated[key]) {
    accumulated[key].duration  += duration;
    // Keep most recent non-empty page title
    if (activeSession.pageTitle) {
      accumulated[key].pageTitle = activeSession.pageTitle;
    }
  } else {
    accumulated[key] = {
      domain:    activeSession.domain,
      url:       activeSession.url,
      pageTitle: activeSession.pageTitle,
      startTime: activeSession.startTime,
      duration,
      date,
    };
  }

  console.log(`[FocusLens] Ended: ${activeSession.domain} +${duration}s (total today: ${accumulated[key].duration}s)`);
  await chrome.storage.local.set({ accumulated });
  activeSession = null;
}

async function flushBuffer() {
  const result      = await chrome.storage.local.get(["accumulated", "blacklist"]);
  const accumulated = result.accumulated || {};
  const blacklist   = result.blacklist   || [];

  const entries = Object.values(accumulated).filter(e =>
    e.duration >= 5 && !blacklist.includes(e.domain)
  );

  if (!entries.length) {
    console.log("[FocusLens] Nothing to flush");
    return;
  }

  console.log("[FocusLens] Flushing", entries.length, "entries...");

  try {
    const res = await fetch(`${SERVER_URL}/api/activity/batch`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sessions: entries }),
    });

    const data = await res.json();
    console.log("[FocusLens] Flush response:", data);

    if (res.ok) {
      // Clear only what we flushed, reset durations to 0 for today
      await chrome.storage.local.set({ accumulated: {} });
    }
  } catch (err) {
    console.warn("[FocusLens] Server offline, keeping buffer:", err.message);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PAGE_INFO" && activeSession && msg.url === activeSession.url) {
    activeSession.pageTitle = msg.title || activeSession.pageTitle;
    console.log("[FocusLens] Title updated:", activeSession.pageTitle);
  }
  if (msg.type === "FLUSH_NOW") {
    endSession()
      .then(() => flushBuffer())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "GET_STATUS") {
    sendResponse({ currentDomain: activeSession?.domain ?? null });
    return true;
  }
});

// Tab listeners
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await endSession();
  try {
    const tab = await chrome.tabs.get(tabId);
    startSession(tab.url, tabId, tab.title);
  } catch {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    await endSession();
    startSession(tab.url, tabId, tab.title);
  }
  if (changeInfo.title && activeSession?.tabId === tabId) {
    activeSession.pageTitle = changeInfo.title;
    console.log("[FocusLens] Title changed:", changeInfo.title);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await endSession();
  } else {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) startSession(tab.url, tab.id, tab.title);
    } catch {}
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (activeSession?.tabId === tabId) await endSession();
});

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await endSession();
  } else if (state === "active") {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) startSession(tab.url, tab.id, tab.title);
    } catch {}
  }
});

chrome.alarms.create("flush", { periodInMinutes: FLUSH_INTERVAL_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flushBuffer();
});

// Startup
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) startSession(tab.url, tab.id, tab.title);
});