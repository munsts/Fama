// set up defaults when first installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([
    "autoLabelerEnabled",
    "focusTrapBreakerEnabled",
    "autoEscapeLoops",
    "healedCount",
    "trapsBrokenCount",
    "historyLog"
  ], (result) => {
    // don't overwrite user settings if already set
    const updates = {};
    if (result.autoLabelerEnabled === undefined) updates.autoLabelerEnabled = true;
    if (result.focusTrapBreakerEnabled === undefined) updates.focusTrapBreakerEnabled = true;
    if (result.autoEscapeLoops === undefined) updates.autoEscapeLoops = true;
    if (result.voiceAnnouncementsEnabled === undefined) updates.voiceAnnouncementsEnabled = true;
    if (result.focusHaloEnabled === undefined) updates.focusHaloEnabled = true;
    if (result.legibleTextEnabled === undefined) updates.legibleTextEnabled = false;
    if (result.healedCount === undefined) updates.healedCount = 0;
    if (result.trapsBrokenCount === undefined) updates.trapsBrokenCount = 0;
    if (result.historyLog === undefined) updates.historyLog = [];

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

// listen for the global shortcut (alt+q)
chrome.commands.onCommand.addListener((command) => {
  if (command === "escape-focus-trap") {
    // send escape signal to the active page tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "force-escape-focus" })
          .catch(() => {
            // ignore failures on system or extension pages
          });
      }
    });
  }
});
