// get elements from the dashboard html
const toggleLabeler = document.getElementById("toggle-labeler");
const toggleTrap = document.getElementById("toggle-trap");
const toggleAutoEscape = document.getElementById("toggle-auto-escape");
const toggleVoice = document.getElementById("toggle-voice");
const toggleHalo = document.getElementById("toggle-halo");
const toggleLegible = document.getElementById("toggle-legible");
const healedCounter = document.getElementById("healed-count");
const trapsCounter = document.getElementById("traps-count");
const historyList = document.getElementById("history-list");
const btnReset = document.getElementById("btn-reset");

// pull saved values from storage to update the ui
function loadDashboardData() {
  chrome.storage.local.get([
    "autoLabelerEnabled",
    "focusTrapBreakerEnabled",
    "autoEscapeLoops",
    "voiceAnnouncementsEnabled",
    "focusHaloEnabled",
    "legibleTextEnabled",
    "healedCount",
    "trapsBrokenCount",
    "historyLog"
  ], (data) => {
    if (chrome.runtime.lastError) return;

    // match checkboxes to current settings
    toggleLabeler.checked = data.autoLabelerEnabled !== false;
    toggleTrap.checked = data.focusTrapBreakerEnabled !== false;
    toggleAutoEscape.checked = data.autoEscapeLoops !== false;
    toggleVoice.checked = data.voiceAnnouncementsEnabled !== false;
    toggleHalo.checked = data.focusHaloEnabled !== false;
    toggleLegible.checked = data.legibleTextEnabled === true;

    // update statistics counters
    healedCounter.textContent = data.healedCount || 0;
    trapsCounter.textContent = data.trapsBrokenCount || 0;

    // update the list of recently named items
    renderHistory(data.historyLog || []);
  });
}

// build html rows for the activity feed
function renderHistory(items) {
  historyList.innerHTML = "";

  if (items.length === 0) {
    historyList.innerHTML = `<p class="empty-state">No elements healed yet.</p>`;
    return;
  }

  // create a card for each activity entry
  items.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "history-item";

    const topRow = document.createElement("div");
    topRow.className = "history-item-top";

    const labelSpan = document.createElement("span");
    labelSpan.className = "history-label";
    labelSpan.textContent = item.label;

    const tagSpan = document.createElement("span");
    tagSpan.className = "history-tag";
    tagSpan.textContent = item.tag;

    const urlSpan = document.createElement("span");
    urlSpan.className = "history-url";
    urlSpan.textContent = item.url || "unknown page";

    topRow.appendChild(labelSpan);
    topRow.appendChild(tagSpan);
    itemEl.appendChild(topRow);
    itemEl.appendChild(urlSpan);

    historyList.appendChild(itemEl);
  });
}

// save settings and tell the active tab about the changes
function saveSettings() {
  const currentSettings = {
    autoLabelerEnabled: toggleLabeler.checked,
    focusTrapBreakerEnabled: toggleTrap.checked,
    autoEscapeLoops: toggleAutoEscape.checked,
    voiceAnnouncementsEnabled: toggleVoice.checked,
    focusHaloEnabled: toggleHalo.checked,
    legibleTextEnabled: toggleLegible.checked
  };

  chrome.storage.local.set(currentSettings, () => {
    // send settings to the page script so it takes effect instantly
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "settings-changed",
          settings: currentSettings
        }).catch(() => {
          // ignore failures when messaging internal pages
        });
      }
    });
  });
}

// open the delete confirmation popup
function resetStatistics() {
  const confirmModal = document.getElementById("confirm-modal");
  confirmModal.style.display = "flex";
}

// wire up confirmation buttons
function setupConfirmModal() {
  const confirmModal = document.getElementById("confirm-modal");
  const btnYes = document.getElementById("btn-confirm-yes");
  const btnNo = document.getElementById("btn-confirm-no");

  btnYes.addEventListener("click", () => {
    chrome.storage.local.set({
      healedCount: 0,
      trapsBrokenCount: 0,
      historyLog: []
    }, () => {
      healedCounter.textContent = "0";
      trapsCounter.textContent = "0";
      historyList.innerHTML = `<p class="empty-state">No elements healed yet.</p>`;
      confirmModal.style.display = "none";
    });
  });

  btnNo.addEventListener("click", () => {
    confirmModal.style.display = "none";
  });
}

// bind click handlers and load data when popup opens
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
  setupConfirmModal();
});
toggleLabeler.addEventListener("change", saveSettings);
toggleTrap.addEventListener("change", saveSettings);
toggleAutoEscape.addEventListener("change", saveSettings);
toggleVoice.addEventListener("change", saveSettings);
toggleHalo.addEventListener("change", saveSettings);
toggleLegible.addEventListener("change", saveSettings);
btnReset.addEventListener("click", resetStatistics);
