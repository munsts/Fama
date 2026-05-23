// active user settings, synced with storage
let settings = {
  autoLabelerEnabled: true,
  focusTrapBreakerEnabled: true,
  autoEscapeLoops: true,
  voiceAnnouncementsEnabled: true,
  focusHaloEnabled: true,
  legibleTextEnabled: false
};

// track metrics locally before writing to storage
let localStats = {
  healedCount: 0,
  trapsBrokenCount: 0,
  healedItems: [] // holds recently healed items for popup dashboard
};

// track focused items to see if we get stuck in loops
const focusHistory = [];
const MAX_FOCUS_HISTORY = 12;

// timer to slow down scans when dom updates rapidly
let scanDebounceTimeout = null;

// html tags we scan and add names to
const INTERACTIVE_SELECTOR = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"], [tabindex="0"]';

// tag names we can focus when shifting away from traps
const FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

// mapping helper words to friendly names
const KEYWORD_MAP = {
  checkout: "Checkout",
  cart: "Shopping Cart",
  shopping: "Shopping",
  bag: "Shopping Bag",
  add: "Add",
  remove: "Remove",
  delete: "Delete",
  trash: "Delete",
  edit: "Edit",
  pencil: "Edit",
  modify: "Edit",
  search: "Search",
  find: "Search",
  magnify: "Search",
  zoom: "Zoom",
  menu: "Menu",
  hamburger: "Menu",
  close: "Close",
  dismiss: "Close",
  exit: "Exit",
  cancel: "Cancel",
  submit: "Submit",
  send: "Send",
  share: "Share",
  like: "Like",
  heart: "Like",
  favorite: "Favorite",
  star: "Favorite",
  save: "Save",
  download: "Download",
  upload: "Upload",
  next: "Next",
  prev: "Previous",
  previous: "Previous",
  play: "Play",
  pause: "Pause",
  stop: "Stop",
  settings: "Settings",
  gear: "Settings",
  cog: "Settings",
  info: "Information",
  help: "Help",
  home: "Home",
  login: "Log In",
  signin: "Sign In",
  logout: "Log Out",
  signout: "Sign Out",
  user: "Profile",
  profile: "Profile",
  avatar: "Profile",
  bell: "Notifications",
  notification: "Notifications",
  alert: "Alert",
  mail: "Email",
  envelope: "Email",
  phone: "Phone",
  call: "Call",
  filter: "Filter",
  sort: "Sort",
  print: "Print",
  refresh: "Refresh",
  reload: "Refresh",
  copy: "Copy",
  
  // common layout page mapping
  about: "About Us",
  contact: "Contact",
  pricing: "Pricing",
  services: "Services",
  faq: "FAQ",
  support: "Support",
  blog: "Blog",
  careers: "Careers",
  features: "Features",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  register: "Register",
  signup: "Sign Up",
  shop: "Shop",
  store: "Store",
  gallery: "Gallery",
  portfolio: "Portfolio"
};

// load saved settings and start searching for empty tags
function initialize() {
  chrome.storage.local.get([
    "autoLabelerEnabled",
    "focusTrapBreakerEnabled",
    "autoEscapeLoops",
    "voiceAnnouncementsEnabled",
    "focusHaloEnabled",
    "legibleTextEnabled"
  ], (stored) => {
    if (chrome.runtime.lastError) {
      // fallback to default if storage fails
      runHealers();
      applyAccessibilityStyles();
      return;
    }
    
    settings = { ...settings, ...stored };
    
    if (settings.autoLabelerEnabled) {
      runHealers();
      observeDOM();
    }
    
    if (settings.focusTrapBreakerEnabled || settings.focusHaloEnabled) {
      setupFocusTracker();
    }

    applyAccessibilityStyles();
  });

  // messages from service worker / shortcut triggers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "force-escape-focus") {
      escapeFocusTrap();
      sendResponse({ status: "escaped" });
    } else if (request.action === "settings-changed") {
      // update settings if user changes them in popup
      settings = { ...settings, ...request.settings };
      
      if (settings.autoLabelerEnabled) {
        runHealers();
        observeDOM();
      } else {
        disconnectObserver();
      }

      if (settings.focusTrapBreakerEnabled || settings.focusHaloEnabled) {
        setupFocusTracker();
      }

      applyAccessibilityStyles();
    }
  });
}

