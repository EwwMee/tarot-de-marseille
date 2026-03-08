// ─── STATE ───
let lang = 'fr';
let selectedSpread = null;
let slots = [];
let activeSlotIndex = null;
let chatHistory = [];
let readingContext = '';
let groqKey = '';

const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── HELPERS ───
function t() { return L[lang]; }
function $(id) { return document.getElementById(id); }
function $q(sel) { return document.querySelector(sel); }

// ─── LANG ───
function setLang(l) {
  lang = l;
  try { localStorage.setItem('tarot_lang', l); } catch (e) { }
  $('btn-lang-fr').classList.toggle('active', l === 'fr');
  $('btn-lang-pt').classList.toggle('active', l === 'pt');
  const T = t();

  const map = {
    'site-sub': T.site_sub,
    'btn-analyze': T.analyze,
    'btn-shuffle': T.shuffle,
    'shuffle-note': T.shuffle_note,
    'question-optional': T.question_optional,
    'chat-send': T.chat_send,
    'm-title-kws': T.m_kws,
    'm-title-up': T.m_up,
    'm-title-rev': T.m_rev,
    'm-title-sym': T.m_sym,
    'm-title-dom': T.m_dom,
  };
  Object.entries(map).forEach(([id, val]) => { const el = $(id); if (el) el.textContent = val; });

  const phMap = {
    'user-name-input': T.name_ph,
    'groq-key-input': T.key_ph,
    'question-input': T.question_ph,
    'chat-input': T.chat_ph,
  };
  Object.entries(phMap).forEach(([id, ph]) => { const el = $(id); if (el) el.placeholder = ph; });

  const qMap = {
    '[onclick="startSession()"]': T.start_btn,
    '[onclick="endSession()"]': T.end_btn,
    '.api-banner-title': T.session_title,
    '.api-note': T.session_note,
    '.chat-header-title': T.deepen_title,
    '.chat-header-desc': T.deepen_desc,
    '#step1 .section-label': T.choose,
    '#screen-arcanes .section-label': T.lib_title,
  };
  Object.entries(qMap).forEach(([sel, val]) => { const el = $q(sel); if (el) el.textContent = val; });

  const navTabs = document.querySelectorAll('.nav-tab');
  if (navTabs[0]) navTabs[0].textContent = T.nav_tirage;
  if (navTabs[1]) navTabs[1].textContent = T.nav_arcanes;

  buildSpreads();
  buildLibrary();
}

// ─── SESSION ───
function startSession() {
  const name = $('user-name-input').value.trim();
  const raw = $('groq-key-input').value;
  const key = raw.replace(/[\s\u00a0\u200b\ufeff]/g, '');
  const st = $('groq-status');
  if (!name) { st.textContent = t().err_name; st.className = 'api-status err'; st.style.display = 'block'; return; }
  if (key.length < 10) { st.textContent = t().err_key; st.className = 'api-status err'; st.style.display = 'block'; return; }
  groqKey = key;
  try { localStorage.setItem('groq_key', key); localStorage.setItem('groq_name', name); } catch (e) { }
  activateSession(name);
  if(document.getElementById('daily-text')) {
  loadDailyReading();
}
}

function activateSession(name) {
  $('api-banner').style.display = 'none';
  const bar = $('session-bar');
  bar.style.display = 'flex';
  $('session-name').textContent = name;
}

function endSession() {
  try { localStorage.removeItem('groq_key'); localStorage.removeItem('groq_name'); } catch (e) { }
  groqKey = '';
  $('session-bar').style.display = 'none';
  $('api-banner').style.display = 'block';
  $('user-name-input').value = '';
  $('groq-key-input').value = '';
  $('groq-status').style.display = 'none';
  goStep1();
}

function loadSavedSession() {
  try {
    const savedLang = localStorage.getItem('tarot_lang');
    if (savedLang === 'fr' || savedLang === 'pt') { lang = savedLang; setLang(savedLang); }
    const key = localStorage.getItem('groq_key');
    const name = localStorage.getItem('groq_name');
    if (key && key.length > 10 && name) { groqKey = key; activateSession(name); }
  } catch (e) { }

try {
  const saved = localStorage.getItem('tarot_theme');
  if(saved === 'dark') {
    document.body.classList.add('dark');
    const btn = document.getElementById('theme-btn');
    if(btn) btn.textContent = '☾';
  } else if(saved === 'light') {
    // forcé clair, rien à faire
  } else {
    // pas de préférence sauvegardée — suit le système
    if(window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
      const btn = document.getElementById('theme-btn');
      if(btn) btn.textContent = '☾';
    }
  }
} catch(e) {}
}

