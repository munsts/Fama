/**
 * Fama - High-Performance Keyboard & Accessibility Companion
 * Intelligent auto-labeling, focus trap breaking, and landmark navigation.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__FAMA_INITIALIZED__) return;
  window.__FAMA_INITIALIZED__ = true;

  // Configuration & Settings State
  let settings = {
    autoLabelerEnabled: true,
    focusTrapBreakerEnabled: true,
    autoEscapeLoops: true,
    voiceAnnouncementsEnabled: false,
    focusHaloEnabled: true,
    legibleTextEnabled: false,
    disabledDomains: []
  };

  const currentDomain = window.location.hostname.toLowerCase();
  let isCurrentSiteDisabled = false;

  // Active Session Metrics for this Tab
  const tabSession = {
    healedItems: new Map(), // id -> { id, label, role, tag, elementRef }
    trapsEscapedCount: 0,
    nextId: 1
  };

  // WeakSet to avoid re-evaluating elements we already checked and deemed valid or already processed
  const processedElements = new WeakSet();

  // Focus tracking history for loop detection
  const focusHistory = [];
  const MAX_FOCUS_HISTORY = 12;

  // Interactive selectors
  const INTERACTIVE_SELECTOR = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="switch"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="combobox"]',
    '[role="searchbox"]',
    '[tabindex="0"]'
  ].join(', ');

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'iframe',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  const LANDMARK_SELECTOR = [
    'main',
    '[role="main"]',
    'nav',
    '[role="navigation"]',
    'header',
    '[role="banner"]',
    'footer',
    '[role="contentinfo"]',
    'aside',
    '[role="complementary"]',
    'form[role="search"]',
    'search',
    '[role="search"]'
  ].join(', ');

  // Standard semantic icon dictionary
  const ICON_KEYWORDS = {
    search: 'Search',
    magnify: 'Search',
    find: 'Search',
    zoom: 'Zoom',
    cart: 'Shopping cart',
    basket: 'Shopping cart',
    bag: 'Shopping bag',
    checkout: 'Checkout',
    menu: 'Open menu',
    hamburger: 'Open menu',
    bars: 'Open menu',
    close: 'Close',
    cross: 'Close',
    times: 'Close',
    dismiss: 'Close',
    cancel: 'Cancel',
    exit: 'Exit',
    edit: 'Edit',
    pencil: 'Edit',
    write: 'Edit',
    trash: 'Delete',
    delete: 'Delete',
    remove: 'Remove',
    bin: 'Delete',
    add: 'Add',
    plus: 'Add',
    create: 'Create',
    new: 'New',
    save: 'Save',
    download: 'Download',
    upload: 'Upload',
    share: 'Share',
    like: 'Like',
    heart: 'Favorite',
    favorite: 'Favorite',
    star: 'Favorite',
    bookmark: 'Bookmark',
    copy: 'Copy',
    clipboard: 'Copy to clipboard',
    settings: 'Settings',
    gear: 'Settings',
    cog: 'Settings',
    config: 'Settings',
    preferences: 'Preferences',
    options: 'Options',
    user: 'Profile',
    profile: 'Profile',
    account: 'Account',
    avatar: 'Profile',
    bell: 'Notifications',
    notification: 'Notifications',
    alert: 'Notifications',
    mail: 'Email',
    email: 'Email',
    envelope: 'Email',
    inbox: 'Inbox',
    message: 'Message',
    chat: 'Chat',
    comment: 'Comment',
    phone: 'Call phone',
    call: 'Call phone',
    filter: 'Filter',
    sort: 'Sort',
    refresh: 'Refresh',
    reload: 'Reload',
    sync: 'Synchronize',
    arrow: 'Navigate',
    chevron: 'Navigate',
    next: 'Next',
    prev: 'Previous',
    previous: 'Previous',
    back: 'Go back',
    forward: 'Go forward',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    volume: 'Volume',
    mute: 'Mute audio',
    unmute: 'Unmute audio',
    sound: 'Audio',
    audio: 'Audio',
    video: 'Video',
    eye: 'Toggle visibility',
    sun: 'Light theme',
    moon: 'Dark theme',
    theme: 'Toggle theme',
    help: 'Help',
    info: 'Information',
    faq: 'FAQ',
    question: 'Help'
  };

  const SOCIAL_PLATFORMS = {
    'github.com': 'GitHub',
    'gitlab.com': 'GitLab',
    'twitter.com': 'X (Twitter)',
    'x.com': 'X (Twitter)',
    'linkedin.com': 'LinkedIn',
    'youtube.com': 'YouTube',
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'reddit.com': 'Reddit',
    'discord.gg': 'Discord',
    'discord.com': 'Discord',
    'slack.com': 'Slack',
    'threads.net': 'Threads',
    'tiktok.com': 'TikTok',
    'pinterest.com': 'Pinterest',
    'medium.com': 'Medium',
    'mastodon.social': 'Mastodon',
    'bsky.app': 'Bluesky'
  };

  const ROUTE_LABELS = {
    '': 'Home',
    'home': 'Home',
    'about': 'About us',
    'about-us': 'About us',
    'contact': 'Contact us',
    'contact-us': 'Contact us',
    'pricing': 'Pricing',
    'features': 'Features',
    'services': 'Services',
    'login': 'Log in',
    'signin': 'Sign in',
    'sign-in': 'Sign in',
    'signup': 'Sign up',
    'sign-up': 'Sign up',
    'register': 'Register',
    'join': 'Join',
    'logout': 'Log out',
    'signout': 'Sign out',
    'checkout': 'Checkout',
    'cart': 'Shopping cart',
    'shop': 'Shop',
    'store': 'Store',
    'products': 'Products',
    'blog': 'Blog',
    'news': 'News',
    'docs': 'Documentation',
    'documentation': 'Documentation',
    'api': 'API Reference',
    'support': 'Support',
    'help': 'Help Center',
    'faq': 'FAQ',
    'terms': 'Terms of Service',
    'privacy': 'Privacy Policy',
    'settings': 'Settings',
    'dashboard': 'Dashboard',
    'search': 'Search'
  };

  // Noise tokens to discard during class/id analysis
  const NOISE_TOKENS = new Set([
    'btn', 'button', 'btn-primary', 'btn-secondary', 'cta', 'link', 'item', 'wrapper',
    'container', 'box', 'element', 'clickable', 'active', 'focus', 'hover', 'disabled',
    'icon', 'svg', 'ico', 'fa', 'fas', 'far', 'fal', 'fad', 'bi', 'ti', 'lucide',
    'feather', 'material-icons', 'material-symbols-outlined', 'nav', 'main', 'header',
    'footer', 'col', 'row', 'flex', 'grid', 'd-flex', 'text', 'small', 'large',
    'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark',
    'top', 'bottom', 'left', 'right', 'inner', 'outer', 'js', 'custom', 'styled',
    'fama', 'fama-healed', 'fama-id', 'fama-focus-halo'
  ]);

  // Inject or update extension styles (Focus Halo & Legible Text)
  let styleSheetElement = null;
  function updateStyles() {
    if (!styleSheetElement) {
      styleSheetElement = document.createElement('style');
      styleSheetElement.id = 'fama-accessibility-styles';
      (document.head || document.documentElement).appendChild(styleSheetElement);
    }

    if (isCurrentSiteDisabled) {
      styleSheetElement.textContent = '';
      return;
    }

    let css = '';

    // WCAG 2.2 Compliant Dual-Contrast Focus Ring
    if (settings.focusHaloEnabled) {
      css += `
        /* Dual-contrast focus ring: visible on any dark or light background */
        :focus-visible,
        .fama-focus-ring:focus-visible {
          outline: 2px solid #2563eb !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px #ffffff, 0 0 0 6px #2563eb, 0 4px 12px rgba(37, 99, 235, 0.3) !important;
        }

        /* Inspector target highlight pulse */
        .fama-inspected-element {
          outline: 3px solid #f59e0b !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.4) !important;
          transition: outline-offset 0.2s ease, box-shadow 0.2s ease !important;
          animation: fama-pulse-target 1.8s ease-in-out forwards !important;
        }

        @keyframes fama-pulse-target {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          50% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0.3); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
      `;
    }

    // Legible Text Mode
    if (settings.legibleTextEnabled) {
      css += `
        body, p, span, li, a, h1, h2, h3, h4, h5, h6, input, button, textarea, select {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          line-height: 1.6 !important;
          letter-spacing: 0.02em !important;
        }
      `;
    }

    styleSheetElement.textContent = css;
  }

  /**
   * Fast accessible name check without layout reflows (no innerText)
   */
  function hasAccessibleName(el) {
    // 1. Direct standard ARIA attributes
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim().length > 0) return true;

    const ariaLabelledby = el.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const referenced = document.getElementById(ariaLabelledby.trim());
      if (referenced && referenced.textContent.trim().length > 0) return true;
    }

    // 2. Title or Alt
    const title = el.getAttribute('title');
    if (title && title.trim().length > 0) return true;

    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt');
      if (alt !== null && alt.trim().length > 0) return true;
    }

    // 3. Form input specials
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        const val = el.getAttribute('value');
        if (val && val.trim().length > 0) return true;
      }
      const placeholder = el.getAttribute('placeholder');
      if (placeholder && placeholder.trim().length > 0) return true;

      // Check for wrapping <label>
      if (el.closest('label')) return true;

      // Check for external <label for="id">
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label && label.textContent.trim().length > 0) return true;
      }
    }

    // 4. Check textContent directly (fast, no layout reflow)
    // Strip non-breaking spaces and zero-width chars
    const rawText = el.textContent || '';
    const cleanText = rawText.replace(/[\s\u00A0\u200B\uFEFF]+/g, ' ').trim();
    if (cleanText.length > 0) {
      // Exclude strings that are just common icon ligatures without accessible roles
      return true;
    }

    // 5. Check if child SVG has a non-empty <title> or <desc>
    const svgTitle = el.querySelector('svg > title, svg > desc');
    if (svgTitle && svgTitle.textContent.trim().length > 0) return true;

    // 6. Check if child image has alt
    const childImg = el.querySelector('img[alt]');
    if (childImg && childImg.getAttribute('alt').trim().length > 0) return true;

    return false;
  }

  /**
   * Split string into clean lowercase semantic tokens
   */
  function extractTokens(str) {
    if (!str || typeof str !== 'string') return [];
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
      .replace(/[-_.:/]/g, ' ')            // delimiter split
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 1 && !NOISE_TOKENS.has(w));
  }

  /**
   * Analyze SVG path shapes, symbols, and icon conventions
   */
  function inspectSvgAndIcons(el) {
    const clues = [];

    // 1. Check icon font classes on element or child <i> / <span> / <svg>
    const iconCandidates = el.querySelectorAll('i, span, svg');
    const allNodes = [el, ...Array.from(iconCandidates)];

    for (const node of allNodes) {
      const cls = typeof node.className === 'string' ? node.className : (node.className?.baseVal || '');
      const dataIcon = node.getAttribute('data-icon') || node.getAttribute('data-lucide') || node.getAttribute('data-feather') || '';
      const testId = node.getAttribute('data-testid') || '';

      if (cls) clues.push(...extractTokens(cls));
      if (dataIcon) clues.push(...extractTokens(dataIcon));
      if (testId) clues.push(...extractTokens(testId));

      // Check SVG <use href="#icon-name">
      if (node.tagName && node.tagName.toLowerCase() === 'svg') {
        const useEl = node.querySelector('use');
        if (useEl) {
          const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '';
          if (href) clues.push(...extractTokens(href));
        }

        // Check path data d-attribute for known standard icon signatures
        const paths = node.querySelectorAll('path');
        for (const p of paths) {
          const d = p.getAttribute('d') || '';
          // Hamburger menu (3 horizontal bars)
          if (/M\s*\d+\s+6h|M\s*\d+\s+12h|M\s*\d+\s+18h/i.test(d)) {
            clues.push('menu');
          }
          // Close cross (diagonal cross)
          if (/M\s*6\s+18|L\s*18\s+6|M\s*18\s+6/i.test(d) || /M\s*19\s+6\.41/i.test(d)) {
            clues.push('close');
          }
          // Plus / Add
          if (/M\s*12\s+5v14|M\s*19\s+13h-6v6/i.test(d)) {
            clues.push('add');
          }
        }
      }
    }

    return clues;
  }

  /**
   * Infer intent from contextual DOM surroundings
   */
  function inspectContext(el) {
    // 1. Inside search form or adjacent to search input
    if (el.closest('form[role="search"], [role="search"], search')) {
      return 'Search';
    }
    const siblingInput = el.parentElement ? el.parentElement.querySelector('input[type="search"]') : null;
    if (siblingInput) {
      return 'Search';
    }

    // 2. Inside modal / dialog / banner
    const dialogAncestor = el.closest('dialog, [role="dialog"], [role="alertdialog"], .modal');
    if (dialogAncestor) {
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      if (cls.includes('close') || cls.includes('dismiss') || cls.includes('cancel')) {
        return 'Close dialog';
      }
    }

    // 3. Stepper / quantity buttons near number input
    const numberSibling = el.parentElement ? el.parentElement.querySelector('input[type="number"], [aria-label*="Quantity"]') : null;
    if (numberSibling) {
      const text = (el.textContent || '').trim();
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      if (text === '+' || cls.includes('plus') || cls.includes('increment')) return 'Increase quantity';
      if (text === '-' || text === '–' || cls.includes('minus') || cls.includes('decrement')) return 'Decrease quantity';
    }

    // 4. Media container controls
    if (el.closest('video, audio, .video-player, .audio-player')) {
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      if (cls.includes('play')) return 'Play';
      if (cls.includes('pause')) return 'Pause';
      if (cls.includes('mute')) return 'Mute';
    }

    return null;
  }

  /**
   * Parse Anchor URL targets
   */
  function inspectAnchorLink(el) {
    if (el.tagName.toLowerCase() !== 'a') return null;
    const href = el.getAttribute('href');
    if (!href) return null;

    // Mailto & Tel
    if (href.startsWith('mailto:')) {
      const email = href.replace(/^mailto:/, '').split('?')[0].trim();
      return email ? `Email ${email}` : 'Send email';
    }
    if (href.startsWith('tel:')) {
      const phone = href.replace(/^tel:/, '').trim();
      return phone ? `Call ${phone}` : 'Call phone';
    }

    if (href.startsWith('#') || href.startsWith('javascript:')) {
      return null;
    }

    try {
      const url = new URL(href, window.location.origin);

      // Social Platform match
      for (const [domain, label] of Object.entries(SOCIAL_PLATFORMS)) {
        if (url.hostname === domain || url.hostname.endsWith('.' + domain)) {
          return `${label} page`;
        }
      }

      // Internal route match
      if (url.hostname === window.location.hostname) {
        const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
        if (segments.length === 0) return 'Home';
        const primary = segments[0];
        if (ROUTE_LABELS[primary]) return ROUTE_LABELS[primary];
        if (segments.length === 1 && primary.length > 2 && primary.length < 25) {
          const words = extractTokens(primary);
          if (words.length > 0) {
            return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
        }
      }
    } catch (e) {
      // Ignore malformed URLs
    }

    return null;
  }

  /**
   * Determine the most descriptive fallback label
   */
  function determineSemanticLabel(el) {
    // 1. High-confidence context check
    const contextLabel = inspectContext(el);
    if (contextLabel) return contextLabel;

    // 2. High-confidence anchor href check
    const anchorLabel = inspectAnchorLink(el);
    if (anchorLabel) return anchorLabel;

    // 3. Collect tokens from classes, IDs, name, testids, icons
    const idTokens = extractTokens(el.id || '');
    const nameTokens = extractTokens(el.getAttribute('name') || '');
    const classStr = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
    const classTokens = extractTokens(classStr);
    const iconTokens = inspectSvgAndIcons(el);

    const allTokens = [...iconTokens, ...classTokens, ...idTokens, ...nameTokens];

    // Priority dictionary matching
    for (const token of allTokens) {
      if (ICON_KEYWORDS[token]) {
        return ICON_KEYWORDS[token];
      }
    }

    // Role-based contextual fallback
    const rawRole = el.getAttribute('role') || el.tagName.toLowerCase();
    if (allTokens.length > 0) {
      const capitalized = allTokens.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return capitalized;
    }

    const defaultRoleNames = {
      button: 'Unlabeled button',
      a: 'Unlabeled link',
      input: 'Unlabeled input',
      select: 'Unlabeled dropdown',
      textarea: 'Unlabeled text field'
    };

    return defaultRoleNames[rawRole] || 'Interactive element';
  }

  /**
   * Heal a single element by adding aria-label and registration metadata
   */
  function healElement(el) {
    if (processedElements.has(el)) return;
    processedElements.add(el);

    // Skip if already labeled or hidden
    if (hasAccessibleName(el)) return;

    const label = determineSemanticLabel(el);
    if (!label) return;

    const elementId = `fama-el-${tabSession.nextId++}`;
    el.setAttribute('aria-label', label);
    el.setAttribute('data-fama-healed', 'true');
    el.setAttribute('data-fama-id', elementId);

    const role = el.getAttribute('role') || el.tagName.toLowerCase();

    tabSession.healedItems.set(elementId, {
      id: elementId,
      label: label,
      role: role,
      tag: el.tagName.toLowerCase(),
      elementRef: el
    });

    // Notify background for badge count update (debounced)
    scheduleTabBadgeUpdate();
  }

  // Debounced badge sync
  let badgeSyncTimer = null;
  function scheduleTabBadgeUpdate() {
    if (badgeSyncTimer) return;
    badgeSyncTimer = setTimeout(() => {
      badgeSyncTimer = null;
      try {
        chrome.runtime.sendMessage({
          action: 'update-tab-badge',
          count: tabSession.healedItems.size
        }).catch(() => {});
      } catch (e) {}

      // Increment all-time metric in storage
      chrome.storage.local.get(['healedCount'], (res) => {
        if (chrome.runtime.lastError) return;
        const current = res.healedCount || 0;
        chrome.storage.local.set({ healedCount: current + 1 });
      });
    }, 400);
  }

  /**
   * Scan candidate elements using requestIdleCallback to avoid jank
   */
  let isScanningScheduled = false;
  function scheduleScan() {
    if (isScanningScheduled || isCurrentSiteDisabled || !settings.autoLabelerEnabled) return;
    isScanningScheduled = true;

    const runner = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    runner(() => {
      isScanningScheduled = false;
      const candidates = document.querySelectorAll(INTERACTIVE_SELECTOR);
      for (let i = 0; i < candidates.length; i++) {
        healElement(candidates[i]);
      }
    });
  }

  // MutationObserver for dynamic SPAs
  let domObserver = null;
  function setupObserver() {
    if (domObserver || isCurrentSiteDisabled) return;

    domObserver = new MutationObserver((mutations) => {
      let hasInteractiveAddition = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches(INTERACTIVE_SELECTOR)) {
                hasInteractiveAddition = true;
                break;
              }
              if (node.querySelector && node.querySelector(INTERACTIVE_SELECTOR)) {
                hasInteractiveAddition = true;
                break;
              }
            }
          }
        }
        if (hasInteractiveAddition) break;
      }

      if (hasInteractiveAddition) {
        scheduleScan();
      }
    });

    domObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function disconnectObserver() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
  }

  /* ==========================================================================
     FOCUS TRAP BREAKER & KEYBOARD ACCESSIBILITY
     ========================================================================== */

  function setupKeyboardListeners() {
    // Global shortcut listener: Alt+Q or Alt+Escape to escape trap
    window.addEventListener('keydown', (e) => {
      if (isCurrentSiteDisabled) return;

      if (e.altKey && (e.key === 'Escape' || e.key?.toLowerCase() === 'q')) {
        e.preventDefault();
        e.stopPropagation();
        escapeFocusTrap();
      } else if (e.altKey && e.key?.toLowerCase() === 'n') {
        // Alt+N jumps to next landmark
        e.preventDefault();
        e.stopPropagation();
        jumpToNextLandmark(1);
      } else if (e.altKey && e.key?.toLowerCase() === 'p') {
        // Alt+P jumps to previous landmark
        e.preventDefault();
        e.stopPropagation();
        jumpToNextLandmark(-1);
      }
    }, true);

    // Track focus for cycle detection
    window.addEventListener('focusin', (e) => {
      if (isCurrentSiteDisabled) return;

      const target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;

      // Voice announcement if enabled
      if (settings.voiceAnnouncementsEnabled && target.hasAttribute('data-fama-healed')) {
        announceText(target.getAttribute('aria-label') || '');
      }

      if (!settings.focusTrapBreakerEnabled) return;

      focusHistory.push(target);
      if (focusHistory.length > MAX_FOCUS_HISTORY) {
        focusHistory.shift();
      }

      // Check for repeating focus loops
      if (settings.autoEscapeLoops) {
        detectFocusLoop();
      }
    });
  }

  /**
   * Detect repeating focus cycles: e.g. [A, B, C, A, B, C]
   */
  function detectFocusLoop() {
    const len = focusHistory.length;
    if (len < 6) return;

    for (let loopSize = 1; loopSize <= 4; loopSize++) {
      const required = loopSize * 3;
      if (len < required) continue;

      const cycle3 = focusHistory.slice(len - loopSize);
      const cycle2 = focusHistory.slice(len - 2 * loopSize, len - loopSize);
      const cycle1 = focusHistory.slice(len - 3 * loopSize, len - 2 * loopSize);

      let isLoop = true;
      for (let i = 0; i < loopSize; i++) {
        if (cycle1[i] !== cycle2[i] || cycle2[i] !== cycle3[i]) {
          isLoop = false;
          break;
        }
      }

      if (isLoop) {
        // Clear history to prevent duplicate triggers
        focusHistory.length = 0;
        showAccessibleToast('Keyboard loop detected. Escaping container...', 'polite');
        escapeFocusTrap(cycle3);
        break;
      }
    }
  }

  /**
   * Escape Focus Trap: breaks modal confinement and shifts focus outside
   */
  function escapeFocusTrap(loopNodes = null) {
    const activeEl = document.activeElement;
    if (!activeEl) return;

    // Identify trap container: modal dialog, overlay, or common ancestor
    let trapContainer = null;

    if (loopNodes && loopNodes.length > 0) {
      trapContainer = findLowestCommonAncestor(loopNodes);
    }

    if (!trapContainer || trapContainer === document.body) {
      let cur = activeEl;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const role = cur.getAttribute('role');
        const isModal = cur.getAttribute('aria-modal') === 'true';
        if (cur.tagName.toLowerCase() === 'dialog' || role === 'dialog' || role === 'alertdialog' || isModal) {
          trapContainer = cur;
          break;
        }
        cur = cur.parentElement;
      }
    }

    // Record broken trap metric
    tabSession.trapsEscapedCount++;
    chrome.storage.local.get(['trapsBrokenCount'], (res) => {
      if (chrome.runtime.lastError) return;
      chrome.storage.local.set({ trapsBrokenCount: (res.trapsBrokenCount || 0) + 1 });
    });

    // Strategy 1: Find next interactive element in DOM order outside the trap container
    if (trapContainer && trapContainer !== document.body) {
      // Temporarily bypass trapping constraints
      trapContainer.setAttribute('data-fama-trap-bypassed', 'true');

      // Intercept next keydown to prevent the modal from re-capturing Tab
      const neutralizeTrapCapture = (e) => {
        if (e.key === 'Tab') {
          // Allow natural navigation without trap interception
          e.stopImmediatePropagation();
        }
      };
      window.addEventListener('keydown', neutralizeTrapCapture, { capture: true, once: true });

      // Find all focusable elements
      const allFocusables = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
        return !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1' && el.offsetParent !== null;
      });

      const containerFocusables = allFocusables.filter(el => trapContainer.contains(el));
      if (containerFocusables.length > 0) {
        const lastInContainer = containerFocusables[containerFocusables.length - 1];
        const lastIdx = allFocusables.indexOf(lastInContainer);
        if (lastIdx !== -1 && lastIdx + 1 < allFocusables.length) {
          const nextTarget = allFocusables[lastIdx + 1];
          nextTarget.focus();
          showAccessibleToast('Focus moved past trap container (Alt+Q).', 'polite');
          return;
        }
      }
    }

    // Strategy 2: Fallback to <main> or top landmark
    const fallbackTarget = document.querySelector('main, [role="main"], h1') || document.body;
    if (fallbackTarget) {
      if (!fallbackTarget.hasAttribute('tabindex')) {
        fallbackTarget.setAttribute('tabindex', '-1');
      }
      fallbackTarget.focus();
      showAccessibleToast('Focus moved to main content area.', 'polite');
    }
  }

  /**
   * Jump between major semantic page landmarks (<main>, <nav>, <header>, etc.)
   */
  function jumpToNextLandmark(direction = 1) {
    const landmarks = Array.from(document.querySelectorAll(LANDMARK_SELECTOR)).filter(el => {
      return el.offsetParent !== null && !el.hasAttribute('aria-hidden');
    });

    if (landmarks.length === 0) {
      showAccessibleToast('No landmarks found on this page.', 'polite');
      return;
    }

    const activeEl = document.activeElement;
    let currentIndex = -1;

    for (let i = 0; i < landmarks.length; i++) {
      if (landmarks[i] === activeEl || landmarks[i].contains(activeEl)) {
        currentIndex = i;
        break;
      }
    }

    let nextIndex = (currentIndex + direction + landmarks.length) % landmarks.length;
    const target = landmarks[nextIndex];

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }

    target.focus();

    const tag = target.tagName.toLowerCase();
    const role = target.getAttribute('role') || tag;
    const landmarkName = target.getAttribute('aria-label') || role;
    showAccessibleToast(`Jumped to landmark: ${landmarkName}`, 'polite');
  }

  function findLowestCommonAncestor(elements) {
    if (!elements || elements.length === 0) return null;
    if (elements.length === 1) return elements[0].parentElement;

    let ancestor = elements[0].parentElement;
    while (ancestor && ancestor !== document.body) {
      if (elements.every(el => ancestor.contains(el))) {
        return ancestor;
      }
      ancestor = ancestor.parentElement;
    }
    return document.body;
  }

  /**
   * Non-intrusive, WCAG-compliant status announcer
   */
  let toastContainer = null;
  function showAccessibleToast(message, ariaPriority = 'polite') {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'fama-notification-area';
      Object.assign(toastContainer.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none'
      });
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', ariaPriority);

    Object.assign(toast.style, {
      background: '#18181b',
      color: '#f4f4f5',
      border: '1px solid #3f3f46',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '13px',
      fontWeight: '500',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      opacity: '0',
      transform: 'translateY(12px)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      pointerEvents: 'auto'
    });

    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => {
        toast.remove();
        if (toastContainer && toastContainer.children.length === 0) {
          toastContainer.remove();
          toastContainer = null;
        }
      }, 200);
    }, 3200);
  }

  function announceText(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  /**
   * Highlight element on page when clicked from popup inspector
   */
  function highlightElementById(elementId) {
    const item = tabSession.healedItems.get(elementId);
    let target = item?.elementRef;

    if (!target) {
      target = document.querySelector(`[data-fama-id="${CSS.escape(elementId)}"]`);
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('fama-inspected-element');
      target.focus({ preventScroll: true });

      setTimeout(() => {
        target.classList.remove('fama-inspected-element');
      }, 2000);
      return true;
    }
    return false;
  }

  /* ==========================================================================
     EXTENSION COMMUNICATION & LIFECYCLE
     ========================================================================== */

  function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'get-tab-status': {
        const items = Array.from(tabSession.healedItems.values()).map(it => ({
          id: it.id,
          label: it.label,
          role: it.role,
          tag: it.tag
        }));

        sendResponse({
          domain: currentDomain,
          isSiteDisabled: isCurrentSiteDisabled,
          healedCount: tabSession.healedItems.size,
          trapsBrokenCount: tabSession.trapsEscapedCount,
          items: items.slice(-35).reverse() // Show latest first
        });
        break;
      }

      case 'highlight-element': {
        const success = highlightElementById(request.elementId);
        sendResponse({ success });
        break;
      }

      case 'toggle-site-disabled': {
        chrome.storage.local.get(['disabledDomains'], (res) => {
          let domains = res.disabledDomains || [];
          if (request.disable) {
            if (!domains.includes(currentDomain)) domains.push(currentDomain);
          } else {
            domains = domains.filter(d => d !== currentDomain);
          }
          chrome.storage.local.set({ disabledDomains: domains }, () => {
            isCurrentSiteDisabled = request.disable;
            updateStyles();
            if (isCurrentSiteDisabled) {
              disconnectObserver();
            } else {
              scheduleScan();
              setupObserver();
            }
            sendResponse({ isSiteDisabled: isCurrentSiteDisabled });
          });
        });
        return true; // async sendResponse
      }

      case 'force-escape-focus': {
        escapeFocusTrap();
        sendResponse({ success: true });
        break;
      }

      case 'jump-next-landmark': {
        jumpToNextLandmark(1);
        sendResponse({ success: true });
        break;
      }

      case 'run-manual-scan': {
        processedElements.clear?.();
        scheduleScan();
        sendResponse({ success: true });
        break;
      }

      case 'settings-changed': {
        settings = { ...settings, ...request.settings };
        isCurrentSiteDisabled = (settings.disabledDomains || []).includes(currentDomain);
        updateStyles();

        if (settings.autoLabelerEnabled && !isCurrentSiteDisabled) {
          scheduleScan();
          setupObserver();
        } else {
          disconnectObserver();
        }
        sendResponse({ success: true });
        break;
      }
    }
  }

  // Initialization
  function init() {
    chrome.storage.local.get([
      'autoLabelerEnabled',
      'focusTrapBreakerEnabled',
      'autoEscapeLoops',
      'voiceAnnouncementsEnabled',
      'focusHaloEnabled',
      'legibleTextEnabled',
      'disabledDomains'
    ], (stored) => {
      if (chrome.runtime.lastError) return;

      settings = { ...settings, ...stored };
      isCurrentSiteDisabled = (settings.disabledDomains || []).includes(currentDomain);

      updateStyles();
      setupKeyboardListeners();

      if (!isCurrentSiteDisabled && settings.autoLabelerEnabled) {
        scheduleScan();
        setupObserver();
      }
    });

    chrome.runtime.onMessage.addListener(handleMessage);
  }

  // Run on DOM ready or immediate if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