let famaStyleElement = null;
// inject custom styles for visual overrides
function applyAccessibilityStyles() {
  if (!famaStyleElement) {
    famaStyleElement = document.createElement("style");
    famaStyleElement.id = "fama-accessibility-styles";
    (document.head || document.documentElement).appendChild(famaStyleElement);
  }

  let cssRules = "";

  // styles for keyboard focus indicator ring
  if (settings.focusHaloEnabled) {
    cssRules += `
      .fama-focus-halo {
        outline: 3px solid #ff2a6d !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 12px rgba(255, 42, 109, 0.6) !important;
        transition: outline-offset 0.1s ease, box-shadow 0.1s ease !important;
      }
    `;
  }

  // styles for legible sans-serif mode
  if (settings.legibleTextEnabled) {
    cssRules += `
      body, p, span, a, li, h1, h2, h3, h4, h5, h6, input, button, textarea, select {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        line-height: 1.65 !important;
        letter-spacing: 0.05em !important;
        word-spacing: 0.1em !important;
      }
    `;
  }

  famaStyleElement.textContent = cssRules;
}

// check if an item already has a text label or accessibility name
function hasAccessibleName(el) {
  // look for direct text content or existing labels
  if (el.innerText && el.innerText.trim().length > 0) return true;
  if (el.getAttribute("aria-label")?.trim()) return true;
  if (el.getAttribute("aria-labelledby")?.trim()) return true;
  if (el.getAttribute("title")?.trim()) return true;
  if (el.getAttribute("alt")?.trim()) return true;

  // look for placeholder values or linked labels on forms
  const tagName = el.tagName.toLowerCase();
  if (tagName === "input") {
    if (el.getAttribute("placeholder")?.trim()) return true;
    if (el.value?.trim()) return true;
    
    // check if parent label tag exists
    if (el.closest("label")) return true;
    
    // check for external label tag pointing to this ID
    if (el.id) {
      const externalLabel = document.querySelector(`label[for="${el.id}"]`);
      if (externalLabel && externalLabel.innerText.trim().length > 0) return true;
    }
  }

  // check if child svg title tag provides a description
  if (tagName === "button" || el.getAttribute("role") === "button") {
    const svgTitle = el.querySelector("svg title");
    if (svgTitle && svgTitle.textContent.trim().length > 0) return true;
  }

  return false;
}

// break strings apart into simple lowercase words
function tokenizeString(str) {
  if (!str) return [];
  // split on spaces, lines, and capital letters
  return str
    .split(/[-_\s]|\b|(?=[A-Z])/)
    .map(word => word.toLowerCase().replace(/[^a-z]/g, ""))
    .filter(word => word.length > 1);
}

