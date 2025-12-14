# MCP Page-Capture: LLM Quick Reference

## Tools

### captureScreenshot
Capture webpage screenshot with optional interactions.

**Parameters**:
- `url` (required): Webpage URL to capture
- `steps` (optional): Array of steps (order auto-fixed, screenshot auto-added)
- `headers` (optional): HTTP headers for authentication
- `validate` (optional): Set to `true` to validate steps without executing

### extractDom
Extract HTML, text, and DOM tree from webpage.

**Parameters**:
- `url` (required): Webpage URL
- `selector` (optional): CSS selector to scope extraction

---

## Step Types (Exactly 6)

### 1. viewport
Set device/screen size. **Must be FIRST step if used.**

```json
{ "type": "viewport", "device": "mobile" }
{ "type": "viewport", "width": 1024, "height": 768 }
```

**Device presets (15 total)**:
- Generic: `mobile`, `tablet`, `desktop`
- Phones: `iphone-16-pro`, `iphone-14`, `pixel-9`, `galaxy-s24`
- Tablets: `ipad-pro`, `ipad-air`, `surface-pro`
- Desktop: `desktop-fhd`, `desktop-hd`, `desktop-4k`, `macbook-pro-16`, `macbook-air`

**Bounds**: width (1-7680), height (1-4320)

### 2. wait
Wait for element OR fixed duration. **Use before click/fill on dynamic pages.**

```json
{ "type": "wait", "for": ".content-loaded" }
{ "type": "wait", "for": "#modal", "timeout": 15000 }
{ "type": "wait", "duration": 2000 }
```

**Parameters** (provide `for` OR `duration`):
- `for` (optional): CSS selector to wait for - **preferred**
- `duration` (optional): Fixed wait in ms (0-30000) - use when no selector available
- `timeout` (optional): Max wait in ms (0-30000). Default: 10000. Only used with `for`

### 3. fill
Fill any form field. Auto-detects type.

```json
{ "type": "fill", "target": "#email", "value": "user@example.com" }
{ "type": "fill", "target": "#search", "value": "query", "submit": true }
{ "type": "fill", "target": "#agree", "value": "true" }
{ "type": "fill", "target": "#country", "value": "US" }
```

### 4. click
Click element. Add `waitFor` for dynamic content.

```json
{ "type": "click", "target": "button.submit" }
{ "type": "click", "target": "#login", "waitFor": ".dashboard" }
```

### 5. scroll
Scroll to element or position.

```json
{ "type": "scroll", "to": "#section-2" }
{ "type": "scroll", "y": 500 }
```

**Parameters**:
- `to` (optional): CSS selector to scroll into view
- `y` (optional): Vertical position in pixels (0-100000)

### 6. screenshot
Capture screenshot. **Auto-added if omitted.**

```json
{ "type": "screenshot" }
{ "type": "screenshot", "fullPage": true }
{ "type": "screenshot", "element": ".hero-card" }
```

---

## Common Patterns

### Basic Screenshot
```json
{ "url": "https://example.com" }
```

### Search Form
```json
{
  "url": "https://example.com",
  "steps": [
    { "type": "fill", "target": "#search", "value": "MCP protocol", "submit": true },
    { "type": "wait", "for": ".results" }
  ]
}
```

### Login Flow
```json
{
  "url": "https://example.com/login",
  "steps": [
    { "type": "fill", "target": "#email", "value": "user@example.com" },
    { "type": "fill", "target": "#password", "value": "secret" },
    { "type": "click", "target": "button[type=submit]", "waitFor": ".dashboard" }
  ]
}
```

### Mobile Screenshot
```json
{
  "url": "https://example.com",
  "steps": [
    { "type": "viewport", "device": "mobile" }
  ]
}
```

### Full Page Capture
```json
{
  "url": "https://example.com",
  "steps": [
    { "type": "screenshot", "fullPage": true }
  ]
}
```

---

## Error Recovery (Actionable Fixes)

| Error | Cause | Fix |
|-------|-------|-----|
| ELEMENT_NOT_FOUND | Element not in DOM yet | Add `{ "type": "wait", "for": "<same-selector>" }` BEFORE the failing step |
| ELEMENT_NOT_VISIBLE | Element below viewport | Add `{ "type": "scroll", "to": "<same-selector>" }` BEFORE the failing step |
| NAVIGATION_TIMEOUT | Page didn't load | Check URL is correct, increase timeout, or retry request |
| INVALID_SELECTOR | Malformed CSS selector | Use `#id` for IDs, `.class` for classes. Verify brackets are closed |
| TIMEOUT | Operation took too long | Add explicit `wait` step or increase `timeout` parameter (max: 30000ms) |

---

## Composite Patterns (NEW)

High-level patterns that auto-expand to multiple steps:

### login
```json
{
  "type": "login",
  "email": { "selector": "#email", "value": "user@example.com" },
  "password": { "selector": "#password", "value": "secret" },
  "submit": "button[type=submit]",
  "successIndicator": ".dashboard"
}
```
*Expands to: fill email → fill password → click submit → wait for success*

### search
```json
{
  "type": "search",
  "input": "#search-box",
  "query": "MCP protocol",
  "resultsIndicator": ".search-results"
}
```
*Expands to: fill search → submit → wait for results*

---

## Step Ordering

**You don't need to worry about order** - the system auto-fixes step ordering:
- `viewport` is auto-moved to first position if needed
- `screenshot` is auto-added at end if omitted

## Parameter Naming Convention

| Parameter | Used In | Meaning |
|-----------|---------|--------|
| `target` | fill, click | Element to act ON |
| `for` | wait | Element to wait FOR |
| `to` | scroll | Element to scroll TO |
| `element` | screenshot | Element to capture |
| `waitFor` | click | Element to wait for after click |
| `duration` | wait | Fixed delay in ms (when no selector available) |

---

## Validate Mode

Use `validate: true` to check steps without executing:

```json
{
  "url": "https://example.com",
  "steps": [
    { "type": "fill", "target": "#email", "value": "test@example.com" },
    { "type": "click", "target": "button" }
  ],
  "validate": true
}
```

**Returns**:
- Validation status (PASSED/FAILED)
- Step count and estimated execution time
- Errors (e.g., missing required parameters)
- Warnings (e.g., viewport not first)
- Suggestions (e.g., add waitFor to click)
- Step-by-step analysis