// ─── GROQ API ───
async function callGroq(messages) {
  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
      body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 1200, temperature: 0.7 })
    });
  } catch (e) {
    throw new Error('Fetch failed: ' + e.message);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Bad response: ' + text.substring(0, 200)); }
  if (!res.ok) throw new Error((data.error && data.error.message) || 'HTTP ' + res.status + ' ' + text.substring(0, 200));
  return data.choices[0].message.content;
}

// ─── BUILD UI ───
function buildSpreads() {
  const spreads = t().spreads;
  $('spreads-list').innerHTML = spreads.map((s, i) => `
    <div class="spread-row" onclick="selectSpread(${i})">
      <div class="spread-row-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="spread-row-body"><div class="spread-row-name">${s.name}</div><div class="spread-row-meta">${s.desc}</div></div>
      <div class="spread-row-count">${t().cards(s.count)}</div>
    </div>`).join('');
}

function buildLibrary() {
  $('lib-grid').innerHTML = ARCANES.map((a, i) => {
    const kws = (lang === 'pt' ? ARCANES_PT[i] : a).keywords;
    return '<div class="lib-row" onclick="openModal(' + i + ')">'
      + '<div class="lib-num">' + a.roman + '</div><div class="lib-name">' + a.name + '</div>'
      + '<div class="lib-kws">' + kws.map(k => '<span class="lib-kw">' + k + '</span>').join('') + '</div>'
      + '</div>';
  }).join('');
}

// ─── SPREAD NAVIGATION ───
function selectSpread(i) {
  selectedSpread = t().spreads[i];
  slots = selectedSpread.positions.map(() => ({ arcanaIndex: null, reversed: false }));
  $('step1').style.display = 'none';
  $('step2').style.display = 'block';
  $('step2-label').textContent = selectedSpread.name;
  $('step2-desc').textContent = selectedSpread.desc;
  renderAll();
  window.scrollTo(0, 0);
}

function goStep1() {
  selectedSpread = null; slots = []; chatHistory = []; readingContext = '';
  $('step3').style.display = 'none';
  $('step2').style.display = 'none';
  $('step1').style.display = 'block';
  window.scrollTo(0, 0);
}

// ─── SHUFFLE ANIMATION ───
function shuffleDraw() {
  const layout = $('spread-layout');
  const vcards = Array.from(layout.querySelectorAll('.vcard'));
  if (!vcards.length) return;

  layout.style.position = 'relative';
  const cx = layout.offsetWidth / 2 - 39;
  const cy = layout.offsetHeight / 2 - 63;

  const cardA = document.createElement('div');
  const cardB = document.createElement('div');
  [cardA, cardB].forEach((c, ii) => {
    c.className = 'vcard filled';
    c.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;height:100%;">
        <span style="font-family:var(--font);font-size:6.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tint);">TAROT</span>
        <span style="font-family:var(--font);font-size:5.5px;font-weight:400;letter-spacing:2.5px;text-transform:uppercase;color:var(--tint);opacity:.6;">do</span>
        <span style="font-family:var(--font);font-size:6.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tint);">MĒCAS</span>
      </div>`;
    c.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;pointer-events:none;z-index:${ii + 2};opacity:0;transition:opacity .15s;`;
    layout.appendChild(c);
  });

  vcards.forEach(v => { v.style.opacity = '0'; v.style.transition = 'opacity .2s'; });
  setTimeout(() => { cardA.style.opacity = '1'; cardB.style.opacity = '1'; }, 50);

  const passes = 6, passDur = 280;
  for (let p = 0; p < passes; p++) {
    const even = p % 2 === 0;
    setTimeout(() => {
      cardA.style.transition = `transform ${passDur}ms cubic-bezier(.4,0,.2,1)`;
      cardB.style.transition = `transform ${passDur}ms cubic-bezier(.4,0,.2,1)`;
      const offset = 12, rot = 8;
      if (even) {
        cardA.style.transform = `translateX(${offset}px) rotate(${rot}deg)`; cardA.style.zIndex = '5';
        cardB.style.transform = `translateX(-${offset}px) rotate(-${rot}deg)`; cardB.style.zIndex = '4';
      } else {
        cardA.style.transform = `translateX(-${offset}px) rotate(-${rot}deg)`; cardA.style.zIndex = '4';
        cardB.style.transform = `translateX(${offset}px) rotate(${rot}deg)`; cardB.style.zIndex = '5';
      }
    }, p * passDur);
  }

  const totalDur = passes * passDur + 200;
  setTimeout(() => {
    cardA.style.opacity = '0'; cardB.style.opacity = '0';
    setTimeout(() => { cardA.remove(); cardB.remove(); layout.style.position = ''; }, 200);

    const n = slots.length;
    const indices = Array.from({ length: 22 }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    slots = indices.slice(0, n).map(idx => ({ arcanaIndex: idx, reversed: Math.random() < .3 }));
    renderAll();

    setTimeout(() => {
      document.querySelectorAll('#spread-layout .vcard.filled').forEach((el, i) => {
        el.style.opacity = '0'; el.style.transform = 'translateY(-16px) scale(.95)'; el.style.transition = 'none';
        void el.offsetWidth;
        el.style.transition = `opacity .3s ${i * 55}ms ease, transform .3s ${i * 55}ms cubic-bezier(.34,1.4,.64,1)`;
        el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)';
        setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; }, i * 55 + 350);
      });
    }, 50);
  }, totalDur);
}