// find a friendly name based on element traits
function computeFallbackLabel(el) {
  const classStr = typeof el.className === "string" ? el.className : (el.className?.baseVal || "");
  const idStr = el.id || "";
  const nameStr = el.getAttribute("name") || "";
  const dataIcon = el.getAttribute("data-icon") || "";

  // find name clues inside child svg attributes
  const nestedSvg = el.querySelector("svg");
  let svgClues = "";
  if (nestedSvg) {
    const svgClass = typeof nestedSvg.className === "string" ? nestedSvg.className : (nestedSvg.className?.baseVal || "");
    const svgId = nestedSvg.id || "";
    const svgDataIcon = nestedSvg.getAttribute("data-icon") || "";
    svgClues = `${svgClass} ${svgId} ${svgDataIcon}`;

    // try to guess the icon name by looking at child svg structure
    // magnifying glass icon detection
    const hasCircle = nestedSvg.querySelector("circle");
    const hasLine = nestedSvg.querySelector("line");
    if (hasCircle && hasLine && (svgClass.includes("search") || svgClues.trim() === "")) {
      svgClues += " search";
    }

    // shopping cart basket icon detection
    const circles = nestedSvg.querySelectorAll("circle");
    const hasPolyline = nestedSvg.querySelector("polyline");
    if (circles.length >= 2 && (hasPolyline || svgClass.includes("cart"))) {
      svgClues += " cart";
    }

    // navigation arrows chevron detection
    const polylines = nestedSvg.querySelectorAll("polyline");
    if (polylines.length === 1 && !hasCircle) {
      const points = polylines[0].getAttribute("points") || "";
      if (points.includes("9 18 15 12 9 6") || points.includes("15 18 9 12 15 6")) {
        svgClues += points.includes("9 18") ? " next" : " prev";
      }
    }

    // close cross icon detection
    const lines = nestedSvg.querySelectorAll("line");
    if (lines.length === 2 && !hasCircle) {
      svgClues += " close";
    }
  }

  // find name clues from nested image tags
  const nestedImg = el.querySelector("img");
  let imgClues = "";
  if (nestedImg) {
    const imgSrc = nestedImg.getAttribute("src") || "";
    imgClues = imgSrc.split("/").pop() || "";
  }

  // compile all element traits and nested shapes
  const classIdClues = `${classStr} ${idStr} ${nameStr} ${dataIcon} ${svgClues} ${imgClues}`;
  const classIdTokens = tokenizeString(classIdClues);

  // extract name clues from anchor link URL
  let hrefTokens = [];
  if (el.tagName.toLowerCase() === "a") {
    const href = el.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("tel:") && !href.startsWith("mailto:")) {
      try {
        const url = new URL(href, window.location.origin);
        
        // check if external link points to known social domains
        const currentHost = window.location.hostname;
        if (url.hostname && url.hostname !== currentHost) {
          const socialMap = {
            "facebook.com": "Facebook",
            "twitter.com": "Twitter",
            "x.com": "Twitter",
            "instagram.com": "Instagram",
            "youtube.com": "YouTube",
            "linkedin.com": "LinkedIn",
            "github.com": "GitHub",
            "pinterest.com": "Pinterest",
            "reddit.com": "Reddit"
          };
          for (const domain in socialMap) {
            if (url.hostname.includes(domain)) {
              return socialMap[domain]; // return social brand name directly
            }
          }
        }
        
        // look at the url path
        if (url.pathname === "/" || url.pathname === "" || url.pathname.includes("index.html")) {
          hrefTokens.push("home");
        } else {
          const segments = url.pathname.split("/").filter(s => s.length > 0);
          if (segments.length === 1) {
            // single path segment is highly descriptive
            hrefTokens.push(segments[0]);
          } else if (segments.length > 1) {
            // deep path links, only search for matches in dictionary
            for (const seg of segments) {
              const cleanSeg = seg.toLowerCase().replace(/[^a-z]/g, "");
              if (KEYWORD_MAP[cleanSeg]) {
                hrefTokens.push(cleanSeg);
              }
            }
          }
        }

        // look inside URL query parameters
        if (url.search) {
          const params = new URLSearchParams(url.search);
          for (const [key, val] of params.entries()) {
            const cleanKey = key.toLowerCase().replace(/[^a-z]/g, "");
            const cleanVal = val.toLowerCase().replace(/[^a-z]/g, "");
            if (KEYWORD_MAP[cleanKey]) hrefTokens.push(cleanKey);
            if (KEYWORD_MAP[cleanVal]) hrefTokens.push(cleanVal);
          }
        }
      } catch (e) {
        // fail silently on bad url formats
      }
    }
  }

  // combine local tokens and filtered link keywords
  const allTokens = [...classIdTokens, ...hrefTokens];
  
  // skip technical code noise words
  const genericWords = new Set([
    "btn", "button", "class", "id", "style", "wrapper", "icon", "ico", "svg", "js", 
    "action", "click", "toggle", "container", "element", "control", "accessibility", 
    "healed", "png", "jpg", "jpeg", "gif", "webp", "html", "htm", "php", "asp", 
    "aspx", "jsp", "json", "xml", "http", "https", "www", "url", "link", "href", 
    "src", "image", "img", "asset", "assets", "index", "main", "page", "test", "demo", "fa"
  ]);
  const cleanTokens = allTokens.filter(token => !genericWords.has(token));

  if (cleanTokens.length === 0) {
    // if no clues found, search sibling nodes for text labels
    const neighboringText = findNeighboringText(el);
    if (neighboringText) return neighboringText;
    
    // fallback role name mapping
    const rawRole = el.getAttribute("role") || el.tagName.toLowerCase();
    const roleMap = {
      "a": "Link",
      "button": "Button",
      "input": "Input field",
      "select": "Dropdown list",
      "textarea": "Text area"
    };
    const role = roleMap[rawRole] || rawRole;
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  // check for common multi-word combinations
  const tokenSet = new Set(cleanTokens);
  if (tokenSet.has("shopping") && tokenSet.has("cart")) return "Shopping Cart";
  if (tokenSet.has("add") && tokenSet.has("cart")) return "Add to Cart";
  if (tokenSet.has("remove") && tokenSet.has("cart")) return "Remove from Cart";
  if (tokenSet.has("sign") && tokenSet.has("in")) return "Sign In";
  if (tokenSet.has("log") && tokenSet.has("in")) return "Log In";
  if (tokenSet.has("sign") && tokenSet.has("out")) return "Sign Out";
  if (tokenSet.has("log") && tokenSet.has("out")) return "Log Out";

  // swap tokens with dictionary words
  const mappedWords = cleanTokens.map(token => KEYWORD_MAP[token] || token);

  // clean up repeated duplicate words
  const uniqueWords = [];
  for (const word of mappedWords) {
    const formattedWord = word.charAt(0).toUpperCase() + word.slice(1);
    if (uniqueWords[uniqueWords.length - 1] !== formattedWord) {
      uniqueWords.push(formattedWord);
    }
  }

  return uniqueWords.slice(0, 4).join(" ");
}

