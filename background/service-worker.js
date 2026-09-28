// Initialize default settings on install or update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([
    "autoLabelerEnabled",
    "focusTrapBreakerEnabled",
    "autoEscapeLoops",
    "voiceAnnouncementsEnabled",
    "focusHaloEnabled",
    "legibleTextEnabled",
    "disabledDomains",
    "healedCount",
    "trapsBrokenCount"
  ], (result) => {
    const defaults = {
      autoLabelerEnabled: true,
      focusTrapBreakerEnabled: true,
      autoEscapeLoops: true,
      voiceAnnouncementsEnabled: false,
      focusHaloEnabled: true,
      legibleTextEnabled: false,
      disabledDomains: [],
      healedCount: 0,
      trapsBrokenCount: 0
    };

    const updates = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (result[key] === undefined) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

// Global keyboard commands
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) return;

    if (command === "escape-focus-trap") {
      chrome.tabs.sendMessage(activeTab.id, { action: "force-escape-focus" }).catch(() => {});
    } else if (command === "jump-next-landmark") {
      chrome.tabs.sendMessage(activeTab.id, { action: "jump-next-landmark" }).catch(() => {});
    }
  });
});

// Update badge count per tab
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === "update-tab-badge" && sender.tab && sender.tab.id) {
    const count = request.count || 0;
    const text = count > 0 ? (count > 99 ? "99+" : String(count)) : "";
    chrome.action.setBadgeText({ tabId: sender.tab.id, text });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#4f46e5" });
  }
});
