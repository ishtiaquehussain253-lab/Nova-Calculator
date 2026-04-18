/* ── Nova Calc — Scientific Calculator Engine ── */
'use strict';

/* ── State ───────────────────────────────────── */
const state = {
  display: '0',
  expression: '',
  memory: 0,
  angleMode: 'DEG',   // 'DEG' | 'RAD'
  invMode: false,
  justEvaluated: false,
  history: [],
};

/* ── DOM refs ─────────────────────────────────── */
const resultDisplay  = document.getElementById('resultDisplay');
const expressionBar  = document.getElementById('expressionBar');
const memIndicator   = document.getElementById('memIndicator');
const errorMsg       = document.getElementById('errorMsg');
const historyList    = document.getElementById('historyList');
const historyPanel   = document.getElementById('historyPanel');
const historyToggle  = document.getElementById('historyToggle');
const clearHistory   = document.getElementById('clearHistory');
const angleToggle    = document.getElementById('angleToggle');
const angleLabel     = document.getElementById('angleLabel');
const themeToggle    = document.getElementById('themeToggle');
const invBtn         = document.getElementById('invBtn');

/* ── Helpers ──────────────────────────────────── */
const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

function angConv(v) {
  return state.angleMode === 'DEG' ? toRad(v) : v;
}

function factorial(n) {
  n = Math.round(n);
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function formatNum(n) {
  if (!isFinite(n)) return n === Infinity ? '∞' : n === -Infinity ? '-∞' : 'Error';
  if (isNaN(n)) return 'Error';
  // Use toPrecision to avoid float dust
  let s = parseFloat(n.toPrecision(12)).toString();
  // Scientific notation cleanup
  if (s.includes('e')) {
    const [base, exp] = s.split('e');
    return `${parseFloat(parseFloat(base).toPrecision(8))}×10^${exp}`;
  }
  return s;
}

/* ── Display update ───────────────────────────── */
function updateDisplay(value, expr = null) {
  const s = String(value);
  resultDisplay.classList.remove('error', 'small', 'smaller');
  if (s === 'Error' || s.startsWith('Error')) {
    resultDisplay.classList.add('error');
  } else if (s.length > 16) {
    resultDisplay.classList.add('smaller');
  } else if (s.length > 11) {
    resultDisplay.classList.add('small');
  }
  resultDisplay.textContent = s;
  state.display = s;
  if (expr !== null) expressionBar.textContent = expr;
  errorMsg.textContent = '';
}

function showError(msg) {
  resultDisplay.classList.remove('small', 'smaller');
  resultDisplay.classList.add('error');
  resultDisplay.textContent = 'Error';
  errorMsg.textContent = msg;
  state.display = '0';
  state.expression = '';
  expressionBar.textContent = '';
}

function updateMemIndicator() {
  memIndicator.textContent = state.memory !== 0 ? `M: ${formatNum(state.memory)}` : '';
}

/* ── Core evaluator ───────────────────────────── */
function safeEval(expr) {
  // Replace display operators with JS operators
  let e = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\^/g, '**')
    .replace(/π/g, `(${Math.PI})`)
    .replace(/∞/g, 'Infinity');

  // Safety: only allow numbers and math symbols
  if (/[^0-9+\-*/().%,eE\s]/.test(e)) throw new Error('Invalid expression');

  /* eslint-disable no-new-func */
  return Function('"use strict"; return (' + e + ')')();
}

/* ── INV map ──────────────────────────────────── */
const invMap = {
  sin:  'asin',
  cos:  'acos',
  tan:  'atan',
  sqrt: 'pow2',
  log:  'pow10',
  ln:   'expe',
};
const invLabels = {
  sin: 'sin⁻¹', cos: 'cos⁻¹', tan: 'tan⁻¹',
  sqrt: 'x²', log: '10ˣ', ln: 'eˣ',
};