// find sibling text node or adjacent span tag labels
function findNeighboringText(el) {
  // look at preceding nodes first
  let sibling = el.previousSibling;
  while (sibling) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const text = sibling.textContent.trim();
      if (text.length > 1 && text.length < 30) {
        return text.replace(/:$/, "").trim();
      }
    } else if (sibling.nodeType === Node.ELEMENT_NODE) {
      const text = sibling.innerText?.trim();
      if (text && text.length > 1 && text.length < 30) {
        return text.replace(/:$/, "").trim();
      }
      break; // do not continue if node is not text or simple container
    }
    sibling = sibling.previousSibling;
  }
  return null;
}

// main function to add label to empty item
function healElement(el) {
  if (el.hasAttribute("data-healed") || hasAccessibleName(el)) {
    return;
  }

  const generatedLabel = computeFallbackLabel(el);
  if (!generatedLabel) return;

  const tag = el.tagName.toLowerCase();
  const classStr = typeof el.className === "string" ? el.className : (el.className?.baseVal || "");
  const elementId = el.id || "";
  
  // create element description signature
  const elementSignature = `${tag}|${classStr}|${elementId}|${generatedLabel}`;

  // write label to standard accessibility attribute
  el.setAttribute("aria-label", generatedLabel);
  el.setAttribute("data-healed", "true");

  let sessionCounted = [];
  try {
    const rawSession = sessionStorage.getItem("fama-session-healed");
    if (rawSession) {
      sessionCounted = JSON.parse(rawSession);
    }
  } catch (e) {
    // ignore sessionStorage errors
  }

  // update counts if we haven't seen this item in current tab
  if (!sessionCounted.includes(elementSignature)) {
    sessionCounted.push(elementSignature);
    try {
      sessionStorage.setItem("fama-session-healed", JSON.stringify(sessionCounted));
    } catch (e) {
      // ignore sessionStorage errors
    }

    localStats.healedCount++;
    localStats.healedItems.push({
      tag: tag,
      className: classStr,
      label: generatedLabel,
      timestamp: Date.now()
    });

    // write to storage after a short delay
    scheduleStatsSync();
  }

  // trigger custom event for debug logs
  const event = new CustomEvent("fama-healed", {
    detail: {
      tag: tag,
      class: el.className,
      injectedLabel: generatedLabel
    }
  });
  window.dispatchEvent(event);
}

// update extension storage metrics
let syncTimeout = null;
function scheduleStatsSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(() => {
    chrome.storage.local.get(["healedCount", "historyLog"], (stored) => {
      const newCount = (stored.healedCount || 0) + localStats.healedCount;
      
      // crop list to keep storage size light
      let newHistory = stored.historyLog || [];
      const formattedItems = localStats.healedItems.map(item => ({
        ...item,
        url: window.location.hostname
      }));
      newHistory = [...formattedItems, ...newHistory].slice(0, 25);

      chrome.storage.local.set({
        healedCount: newCount,
        historyLog: newHistory
      });

      // reset local stats queue
      localStats.healedCount = 0;
      localStats.healedItems = [];
    });
  }, 1000);
}

// search page for empty buttons and fields
function runHealers() {
  try {
    const elements = document.querySelectorAll(INTERACTIVE_SELECTOR);
    elements.forEach(healElement);
  } catch (e) {
    // ignore errors
  }
}