// ─── RENDER ───
function renderAll() {
  renderVisualLayout();
  renderPositionList();
  $('btn-analyze').disabled = slots.some(s => s.arcanaIndex === null);
}

function renderVisualLayout() {
  const layout = selectedSpread.layout;
  const el = $('spread-layout');
  el.innerHTML = ''; el.removeAttribute('style');

  if (layout.type === 'vertical') {
    el.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:center;';
    el.innerHTML = slots.map((_, i) => vcardHTML(i)).join('');
    return;
  }
  if (layout.type === 'fer') { renderFer(el); return; }
  if (layout.type === 'amour') { renderAmour(el); return; }

  el.style.cssText = `display:grid;grid-template-columns:repeat(${layout.cols},78px);grid-template-rows:repeat(${layout.rows},126px);gap:10px;`;
  const map = {};
  layout.slots.forEach((p, i) => map[`${p.c},${p.r}`] = i);
  let h = '';
  for (let r = 1; r <= layout.rows; r++) {
    for (let c = 1; c <= layout.cols; c++) {
      const k = `${c},${r}`;
      h += k in map
        ? `<div style="grid-column:${c};grid-row:${r};">${vcardHTML(map[k])}</div>`
        : `<div style="grid-column:${c};grid-row:${r};" class="vghost"></div>`;
    }
  }
  el.innerHTML = h;
}

function renderFer(el) {
  const arcRow = [1, 1, 2, 2, 2, 1, 1];
  el.style.cssText = 'display:grid;grid-template-columns:repeat(7,78px);grid-template-rows:126px 40px 126px;gap:10px;';
  el.innerHTML = Array.from({ length: 7 }, (_, i) =>
    `<div style="grid-column:${i + 1};grid-row:${arcRow[i] === 1 ? 1 : 3};">${vcardHTML(i)}</div>`).join('');
}

function renderAmour(el) {
  el.style.cssText = 'display:grid;grid-template-columns:repeat(3,78px);grid-template-rows:repeat(3,126px);gap:10px;';
  const pos = [{ c: 1, r: 1, i: 0 }, { c: 3, r: 1, i: 1 }, { c: 2, r: 1, i: 2 }, { c: 2, r: 2, i: 3 }, { c: 2, r: 3, i: 4 }];
  const used = {}; pos.forEach(p => used[`${p.c},${p.r}`] = p.i);
  let h = '';
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      const k = `${c},${r}`;
      h += k in used ? `<div style="grid-column:${c};grid-row:${r};">${vcardHTML(used[k])}</div>`
        : `<div style="grid-column:${c};grid-row:${r};" class="vghost"></div>`;
    }
  }
  el.innerHTML = h;
}

