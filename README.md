# Fama — Keyboard & Accessibility Companion

> Intelligent client-side accessibility companion for Chrome. Fama auto-labels unlabeled buttons and links using semantic heuristics, breaks keyboard focus traps in modal dialogs, provides dual-contrast focus rings, and enables instant landmark navigation.

---

## Key Features

- **Semantic Auto-Labeler**: Identifies unlabeled buttons, interactive icons, and links without layout reflow. Automatically infers intent from SVG path signatures, icon class conventions (Lucide, Heroicons, FontAwesome, Tabler, Material Icons), context (search forms, steppers, dialog close buttons), and URL routes, injecting standard `aria-label` attributes.
- **Focus Trap Breaker & Loop Rescue**: Detects cyclical keyboard navigation traps in broken modals, overlays, or mega-menus. Press <kbd>Alt</kbd>+<kbd>Q</kbd> (or <kbd>Alt</kbd>+<kbd>Esc</kbd>) to instantly neutralize the trap and jump to the next interactive page element or `<main>` landmark.
- **Landmark Navigation**: Jump between major page landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`, `<search>`) using <kbd>Alt</kbd>+<kbd>N</kbd> (forward) and <kbd>Alt</kbd>+<kbd>P</kbd> (backward).
- **WCAG 2.2 Dual-Contrast Focus Ring**: Injects a dual-contrast indicator (blue and white) that guarantees $\ge 3:1$ contrast against light, dark, and multi-colored backgrounds while respecting `:focus-visible` (keyboard only).
- **Live Page Inspector**: Open the extension popup on any webpage to see real-time healed elements, re-scan on demand, or click an element to scroll directly to it on the page.
- **Per-Site Controls**: Quickly toggle Fama on or off for specific domains with one click.
- **Zero Network Fluff**: Self-contained, lightweight, offline-ready with native system typography. No external tracking, remote fonts, or telemetry.

---

## Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Alt</kbd> + <kbd>Q</kbd> | **Escape Trap** | Breaks out of a stuck modal or repeating keyboard loop. |
| <kbd>Alt</kbd> + <kbd>Esc</kbd> | **Quick Escape** | Alternative fallback sequence to escape focus traps. |
| <kbd>Alt</kbd> + <kbd>N</kbd> | **Next Landmark** | Advance keyboard focus to the next major page landmark. |
| <kbd>Alt</kbd> + <kbd>P</kbd> | **Prev Landmark** | Move keyboard focus to the previous major page landmark. |

*Shortcuts can be customized anytime via `chrome://extensions/shortcuts`.*

---

## Installation (Unpacked)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select this directory (`Fama`).
5. Pin **Fama** to your extension toolbar for quick access to the Page Inspector.

---

## Architecture

- **`manifest.json`**: Manifest V3 configuration with streamlined permissions (`storage`, `activeTab`).
- **`background/service-worker.js`**: Listens for global keyboard commands, updates per-tab badge counters, and manages extension settings defaults.
- **`scripts/content.js`**: Fast semantic labeling heuristics, `MutationObserver` debouncing via `requestIdleCallback`, loop detection ring buffer, trap escaping logic, and message dispatcher.
- **`popup/`**: Clean, accessible popup controller featuring the Live Page Inspector, site toggle, keyboard cheat sheet, and preference switches.
