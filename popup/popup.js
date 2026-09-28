/**
 * Fama Popup Controller
 * Manages live page inspection, domain toggles, and global preferences.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabViews = document.querySelectorAll('.tab-view');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');

      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabViews.forEach(v => {
        v.classList.remove('active');
        v.hidden = true;
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const targetView = document.getElementById(targetId);
      if (targetView) {
        targetView.classList.add('active');
        targetView.hidden = false;
      }
    });
  });

  // UI Elements
  const domainLabel = document.getElementById('current-domain');
  const siteToggle = document.getElementById('site-enabled-toggle');
  const tabHealedCount = document.getElementById('tab-healed-count');
  const tabTrapsCount = document.getElementById('tab-traps-count');
  const healedList = document.getElementById('healed-items-list');
  const btnRescan = document.getElementById('btn-rescan');

  // Settings Toggles
  const toggleLabeler = document.getElementById('toggle-labeler');
  const toggleTrap = document.getElementById('toggle-trap');
  const toggleAutoEscape = document.getElementById('toggle-auto-escape');
  const toggleHalo = document.getElementById('toggle-halo');
  const toggleLegible = document.getElementById('toggle-legible');
  const toggleVoice = document.getElementById('toggle-voice');

  // Lifetime metrics
  const lifetimeHealed = document.getElementById('lifetime-healed');
  const lifetimeTraps = document.getElementById('lifetime-traps');
  const btnClearStats = document.getElementById('btn-clear-stats');

  let activeTabId = null;
  let activeTabDomain = '';

  // Get active tab and load live inspector data
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      domainLabel.textContent = 'No active webpage';
      siteToggle.disabled = true;
      return;
    }

    activeTabId = tab.id;

    if (tab.url) {
      try {
        const parsed = new URL(tab.url);
        if (parsed.protocol.startsWith('http')) {
          activeTabDomain = parsed.hostname;
          domainLabel.textContent = activeTabDomain;
        } else {
          domainLabel.textContent = 'Browser internal page';
          siteToggle.disabled = true;
          return;
        }
      } catch (e) {
        domainLabel.textContent = 'Active page';
      }
    }

    refreshTabStatus();
  });

  // Query content script for live element data on this tab
  function refreshTabStatus() {
    if (!activeTabId) return;

    chrome.tabs.sendMessage(activeTabId, { action: 'get-tab-status' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be injected or running
        tabHealedCount.textContent = '0';
        tabTrapsCount.textContent = '0';
        renderEmptyState('Fama is idle on this page (refresh to connect).');
        return;
      }

      siteToggle.checked = !response.isSiteDisabled;
      tabHealedCount.textContent = response.healedCount || 0;
      tabTrapsCount.textContent = response.trapsBrokenCount || 0;

      renderHealedItems(response.items || []);
    });
  }

  // Render list of healed elements for live inspection
  function renderHealedItems(items) {
    healedList.innerHTML = '';

    if (items.length === 0) {
      renderEmptyState('No unlabeled elements found on this page.');
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'healed-item';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'Click to scroll and highlight this element on the page';

      const left = document.createElement('div');
      left.className = 'item-left';

      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.textContent = item.role || item.tag;

      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = item.label;

      left.appendChild(badge);
      left.appendChild(label);

      const hint = document.createElement('span');
      hint.className = 'inspect-hint';
      hint.innerHTML = `Inspect &rarr;`;

      card.appendChild(left);
      card.appendChild(hint);

      // On click or Enter, send highlight command to page
      const inspectItem = () => {
        if (!activeTabId) return;
        chrome.tabs.sendMessage(activeTabId, {
          action: 'highlight-element',
          elementId: item.id
        });
        card.style.borderColor = 'var(--primary)';
        setTimeout(() => {
          card.style.borderColor = '';
        }, 1200);
      };

      card.addEventListener('click', inspectItem);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inspectItem();
        }
      });

      healedList.appendChild(card);
    });
  }

  function renderEmptyState(message) {
    healedList.innerHTML = `
      <div class="empty-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
        <p class="empty-title">All elements accessible</p>
        <p class="empty-desc">${message}</p>
      </div>
    `;
  }

  // Rescan button
  if (btnRescan) {
    btnRescan.addEventListener('click', () => {
      if (!activeTabId) return;
      btnRescan.disabled = true;
      btnRescan.textContent = 'Scanning...';
      chrome.tabs.sendMessage(activeTabId, { action: 'run-manual-scan' }, () => {
        setTimeout(() => {
          refreshTabStatus();
          btnRescan.disabled = false;
          btnRescan.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Rescan
          `;
        }, 300);
      });
    });
  }

  // Site Enable / Disable toggle
  if (siteToggle) {
    siteToggle.addEventListener('change', () => {
      if (!activeTabId) return;
      const disableSite = !siteToggle.checked;
      chrome.tabs.sendMessage(activeTabId, {
        action: 'toggle-site-disabled',
        disable: disableSite
      }, () => {
        refreshTabStatus();
      });
    });
  }

  // Load Preferences & Storage Stats
  function loadPreferences() {
    chrome.storage.local.get([
      'autoLabelerEnabled',
      'focusTrapBreakerEnabled',
      'autoEscapeLoops',
      'voiceAnnouncementsEnabled',
      'focusHaloEnabled',
      'legibleTextEnabled',
      'healedCount',
      'trapsBrokenCount'
    ], (data) => {
      if (chrome.runtime.lastError) return;

      toggleLabeler.checked = data.autoLabelerEnabled !== false;
      toggleTrap.checked = data.focusTrapBreakerEnabled !== false;
      toggleAutoEscape.checked = data.autoEscapeLoops !== false;
      toggleHalo.checked = data.focusHaloEnabled !== false;
      toggleLegible.checked = data.legibleTextEnabled === true;
      toggleVoice.checked = data.voiceAnnouncementsEnabled === true;

      lifetimeHealed.textContent = (data.healedCount || 0).toLocaleString();
      lifetimeTraps.textContent = (data.trapsBrokenCount || 0).toLocaleString();
    });
  }

  // Save Preferences
  function savePreferences() {
    const updatedSettings = {
      autoLabelerEnabled: toggleLabeler.checked,
      focusTrapBreakerEnabled: toggleTrap.checked,
      autoEscapeLoops: toggleAutoEscape.checked,
      focusHaloEnabled: toggleHalo.checked,
      legibleTextEnabled: toggleLegible.checked,
      voiceAnnouncementsEnabled: toggleVoice.checked
    };

    chrome.storage.local.set(updatedSettings, () => {
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          action: 'settings-changed',
          settings: updatedSettings
        }).catch(() => {});
      }
    });
  }

  [toggleLabeler, toggleTrap, toggleAutoEscape, toggleHalo, toggleLegible, toggleVoice].forEach(toggle => {
    toggle.addEventListener('change', savePreferences);
  });

  // Clear Lifetime Stats
  if (btnClearStats) {
    btnClearStats.addEventListener('click', () => {
      if (confirm('Reset lifetime accessibility metrics?')) {
        chrome.storage.local.set({ healedCount: 0, trapsBrokenCount: 0 }, () => {
          lifetimeHealed.textContent = '0';
          lifetimeTraps.textContent = '0';
        });
      }
    });
  }

  loadPreferences();
});