function vcardHTML(i) {
  const slot = slots[i];
  const pos = selectedSpread.positions[i];
  const lbl = pos.split('—')[0].trim();
  const filled = slot.arcanaIndex !== null;
  const a = filled ? ARCANES[slot.arcanaIndex] : null;
  return `<div class="vcard${filled ? ' filled' : ''}${filled && slot.reversed ? ' reversed-v' : ''}" onclick="openPicker(${i})" title="${lbl}">
    ${filled
      ? `${slot.reversed ? '<div class="vcard-rev-mark">↑</div>' : ''}
         <div class="vcard-num">${a.roman}</div>
         <div class="vcard-svg">${ARCANA_SVG[slot.arcanaIndex]}</div>
         <div class="vcard-name">${a.name}</div>`
      : `<div class="vcard-pos-num">${i + 1}</div>
         <div class="vcard-empty-line"></div>
         <div class="vcard-pos">${lbl}</div>
         <div class="vcard-empty-line"></div>`
    }
  </div>`;
}

function renderPositionList() {
  $('positions-list').innerHTML = slots.map((slot, i) => {
    const pos = selectedSpread.positions[i];
    const parts = pos.split('—');
    const filled = slot.arcanaIndex !== null;
    const a = filled ? ARCANES[slot.arcanaIndex] : null;
    return `<div class="position-slot">
      <div class="pos-label-block">
        <div class="pos-num">POSITION ${i + 1}</div>
        <div class="pos-name">${parts[0].trim()}${parts[1] ? ' · ' + parts[1].trim() : ''}</div>
      </div>
      <div class="pos-card-block${filled ? ' filled' : ''}" onclick="${filled ? '' : 'openPicker(' + i + ')'}">
        ${filled
        ? `<div class="pos-card-info">
               <div class="pos-card-svg-wrap">${ARCANA_SVG[slot.arcanaIndex]}</div>
               <div class="pos-card-text">
                 <div class="pos-card-name">${a.name}</div>
                 <div class="pos-card-num">Arcane ${a.roman}${slot.reversed ? ' · <span class="pos-reversed-tag">' + t().rev_label + '</span>' : ''}</div>
               </div>
             </div>
             <div class="pos-card-actions">
               <button class="pos-reversed-toggle${slot.reversed ? ' on' : ''}" onclick="toggleReversed(event,${i})">${slot.reversed ? t().rev_label : t().turn_btn}</button>
               <button class="pos-clear" onclick="clearSlot(event,${i})">×</button>
             </div>`
        : `<span class="pos-card-placeholder">${t().click_pick}</span>`
      }
      </div>
    </div>`;
  }).join('');
}

// ─── PICKER ───
function openPicker(i) {
  activeSlotIndex = i;
  const taken = slots.map(s => s.arcanaIndex).filter(x => x !== null);
  $('picker-title').textContent = `Position ${i + 1} — ${selectedSpread.positions[i].split('—')[0].trim()}`;
  $('picker-grid').innerHTML = ARCANES.map((a, j) => `
    <div class="picker-cell${taken.includes(j) && slots[i].arcanaIndex !== j ? ' taken' : ''}" onclick="pickCard(${j})">
      <div class="pc-num">${a.roman}</div><div class="pc-name">${a.name}</div>
    </div>`).join('');
  $('picker-overlay').classList.add('open');
}

function pickCard(j) {
  if (activeSlotIndex === null) return;
  slots[activeSlotIndex] = { arcanaIndex: j, reversed: false };
  closePicker();
  renderAll();
}

function closePicker() {
  $('picker-overlay').classList.remove('open');
  activeSlotIndex = null;
}

function clearSlot(e, i) {
  e.stopPropagation();
  slots[i] = { arcanaIndex: null, reversed: false };
  renderAll();
}

function toggleReversed(e, i) {
  e.stopPropagation();
  slots[i].reversed = !slots[i].reversed;
  renderAll();
}

