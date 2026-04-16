// FocusLens — Content Script

(function () {
  // Guard: if extension context is already invalid, bail out silently
  function isExtensionValid() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function sendPageInfo() {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage({
      type:  "PAGE_INFO",
      url:   location.href,
      title: document.title,
    }).catch(() => {});
  }

  if (document.readyState === "complete") {
    sendPageInfo();
  } else {
    window.addEventListener("load", sendPageInfo);
  }

  // YouTube changes title dynamically when a new video starts
  let lastTitle = document.title;
  const observer = new MutationObserver(() => {
    if (!isExtensionValid()) {
      observer.disconnect();
      return;
    }
    if (document.title !== lastTitle) {
      lastTitle = document.title;
      sendPageInfo();
    }
  });

  const titleEl = document.querySelector("title") || document.documentElement;
  observer.observe(titleEl, { subtree: true, characterData: true, childList: true });

  document.addEventListener("visibilitychange", () => {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage({
      type:   "VISIBILITY_CHANGE",
      hidden: document.hidden,
      url:    location.href,
      title:  document.title,
    }).catch(() => {});
  });
})();