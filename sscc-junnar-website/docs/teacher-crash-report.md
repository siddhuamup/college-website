# Teacher Dashboard Crash Report

## Crash Overview

- **Exact Page:** `/teacher/index.html` (Teacher Workspace Dashboard)
- **Exact Action:** Clicking on any of the quick action buttons in the Welcome Card ("Enter Marks", "Mark Attendance", or "Apply Leave") while in the "My subjects" panel.
- **Exact API Endpoint:** N/A (Client-side ReferenceError before any API endpoint is reached)
- **Failing Element:**
  - `<button class="btn small" onclick="panel('marks'); load('marks');" ...>Enter Marks</button>`
  - `<button class="btn secondary small" onclick="panel('attendance'); load('attendance');" ...>Mark Attendance</button>`
  - `<button class="btn secondary small" onclick="panel('leave'); load('leave');" ...>Apply Leave</button>`

---

## Technical Details

### Exact Error
`ReferenceError: panel is not defined` / `ReferenceError: load is not defined`

### Exact Stack Trace
```
ReferenceError: panel is not defined
    at HTMLButtonElement.onclick (http://localhost:3000/teacher/index.html:50:37)
```

---

## Root Cause Analysis

The JavaScript logic in `/js/teacher-app.js` is wrapped in an Immediately Invoked Function Expression (IIFE):

```javascript
(function () {
  let studentsCache = [];
  
  function panel(id) {
    // ...
  }
  
  async function load(id) {
    // ...
  }
  
  // ...
})();
```

Because of the IIFE encapsulation, the `panel` and `load` functions are scoped locally and are not accessible on the global `window` object. 
However, the HTML file `/teacher/index.html` defines inline `onclick` handlers on the Welcome Card's buttons:
```html
onclick="panel('marks'); load('marks');"
```
When clicked, the browser attempts to execute `window.panel(...)` and `window.load(...)`, which throws a `ReferenceError` since they are not defined in the global scope.

---

## Remediation Plan

Expose `panel` and `load` globally on the `window` object from within `/js/teacher-app.js`:
```javascript
window.panel = panel;
window.load = load;
```
This fixes the ReferenceError while keeping the inline HTML handlers functional without breaking backward compatibility or requiring modification of structural markup.
Additionally, make the loading and list-iteration functions in `teacher-app.js` defensive against non-array payloads or undefined cache states.
