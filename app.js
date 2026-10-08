/**
 * OmniCalc Pro — Core Logic, Math Evaluator, Unit Converter & UI Controller
 */

class CalculatorApp {
  constructor() {
    // DOM Elements
    this.mainDisplay = document.getElementById('main-display');
    this.historyDisplay = document.getElementById('history-display');
    this.displayPanel = document.querySelector('.display-panel');
    this.calcApp = document.getElementById('calculator-app');
    
    // View Panels
    this.calcView = document.getElementById('calc-view');
    this.converterView = document.getElementById('converter-view');
    this.scientificGrid = document.getElementById('scientific-grid');
    this.historyDrawer = document.getElementById('history-drawer');
    this.historyList = document.getElementById('history-list');
    this.historyBadge = document.getElementById('history-badge');
    this.toastEl = document.getElementById('toast');

    // Indicators
    this.degIndicator = document.getElementById('deg-indicator');
    this.memIndicator = document.getElementById('mem-indicator');
    this.modeIndicator = document.getElementById('mode-indicator');
    this.btnDegToggle = document.getElementById('btn-deg-toggle');

    // State
    this.currentInput = '0';
    this.expression = '';
    this.memory = 0;
    this.isDegree = true;
    this.mode = 'standard'; // 'standard', 'scientific', 'converter'
    this.justCalculated = false;
    this.history = JSON.parse(localStorage.getItem('omnicalc_history') || '[]');

    // Audio instance
    this.audio = window.calcAudio;

    // Unit Converter Data
    this.currentCategory = 'length';
    this.initUnitDefinitions();

    // Initialization
    this.initTheme();
    this.bindEvents();
    this.bindKeyboard();
    this.renderHistory();
    this.updateDisplay();
    this.initConverterUI();
  }