// ─── ANALYSIS ───
async function runAnalysis() {
  $('step2').style.display = 'none';
  $('step3').style.display = 'block';
  chatHistory = [];
  $('chat-section').style.display = 'none';
  $('chat-messages').innerHTML = '';
  window.scrollTo(0, 0);

  const revCount = slots.filter(s => s.reversed).length;
  $('result-title').textContent = selectedSpread.name;
  $('result-meta').textContent = `${t().cards(slots.length)} · ${t().revs(revCount)}`;

  $('result-cards').innerHTML = slots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `<div class="analysis-card${slot.reversed ? ' rev' : ''}">
      <div class="ac-row"><div class="ac-pos-num">${i + 1}</div><div class="ac-body">
        <div class="ac-pos-label">${selectedSpread.positions[i]}</div>
        <div class="ac-card-name">${a.name}</div>
        <div class="ac-arcanum">Arcane ${a.roman}${slot.reversed ? ' · <span style="color:var(--red)">Renversée</span>' : ''}</div>
        <div class="ac-kws">${a.keywords.map(k => `<span class="ac-kw">${k}</span>`).join('')}</div>
      </div></div>
    </div>`;
  }).join('');

  $('reading-result').innerHTML = `<div class="loading-block"><div class="loading-text">${t().loading}</div></div>`;

  readingContext = slots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `Position ${i + 1} (${selectedSpread.positions[i]}) : ${a.name} (Arcane ${a.roman})${slot.reversed ? ' RENVERSÉE' : ''}`;
  }).join('\n');

  const sysPrompt = t().sys;
  const userPrompt = buildPrompt();

  try {
    const raw = await callGroq([{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }]);
    renderReading(raw);
    chatHistory = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: raw }
    ];
    $('chat-section').style.display = 'block';
  } catch (err) {
    $('reading-result').innerHTML = `<div class="error-block"><div class="error-text">Erreur : ${err.message}</div><div class="error-text" style="font-size:12px;margin-top:8px;opacity:.7;">Vérifie ta clé Groq et que tu n'es pas sur file:// (utilise un serveur local ou GitHub Pages)</div></div>`;
  }
}

function buildPrompt() {
  const lines = slots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `Position ${i + 1} (${selectedSpread.positions[i]}) : ${a.name} (Arcane ${a.roman})${slot.reversed ? ' — RENVERSÉE' : ''}\nMots-clés : ${a.keywords.join(', ')}\nSens endroit : ${a.upright}\nSens renversé : ${a.reversed}`;
  }).join('\n\n');
  const q = ($('question-input') || {}).value || '';
  return t().prompt(selectedSpread.name, selectedSpread.desc, lines, q.trim());
}

// ─── RENDER READING ───
function highlightText(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="hl-bold">$1</strong>');
  text = text.replace(/^([→•\-]\s*.+)$/gm, '<span class="hl-point">$1</span>');
  text = text.replace(/^([^—\n]+?)(?=\s*—)/gm, '<strong>$1</strong>');
  return text;
}

function fmt(text) {
  return '<p>' + text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, ' ') + '</p>';
}

function renderReading(raw) {
  const p1 = raw.match(/PARTIE\s*1[^:\n]*[:\n]([\s\S]*?)(?=PARTIE\s*2|$)/i);
  const p2 = raw.match(/PARTIE\s*2[^:\n]*[:\n]([\s\S]*)/i);
  const fmtHL = s => fmt(highlightText(s));
  $('reading-result').innerHTML = p1 && p2
    ? `<div class="reading-section"><div class="reading-section-title">${t().card_by_card}</div><div class="reading-text">${fmtHL(p1[1].trim())}</div></div>
       <div class="reading-section"><div class="reading-section-title">${t().global_r}</div><div class="reading-text">${fmtHL(p2[1].trim())}</div></div>`
    : `<div class="reading-section"><div class="reading-section-title">${t().reading}</div><div class="reading-text">${fmtHL(raw)}</div></div>`;
}

// ─── CHAT ───
function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

async function sendChatMessage() {
  const input = $('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  $('chat-send').disabled = true;
  appendChatMsg('user', msg);
  chatHistory.push({ role: 'user', content: msg });

  const tid = 't' + Date.now();
  $('chat-messages').insertAdjacentHTML('beforeend',
    `<div class="chat-typing" id="${tid}"><span style="min-width:36px;font-size:9px;letter-spacing:2px;color:var(--label-3)">IA</span><span>· · ·</span></div>`);
  scrollChat();

  try {
    const raw = await callGroq(chatHistory);
    $(tid)?.remove();
    appendChatMsg('ai', raw);
    chatHistory.push({ role: 'assistant', content: raw });
  } catch (err) {
    $(tid)?.remove();
    appendChatMsg('ai', err.message);
  }
  $('chat-send').disabled = false;
  input.focus();
}

function appendChatMsg(role, text) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.innerHTML = `<div class="chat-msg-role">${role === 'user' ? t().you : t().ai}</div><div class="chat-msg-text">${fmt(text)}</div>`;
  $('chat-messages').appendChild(el);
  scrollChat();
}

function scrollChat() {
  const el = $('chat-messages');
  el.scrollTop = el.scrollHeight;
}

