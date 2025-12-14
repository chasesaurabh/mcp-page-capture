# Advanced Step Types

This document describes advanced step types for power users and developers. These are not exposed in the primary LLM tool description but are available for complex scenarios.

## Extended Steps

### type
Type text with keyboard simulation. Use for autocomplete or special input handling.

```json
{
  "type": "type",
  "target": "#search",
  "text": "hello world",
  "pressEnter": true,
  "delay": 50
}
```

**Parameters**:
- `target` (required): CSS selector for input element
- `text` (required): Text to type character by character
- `pressEnter` (optional): Press Enter after typing. Default: false
- `delay` (optional): Delay between keystrokes in ms (0-500). Default: 0

### hover
Hover over element. Use for dropdowns, tooltips, or hover menus.

```json
{
  "type": "hover",
  "target": ".dropdown-trigger",
  "duration": 1000
}
```

**Parameters**:
- `target` (required): CSS selector for element to hover
- `duration` (optional): How long to hover in ms (0-5000). Default: 100

### cookie
Manage cookies in the browser.

```json
{
  "type": "cookie",
  "action": "set",
  "name": "session_id",
  "value": "abc123",
  "domain": ".example.com",
  "secure": true,
  "httpOnly": true
}
```

**Parameters**:
- `action` (required): "set" or "delete"
- `name` (required): Cookie name
- `value` (optional): Cookie value (required for "set")
- `domain` (optional): Cookie domain
- `path` (optional): Cookie path
- `secure` (optional): HTTPS only
- `httpOnly` (optional): Not accessible via JavaScript
- `sameSite` (optional): "Strict", "Lax", or "None"
- `expires` (optional): Unix timestamp in seconds

### storage
Manage localStorage or sessionStorage.

```json
{
  "type": "storage",
  "storageType": "localStorage",
  "action": "set",
  "key": "user_pref",
  "value": "dark_mode"
}
```

**Parameters**:
- `storageType` (required): "localStorage" or "sessionStorage"
- `action` (required): "set", "delete", or "clear"
- `key` (optional): Storage key (required for "set" and "delete")
- `value` (optional): Value to store (required for "set")

### delay
Fixed delay. Prefer `wait` with selector when possible.

```json
{
  "type": "delay",
  "duration": 2000
}
```

**Parameters**:
- `duration` (required): Milliseconds to wait (0-30000)

### evaluate
Execute JavaScript in the page context.

```json
{
  "type": "evaluate",
  "script": "document.querySelector('.banner').remove()",
  "selector": ".banner"
}
```

**Parameters**:
- `script` (required): JavaScript code to execute
- `selector` (optional): Element to pass to the script

---

## Legacy Parameter Support

The tool accepts legacy parameter names and automatically normalizes them:

| Legacy | Canonical |
|--------|-----------|
| `awaitElement` | `for` |
| `selector` | `target` |
| `scrollTo` | `to` |
| `waitAfter` | `wait` |
| `waitForSelector` | `wait` |
| `captureElement` | `element` |
| `preset` | `device` |

Legacy step types:
- `waitForSelector` → `wait`
- `delay` → `wait` (with duration)

---

## Migration Guide

If you're using advanced features, here's how to migrate:

### Old fillForm Step
```json
{
  "type": "fillForm",
  "fields": [
    { "selector": "#email", "value": "user@example.com" },
    { "selector": "#password", "value": "secret" }
  ],
  "submit": true
}
```

### New fill Steps
```json
[
  { "type": "fill", "target": "#email", "value": "user@example.com" },
  { "type": "fill", "target": "#password", "value": "secret", "submit": true }
]
```

---

## When to Use Advanced Steps

- **type**: When you need keyboard simulation for autocomplete
- **hover**: For dropdown menus or tooltips
- **cookie**: For authentication or session management
- **storage**: For setting localStorage/sessionStorage
- **delay**: Only when you can't use `wait` with a selector
- **evaluate**: For complex page manipulation (use sparingly)

For most use cases, stick to the 6 primary steps in the LLM Reference.