/* ── Button handler ───────────────────────────── */
function applyAction(action) {
  clearError();
  const cur = state.display;
  const isNum     = /^-?[\d.]+([Ee][+-]?\d+)?$/.test(cur) && cur !== 'Error';
  const curNum    = parseFloat(cur);
  const inv       = state.invMode;

  // Digits
  if (/^\d$/.test(action) || action === 'dot') {
    const ch = action === 'dot' ? '.' : action;
    if (state.justEvaluated) {
      state.expression = '';
      expressionBar.textContent = '';
      state.justEvaluated = false;
      updateDisplay(ch === '.' ? '0.' : ch);
      state.expression += ch === '.' ? '0.' : ch;
    } else {
      if (ch === '.' && cur.includes('.')) return;
      const next = cur === '0' && ch !== '.' ? ch : cur + ch;
      state.expression += ch;
      updateDisplay(next);
    }
    return;
  }

  switch (action) {
    /* ── Constants ── */
    case 'pi':
      append(Math.PI.toPrecision(12), 'π');
      break;
    case 'e_const':
      append(Math.E.toPrecision(12), 'e');
      break;

    /* ── Unary: trig ── */
    case 'sin': unary(v => {
      if (inv) { const r = Math.asin(v); return state.angleMode==='DEG' ? toDeg(r) : r; }
      return Math.sin(angConv(v));
    }, inv ? 'sin⁻¹' : 'sin'); break;

    case 'cos': unary(v => {
      if (inv) { const r = Math.acos(v); return state.angleMode==='DEG' ? toDeg(r) : r; }
      return Math.cos(angConv(v));
    }, inv ? 'cos⁻¹' : 'cos'); break;

    case 'tan': unary(v => {
      if (inv) { const r = Math.atan(v); return state.angleMode==='DEG' ? toDeg(r) : r; }
      return Math.tan(angConv(v));
    }, inv ? 'tan⁻¹' : 'tan'); break;

    /* ── Log / Exp ── */
    case 'log':
      if (inv) { unary(v => Math.pow(10, v), '10^'); }
      else { unary(v => Math.log10(v), 'log'); }
      break;
    case 'ln':
      if (inv) { unary(v => Math.exp(v), 'e^'); }
      else { unary(v => Math.log(v), 'ln'); }
      break;

    /* ── Powers / Roots ── */
    case 'sqrt':
      if (inv) { unary(v => v * v, 'x²'); }
      else { unary(v => Math.sqrt(v), '√'); }
      break;
    case 'cbrt':  unary(v => Math.cbrt(v), '∛'); break;
    case 'pow2':  unary(v => v * v, 'x²'); break;
    case 'powY':
      appendOp('**', '^'); break;
    case 'nthroot':
      // ʸ√x = x^(1/y). We append operator style
      appendOp('**(1/', 'ʸ√'); break;
    case 'exp10': unary(v => Math.pow(10, v), '10^'); break;
    case 'expe':  unary(v => Math.exp(v), 'e^'); break;

    /* ── Other Unary ── */
    case 'factorial': unary(v => factorial(v), 'n!'); break;
    case 'reciprocal': unary(v => 1 / v, '1/'); break;
    case 'abs':   unary(v => Math.abs(v), '|x|'); break;
    case 'sign':  unary(v => -v, '±'); break;
    case 'percent': unary(v => v / 100, '%'); break;
    case 'floor': unary(v => Math.floor(v), '⌊⌋'); break;

    /* ── EE ── */
    case 'EE':
      if (state.justEvaluated) { state.expression = cur; state.justEvaluated = false; }
      state.expression += 'e';
      updateDisplay(cur + 'e');
      break;

    /* ── Operators ── */
    case 'add': appendOp('+', ' + '); break;
    case 'sub': appendOp('-', ' − '); break;
    case 'mul': appendOp('*', ' × '); break;
    case 'div': appendOp('/', ' ÷ '); break;
    case 'mod': appendOp('%', ' mod '); break;

    /* ── Parens ── */
    case 'lparen':
      state.expression += '(';
      updateDisplay(cur + '(');
      break;
    case 'rparen':
      state.expression += ')';
      updateDisplay(cur + ')');
      break;

    /* ── Equals ── */
    case 'equals': evaluate(); break;

    /* ── Clear / Back ── */
    case 'clear':
      state.expression = '';
      state.justEvaluated = false;
      updateDisplay('0', '');
      break;
    case 'backspace':
      if (state.justEvaluated) { /* clear */ state.expression=''; updateDisplay('0',''); state.justEvaluated=false; break; }
      state.expression = state.expression.slice(0, -1);
      const nd = state.expression || '0';
      updateDisplay(nd, '');
      break;

    /* ── Memory ── */
    case 'mc': state.memory = 0; updateMemIndicator(); break;
    case 'mr':
      updateDisplay(formatNum(state.memory));
      state.expression = String(state.memory);
      state.justEvaluated = false;
      break;
    case 'ms':
      if (isNum) { state.memory = curNum; updateMemIndicator(); }
      break;
    case 'mplus':
      if (isNum) { state.memory += curNum; updateMemIndicator(); }
      break;
    case 'mminus':
      if (isNum) { state.memory -= curNum; updateMemIndicator(); }
      break;

    /* ── INV toggle ── */
    case 'inv':
      state.invMode = !state.invMode;
      invBtn.classList.toggle('inv-active', state.invMode);
      break;
  }
}