// watch page updates for dynamically added elements
let observer = null;
function observeDOM() {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    if (scanDebounceTimeout) clearTimeout(scanDebounceTimeout);
    
    // wait until changes stop before running healer
    scanDebounceTimeout = setTimeout(() => {
      let shouldScan = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // verify if newly added elements are interactive
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches(INTERACTIVE_SELECTOR) || node.querySelector(INTERACTIVE_SELECTOR)) {
                shouldScan = true;
                break;
              }
            }
          }
        }
        if (shouldScan) break;
      }
      
      if (shouldScan) {
        runHealers();
      }
    }, 250);
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
}

// stop watching page updates
function disconnectObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

/* ==========================================================================
   FOCUS TRAP BREAKER ENGINE
   ========================================================================== */

// speak text out loud using browser engine
function speakText(text) {
  if (settings.voiceAnnouncementsEnabled && 'speechSynthesis' in window) {
    try {
      // cancel any current audio queue
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      // ignore speech errors
    }
  }
}

// check keyboard focus shifts
let isFocusTrackerSetup = false;
function setupFocusTracker() {
  if (isFocusTrackerSetup) return;
  isFocusTrackerSetup = true;

  // break out of loops when alt+q or alt+esc is pressed
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "Escape" || e.key?.toLowerCase() === "q")) {
      e.preventDefault();
      escapeFocusTrap();
    }
  }, true);

  // track focused items to find loops
  window.addEventListener("focusin", (e) => {
    const target = e.target;
    if (!target || target === document.body) return;

    // turn on focus ring styling
    if (settings.focusHaloEnabled && typeof target.classList === "object") {
      target.classList.add("fama-focus-halo");
    }

    // speak the healed label aloud
    if (settings.voiceAnnouncementsEnabled && settings.autoLabelerEnabled && target.hasAttribute("data-healed")) {
      const label = target.getAttribute("aria-label");
      if (label) {
        const tagName = target.tagName.toLowerCase();
        let role = target.getAttribute("role") || tagName;
        if (tagName === "input") {
          role = "edit field";
        }
        speakText(`${label}, ${role}`);
      }
    }

    if (!settings.focusTrapBreakerEnabled) return;
    
    // record active focus history
    focusHistory.push(target);
    if (focusHistory.length > MAX_FOCUS_HISTORY) {
      focusHistory.shift();
    }

    // check if user is stuck in looping focus
    checkFocusLoop();
  });

  // clear focus ring styling when focus moves out
  window.addEventListener("focusout", (e) => {
    const target = e.target;
    if (target && typeof target.classList === "object") {
      target.classList.remove("fama-focus-halo");
    }
  });
}

