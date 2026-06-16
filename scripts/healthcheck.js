#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ERRORS = [];
const WARNINGS = [];

function check(label, ok, detail) {
  if (!ok) ERRORS.push(`[FAIL] ${label}: ${detail || ''}`);
}

function warn(label, detail) {
  WARNINGS.push(`[WARN] ${label}: ${detail || ''}`);
}

// 1) Syntax check
try {
  require('child_process').execSync('node --check server/app.js', { cwd: path.join(__dirname, '..') });
} catch (e) {
  ERRORS.push('[FAIL] server/app.js syntax error: ' + e.stderr?.toString().trim());
}

try {
  require('child_process').execSync('node --check server/database.js', { cwd: path.join(__dirname, '..') });
} catch (e) {
  ERRORS.push('[FAIL] server/database.js syntax error: ' + e.stderr?.toString().trim());
}

// 2) app.js critical functions check
const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf-8');

const criticalFunctions = [
  'function login',
  'function checkAuth',
  'function renderHome',
  'function navigate',
  'function doCheckIn',
  'function doCheckOut',
  'function viewReport',
  'function renderReports',
  'function renderMore',
  'function renderWeekly',
  'function toast',
  'function api(',
  'function escHtml',
  'function showAdminPanel',
];

criticalFunctions.forEach(fn => {
  check(`Critical function: ${fn}`, appJs.includes(fn), 'Function missing or renamed');
});

// 3) Duplicate let/const/var declarations (the #1 cause of total app breakage)
const declRe = /\b(let|const|var)\s+(\w+)/g;
const decls = {};
let m;
const lines = appJs.split('\n');
lines.forEach((line, i) => {
  const lineNum = i + 1;
  // Skip lines inside strings or comments
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

  let match;
  const re = /\b(let|const|var)\s+(\w+)/g;
  while ((match = re.exec(line)) !== null) {
    const name = match[2];
    // Skip common loop vars and short names
    if (['i', 'j', 'k', 'e', 'r', 'n', 'a', 'c', 'd', 'v', 'h', 'm', 'p', 's', 't', 'w', 'x', 'y', 'el', 'fn', 'id', 'dt', 'ok', 're'].includes(name)) continue;
    if (!decls[name]) decls[name] = [];
    decls[name].push(lineNum);
  }
});

Object.entries(decls).forEach(([name, linesArr]) => {
  // Only flag top-level (non-function-scoped) duplicates is hard,
  // so flag if same name declared 2+ times AND one is in top-level scope
  if (linesArr.length >= 2) {
    // Check if any declaration is at column 0 (top-level)
    const topLevel = linesArr.filter(ln => {
      const lineText = lines[ln - 1];
      return lineText && !lineText.startsWith(' ') && !lineText.startsWith('\t');
    });
    if (topLevel.length >= 2) {
      ERRORS.push(`[FAIL] Duplicate top-level declaration: '${name}' at lines ${linesArr.join(', ')}`);
    }
  }
});

// 4) Check onclick handlers reference existing functions
const onclickRe = /onclick="(\w+)\(/g;
const funcDefRe = /function\s+(\w+)\s*\(/g;
const definedFunctions = new Set();
while ((m = funcDefRe.exec(appJs)) !== null) definedFunctions.add(m[1]);
// Also add arrow/const functions
const arrowRe = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\()/g;
while ((m = arrowRe.exec(appJs)) !== null) definedFunctions.add(m[1]);

const onclickFunctions = new Set();
while ((m = onclickRe.exec(appJs)) !== null) onclickFunctions.add(m[1]);

onclickFunctions.forEach(fn => {
  if (!definedFunctions.has(fn)) {
    // Built-in/global functions to skip
    if (['confirm', 'alert', 'prompt', 'location', 'window', 'document', 'history', 'navigator', 'console', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout', 'JSON', 'Date', 'Math', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Promise', 'fetch', 'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'if', 'return', 'new', 'typeof', 'void'].includes(fn)) return;
    warn(`onclick references undefined function: ${fn}()`);
  }
});

// 5) Check index.html integrity
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf-8');
check('index.html has loginScreen', indexHtml.includes('id="loginScreen"'));
check('index.html has appContainer', indexHtml.includes('id="appContainer"'));
check('index.html has mainContent', indexHtml.includes('id="mainContent"'));
check('index.html loads app.js', indexHtml.includes('/js/app.js'));
check('index.html loads style.css', indexHtml.includes('/css/style.css'));

// 6) server/app.js critical endpoints
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server', 'app.js'), 'utf-8');
const criticalEndpoints = [
  '/api/me', '/api/login', '/api/logout', '/api/reports', '/api/dashboard',
  '/api/attendance/today', '/api/attendance/check-in', '/api/notices'
];
criticalEndpoints.forEach(ep => {
  check(`Server endpoint: ${ep}`, serverJs.includes(`'${ep}'`) || serverJs.includes(`"${ep}"`), 'Endpoint missing');
});

// Report
console.log('\n══════════════════════════════════');
console.log('  WorkFlow Health Check Report');
console.log('══════════════════════════════════\n');

if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ All checks passed!\n');
  process.exit(0);
} else {
  if (ERRORS.length > 0) {
    console.log(`❌ ${ERRORS.length} ERROR(S):`);
    ERRORS.forEach(e => console.log('  ' + e));
    console.log('');
  }
  if (WARNINGS.length > 0) {
    console.log(`⚠️  ${WARNINGS.length} WARNING(S):`);
    WARNINGS.forEach(w => console.log('  ' + w));
    console.log('');
  }
  process.exit(ERRORS.length > 0 ? 1 : 0);
}
