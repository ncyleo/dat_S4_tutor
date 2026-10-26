/* DAT 中四設計與應用科技科三欄自學 */
(function () {
  const LS_KEY = 'dat-s4-3col-progress-v1';
  const BANK = window.S4_BANK || window.LOGIC_BANK || { lessons: [], chapters: [], titleZh: '中四設計與應用科技科自學' };
  const LESSONS = BANK.lessons || [];

  let currentId = 'home';
  let practiceChecked = false;
  let hintStep = 0;
  let progress = loadProgress();

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Convert prime Boolean complement (A', (AB＋CD)') to continuous top-bar HTML. Input must already be HTML-escaped (or trusted text without raw <>&). */
  function primeToObar(s) {
    s = String(s == null ? '' : s);
    let out = '';
    let i = 0;
    const n = s.length;
    while (i < n) {
      const ch = s[i];
      if (ch === '(') {
        let depth = 1;
        let j = i + 1;
        while (j < n && depth > 0) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')') depth--;
          j++;
        }
        const inner = s.slice(i + 1, j - 1);
        if (j <= n && s[j - 1] === ')' && j < n && s[j] === "'") {
          let content = '<span class="obar">' + primeToObar(inner) + '</span>';
          j++; // consume first '
          while (j < n && s[j] === "'") {
            content = '<span class="obar">' + content + '</span>';
            j++;
          }
          out += content;
          i = j;
        } else {
          out += '(' + primeToObar(inner) + ')';
          i = j;
        }
      } else if (/[A-Za-z0-9]/.test(ch)) {
        let atom = ch;
        i++;
        while (i < n && s[i] === "'") {
          atom = '<span class="obar">' + atom + '</span>';
          i++;
        }
        out += atom;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  }

  /** Escape plain text then convert primes → .obar spans. */
  function boolHtml(raw) {
    return primeToObar(esc(raw));
  }

  /** Walk trusted HTML: convert primes in text nodes only; do not touch tags. */
  function boolHtmlInTrustedHtml(html) {
    return String(html == null ? '' : html).replace(/(<[^>]*>)|([^<]+)/g, function (m, tag, text) {
      if (tag) return tag;
      return primeToObar(text);
    });
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveProgress() {
    localStorage.setItem(LS_KEY, JSON.stringify(progress));
  }
  function markDone(id) {
    if (!progress.done) progress.done = {};
    progress.done[id] = true;
    saveProgress();
    renderNav();
    updateProgressTag();
  }
  function clearProgress() {
    if (!confirm('確定重置所有進度？')) return;
    progress = {};
    localStorage.removeItem(LS_KEY);
    renderNav();
    updateProgressTag();
    showLesson(currentId);
  }
  function isDone(id) { return !!(progress.done && progress.done[id]); }

  function liveLessons() {
    return LESSONS.filter(l => l.live && l.id !== 'home');
  }
  function progressStats() {
    const live = liveLessons();
    const done = live.filter(l => isDone(l.id)).length;
    return { done, total: live.length };
  }
  function updateProgressTag() {
    const s = progressStats();
    const el = $('progressTag');
    if (el) el.textContent = '已完成 ' + s.done + '／' + s.total;
  }
  function findLesson(id) { return LESSONS.find(l => l.id === id); }
  function lessonIndex(id) { return LESSONS.findIndex(l => l.id === id); }
  function adjacentLive(id, dir) {
    const live = LESSONS.filter(l => l.live);
    const i = live.findIndex(l => l.id === id);
    if (i < 0) return null;
    return live[i + dir] || null;
  }
  function isFirstLivePractice(id) {
    const live = liveLessons();
    return live.length && live[0].id === id;
  }

  function renderNav() {
    const box = $('navList');
    if (!box) return;
    let html = '';
    html += '<button type="button" class="nav-item' + (currentId === 'home' ? ' active' : '') + '" data-id="home">' +
      '<span class="ord">⌂</span><span class="ttl">學習地圖</span></button>';

    const byCh = {};
    LESSONS.forEach(l => {
      if (l.id === 'home') return;
      const ch = l.chapter || 0;
      if (!byCh[ch]) byCh[ch] = [];
      byCh[ch].push(l);
    });
    const chMeta = {};
    (BANK.chapters || []).forEach(c => { chMeta[c.n] = c; });

    Object.keys(byCh).map(Number).sort((a, b) => a - b).forEach(ch => {
      const meta = chMeta[ch] || { name: '第 ' + ch + ' 章' };
      const label = '第 ' + ch + ' 章 · ' + (meta.name || '');
      html += '<div class="nav-ch">' + esc(label) + (meta.soon || !meta.live ? ' · 預告' : '') + '</div>';
      byCh[ch].forEach((l, idx) => {
        const locked = !l.live;
        const active = currentId === l.id ? ' active' : '';
        const star = isDone(l.id) ? '<span class="star">★</span>' : '';
        const soon = locked ? '<span class="soon">即將推出</span>' : '';
        html += '<button type="button" class="nav-item' + active + (locked ? ' locked' : '') + '" data-id="' + esc(l.id) + '"' +
          (locked ? ' data-soon="1"' : '') + '>' +
          '<span class="ord">' + (idx + 1) + '</span>' +
          '<span class="ttl">' + boolHtml(l.nav || l.title) + ' ' + soon + '</span>' + star +
          '</button>';
      });
    });
    box.innerHTML = html;
    box.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        showLesson(id);
      });
    });
  }

  function renderSupport(lesson) {
    const box = $('supportBody');
    if (!box) return;
    if (!lesson) {
      box.innerHTML = '<p class="muted">左欄揀課題 → 中欄睇教學同做練習 → 右欄睇定義、例子同引導提示。</p>';
      return;
    }
    const s = lesson.support || {};
    let html = '';
    html += '<h3>定義</h3><dl class="defs"><dt>' + boolHtml(lesson.title || '') + '</dt><dd>' +
      boolHtml(s.definition || '見中欄教學。') + '</dd></dl>';
    if (s.fig) {
      html += '<div class="fig-def"><img src="' + esc(s.fig) + '" alt="示意"></div>';
    }
    html += '<h3>範例</h3><div class="hint-card"><div class="hint-lab">例子</div>' +
      boolHtml(s.example || '跟中欄示範。') + '</div>';
    if (s.tip) {
      html += '<h3>溫習口訣</h3><div class="hint-card"><div class="hint-lab">記住</div>' +
        boolHtml(s.tip) + '</div>';
    }
    const hints = Array.isArray(s.guidedHints) ? s.guidedHints.filter(Boolean) : [];
    html += '<h3>引導提示</h3><p class="muted">提示係引導問題，唔會直接講出本題答案。撳中欄「提示」逐步解鎖。</p>';
    if (!lesson.live) {
      html += '<p class="muted">呢章已預留，今輪未開放練習。</p>';
    } else if (!hints.length) {
      html += '<div class="hint-card"><div class="hint-lab">提示</div>先睇定義同範例，再問自己：已知邊啲？要求邊個？</div>';
    } else {
      hints.forEach((text, i) => {
        const show = hintStep > i;
        html += '<div class="hint-card ' + (show ? 'open' : 'locked') + '">' +
          '<div class="hint-lab">提示 ' + (i + 1) + (show ? '' : '（未解鎖）') + '</div>' +
          (show ? '<div>' + boolHtml(text) + '</div>' : '<div class="muted">再撳「提示」解鎖</div>') +
          '</div>';
      });
    }
    if (lesson.pill) {
      html += '<p class="muted" style="margin-top:.8rem">標籤：' + esc(lesson.pill) +
        (lesson.live ? '' : ' · 即將推出') + '</p>';
    }
    box.innerHTML = html;
  }

  function renderHome() {
    const s = progressStats();
    const pct = s.total ? Math.round(100 * s.done / s.total) : 0;
    let html = '<div class="welcome"><h2>' + esc(BANK.titleZh || '中四設計與應用科技科自學') + '</h2>';
    html += '<p>左欄自由揀課；中欄短講＋ Try it；右欄「定義 · 範例 · 引導提示」（撳「提示」逐步解鎖）。</p>';
    html += '<div class="progress-bar"><span style="width:' + pct + '%"></span></div>';
    html += '<p class="muted">進度：' + s.done + '／' + s.total + '（' + pct + '%）</p>';
    html += '<div class="map-grid">';
    (BANK.chapters || []).forEach(c => {
      const live = !!c.live;
      const nDone = LESSONS.filter(l => l.chapter === c.n && l.live && isDone(l.id)).length;
      const nLive = LESSONS.filter(l => l.chapter === c.n && l.live).length;
      html += '<button type="button" class="map-card' + (live ? ' live' : '') + '" data-ch="' + c.n + '"' +
        (live ? '' : ' disabled') + '>' +
        '<span class="num">CHAPTER ' + c.n + '</span>' +
        '<span class="name">' + esc(c.name) + '</span>' +
        '<span class="state">' + (live ? ('可學 · ' + nDone + '/' + nLive) : '即將推出') + '</span></button>';
    });
    html += '</div></div>';
    return html;
  }

  function bitToggleHtml(cls, rowAttr) {
    return '<button type="button" class="' + cls + '" ' + rowAttr + ' data-val="">?</button>';
  }

  function renderPractice(lesson) {
    const pr = lesson.practice;
    if (!pr) return '';
    let body = '';

    if (pr.type === 'mcq') {
      body += '<p class="try-note">' + boolHtml(pr.prompt) + '</p><div class="mcq-opts" id="mcqOpts">';
      pr.choices.forEach((c, i) => {
        body += '<label><input type="radio" name="mcq" value="' + i + '"><span>' + boolHtml(c) + '</span></label>';
      });
      body += '</div>';
    } else if (pr.type === 'fill') {
      body += '<p class="try-note">' + boolHtml(pr.prompt) + '</p><div class="fill-fields" id="fillFields">';
      (pr.fields || []).forEach((f, i) => {
        body += '<div class="fill-row"><label for="fill_' + i + '">' + boolHtml(f.label || ('欄'+(i+1))) + '</label>' +
          '<input type="text" id="fill_' + i + '" data-idx="' + i + '" autocomplete="off" placeholder="' + esc(f.placeholder || '輸入答案') + '"></div>';
      });
      body += '</div>';
      if (pr.note) body += '<p class="muted">' + boolHtml(pr.note) + '</p>';
    } else if (pr.type === 'match') {
      body += '<p class="try-note">' + boolHtml(pr.prompt) + '</p><div class="match-list" id="matchList">';
      const opts = pr.options || [];
      (pr.items || []).forEach((it, i) => {
        body += '<div class="match-row"><span class="m-left">' + boolHtml(it.text || it) + '</span>' +
          '<select data-idx="' + i + '"><option value="">— 揀配對 —</option>';
        opts.forEach((o, oi) => {
          body += '<option value="' + oi + '">' + boolHtml(o) + '</option>';
        });
        body += '</select></div>';
      });
      body += '</div>';
    } else if (pr.type === 'truth') {
      body += renderTruthBlock(pr, 'ttFill');
    } else if (pr.type === 'kmap') {
      body += '<p class="try-note">' + boolHtml(pr.prompt) + '</p>';
      body += '<div class="kmap-wrap" id="kmapWrap">';
      body += '<table class="kmap-grid" id="kmapGrid"><thead><tr><th class="kmap-corner"></th>';
      (pr.colLabels || []).forEach(h => { body += '<th>' + boolHtml(h) + '</th>'; });
      body += '</tr></thead><tbody>';
      const R = pr.rows || 2, C = pr.cols || 2;
      for (let r = 0; r < R; r++) {
        body += '<tr><th>' + boolHtml((pr.rowLabels || [])[r] || '') + '</th>';
        for (let c = 0; c < C; c++) {
          const i = r * C + c;
          const id = (pr.cellIds && pr.cellIds[i]) ? pr.cellIds[i] : ('c' + i);
          body += '<td class="kmap-cell"><button type="button" class="kbit" data-idx="' + i +
            '" data-val="" title="' + esc(id) + '">?</button></td>';
        }
        body += '</tr>';
      }
      body += '</tbody></table>';
      body += '<p class="kmap-hint">撳格：? → 0 → 1。軸標已用 Gray code。</p>';
      if (pr.readChoices && pr.readChoices.length) {
        body += '<p class="try-note" style="margin-top:.75rem">' + boolHtml(pr.readPrompt || '化簡後 F 係？') + '</p>';
        body += '<div class="mcq-opts" id="kmapReadOpts">';
        pr.readChoices.forEach((ch, i) => {
          body += '<label><input type="radio" name="kmapRead" value="' + i + '"><span>' + boolHtml(ch) + '</span></label>';
        });
        body += '</div>';
      }
      body += '</div>';
    } else if (pr.type === 'design') {
      body += '<p class="try-note"><strong>情境：</strong>' + boolHtml(pr.scenario || pr.prompt || '') + '</p>';
      (pr.steps || []).forEach((st, si) => {
        body += '<div class="design-step" data-step="' + si + '">';
        body += '<div class="step-lab">步驟 ' + (si + 1) + '</div>';
        if (st.kind === 'mcq') {
          body += '<p class="try-note">' + boolHtml(st.prompt) + '</p>';
          body += '<div class="mcq-opts" id="designMcq' + si + '">';
          (st.choices || []).forEach((c, i) => {
            body += '<label><input type="radio" name="designMcq' + si + '" value="' + i + '"><span>' + boolHtml(c) + '</span></label>';
          });
          body += '</div>';
        } else if (st.kind === 'truth') {
          body += renderTruthBlock(st, 'designTt' + si);
        }
        body += '</div>';
      });
    }

    const first = isFirstLivePractice(lesson.id);
    body += '<div class="btn-row">' +
      '<button type="button" class="btn btn-ghost" id="prevBtn"' +
      (first ? ' disabled title="已經係第一題"' : '') + '>上一題</button>' +
      '<button type="button" class="btn btn-ghost" id="hintBtn">提示</button>' +
      '<button type="button" class="btn btn-primary" id="checkBtn">檢查答案</button>' +
      '<button type="button" class="btn btn-ghost" id="retryBtn">重試</button>' +
      '<button type="button" class="btn btn-secondary" id="nextBtn">下一題</button>' +
      '</div>';
    body += '<div class="status info" id="practiceStatus"></div>';
    body += '<div id="explainBox" style="display:none" class="tip"></div>';
    return '<div class="tryit"><h3>Try it · 練習</h3>' + body + '</div>';
  }

  function renderTruthBlock(pr, tableId) {
    let body = '<p class="try-note">' + boolHtml(pr.prompt) + '</p>';
    body += '<table class="tt-fill" id="' + tableId + '"><thead><tr>';
    (pr.inputs || []).forEach(h => { body += '<th>' + boolHtml(h) + '</th>'; });
    body += '<th>F</th></tr></thead><tbody>';
    (pr.rows || []).forEach((row, ri) => {
      body += '<tr data-row="' + ri + '">';
      row.forEach(v => { body += '<td>' + v + '</td>'; });
      body += '<td class="fcell"><button type="button" class="bit" data-row="' + ri + '" data-val="">?</button></td>';
      body += '</tr>';
    });
    body += '</tbody></table>';
    body += '<p style="font-size:.8rem;color:#64748b">撳 F 欄喺 ? → 0 → 1 之間切換。</p>';
    return body;
  }

  function bindBitButtons(selector) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        if (practiceChecked) return;
        const cur = btn.getAttribute('data-val');
        let next = '';
        if (cur === '') next = '0';
        else if (cur === '0') next = '1';
        else next = '';
        btn.setAttribute('data-val', next);
        btn.textContent = next === '' ? '?' : next;
        btn.classList.toggle('on', next === '1');
        btn.classList.toggle('off', next === '0');
      });
    });
  }

  function checkTruthTable(tableSel, answers) {
    const bits = document.querySelectorAll(tableSel + ' button.bit');
    let allFilled = true, allOk = true;
    bits.forEach(btn => {
      const ri = +btn.getAttribute('data-row');
      const val = btn.getAttribute('data-val');
      const td = btn.parentElement;
      td.classList.remove('cell-ok', 'cell-bad', 'cell-miss');
      if (val === '') {
        allFilled = false; allOk = false; td.classList.add('cell-miss');
        btn.textContent = '?→' + answers[ri];
      } else if (+val === answers[ri]) {
        td.classList.add('cell-ok');
      } else {
        allOk = false; td.classList.add('cell-bad');
        btn.textContent = val + '→' + answers[ri];
      }
    });
    return { allFilled, allOk };
  }

  function bindPractice(lesson) {
    const pr = lesson.practice;
    if (!pr) return;
    practiceChecked = false;
    const maxHints = ((lesson.support && lesson.support.guidedHints) || []).length || 3;

    if (pr.type === 'kmap') bindBitButtons('#kmapGrid button.kbit');
    if (pr.type === 'truth') bindBitButtons('#ttFill button.bit');
    if (pr.type === 'design') {
      bindBitButtons('.design-step button.bit');
    }

    const status = $('practiceStatus');
    const explain = $('explainBox');

    const hintBtn = $('hintBtn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        hintStep = Math.min(hintStep + 1, maxHints);
        renderSupport(lesson);
      });
    }

    $('checkBtn').addEventListener('click', () => {
      if (pr.type === 'mcq') {
        const sel = document.querySelector('input[name="mcq"]:checked');
        if (!sel) {
          status.textContent = '請先揀一個選項。';
          status.className = 'status info';
          return;
        }
        const idx = +sel.value;
        document.querySelectorAll('#mcqOpts label').forEach((lb, i) => {
          lb.classList.remove('correct-mark', 'wrong-mark');
          if (i === pr.answer) lb.classList.add('correct-mark');
          else if (i === idx && idx !== pr.answer) lb.classList.add('wrong-mark');
        });
        practiceChecked = true;
        if (idx === pr.answer) {
          status.textContent = '正確！★';
          status.className = 'status ok';
          markDone(lesson.id);
        } else {
          status.textContent = '未啱。試撳「提示」睇引導問題，再答一次。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        }
        explain.style.display = 'block';
        explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
      } else if (pr.type === 'fill') {
        function norm(s) {
          return String(s || '').trim().toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[－—–]/g, '-')
            .replace(/（/g, '(').replace(/）/g, ')');
        }
        let allOk = true, allFilled = true;
        (pr.fields || []).forEach((f, i) => {
          const inp = document.getElementById('fill_' + i);
          if (!inp) return;
          const val = norm(inp.value);
          if (!val) { allFilled = false; allOk = false; inp.style.borderColor = '#f59e0b'; return; }
          const accepted = (f.accepted || [f.answer]).map(norm);
          if (accepted.includes(val)) {
            inp.style.borderColor = '#10b981';
            inp.style.background = '#ecfdf5';
          } else {
            allOk = false;
            inp.style.borderColor = '#f87171';
            inp.style.background = '#fef2f2';
          }
        });
        practiceChecked = true;
        if (!allFilled) {
          status.textContent = '請填齊所有欄（橙色＝未填）。';
          status.className = 'status info';
        } else if (allOk) {
          status.textContent = '全對！★';
          status.className = 'status ok';
          markDone(lesson.id);
        } else {
          status.textContent = '有欄未啱（紅色）。試撳「提示」再諗；用詞可稍簡，意思要啱。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        }
        explain.style.display = 'block';
        explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
      } else if (pr.type === 'match') {
        let allOk = true, allFilled = true;
        const sels = document.querySelectorAll('#matchList select');
        sels.forEach((sel) => {
          const i = +sel.getAttribute('data-idx');
          const v = sel.value;
          const row = sel.closest('.match-row');
          if (v === '') { allFilled = false; allOk = false; if (row) row.style.borderColor = '#f59e0b'; return; }
          if (+v === (pr.answers || [])[i]) {
            if (row) { row.style.borderColor = '#10b981'; row.style.background = '#ecfdf5'; }
          } else {
            allOk = false;
            if (row) { row.style.borderColor = '#f87171'; row.style.background = '#fef2f2'; }
          }
        });
        practiceChecked = true;
        if (!allFilled) {
          status.textContent = '請完成所有配對。';
          status.className = 'status info';
        } else if (allOk) {
          status.textContent = '配對全對！★';
          status.className = 'status ok';
          markDone(lesson.id);
        } else {
          status.textContent = '有配對未啱。試撳「提示」再諗。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        }
        explain.style.display = 'block';
        explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
      } else if (pr.type === 'truth') {
        const r = checkTruthTable('#ttFill', pr.answers);
        practiceChecked = true;
        if (!r.allFilled) {
          status.textContent = '有格請填 0 或 1（黃色＝未填）。已標出正確值供對照。';
          status.className = 'status info';
        } else if (r.allOk) {
          status.textContent = '真值表全對！★';
          status.className = 'status ok';
          markDone(lesson.id);
        } else {
          status.textContent = '有格唔啱（紅色）。試撳「提示」再諗。綠色＝正確；箭嘴顯示應填值。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        }
        explain.style.display = 'block';
        explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
      } else if (pr.type === 'kmap') {
        const bits = document.querySelectorAll('#kmapGrid button.kbit');
        let allFilled = true, fillOk = true;
        bits.forEach(btn => {
          const i = +btn.getAttribute('data-idx');
          const val = btn.getAttribute('data-val');
          const td = btn.parentElement;
          td.classList.remove('cell-ok', 'cell-bad', 'cell-miss');
          if (val === '') {
            allFilled = false; fillOk = false; td.classList.add('cell-miss');
            btn.textContent = '?→' + pr.answers[i];
          } else if (+val === pr.answers[i]) {
            td.classList.add('cell-ok');
          } else {
            fillOk = false; td.classList.add('cell-bad');
            btn.textContent = val + '→' + pr.answers[i];
          }
        });
        let readOk = true;
        const readNeeded = !!(pr.readChoices && pr.readChoices.length);
        if (readNeeded) {
          const sel = document.querySelector('input[name="kmapRead"]:checked');
          const labels = document.querySelectorAll('#kmapReadOpts label');
          if (!sel) {
            status.textContent = '請填完格，並揀簡式選項。';
            status.className = 'status info';
            practiceChecked = true;
            explain.style.display = 'block';
            explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
            return;
          }
          const idx = +sel.value;
          labels.forEach((lb, i) => {
            lb.classList.remove('correct-mark', 'wrong-mark');
            if (i === pr.readAnswer) lb.classList.add('correct-mark');
            else if (i === idx && idx !== pr.readAnswer) lb.classList.add('wrong-mark');
          });
          readOk = idx === pr.readAnswer;
        }
        practiceChecked = true;
        if (!allFilled) {
          status.textContent = '有格未填（黃色）。已標出應填值。';
          status.className = 'status info';
        } else if (fillOk && readOk) {
          status.textContent = 'K-map 全對！★';
          status.className = 'status ok';
          markDone(lesson.id);
        } else if (fillOk && !readOk) {
          status.textContent = '填格啱，簡式未啱——試撳「提示」再諗。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        } else {
          status.textContent = '填格有誤（紅色）。試撳「提示」再諗。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        }
        explain.style.display = 'block';
        explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
      } else if (pr.type === 'design') {
        let allOk = true;
        let msgParts = [];
        (pr.steps || []).forEach((st, si) => {
          if (st.kind === 'mcq') {
            const sel = document.querySelector('input[name="designMcq' + si + '"]:checked');
            const labels = document.querySelectorAll('#designMcq' + si + ' label');
            if (!sel) {
              allOk = false;
              msgParts.push('步驟' + (si + 1) + '未揀');
              return;
            }
            const idx = +sel.value;
            labels.forEach((lb, i) => {
              lb.classList.remove('correct-mark', 'wrong-mark');
              if (i === st.answer) lb.classList.add('correct-mark');
              else if (i === idx && idx !== st.answer) lb.classList.add('wrong-mark');
            });
            if (idx !== st.answer) {
              allOk = false;
              msgParts.push('步驟' + (si + 1) + '未啱');
            }
          } else if (st.kind === 'truth') {
            const r = checkTruthTable('#designTt' + si, st.answers);
            if (!r.allFilled || !r.allOk) {
              allOk = false;
              msgParts.push('步驟' + (si + 1) + '真值表');
            }
          }
        });
        practiceChecked = true;
        if (allOk) {
          status.textContent = '選閘解題全對！★';
          status.className = 'status ok';
          markDone(lesson.id);
        } else {
          status.textContent = '未完成或有錯：' + (msgParts.join('、') || '請檢查') + '。試撳「提示」。';
          status.className = 'status err';
          if (hintStep < 1) { hintStep = 1; renderSupport(lesson); }
        }
        explain.style.display = 'block';
        explain.innerHTML = '<strong>講解：</strong>' + boolHtml(pr.explain || '');
      }
    });

    $('retryBtn').addEventListener('click', () => {
      practiceChecked = false;
      showLesson(lesson.id);
    });
    const prevBtn = $('prevBtn');
    if (prevBtn && !prevBtn.disabled) {
      prevBtn.addEventListener('click', () => {
        const prev = adjacentLive(lesson.id, -1);
        if (prev) showLesson(prev.id);
      });
    }
    $('nextBtn').addEventListener('click', () => {
      const next = adjacentLive(lesson.id, 1);
      if (next) showLesson(next.id);
      else showLesson('home');
    });
  }

  function showLesson(id) {
    currentId = id;
    hintStep = 0;
    practiceChecked = false;
    const lesson = findLesson(id);
    const mid = $('practiceBody');
    renderNav();
    updateProgressTag();

    if (!lesson) {
      mid.innerHTML = '<p>找不到課題。</p>';
      renderSupport(null);
      return;
    }

    if (id === 'home') {
      mid.innerHTML = renderHome();
      mid.querySelectorAll('.map-card[data-ch]').forEach(card => {
        card.addEventListener('click', () => {
          const ch = +card.getAttribute('data-ch');
          const first = LESSONS.find(l => l.chapter === ch && l.live);
          if (first) showLesson(first.id);
        });
      });
      renderSupport(lesson);
      return;
    }

    const pill = lesson.pill ? '<span class="pill">' + esc(lesson.pill) + '</span> ' : '';
    let html = '<h2 class="stem">' + pill + boolHtml(lesson.title) + '</h2>';
    html += '<div class="teach">' + boolHtmlInTrustedHtml(lesson.teach || '') + '</div>';
    if (!lesson.live) {
      html += '<div class="tip">呢課尚未開放練習。可先溫習其他已上線章節。</div>';
    } else {
      html += renderPractice(lesson);
    }
    html += '<div class="btn-row nav-lesson">';
    const i = lessonIndex(id);
    const prev = i > 0 ? LESSONS[i - 1] : null;
    const next = LESSONS.slice(i + 1).find(l => l.live || l.soon);
    if (prev && prev.id !== 'home') {
      html += '<button type="button" class="btn btn-ghost" id="prevLesson">← ' + boolHtml(prev.nav) + '</button>';
    } else {
      html += '<button type="button" class="btn btn-ghost" id="prevLesson">← 地圖</button>';
    }
    if (next) html += '<button type="button" class="btn btn-ghost" id="nextLesson">' + boolHtml(next.nav) + ' →</button>';
    html += '</div>';

    mid.innerHTML = html;
    if (lesson.live && lesson.practice) bindPractice(lesson);
    renderSupport(lesson);

    const goPrev = $('prevLesson');
    if (goPrev) goPrev.addEventListener('click', () => {
      if (prev && prev.id !== 'home') showLesson(prev.id);
      else showLesson('home');
    });
    const goNext = $('nextLesson');
    if (goNext && next) goNext.addEventListener('click', () => showLesson(next.id));
  }

  /* lightbox */
  function openLightbox(src, alt) {
    const lb = $('imgLightbox');
    const img = $('lightboxImg');
    img.src = src;
    img.alt = alt || '放大圖';
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
  }
  function closeLightbox() {
    const lb = $('imgLightbox');
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    $('lightboxImg').src = '';
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.closest('#practiceBody, #supportBody')) {
      if (t.closest('.lightbox')) return;
      openLightbox(t.src, t.alt);
      return;
    }
    if (t && (t.id === 'imgLightbox' || t.id === 'btnCloseLightbox' || t.id === 'lightboxImg')) {
      closeLightbox();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  $('btnToggleLeft').addEventListener('click', () => {
    document.body.classList.toggle('hide-left');
    $('btnToggleLeft').textContent = document.body.classList.contains('hide-left') ? '顯示目錄' : '隱藏目錄';
  });
  $('btnToggleRight').addEventListener('click', () => {
    document.body.classList.toggle('hide-right');
    $('btnToggleRight').textContent = document.body.classList.contains('hide-right') ? '顯示支援' : '隱藏支援';
  });
  $('btnReset').addEventListener('click', clearProgress);

  if (BANK.uiNoteZh) {
    const c = $('creditLine');
    if (c) c.textContent = BANK.uiNoteZh;
  }

  if (!LESSONS.length) {
    $('practiceBody').innerHTML = '<p class="status err">未能載入 lessons。請確認 lessons-data.js 存在。</p>';
    return;
  }
  renderNav();
  updateProgressTag();
  showLesson('home');
})();