// scan focus history for repeating cycles
function checkFocusLoop() {
  const len = focusHistory.length;
  if (len < 6) return;

  // check repeating loop sizes
  for (let loopSize = 1; loopSize <= 4; loopSize++) {
    const requiredElements = loopSize * 3;
    if (len < requiredElements) continue;

    // slice history into comparison blocks
    const cycle3 = focusHistory.slice(len - loopSize);
    const cycle2 = focusHistory.slice(len - 2 * loopSize, len - loopSize);
    const cycle1 = focusHistory.slice(len - 3 * loopSize, len - 2 * loopSize);

    let isMatch = true;
    for (let i = 0; i < loopSize; i++) {
      if (cycle1[i] !== cycle2[i] || cycle2[i] !== cycle3[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      // loop detected, trigger rescue
      handleDetectedTrap(cycle3);
      break;
    }
  }
}

// loop detected actions
let lastTrapAlertTime = 0;
function handleDetectedTrap(loopElements) {
  const now = Date.now();
  // throttle alerts to prevent spam
  if (now - lastTrapAlertTime < 10000) return;
  lastTrapAlertTime = now;

  // trigger event for visual console
  const event = new CustomEvent("fama-trap-detected", {
    detail: { loopSize: loopElements.length }
  });
  window.dispatchEvent(event);

  if (settings.autoEscapeLoops) {
    showToast("Keyboard loop detected. Jumps you past it now...", true);
    speakText("Keyboard loop detected. Jumping you past it now.");
    setTimeout(() => {
      escapeFocusTrap(loopElements);
    }, 800);
  } else {
    showToast("Got stuck in a loop? Press Alt+Esc or Alt+Q to jump past.", false);
    speakText("Keyboard loop detected. Press Alt+Escape or Alt+Q to jump past.");
  }
}

// calculate common parent container of loop items
function findLowestCommonAncestor(elements) {
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0].parentElement;

  let ancestor = elements[0];
  while (ancestor) {
    const isCommon = elements.every(el => ancestor.contains(el));
    if (isCommon && ancestor !== document.body && ancestor !== document.documentElement) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return document.body;
}

// find the dialog container holding focus
function identifyTrapContainer(activeEl, loopElements) {
  if (loopElements && loopElements.length > 0) {
    return findLowestCommonAncestor(loopElements);
  }

  // climb page tree to find fixed modals or dialogue boxes
  let cur = activeEl;
  while (cur && cur !== document.body) {
    const style = window.getComputedStyle(cur);
    const role = cur.getAttribute("role");
    const isModal = cur.getAttribute("aria-modal") === "true";
    
    if (
      role === "dialog" || 
      role === "alertdialog" || 
      isModal || 
      style.position === "fixed" || 
      cur.classList.contains("modal") || 
      cur.classList.contains("popup") ||
      cur.classList.contains("cookie-banner")
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  
  return activeEl.parentElement || document.body;
}

// shift focus past the trap container
function escapeFocusTrap(providedLoopElements = null) {
  const activeEl = document.activeElement;
  if (!activeEl || activeEl === document.body) return;

  const trapContainer = identifyTrapContainer(activeEl, providedLoopElements || focusHistory);
  if (!trapContainer || trapContainer === document.body) {
    // move focus to page header if no trap container found
    fallbackFocus();
    return;
  }

  // get all visible keyboard focusable elements
  const allFocusables = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && (rect.width > 0 || rect.height > 0);
  });

  // separate elements inside the trap
  const trappedFocusables = allFocusables.filter(el => trapContainer.contains(el));
  
  if (trappedFocusables.length === 0) {
    fallbackFocus();
    return;
  }

  // find index of last trapped element
  const lastTrappedElement = trappedFocusables[trappedFocusables.length - 1];
  const lastIdx = allFocusables.indexOf(lastTrappedElement);

  // select first item following the trap
  let escapeTarget = null;
  if (lastIdx !== -1 && lastIdx + 1 < allFocusables.length) {
    escapeTarget = allFocusables[lastIdx + 1];
  }

  if (escapeTarget) {
    // clear history loop state
    focusHistory.length = 0;
    
    escapeTarget.focus();
    showToast("Rescued! Shifted keyboard focus past the pop-up.", true);
    speakText("Rescued! Shifted keyboard focus past the pop-up.");
    
    incrementTrapsBrokenStats();
  } else {
    fallbackFocus();
  }
}

// return focus to page header landmark
function fallbackFocus() {
  focusHistory.length = 0;
  
  const mainEl = document.querySelector("main") || document.querySelector("#main") || document.querySelector("h1");
  if (mainEl) {
    if (!mainEl.hasAttribute("tabindex")) {
      mainEl.setAttribute("tabindex", "-1");
    }
    mainEl.focus();
  } else {
    document.body.focus();
  }

  showToast("Rescued! Returned keyboard focus to the top of the page.", true);
  speakText("Rescued! Returned keyboard focus to the top of the page.");
  incrementTrapsBrokenStats();
}

// log escape count in storage
function incrementTrapsBrokenStats() {
  chrome.storage.local.get(["trapsBrokenCount"], (stored) => {
    if (chrome.runtime.lastError) return;
    
    const count = (stored.trapsBrokenCount || 0) + 1;
    chrome.storage.local.set({ trapsBrokenCount: count });
  });

  const event = new CustomEvent("fama-trap-broken", {
    detail: { url: window.location.hostname, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
}

// draw custom pink alert toast
function showToast(message, isSuccess = true) {
  // construct notification container if missing
  let toastContainer = document.getElementById("fama-toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "fama-toast-container";
    Object.assign(toastContainer.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "2147483647",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    });
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");

  Object.assign(toast.style, {
    backgroundColor: isSuccess ? "#ff2a6d" : "#ffffff",
    color: isSuccess ? "#ffffff" : "#4a0e17",
    border: isSuccess ? "none" : "2px solid #ffb3c1",
    padding: "12px 18px",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(255, 42, 109, 0.15)",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    opacity: "0",
    transform: "translateY(20px)",
    transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
  });

  const iconSvg = isSuccess 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="12"></line></svg>`;

  toast.innerHTML = `${iconSvg} <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-15px)";
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  }, 4000);
}

// initialize extension page engine
initialize();
