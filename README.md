# CollegeBoard+ Dark Mode

A dependency-free Chrome Manifest V3 extension. Black-and-white controls with six page palettes: Pure black, Dark gray, Gray, Light gray, Dark white, and Old book (warm aged-paper beige).

## Install

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder next to this file.
4. Refresh existing website tabs, then pin the extension and open **Page colors**.

The ZIP contains the same installable files. Extract it first and select the extracted folder containing `manifest.json`.

## Use

Choose a preset or change background, surface, text, and border colors. Settings save immediately. **This website** creates an override for the current hostname; **Default for all websites** changes the fallback for websites without overrides. **Use website defaults** deletes that site's override. Switching **On** off restores original page colors. The popup stays black regardless of the page palette.

**Old book** uses warm beige backgrounds and dark brown text. It has no texture or animation. **White backing for quiz diagrams** keeps transparent Learnosity images readable without inverting their pixels. Custom color contrast is shown against both background colors.

## Scope and privacy

The extension requests local storage, active-tab access for identifying the current site, and content-script access to HTTP/HTTPS pages. It stores settings locally. It has no analytics, network requests, remote libraries, or quiz-answer features. The supplied HAR files were inspected for CSS patterns; account data, request headers, captured questions, and HAR files are not included in the extension or ZIP.

The implementation follows [Chrome's content script model](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts). Page recoloring cannot change the Chrome toolbar, internal pages, Web Store, or built-in PDF viewer. Closed shadow roots and unusual inline `!important` rules can retain original styles. Images, videos, diagram SVGs, and canvases keep their original artwork; neutral SVG icons in controls follow the text color; full-color background images are preserved. Embedded HTTP/HTTPS frames inherit the top-level hostname when exposed by Chrome.

## Verification

`tests/browser.cjs` loads the actual extension into isolated Chromium and checks all six palettes, custom color persistence, dynamically inserted content, selected quiz choices, image preservation, disable restoration, site overrides, and embedded-frame inheritance. Test pages are synthetic, informed by AP Classroom/Learnosity CSS selectors in the supplied captures. A live authenticated College Board quiz has not been tested.

Run with Node and Playwright available:

```sh
node tests/browser.cjs
```

Set `CHROMIUM_PATH` if using a separately installed Chromium executable. Preview screenshots are in `artifacts/`.

## Changes after release 1.0.0

The main branch contains version 1.0.3. Releases **1.0.2** and **1.0.3** are published on GitHub; release **1.0.0** remains available unchanged.

- Re-scan the page when dynamically inserted stylesheets change quiz colors.
- Override high-specificity page rules affecting headers, footers, banners, and controls.
- Theme generated control decorations and neutral toolbar SVG icons, while preserving quiz diagrams.
- Keep the chosen body background and correct/incorrect outlines intact.
- Restore all added color attributes when disabled.

Regression checks reproduce late stylesheet insertion and high-specificity light header/footer/banner styling. Chromium checks and rendered synthetic-page review pass; verification in a live authenticated quiz is still pending.

### 1.0.2 — Loading flash (issue #1)

Removed the 60 ms recoloring delay for inserted content. Mutation processing now runs in a microtask before paint, and Learnosity loading panels have explicit palette rules. Spinner borders and loading dots retain contrast.

The first-frame regression fails against 1.0.1 with white loading panels and passes against the fix across all six presets and with theming disabled. The complete Chromium regression suite also passes. `artifacts/loading-preview.png` shows the synthetic loading fixture; this is not a live authenticated AP Classroom test.

### 1.0.3 — Temporary loading cover

AP Classroom and Learnosity receive a black startup cover from a document-start stylesheet before saved preferences finish loading. Once preferences are available, a temporary cover uses the chosen background color. It stays through initial rendering or a large quiz loading panel, then clears after recoloring and two animation frames. The cover ignores pointer events and fails open after 1.5 seconds (2 seconds for the CSS startup fallback). The initial fallback is black even when saved settings later select a light palette or disable theming.

Browser checks verify the cover exists before page scripts execute on an intercepted AP Classroom URL, clears after loading, and disappears when disabled. These are controlled browser tests, not a signed-in quiz test.

Release policy: see [versioning.md](versioning.md). Every delivered version must include a published GitHub release and its matching installable ZIP.