// ─── ARCANE MODAL ───
function openModal(i) {
  const a = ARCANES[i];
  const pt = lang === 'pt' ? ARCANES_PT[i] : null;
  $('m-svg').innerHTML = ARCANA_SVG[i];
  $('m-roman').textContent = `Arcane ${a.roman}`;
  $('m-name').textContent = a.name;
  $('m-altname').textContent = a.altname;
  $('m-kws').innerHTML = (pt || a).keywords.map(k => `<span class="modal-kw">${k}</span>`).join('');
  $('m-upright').textContent = (pt || a).upright;
  $('m-reversed').textContent = (pt || a).reversed;
  $('m-symbolism').textContent = (pt || a).symbolism;
  $('m-domains').textContent = (pt || a).domains;
  $('modal-overlay').classList.add('open');
}

function closeModal() { $('modal-overlay').classList.remove('open'); }
function maybeCloseModal(e) { if (e.target === $('modal-overlay')) closeModal(); }

// ─── NAV ───
function showScreen(id, btn) {
  const ripple = document.createElement('span');
  ripple.className = 'nav-tab-ripple';
  const size = Math.max(btn.offsetWidth, btn.offsetHeight);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${btn.offsetWidth / 2 - size / 2}px;top:${btn.offsetHeight / 2 - size / 2}px;`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  btn.classList.add('active');
}

function toggleMute() {
  const audio = document.getElementById('bg-audio');
  const btn = document.getElementById('mute-btn');
  if (audio.muted) {
    audio.muted = false;
    btn.classList.remove('muted');
    btn.classList.add('playing');
    btn.textContent = '♪';
  } else {
    audio.muted = true;
    btn.classList.add('muted');
    btn.classList.remove('playing');
    btn.textContent = '♩';
  }
}

function handleSplashClick() {
  document.getElementById('bg-audio').play().catch(() => {});
  hideSplash();
}

function hideSplash() {
  const splash = document.getElementById('splash');
  const card = document.getElementById('splash-card');

  const startTime = performance.now();
  const duration = 550;

  // Courbe bezier custom pour y : 0 → -12vh (saut) → 140vh (chute)
  // t 0→0.25 : monte doucement puis accélère vers le haut
  // t 0.25→0.4 : ralentit en haut (apex)
  // t 0.4→1 : tombe, lent au début puis accélère fortement

  const fall = (now) => {
    const t = Math.min((now - startTime) / duration, 1);

    let y, rot, opacity;

    if(t < 0.4) {
      // Phase montée : ease-in-out vers l'apex
      const t2 = t / 0.4;
      const curve = t2 * t2 * (3 - 2 * t2); // smoothstep — lent→rapide→lent
      y = -12 * curve;
      rot = -3 * curve;
      opacity = 1;
      card.style.filter = `blur(${curve * 1}px)`;
    } else {
      // Phase chute : part lentement de l'apex, accélère comme gravité
      const t2 = (t - 0.4) / 0.6;
      const gravity = Math.pow(t2, 2.2); // lent au début, très rapide à la fin
      y = -12 + (12 + 140) * gravity;
      rot = -3 + t2 * 32;
      opacity = t2 < 0.35 ? 1 : 1 - Math.pow((t2 - 0.35) / 0.65, 1.2);
      card.style.filter = `blur(${gravity * 140}px)`;
    }

    card.style.transform = `translateY(${y}vh) rotate(${rot}deg) rotateY(${t < 0.4 ? 0 : ((t - 0.4) / 0.6) * 300}deg)`;
    card.style.opacity = Math.max(0, opacity);

    if(t < 1) {
      requestAnimationFrame(fall);
    } else {
      splash.style.transition = 'opacity .3s ease';
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 300);
    }
  };

  requestAnimationFrame(fall);

  setTimeout(() => {
  document.getElementById('bg-audio').play().catch(() => {});
}, 500);
}

// ─── INIT ───
setTimeout(hideSplash, 1500);
function init() {
  buildLibrary();
  loadSavedSession();
  buildSpreadsWithDaily();
const audio = document.getElementById('bg-audio');
audio.volume = 0.35;
document.addEventListener('click', () => audio.play().catch(() => {}), { once: true });
setInterval(() => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const saved = JSON.parse(localStorage.getItem('daily_card') || '{}');
    if(saved.date !== today) buildSpreadsWithDaily();
  } catch(e) {}
}, 60000);
try {
  if(!localStorage.getItem('tuto_done')) setTimeout(showTuto, 2000);
} catch(e) {}
}

document.addEventListener('DOMContentLoaded', init);

function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  document.getElementById('theme-btn').textContent = dark ? '☾' : '☀';
  try { localStorage.setItem('tarot_theme', dark ? 'dark' : 'light'); } catch(e) {}
}

function getDailyCard() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const saved = JSON.parse(localStorage.getItem('daily_card') || '{}');
    if(saved.date === today) return saved;
    const index = Math.floor(Math.random() * 22);
    const reversed = Math.random() < 0.3;
    const entry = { date: today, index, reversed, unlocked: false };
    localStorage.setItem('daily_card', JSON.stringify(entry));
    return entry;
  } catch(e) {
    return { date: today, index: Math.floor(Math.random() * 22), reversed: false, unlocked: false };
  }
}

function unlockDailyCard() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const saved = JSON.parse(localStorage.getItem('daily_card') || '{}');
    if(saved.date === today) {
      saved.unlocked = true;
      localStorage.setItem('daily_card', JSON.stringify(saved));
    }
  } catch(e) {}
  buildSpreadsWithDaily();
}

function resetDailyCard() {
  try { localStorage.removeItem('daily_card'); } catch(e) {}
  buildSpreadsWithDaily();
}

async function loadDailyReading() {
  if(!groqKey) return;
  const daily = getDailyCard();
  const a = ARCANES[daily.index];
  const prompt = `Carte du jour : ${a.name} (Arcane ${a.roman})${daily.reversed?' — RENVERSÉE':''}.
Mots-clés : ${a.keywords.join(', ')}.
En 2-3 phrases courtes et directes, dis ce que cette carte signifie pour aujourd'hui. Pas de titre, pas de "PARTIE", pas de structure. Juste le texte brut.`;

  try {
    const today = new Date().toISOString().split('T')[0];
const savedRaw = localStorage.getItem('daily_reading_' + today);
const savedIndex = localStorage.getItem('daily_reading_index_' + today);
const savedReading = savedRaw && parseInt(savedIndex) === daily.index ? savedRaw : null;

if(savedReading) {
      const el = document.getElementById('daily-text');
      if(el) {
        const parts = savedReading.split('→');
        let html = fmt(parts[0].trim());
        if(parts[1]) html += `<span class="hl-point">→ ${parts[1].trim()}</span>`;
        el.innerHTML = html;
      }
      return;
    }

    const raw = await callGroq([
      { role: 'system', content: t().sys },
      { role: 'user', content: prompt }
    ]);
    localStorage.setItem('daily_reading_index_' + today, daily.index);
    const el = document.getElementById('daily-text');
    if(el) {
      const parts = raw.split('→');
      let html = fmt(parts[0].trim());
      if(parts[1]) html += `<span class="hl-point">→ ${parts[1].trim()}</span>`;
      el.innerHTML = html;
    }
  } catch(e) {
    const el = document.getElementById('daily-text');
    if(el) el.textContent = '—';
  }
}

