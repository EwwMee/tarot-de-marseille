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

// ─── INIT ───
function init() {
  buildSpreads();
  buildLibrary();
  loadSavedSession();
}

document.addEventListener('DOMContentLoaded', init);