  // --- THEME MANAGEMENT ---
  initTheme() {
    const savedTheme = localStorage.getItem('omnicalc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('omnicalc_theme', next);
    this.updateThemeIcon(next);
  }

  updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.innerText = theme === 'dark' ? '🌙' : '☀️';
    }
  }

  // --- DISPLAY & FORMATTING ---
  updateDisplay() {
    // Format large numbers cleanly
    let displayVal = this.currentInput;
    if (!isNaN(displayVal) && displayVal !== '' && !displayVal.endsWith('.')) {
      const parts = displayVal.split('.');
      parts[0] = Number(parts[0]).toLocaleString('en-US');
      displayVal = parts.join('.');
    }

    this.mainDisplay.innerText = displayVal;
    this.historyDisplay.innerText = this.expression;

    // Dynamic Font Scaling
    const len = this.mainDisplay.innerText.length;
    if (len > 15) {
      this.mainDisplay.style.fontSize = '24px';
    } else if (len > 11) {
      this.mainDisplay.style.fontSize = '32px';
    } else if (len > 8) {
      this.mainDisplay.style.fontSize = '40px';
    } else {
      this.mainDisplay.style.fontSize = '46px';
    }

    // Memory Indicator
    if (this.memory !== 0) {
      this.memIndicator.classList.remove('hidden');
    } else {
      this.memIndicator.classList.add('hidden');
    }
  }

  triggerShake() {
    this.displayPanel.classList.remove('shake');
    void this.displayPanel.offsetWidth; // Reflow
    this.displayPanel.classList.add('shake');
    if (this.audio) this.audio.playError();
  }

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.innerText = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 2200);
  }

  // --- NUMERIC & OPERATOR INPUT ---
  inputDigit(digit) {
    if (this.audio) this.audio.playClick('num');

    if (this.justCalculated) {
      this.currentInput = digit;
      this.expression = '';
      this.justCalculated = false;
    } else {
      if (this.currentInput === '0' && digit !== '.') {
        this.currentInput = digit;
      } else {
        if (this.currentInput.length < 18) {
          this.currentInput += digit;
        }
      }
    }
    this.updateDisplay();
  }

  inputDecimal() {
    if (this.audio) this.audio.playClick('num');
    if (this.justCalculated) {
      this.currentInput = '0.';
      this.expression = '';
      this.justCalculated = false;
    } else if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
    this.updateDisplay();
  }

  handleOperator(opSymbol, opName) {
    if (this.audio) this.audio.playClick('op');

    if (this.justCalculated) {
      this.expression = `${this.currentInput} ${opSymbol} `;
      this.currentInput = '0';
      this.justCalculated = false;
    } else {
      if (this.currentInput !== '') {
        this.expression += `${this.currentInput} ${opSymbol} `;
        this.currentInput = '0';
      } else if (this.expression.length > 0) {
        // Replace last operator
        this.expression = this.expression.replace(/[\+\−\×\÷\^]\s*$/, `${opSymbol} `);
      }
    }
    this.updateDisplay();
  }

  negate() {
    if (this.audio) this.audio.playClick('num');
    if (this.currentInput === '0' || this.currentInput === '') return;
    if (this.currentInput.startsWith('-')) {
      this.currentInput = this.currentInput.slice(1);
    } else {
      this.currentInput = '-' + this.currentInput;
    }
    this.updateDisplay();
  }

  backspace() {
    if (this.audio) this.audio.playClick('special');
    if (this.justCalculated) {
      this.expression = '';
      this.justCalculated = false;
      return;
    }
    if (this.currentInput.length > 1) {
      this.currentInput = this.currentInput.slice(0, -1);
    } else {
      this.currentInput = '0';
    }
    this.updateDisplay();
  }

  clearEntry() {
    if (this.audio) this.audio.playClick('special');
    this.currentInput = '0';
    this.updateDisplay();
  }

  allClear() {
    if (this.audio) this.audio.playClick('special');
    this.currentInput = '0';
    this.expression = '';
    this.justCalculated = false;
    this.updateDisplay();
  }

  // --- SCIENTIFIC FUNCTIONS ---
  handleScientific(func) {
    if (this.audio) this.audio.playClick('func');
    let val = parseFloat(this.currentInput);
    if (isNaN(val)) return;

    let res;
    switch (func) {
      case 'sin':
        res = this.isDegree ? Math.sin((val * Math.PI) / 180) : Math.sin(val);
        this.expression = `sin(${val})`;
        break;
      case 'cos':
        res = this.isDegree ? Math.cos((val * Math.PI) / 180) : Math.cos(val);
        this.expression = `cos(${val})`;
        break;
      case 'tan':
        if (this.isDegree && Math.abs(val % 180) === 90) {
          this.triggerShake();
          return;
        }
        res = this.isDegree ? Math.tan((val * Math.PI) / 180) : Math.tan(val);
        this.expression = `tan(${val})`;
        break;
      case 'asin':
        if (val < -1 || val > 1) { this.triggerShake(); return; }
        res = Math.asin(val);
        if (this.isDegree) res = (res * 180) / Math.PI;
        this.expression = `sin⁻¹(${val})`;
        break;
      case 'acos':
        if (val < -1 || val > 1) { this.triggerShake(); return; }
        res = Math.acos(val);
        if (this.isDegree) res = (res * 180) / Math.PI;
        this.expression = `cos⁻¹(${val})`;
        break;
      case 'atan':
        res = Math.atan(val);
        if (this.isDegree) res = (res * 180) / Math.PI;
        this.expression = `tan⁻¹(${val})`;
        break;
      case 'sqrt':
        if (val < 0) { this.triggerShake(); return; }
        res = Math.sqrt(val);
        this.expression = `√(${val})`;
        break;
      case 'square':
        res = val * val;
        this.expression = `sqr(${val})`;
        break;
      case 'reciprocal':
        if (val === 0) { this.triggerShake(); return; }
        res = 1 / val;
        this.expression = `1/(${val})`;
        break;
      case 'abs':
        res = Math.abs(val);
        this.expression = `|${val}|`;
        break;
      case 'ln':
        if (val <= 0) { this.triggerShake(); return; }
        res = Math.log(val);
        this.expression = `ln(${val})`;
        break;
      case 'log':
        if (val <= 0) { this.triggerShake(); return; }
        res = Math.log10(val);
        this.expression = `log(${val})`;
        break;
      case 'factorial':
        if (val < 0 || val > 100 || !Number.isInteger(val)) { this.triggerShake(); return; }
        res = this.calculateFactorial(val);
        this.expression = `fact(${val})`;
        break;
      case 'pi':
        res = Math.PI;
        break;
      case 'e':
        res = Math.E;
        break;
      case 'exp':
        this.currentInput += 'e+';
        this.updateDisplay();
        return;
      case 'open-paren':
        this.expression += '( ';
        this.updateDisplay();
        return;
      case 'close-paren':
        if (this.currentInput !== '') {
          this.expression += `${this.currentInput} ) `;
          this.currentInput = '';
        } else {
          this.expression += ') ';
        }
        this.updateDisplay();
        return;
      default:
        return;
    }

    if (res !== undefined) {
      res = this.stripPrecision(res);
      this.currentInput = res.toString();
      this.justCalculated = true;
      this.addHistory(this.expression, this.currentInput);
      this.updateDisplay();
    }
  }

  calculateFactorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  toggleDegRad() {
    if (this.audio) this.audio.playClick('special');
    this.isDegree = !this.isDegree;
    if (this.degIndicator) {
      this.degIndicator.innerText = this.isDegree ? 'DEG' : 'RAD';
    }
    if (this.btnDegToggle) {
      this.btnDegToggle.innerText = this.isDegree ? 'RAD' : 'DEG';
    }
  }

  // --- MEMORY OPERATIONS ---
  handleMemory(action) {
    if (this.audio) this.audio.playClick('special');
    const curVal = parseFloat(this.currentInput) || 0;

    switch (action) {
      case 'mc':
        this.memory = 0;
        this.showToast('Memory Cleared');
        break;
      case 'mr':
        this.currentInput = this.memory.toString();
        this.justCalculated = true;
        this.showToast(`Memory Recall: ${this.memory}`);
        break;
      case 'm-plus':
        this.memory += curVal;
        this.showToast(`Memory +: ${this.memory}`);
        break;
      case 'm-minus':
        this.memory -= curVal;
        this.showToast(`Memory −: ${this.memory}`);
        break;
      case 'ms':
        this.memory = curVal;
        this.showToast(`Stored in Memory: ${this.memory}`);
        break;
    }
    this.updateDisplay();
  }

  // --- EVALUATION ENGINE ---
  calculate() {
    if (this.audio) this.audio.playClick('equals');

    let fullExpr = this.expression;
    if (this.currentInput !== '') {
      fullExpr += this.currentInput;
    }

    if (!fullExpr.trim()) return;

    try {
      // Clean and map math symbols
      let sanitize = fullExpr
        .replace(/\×/g, '*')
        .replace(/\÷/g, '/')
        .replace(/\−/g, '-')
        .replace(/\^/g, '**')
        .replace(/\%/g, '* 0.01');

      // Auto close missing parentheses
      const openCount = (sanitize.match(/\(/g) || []).length;
      const closeCount = (sanitize.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        sanitize += ')'.repeat(openCount - closeCount);
      }

      // Safe evaluation
      const result = this.safeEvaluate(sanitize);

      if (isNaN(result) || !isFinite(result)) {
        throw new Error("Math Error");
      }

      const formattedResult = this.stripPrecision(result);
      const historyExpr = fullExpr;

      this.addHistory(historyExpr, formattedResult);
      this.expression = `${historyExpr} =`;
      this.currentInput = formattedResult.toString();
      this.justCalculated = true;

      this.updateDisplay();
    } catch (err) {
      this.triggerShake();
      this.currentInput = 'Error';
      this.updateDisplay();
    }
  }

  safeEvaluate(expr) {
    // Only allow safe math tokens
    if (/[^0-9\+\-\*\/\.\(\)\s\*\*,e]/.test(expr)) {
      throw new Error("Invalid Syntax");
    }
    return Function(`'use strict'; return (${expr})`)();
  }

  stripPrecision(num) {
    return Math.round((num + Number.EPSILON) * 1e12) / 1e12;
  }

  // --- HISTORY MANAGEMENT ---
  addHistory(expr, res) {
    this.history.unshift({
      expr,
      res,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    if (this.history.length > 50) this.history.pop();
    localStorage.setItem('omnicalc_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    if (!this.historyList) return;
    this.historyBadge.innerText = this.history.length;
    this.historyBadge.classList.toggle('hidden', this.history.length === 0);

    if (this.history.length === 0) {
      this.historyList.innerHTML = `<div class="empty-history">No calculations yet.<br><small>Your calculations will appear here.</small></div>`;
      return;
    }

    this.historyList.innerHTML = this.history.map((item, idx) => `
      <div class="history-item" data-index="${idx}">
        <div class="item-expr">${item.expr}</div>
        <div class="item-res">${item.res}</div>
      </div>
    `).join('');

    // Attach click to reuse
    this.historyList.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = el.dataset.index;
        const item = this.history[idx];
        if (item) {
          this.currentInput = item.res.toString();
          this.expression = '';
          this.justCalculated = true;
          this.updateDisplay();
          this.toggleHistory(false);
          this.showToast(`Loaded ${item.res}`);
        }
      });
    });
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('omnicalc_history');
    this.renderHistory();
    this.showToast('History Cleared');
  }

  copyHistory() {
    if (this.history.length === 0) return;
    const text = this.history.map(h => `${h.expr} = ${h.res}`).join('\n');
    navigator.clipboard.writeText(text);
    this.showToast('History copied to clipboard!');
  }

  toggleHistory(force) {
    const isHidden = this.historyDrawer.classList.contains('hidden');
    const show = force !== undefined ? force : isHidden;
    this.historyDrawer.classList.toggle('hidden', !show);
  }

  // --- UNIT CONVERTER ENGINE ---
  initUnitDefinitions() {
    this.units = {
      length: {
        units: [
          { id: 'm', name: 'Meters (m)', factor: 1 },
          { id: 'km', name: 'Kilometers (km)', factor: 1000 },
          { id: 'cm', name: 'Centimeters (cm)', factor: 0.01 },
          { id: 'mm', name: 'Millimeters (mm)', factor: 0.001 },
          { id: 'mi', name: 'Miles (mi)', factor: 1609.344 },
          { id: 'yd', name: 'Yards (yd)', factor: 0.9144 },
          { id: 'ft', name: 'Feet (ft)', factor: 0.3048 },
          { id: 'in', name: 'Inches (in)', factor: 0.0254 }
        ],
        defaultFrom: 'm',
        defaultTo: 'ft'
      },
      weight: {
        units: [
          { id: 'kg', name: 'Kilograms (kg)', factor: 1 },
          { id: 'g', name: 'Grams (g)', factor: 0.001 },
          { id: 'mg', name: 'Milligrams (mg)', factor: 0.000001 },
          { id: 'lb', name: 'Pounds (lbs)', factor: 0.45359237 },
          { id: 'oz', name: 'Ounces (oz)', factor: 0.028349523 },
          { id: 'ton', name: 'Metric Tonnes', factor: 1000 }
        ],
        defaultFrom: 'kg',
        defaultTo: 'lb'
      },
      temperature: {
        units: [
          { id: 'c', name: 'Celsius (°C)' },
          { id: 'f', name: 'Fahrenheit (°F)' },
          { id: 'k', name: 'Kelvin (K)' }
        ],
        defaultFrom: 'c',
        defaultTo: 'f'
      },
      speed: {
        units: [
          { id: 'kmh', name: 'km/h', factor: 1 },
          { id: 'mph', name: 'mph', factor: 1.60934 },
          { id: 'ms', name: 'm/s', factor: 3.6 },
          { id: 'knot', name: 'Knots', factor: 1.852 }
        ],
        defaultFrom: 'kmh',
        defaultTo: 'mph'
      },
      data: {
        units: [
          { id: 'b', name: 'Bytes (B)', factor: 1 },
          { id: 'kb', name: 'Kilobytes (KB)', factor: 1024 },
          { id: 'mb', name: 'Megabytes (MB)', factor: 1048576 },
          { id: 'gb', name: 'Gigabytes (GB)', factor: 1073741824 },
          { id: 'tb', name: 'Terabytes (TB)', factor: 1099511627776 }
        ],
        defaultFrom: 'gb',
        defaultTo: 'mb'
      },
      time: {
        units: [
          { id: 's', name: 'Seconds', factor: 1 },
          { id: 'min', name: 'Minutes', factor: 60 },
          { id: 'h', name: 'Hours', factor: 3600 },
          { id: 'd', name: 'Days', factor: 86400 },
          { id: 'w', name: 'Weeks', factor: 604800 },
          { id: 'y', name: 'Years', factor: 31536000 }
        ],
        defaultFrom: 'h',
        defaultTo: 'min'
      }
    };
  }

  initConverterUI() {
    this.convFromInput = document.getElementById('conv-from-input');
    this.convToInput = document.getElementById('conv-to-input');
    this.convFromSelect = document.getElementById('conv-from-unit');
    this.convToSelect = document.getElementById('conv-to-unit');
    this.convFormula = document.getElementById('conv-formula-text');

    this.populateConverterDropdowns();

    // Event listeners
    this.convFromInput?.addEventListener('input', () => this.calculateConversion());
    this.convFromSelect?.addEventListener('change', () => this.calculateConversion());
    this.convToSelect?.addEventListener('change', () => this.calculateConversion());

    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentCategory = pill.dataset.category;
        this.populateConverterDropdowns();
      });
    });

    document.getElementById('btn-swap-units')?.addEventListener('click', () => {
      const temp = this.convFromSelect.value;
      this.convFromSelect.value = this.convToSelect.value;
      this.convToSelect.value = temp;
      this.calculateConversion();
    });
  }

  populateConverterDropdowns() {
    const cat = this.units[this.currentCategory];
    if (!cat) return;

    const optionsHtml = cat.units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    this.convFromSelect.innerHTML = optionsHtml;
    this.convToSelect.innerHTML = optionsHtml;

    this.convFromSelect.value = cat.defaultFrom || cat.units[0].id;
    this.convToSelect.value = cat.defaultTo || cat.units[1].id;

    this.calculateConversion();
  }

  calculateConversion() {
    const val = parseFloat(this.convFromInput.value);
    if (isNaN(val)) {
      this.convToInput.value = '';
      return;
    }

    const fromId = this.convFromSelect.value;
    const toId = this.convToSelect.value;
    let converted = 0;

    if (this.currentCategory === 'temperature') {
      // Temperature special formulas
      let tempInC = val;
      if (fromId === 'f') tempInC = (val - 32) * (5 / 9);
      if (fromId === 'k') tempInC = val - 273.15;

      if (toId === 'c') converted = tempInC;
      if (toId === 'f') converted = (tempInC * (9 / 5)) + 32;
      if (toId === 'k') converted = tempInC + 273.15;
    } else {
      const cat = this.units[this.currentCategory];
      const fromObj = cat.units.find(u => u.id === fromId);
      const toObj = cat.units.find(u => u.id === toId);

      const baseVal = val * fromObj.factor;
      converted = baseVal / toObj.factor;
    }

    converted = this.stripPrecision(converted);
    this.convToInput.value = converted;

    // Formula footnote
    const fromName = this.convFromSelect.options[this.convFromSelect.selectedIndex].text;
    const toName = this.convToSelect.options[this.convToSelect.selectedIndex].text;
    this.convFormula.innerText = `${val} ${fromName} = ${converted} ${toName}`;
  }

  // --- EVENT BINDINGS ---
  bindEvents() {
    // Mode Switcher Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchMode(btn.dataset.mode);
      });
    });

    // Theme Toggle
    document.getElementById('btn-theme')?.addEventListener('click', () => this.toggleTheme());

    // Sound Mute Toggle
    const soundBtn = document.getElementById('btn-sound');
    soundBtn?.addEventListener('click', () => {
      if (this.audio) {
        const isMuted = this.audio.toggleMute();
        soundBtn.classList.toggle('active', !isMuted);
        soundBtn.querySelector('.btn-icon').innerText = isMuted ? '🔇' : '🔊';
        this.showToast(isMuted ? 'Sound Muted' : 'Sound Enabled');
      }
    });

    // History Toggle & Drawer
    document.getElementById('btn-history-toggle')?.addEventListener('click', () => this.toggleHistory());
    document.getElementById('btn-close-history')?.addEventListener('click', () => this.toggleHistory(false));
    document.getElementById('btn-clear-history')?.addEventListener('click', () => this.clearHistory());
    document.getElementById('btn-copy-history')?.addEventListener('click', () => this.copyHistory());

    // Copy Result Chip
    document.getElementById('btn-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(this.mainDisplay.innerText);
      this.showToast('Copied result to clipboard!');
    });

    // Scientific DEG / RAD toggle
    this.btnDegToggle?.addEventListener('click', () => this.toggleDegRad());

    // Keypad Clicks Delegation
    document.querySelector('.keypad-grid')?.addEventListener('click', (e) => {
      const target = e.target.closest('.key');
      if (!target) return;

      if (target.dataset.key) {
        if (target.dataset.key === '.') {
          this.inputDecimal();
        } else {
          this.inputDigit(target.dataset.key);
        }
      } else if (target.dataset.action) {
        this.handleAction(target.dataset.action);
      }
    });

    // Scientific Keypad Clicks
    document.getElementById('scientific-grid')?.addEventListener('click', (e) => {
      const target = e.target.closest('.key');
      if (!target) return;
      if (target.dataset.action === 'deg-rad') return; // Handled separately
      this.handleScientific(target.dataset.action);
    });

    // Memory Bar Clicks
    document.querySelector('.memory-bar')?.addEventListener('click', (e) => {
      const target = e.target.closest('.mem-btn');
      if (!target) return;
      this.handleMemory(target.dataset.action);
    });
  }

  switchMode(mode) {
    this.mode = mode;
    this.calcApp.classList.toggle('mode-scientific', mode === 'scientific');

    if (mode === 'converter') {
      this.calcView.classList.add('hidden');
      this.converterView.classList.remove('hidden');
    } else {
      this.converterView.classList.add('hidden');
      this.calcView.classList.remove('hidden');

      if (mode === 'scientific') {
        this.scientificGrid.classList.remove('hidden');
        this.modeIndicator.innerText = 'SCI';
      } else {
        this.scientificGrid.classList.add('hidden');
        this.modeIndicator.innerText = 'STD';
      }
    }
  }

  handleAction(action) {
    switch (action) {
      case 'all-clear': this.allClear(); break;
      case 'clear-entry': this.clearEntry(); break;
      case 'backspace': this.backspace(); break;
      case 'negate': this.negate(); break;
      case 'calculate': this.calculate(); break;
      case 'add': this.handleOperator('+', 'add'); break;
      case 'subtract': this.handleOperator('−', 'subtract'); break;
      case 'multiply': this.handleOperator('×', 'multiply'); break;
      case 'divide': this.handleOperator('÷', 'divide'); break;
      case 'percent': this.handleOperator('%', 'percent'); break;
      case 'power': this.handleOperator('^', 'power'); break;
    }
  }

  // --- KEYBOARD BINDINGS ---
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if typing in converter input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        this.flashKey(`[data-key="${key}"]`);
        this.inputDigit(key);
      } else if (key === '.') {
        this.flashKey('[data-key="."]');
        this.inputDecimal();
      } else if (key === '+' || key === '-') {
        const action = key === '+' ? 'add' : 'subtract';
        this.flashKey(`[data-action="${action}"]`);
        this.handleAction(action);
      } else if (key === '*' || key === 'x' || key === 'X') {
        this.flashKey('[data-action="multiply"]');
        this.handleAction('multiply');
      } else if (key === '/') {
        e.preventDefault();
        this.flashKey('[data-action="divide"]');
        this.handleAction('divide');
      } else if (key === '%') {
        this.flashKey('[data-action="percent"]');
        this.handleAction('percent');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        this.flashKey('[data-action="calculate"]');
        this.calculate();
      } else if (key === 'Backspace') {
        this.flashKey('[data-action="backspace"]');
        this.backspace();
      } else if (key === 'Escape') {
        this.flashKey('[data-action="all-clear"]');
        this.allClear();
      } else if (key === '(' || key === ')') {
        this.handleScientific(key === '(' ? 'open-paren' : 'close-paren');
      } else if (key === 'h' || key === 'H') {
        this.toggleHistory();
      } else if (key === 't' || key === 'T') {
        this.toggleTheme();
      } else if (key === 'm' || key === 'M') {
        document.getElementById('btn-sound')?.click();
      }
    });
  }

  flashKey(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 120);
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new CalculatorApp();
});