function buildSpreadsWithDaily() {
  const container = document.getElementById('step1');
  const existing = document.getElementById('daily-block');
  if(existing) existing.remove();
  container.insertAdjacentHTML('afterbegin', buildDailyCard());
  loadDailyReading();
}

function buildDailyCard() {
  const daily = getDailyCard();
  const a = ARCANES[daily.index];
  const now = new Date();
  const midnight = new Date(); midnight.setHours(24,0,0,0);
  const diff = midnight - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  if(!daily.unlocked) {
    return `
      <div id="daily-block" style="margin-bottom:24px;">
        <p class="section-label">Carte du jour</p>
        <div onclick="unlockDailyCard()" class="daily-locked">
          <div style="
            width:56px;height:56px;border-radius:50%;
            background:var(--tint-bg);
            border:1.5px solid var(--tint);
            display:flex;align-items:center;justify-content:center;
            font-size:22px;
          ">✦</div>
          <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tint);">Révéler la carte du jour</div>
          <div style="font-size:12px;color:var(--label-3);text-align:center;line-height:1.6;">Votre carte quotidienne vous attend.<br>Elle changera dans ${h}h ${m}m.</div>
        </div>
      </div>
    `;
  }

  return `
    <div id="daily-block" style="margin-bottom:24px;">
      <p class="section-label">Carte du jour</p>
      <div style="background:var(--glass-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--glass-shadow);border:1px solid var(--glass-border-outer);">
        <div style="padding:20px 22px;display:flex;align-items:center;gap:20px;">
          <div style="width:64px;height:64px;flex-shrink:0;color:${daily.reversed?'var(--red)':'var(--tint)'};">${ARCANA_SVG[daily.index]}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--label-3);margin-bottom:4px;">Arcane ${a.roman}${daily.reversed?' · <span style="color:var(--red)">Renversée</span>':''}</div>
            <div style="font-size:18px;font-weight:500;color:var(--label);margin-bottom:8px;">${a.name}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">${a.keywords.map(k=>`<span style="font-size:11px;font-weight:500;color:var(--label-2);background:var(--fill);padding:3px 10px;border-radius:20px;">${k}</span>`).join('')}</div>
          </div>
        </div>
        <div id="daily-reading" style="padding:0 22px 20px;font-size:14px;color:var(--label-2);line-height:1.7;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--label-3);margin-bottom:8px;">Lecture du jour</div>
          <div id="daily-text"><span style="color:var(--label-3);animation:pulse 2s infinite;display:inline-block;">· · ·</span></div>
        </div>
        <div style="padding:12px 22px;border-top:1px solid var(--glass-border-outer);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--label-3);">Nouvelle carte dans ${h}h ${m}m</span>
          <span style="font-size:11px;font-weight:600;color:var(--tint);cursor:pointer;" onclick="openModal(${daily.index})">Voir l'arcane →</span>
        </div>
      </div>
    </div>
  `;
}