/* ── Helpers for applyAction ─────────────────── */
function append(numStr, displayStr) {
  state.expression = numStr;
  state.justEvaluated = false;
  updateDisplay(displayStr);
}

function appendOp(opToken, displayOp) {
  if (state.justEvaluated) state.justEvaluated = false;
  state.expression += opToken;
  expressionBar.textContent = state.display + displayOp;
  /* keep display showing current number */
}

function unary(fn, label) {
  if (!(/^-?[\d.eE+\-]+$/.test(state.display) && state.display !== 'Error')) return;
  const v = parseFloat(state.display);
  const result = fn(v);
  const fmt = formatNum(result);
  expressionBar.textContent = `${label}(${state.display})`;
  updateDisplay(fmt);
  state.expression = fmt === '∞' ? 'Infinity' : (isNaN(result) ? '0' : String(result));
  state.justEvaluated = false;
  if (state.invMode) { state.invMode = false; invBtn.classList.remove('inv-active'); }
}

function evaluate() {
  if (!state.expression) return;
  const expr = state.expression;
  expressionBar.textContent = expr
    .replace(/\*/g,'×').replace(/\//g,'÷').replace(/-/g,'−');

  try {
    let result;
    // Handle nthroot closing paren
    let evalExpr = expr;
    if (evalExpr.includes('**(1/') && !evalExpr.endsWith(')')) {
      evalExpr += ')';
    }
    result = safeEval(evalExpr);
    const fmt = formatNum(result);
    updateDisplay(fmt, expressionBar.textContent + ' =');
    addHistory(expressionBar.textContent, fmt);
    state.expression = String(result);
    state.justEvaluated = true;
  } catch (err) {
    showError('Invalid expression');
  }
}

function clearError() {
  errorMsg.textContent = '';
  if (resultDisplay.classList.contains('error')) {
    resultDisplay.classList.remove('error');
    updateDisplay('0', '');
    state.expression = '';
    state.justEvaluated = false;
  }
}

/* ── History ─────────────────────────────────── */
function addHistory(expr, result) {
  state.history.unshift({ expr, result });
  if (state.history.length > 30) state.history.pop();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  if (state.history.length === 0) {
    historyList.innerHTML = '<li class="history-empty">No calculations yet</li>';
    return;
  }
  state.history.forEach((h, i) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `<div class="history-expr">${h.expr}</div><div class="history-result">${h.result}</div>`;
    li.addEventListener('click', () => {
      state.expression = state.history[i].result.replace(/[^\d.eE+\-]/g,'') || '0';
      updateDisplay(state.history[i].result, state.history[i].expr);
      state.justEvaluated = true;
    });
    historyList.appendChild(li);
  });
}

/* ── Ripple effect ───────────────────────────── */
function addRipple(btn, e) {
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

/* ── Event Binding ───────────────────────────── */
document.querySelectorAll('.key').forEach(btn => {
  btn.addEventListener('click', e => {
    addRipple(btn, e);
    btn.classList.add('pressed');
    btn.addEventListener('animationend', () => btn.classList.remove('pressed'), { once: true });
    const action = btn.dataset.action;
    if (action) applyAction(action);
  });
});

historyToggle.addEventListener('click', () => {
  historyPanel.classList.toggle('open');
  historyToggle.classList.toggle('active');
});

clearHistory.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});

angleToggle.addEventListener('click', () => {
  state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
  angleLabel.textContent = state.angleMode;
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const icon = document.getElementById('themeIcon');
  if (document.body.classList.contains('light')) {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  } else {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
  }
});

/* ── Keyboard support ────────────────────────── */
const physicalKeyMap = {
  '0':'0','1':'1','2':'2','3':'3','4':'4',
  '5':'5','6':'6','7':'7','8':'8','9':'9',
  '.':'dot', '+':'add','-':'sub','*':'mul','/':'div',
  'Enter':'equals','='  :'equals',
  'Backspace':'backspace','Escape':'clear',
  '(':'lparen',')':'rparen','%':'percent',
};

document.addEventListener('keydown', e => {
  const action = physicalKeyMap[e.key];
  if (action) {
    e.preventDefault();
    applyAction(action);
    // Flash corresponding button
    const btn = document.querySelector(`[data-action="${action}"]`);
    if (btn) { btn.classList.add('pressed'); setTimeout(()=>btn.classList.remove('pressed'),150); }
  }
});

/* ── Init ────────────────────────────────────── */
updateDisplay('0', '');
updateMemIndicator();