function showTuto() {
  const steps = [
    { icon: '✦', title: 'Carte du jour', desc: 'Chaque jour une carte t\'attend. Révèle-la pour recevoir un message personnalisé.' },
    { icon: '🔑', title: 'Clé API', desc: 'Entre ton prénom et ta clé API pour activer l\'IA.' },
    { icon: '🃏', title: 'Choisir un tirage', desc: 'Sélectionne un tirage selon ta question. De 3 à 7 cartes selon la profondeur souhaitée.' },
    { icon: '✦', title: 'Lire les arcanes', desc: 'Consulte les 22 Arcanes Majeurs dans l\'onglet Arcanes pour approfondir ta connaissance.' },
  ];

  let current = 0;

  const overlay = document.createElement('div');
  overlay.id = 'tuto-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:2000;
    background:rgba(200,200,210,.25);
    backdrop-filter:blur(24px) saturate(180%);
    -webkit-backdrop-filter:blur(24px) saturate(180%);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  const render = () => {
    const s = steps[current];
    overlay.innerHTML = `
      <div style="
        background:var(--glass-bg-strong);
        backdrop-filter:var(--blur);
        -webkit-backdrop-filter:var(--blur);
        border-radius:var(--r-lg);
        border:1px solid var(--glass-border-outer);
        box-shadow:var(--glass-shadow-md);
        max-width:380px;width:100%;
        padding:36px 28px 28px;
        text-align:center;
      ">
        <div style="font-size:32px;margin-bottom:16px;">${s.icon}</div>
        <div style="font-size:17px;font-weight:700;color:var(--label);margin-bottom:10px;letter-spacing:.2px;">${s.title}</div>
        <div style="font-size:14px;color:var(--label-2);line-height:1.7;margin-bottom:28px;">${s.desc}</div>
        <div style="display:flex;gap:6px;justify-content:center;margin-bottom:24px;">
          ${steps.map((_,i) => `<div style="width:6px;height:6px;border-radius:50%;background:${i===current?'var(--tint)':'var(--fill-2)'};transition:background .2s;"></div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('tuto-overlay').remove();try{localStorage.setItem('tuto_done','1')}catch(e){}" style="
            flex:1;background:var(--fill);border:none;color:var(--label-2);
            font-family:var(--font);font-size:12px;font-weight:600;letter-spacing:.5px;
            padding:12px;border-radius:100px;cursor:pointer;
          ">Passer</button>
          <button id="tuto-next" style="
            flex:2;background:var(--tint);border:none;color:#fff;
            font-family:var(--font);font-size:12px;font-weight:700;letter-spacing:1px;
            text-transform:uppercase;padding:12px;border-radius:100px;cursor:pointer;
          ">${current < steps.length-1 ? 'Suivant →' : 'Commencer'}</button>
        </div>
      </div>
    `;
    document.getElementById('tuto-next').onclick = () => {
      if(current < steps.length-1) { current++; render(); }
      else { overlay.remove(); try{localStorage.setItem('tuto_done','1')}catch(e){} }
    };
  };

  document.body.appendChild(overlay);
render();
}