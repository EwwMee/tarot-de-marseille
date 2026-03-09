// ─── STATE ───
let lang = 'fr';
let selectedSpread = null;
let slots = [];
let activeSlotIndex = null;
let chatHistory = [];
let readingContext = '';
let groqKey = '';
let quickChatHistory = [];

const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── HELPERS ───
function t() { return L[lang]; }
function $(id) { return document.getElementById(id); }
function $q(sel) { return document.querySelector(sel); }

// ─── PROFIL ───
function saveProfil() {
  const p = {
    age: $('profil-age') ? $('profil-age').value : '',
    situation: $('profil-situation') ? $('profil-situation').value : '',
    domaine: $('profil-domaine') ? $('profil-domaine').value : '',
    intention: $('profil-intention') ? $('profil-intention').value : '',
  };
  try { localStorage.setItem('tarot_profil', JSON.stringify(p)); } catch(e) {}
}

function loadProfil() {
  try {
    const p = JSON.parse(localStorage.getItem('tarot_profil') || '{}');
    if ($('profil-age') && p.age) $('profil-age').value = p.age;
    if ($('profil-situation') && p.situation) $('profil-situation').value = p.situation;
    if ($('profil-domaine') && p.domaine) $('profil-domaine').value = p.domaine;
    if ($('profil-intention') && p.intention) $('profil-intention').value = p.intention;
  } catch(e) {}
}

function getProfilContext() {
  try {
    const p = JSON.parse(localStorage.getItem('tarot_profil') || '{}');
    const parts = [];
    if (p.age) parts.push(`Âge : ${p.age} ans`);
    if (p.situation) parts.push(`Situation amoureuse : ${p.situation}`);
    if (p.domaine) parts.push(`Domaine prioritaire : ${p.domaine}`);
    if (p.intention) parts.push(`Contexte personnel : ${p.intention}`);
    return parts.length ? '\n\nContexte de la personne :\n' + parts.join('\n') : '';
  } catch(e) { return ''; }
}

// ─── LANG ───
function setLang(l) {
  lang = l;
  try { localStorage.setItem('tarot_lang', l); } catch (e) {}

  // Nav lang buttons
  ['btn-lang-fr','pref-lang-fr'].forEach(id => { const el=$(id); if(el) el.classList.toggle('active', l==='fr'); });
  ['btn-lang-pt','pref-lang-pt'].forEach(id => { const el=$(id); if(el) el.classList.toggle('active', l==='pt'); });

  const T = t();

  // Nav labels
  const nlA = $('nav-label-accueil'); if (nlA) nlA.textContent = T.nav_accueil || 'Accueil';
  const nlT = $('nav-label-tirages'); if (nlT) nlT.textContent = T.nav_tirage;
  const nlAr = $('nav-label-arcanes'); if (nlAr) nlAr.textContent = T.nav_arcanes;
  const nlM = $('nav-label-moi'); if (nlM) nlM.textContent = T.nav_moi || 'Moi';

  const map = {
    'btn-analyze': T.analyze,
    'btn-shuffle': T.shuffle,
    'shuffle-note': T.shuffle_note,
    'question-optional': T.question_optional,
    'chat-send': T.chat_send,
    'quick-chat-send': T.chat_send,
    'm-title-kws': T.m_kws,
    'm-title-up': T.m_up,
    'm-title-rev': T.m_rev,
    'm-title-sym': T.m_sym,
    'm-title-dom': T.m_dom,
    'label-choose': T.choose,
    'label-arcanes': T.lib_title,
    'label-profil': T.profil_title || 'Mon profil',
    'api-banner-title': T.session_title,
    'deepen-title': T.deepen_title,
    'deepen-desc': T.deepen_desc,
    'quick-deepen-title': T.deepen_title,
    'quick-deepen-desc': T.deepen_desc,
    'quick-label': T.quick_label || 'Tirage rapide',
  };
  Object.entries(map).forEach(([id, val]) => { const el = $(id); if (el && val) el.textContent = val; });

  const phMap = {
    'user-name-input': T.name_ph,
    'groq-key-input': T.key_ph,
    'question-input': T.question_ph,
    'chat-input': T.chat_ph,
    'quick-chat-input': T.chat_ph,
  };
  Object.entries(phMap).forEach(([id, ph]) => { const el = $(id); if (el) el.placeholder = ph; });

  buildSpreads();
  buildLibrary();
  buildSpreadsWithDaily();
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
  try { localStorage.setItem('groq_key', key); localStorage.setItem('groq_name', name); } catch (e) {}
  activateSession(name);
  if (document.getElementById('daily-text')) loadDailyReading();
  if (document.getElementById('daily-text-accueil')) loadDailyReadingAccueil();
}

function activateSession(name) {
  const banner = $('api-banner');
  if (banner) banner.style.display = 'none';
  const bar = $('session-bar');
  if (bar) { bar.style.display = 'flex'; }
  const sn = $('session-name');
  if (sn) sn.textContent = name;
  const pb = $('profil-block');
  if (pb) pb.style.display = 'block';
  const prb = $('prefs-block');
  if (prb) prb.style.display = 'block';
  loadProfil();
  updatePrefsThemeBtn();
}

function endSession() {
  try { localStorage.removeItem('groq_key'); localStorage.removeItem('groq_name'); } catch (e) {}
  groqKey = '';
  const bar = $('session-bar'); if (bar) bar.style.display = 'none';
  const banner = $('api-banner'); if (banner) banner.style.display = 'block';
  const un = $('user-name-input'); if (un) un.value = '';
  const gk = $('groq-key-input'); if (gk) gk.value = '';
  const gs = $('groq-status'); if (gs) gs.style.display = 'none';
  const pb = $('profil-block'); if (pb) pb.style.display = 'none';
  const prb = $('prefs-block'); if (prb) prb.style.display = 'none';
  goStep1();
}

function loadSavedSession() {
  try {
    const savedLang = localStorage.getItem('tarot_lang');
    if (savedLang === 'fr' || savedLang === 'pt') { lang = savedLang; }
    const key = localStorage.getItem('groq_key');
    const name = localStorage.getItem('groq_name');
    if (key && key.length > 10 && name) { groqKey = key; activateSession(name); }
  } catch (e) {}

  try {
    const saved = localStorage.getItem('tarot_theme');
    if (saved === 'dark') {
      document.body.classList.add('dark');
      const btn = $('theme-btn'); if (btn) btn.textContent = '☾';
    } else if (!saved) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark');
        const btn = $('theme-btn'); if (btn) btn.textContent = '☾';
      }
    }
  } catch(e) {}
}

function updatePrefsThemeBtn() {
  const btn = $('pref-theme-btn');
  if (!btn) return;
  const dark = document.body.classList.contains('dark');
  btn.textContent = dark ? '☾ Sombre' : '☀ Clair';
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
  if (!res.ok) throw new Error((data.error && data.error.message) || 'HTTP ' + res.status);
  return data.choices[0].message.content;
}

// ─── BUILD UI ───
function buildSpreads() {
  const el = $('spreads-list');
  if (!el) return;
  const spreads = t().spreads;
  el.innerHTML = spreads.map((s, i) => `
    <div class="spread-row" onclick="selectSpread(${i})">
      <div class="spread-row-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="spread-row-body"><div class="spread-row-name">${s.name}</div><div class="spread-row-meta">${s.desc}</div></div>
      <div class="spread-row-count">${t().cards(s.count)}</div>
    </div>`).join('');
}

function buildLibrary() {
  const el = $('lib-grid');
  if (!el) return;
  el.innerHTML = ARCANES.map((a, i) => {
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
  const s3 = $('step3'); if (s3) s3.style.display = 'none';
  const s2 = $('step2'); if (s2) s2.style.display = 'none';
  const s1 = $('step1'); if (s1) s1.style.display = 'block';
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
  const ba = $('btn-analyze');
  if (ba) ba.disabled = slots.some(s => s.arcanaIndex === null);
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
  const el = $('positions-list');
  if (!el) return;
  el.innerHTML = slots.map((slot, i) => {
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

  const sysPrompt = t().sys + getProfilContext();
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
    generateSuggestions(chatHistory, 'chat-input', 'sendChatMessage');
  } catch (err) {
    $('reading-result').innerHTML = `<div class="error-block"><div class="error-text">Erreur : ${err.message}</div></div>`;
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

// ─── CHAT (tirage principal) ───
function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

async function sendChatMessage() {
  const input = $('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  $('chat-send').disabled = true;
  appendChatMsg('user', msg, 'chat-messages');
  chatHistory.push({ role: 'user', content: msg });
  generateSuggestions(chatHistory, 'chat-input', 'sendChatMessage');
  generateSuggestions(quickChatHistory, 'quick-chat-input', 'sendQuickChatMessage');

  const tid = 't' + Date.now();
  $('chat-messages').insertAdjacentHTML('beforeend',
    `<div class="chat-typing" id="${tid}"><span style="min-width:36px;font-size:9px;letter-spacing:2px;color:var(--label-3)">IA</span><span>· · ·</span></div>`);
  scrollChat('chat-messages');

  try {
    const raw = await callGroq(chatHistory);
    $(tid)?.remove();
    appendChatMsg('ai', raw, 'chat-messages');
    chatHistory.push({ role: 'assistant', content: raw });
  } catch (err) {
    $(tid)?.remove();
    appendChatMsg('ai', err.message, 'chat-messages');
  }
  $('chat-send').disabled = false;
  input.focus();
}

// ─── CHAT (tirage rapide) ───
function quickChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuickChatMessage(); }
}

async function sendQuickChatMessage() {
  const input = $('quick-chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  $('quick-chat-send').disabled = true;
  appendChatMsg('user', msg, 'quick-chat-messages');
  quickChatHistory.push({ role: 'user', content: msg });
  generateSuggestions(chatHistory, 'chat-input', 'sendChatMessage');
  generateSuggestions(quickChatHistory, 'quick-chat-input', 'sendQuickChatMessage');

  const tid = 't' + Date.now();
  $('quick-chat-messages').insertAdjacentHTML('beforeend',
    `<div class="chat-typing" id="${tid}"><span style="min-width:36px;font-size:9px;letter-spacing:2px;color:var(--label-3)">IA</span><span>· · ·</span></div>`);
  scrollChat('quick-chat-messages');

  try {
    const raw = await callGroq(quickChatHistory);
    $(tid)?.remove();
    appendChatMsg('ai', raw, 'quick-chat-messages');
    quickChatHistory.push({ role: 'assistant', content: raw });
  } catch (err) {
    $(tid)?.remove();
    appendChatMsg('ai', err.message, 'quick-chat-messages');
  }
  $('quick-chat-send').disabled = false;
  input.focus();
}

function appendChatMsg(role, text, containerId) {
  const container = $(containerId || 'chat-messages');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.innerHTML = `<div class="chat-msg-role">${role === 'user' ? t().you : t().ai}</div><div class="chat-msg-text">${fmt(text)}</div>`;
  container.appendChild(el);
  scrollChat(containerId || 'chat-messages');
}

function scrollChat(id) {
  const el = $(id || 'chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
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

// ─── AUDIO ───
function toggleMute() {
  const audio = $('bg-audio');
  const btn = $('mute-btn');
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
  $('bg-audio').play().catch(() => {});
  hideSplash();
}

function hideSplash() {
  const splash = $('splash');
  const card = $('splash-card');
  const startTime = performance.now();
  const duration = 550;

  const fall = (now) => {
    const t = Math.min((now - startTime) / duration, 1);
    let y, rot, opacity;
    if (t < 0.4) {
      const t2 = t / 0.4;
      const curve = t2 * t2 * (3 - 2 * t2);
      y = -12 * curve; rot = -3 * curve; opacity = 1;
      card.style.filter = `blur(${curve * 1}px)`;
    } else {
      const t2 = (t - 0.4) / 0.6;
      const gravity = Math.pow(t2, 2.2);
      y = -12 + (12 + 140) * gravity;
      rot = -3 + t2 * 32;
      opacity = t2 < 0.35 ? 1 : 1 - Math.pow((t2 - 0.35) / 0.65, 1.2);
      card.style.filter = `blur(${gravity * 140}px)`;
    }
    card.style.transform = `translateY(${y}vh) rotate(${rot}deg) rotateY(${t < 0.4 ? 0 : ((t - 0.4) / 0.6) * 300}deg)`;
    card.style.opacity = Math.max(0, opacity);
    if (t < 1) {
      requestAnimationFrame(fall);
    } else {
      splash.style.transition = 'opacity .3s ease';
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 300);
    }
  };
  requestAnimationFrame(fall);
  setTimeout(() => { $('bg-audio').play().catch(() => {}); }, 500);
}

// ─── THEME ───
function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  const tb = $('theme-btn'); if (tb) tb.textContent = dark ? '☾' : '☀';
  try { localStorage.setItem('tarot_theme', dark ? 'dark' : 'light'); } catch(e) {}
  updatePrefsThemeBtn();
}

// ─── DAILY CARD ───
function getDailyCard() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const saved = JSON.parse(localStorage.getItem('daily_card') || '{}');
    if (saved.date === today) return saved;
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
    if (saved.date === today) { saved.unlocked = true; localStorage.setItem('daily_card', JSON.stringify(saved)); }
  } catch(e) {}
  buildSpreadsWithDaily();
  loadDailyReadingAccueil();
}

// ─── DAILY READING (accueil) ───
async function loadDailyReadingAccueil() {
  if (!groqKey) return;
  const daily = getDailyCard();
  if (!daily.unlocked) return;
  const a = ARCANES[daily.index];
  const prompt = `Carte du jour : ${a.name} (Arcane ${a.roman})${daily.reversed ? ' — RENVERSÉE' : ''}.
Mots-clés : ${a.keywords.join(', ')}.
En 2-3 phrases courtes et directes, dis ce que cette carte signifie pour aujourd'hui. Pas de titre, pas de "PARTIE", pas de structure. Juste le texte brut.`;

  try {
    const today = new Date().toISOString().split('T')[0];
    const savedRaw = localStorage.getItem('daily_reading_' + today);
    const savedIndex = localStorage.getItem('daily_reading_index_' + today);
    const savedReading = savedRaw && parseInt(savedIndex) === parseInt(daily.index) ? savedRaw : null;

    const el = $('daily-text-accueil');
    if (!el) return;

    if (savedReading) {
      const parts = savedReading.split('→');
      let html = fmt(parts[0].trim());
      if (parts[1]) html += `<span class="hl-point">→ ${parts[1].trim()}</span>`;
      el.innerHTML = html;
      return;
    }

    const raw = await callGroq([
      { role: 'system', content: t().sys + getProfilContext() },
      { role: 'user', content: prompt }
    ]);
    localStorage.setItem('daily_reading_' + today, raw);
    localStorage.setItem('daily_reading_index_' + today, daily.index);
    const parts = raw.split('→');
    let html = fmt(parts[0].trim());
    if (parts[1]) html += `<span class="hl-point">→ ${parts[1].trim()}</span>`;
    el.innerHTML = html;
  } catch(e) {
    const el = $('daily-text-accueil');
    if (el) el.textContent = '—';
  }
}

// ─── BUILD DAILY CARD (accueil) ───
function buildSpreadsWithDaily() {
  const bannerAccueil = $('session-banner-accueil');
if (bannerAccueil) {
  if (!groqKey) {
    bannerAccueil.innerHTML = `
      <div class="api-banner" style="margin-bottom:24px;">
        <div class="api-banner-title">Nouvelle session</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <input id="user-name-input-acc" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Ton prénom" style="display:block;width:100%;background:var(--fill);border:none;border-radius:var(--r-sm);color:var(--label);font-family:var(--font);font-size:15px;padding:13px 14px;outline:none;caret-color:var(--tint);">
          <textarea id="groq-key-input-acc" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Clé Groq — gsk_…" style="font-family:monospace;font-size:12px;height:56px;resize:none;word-break:break-all;display:block;width:100%;background:var(--fill);border:none;border-radius:var(--r-sm);color:var(--label);padding:13px 14px;outline:none;caret-color:var(--tint);"></textarea>
          <button class="api-btn" onclick="startSessionFromAccueil()">Commencer la session →</button>
        </div>
        <div class="api-note">Clé gratuite sur <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a> · Stockée localement.</div>
        <div id="groq-status-acc" class="api-status" style="display:none;"></div>
      </div>`;
  } else {
  const name = localStorage.getItem('groq_name') || '';
  bannerAccueil.innerHTML = `
    <div style="padding:4px 2px 20px;display:flex;align-items:center;gap:10px;">
      <div style="font-size:20px;color:var(--tint);">✦</div>
      <div style="font-size:20px;font-weight:600;color:var(--label);">Bonjour, ${name}</div>
    </div>`;
}
}
  const container = $('daily-block-accueil');
  if (!container) return;

  const daily = getDailyCard();
  const a = ARCANES[daily.index];
  const now = new Date();
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  const diff = midnight - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  if (!daily.unlocked) {
    container.innerHTML = `
      <p class="section-label">Carte du jour</p>
      <div onclick="unlockDailyCard()" class="daily-locked" style="margin-bottom:24px;">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--tint-bg);border:1.5px solid var(--tint);display:flex;align-items:center;justify-content:center;font-size:22px;">✦</div>
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tint);">Révéler la carte du jour</div>
        <div style="font-size:12px;color:var(--label-3);text-align:center;line-height:1.6;">Votre carte quotidienne vous attend.<br>Elle changera dans ${h}h ${m}m.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <p class="section-label">Carte du jour</p>
    <div style="background:var(--glass-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--glass-shadow);border:1px solid var(--glass-border-outer);margin-bottom:28px;">
      <div style="padding:20px 22px;display:flex;align-items:center;gap:20px;">
        <div style="width:64px;height:64px;flex-shrink:0;color:${daily.reversed ? 'var(--red)' : 'var(--tint)'};">${ARCANA_SVG[daily.index]}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--label-3);margin-bottom:4px;">Arcane ${a.roman}${daily.reversed ? ' · <span style="color:var(--red)">Renversée</span>' : ''}</div>
          <div style="font-size:18px;font-weight:500;color:var(--label);margin-bottom:8px;">${a.name}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">${a.keywords.map(k => `<span style="font-size:11px;font-weight:500;color:var(--label-2);background:var(--fill);padding:3px 10px;border-radius:20px;">${k}</span>`).join('')}</div>
        </div>
      </div>
      <div style="padding:0 22px 20px;font-size:14px;color:var(--label-2);line-height:1.7;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--label-3);margin-bottom:8px;">Lecture du jour</div>
        <div id="daily-text-accueil"><span style="color:var(--label-3);animation:pulse 2s infinite;display:inline-block;">· · ·</span></div>
      </div>
      <div style="padding:12px 22px;border-top:1px solid var(--glass-border-outer);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--label-3);">Nouvelle carte dans ${h}h ${m}m</span>
        <span style="font-size:11px;font-weight:600;color:var(--tint);cursor:pointer;" onclick="openModal(${daily.index})">Voir l'arcane →</span>
      </div>
    </div>`;

  loadDailyReadingAccueil();
}

// ─── TIRAGE RAPIDE ───
async function quickShuffleAndAnalyze() {
  if (!groqKey) {
    showScreen('moi', $('nav-moi'));
    return;
  }

  const btn = $('btn-quick-shuffle');
  btn.disabled = true;
  btn.textContent = '· · ·';

  const quickResult = $('quick-result');
  quickResult.style.display = 'block';
  $('quick-chat-section').style.display = 'none';
  $('quick-chat-messages').innerHTML = '';
  quickChatHistory = [];

  // Tirer 3 cartes aléatoires
  const indices = Array.from({ length: 22 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const quickSlots = indices.slice(0, 3).map(idx => ({ arcanaIndex: idx, reversed: Math.random() < .3 }));
  const positions = ['Le Passé', 'Le Présent', 'Le Futur'];

  // Afficher les cartes
  const layout = $('quick-layout');
  layout.innerHTML = quickSlots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `<div class="vcard filled${slot.reversed ? ' reversed-v' : ''}" style="cursor:default;">
      ${slot.reversed ? '<div class="vcard-rev-mark">↑</div>' : ''}
      <div class="vcard-num">${a.roman}</div>
      <div class="vcard-svg">${ARCANA_SVG[slot.arcanaIndex]}</div>
      <div class="vcard-name">${a.name}</div>
    </div>`;
  }).join('');

  // Animation d'apparition
  setTimeout(() => {
    layout.querySelectorAll('.vcard').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(-12px) scale(.95)'; el.style.transition = 'none';
      void el.offsetWidth;
      el.style.transition = `opacity .3s ${i * 80}ms ease, transform .3s ${i * 80}ms cubic-bezier(.34,1.4,.64,1)`;
      el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)';
    });
  }, 50);

  // Générer la lecture
  const resultEl = $('quick-reading-result');
  resultEl.innerHTML = `<div class="loading-block"><div class="loading-text">${t().loading}</div></div>`;

  const lines = quickSlots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `Position ${i + 1} (${positions[i]}) : ${a.name} (Arcane ${a.roman})${slot.reversed ? ' — RENVERSÉE' : ''}\nMots-clés : ${a.keywords.join(', ')}\nSens endroit : ${a.upright}\nSens renversé : ${a.reversed}`;
  }).join('\n\n');

  const sysPrompt = t().sys + getProfilContext();
  const userPrompt = t().prompt('Passé · Présent · Futur', '3 cartes · trajectoire temporelle', lines, '');

  try {
    const raw = await callGroq([{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }]);

    const p1 = raw.match(/PARTIE\s*1[^:\n]*[:\n]([\s\S]*?)(?=PARTIE\s*2|$)/i);
    const p2 = raw.match(/PARTIE\s*2[^:\n]*[:\n]([\s\S]*)/i);
    const fmtHL = s => fmt(highlightText(s));
    resultEl.innerHTML = p1 && p2
      ? `<div class="reading-section"><div class="reading-section-title">${t().card_by_card}</div><div class="reading-text">${fmtHL(p1[1].trim())}</div></div>
         <div class="reading-section"><div class="reading-section-title">${t().global_r}</div><div class="reading-text">${fmtHL(p2[1].trim())}</div></div>`
      : `<div class="reading-section"><div class="reading-section-title">${t().reading}</div><div class="reading-text">${fmtHL(raw)}</div></div>`;

    quickChatHistory = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: raw }
    ];
    $('quick-chat-section').style.display = 'block';
    generateSuggestions(quickChatHistory, 'quick-chat-input', 'sendQuickChatMessage');
  } catch(err) {
    resultEl.innerHTML = `<div class="error-block"><div class="error-text">Erreur : ${err.message}</div></div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Nouveau tirage →';
}

// ─── TUTO ───
function showTuto() {
  const steps = [
  { icon: '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><path d="M6 20L22 6l16 14"/><path d="M10 16v20h9v-10h6v10h9V16"/></svg></div>', title: 'Accueil', desc: 'Ta carte du jour t\'attend chaque matin. Tire aussi 3 cartes en un clic.' },
  { icon: '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><rect x="8" y="6" width="20" height="30" rx="3"/><rect x="16" y="10" width="20" height="30" rx="3"/><path d="M16 18h8M16 24h6"/></svg></div>', title: 'Tirages', desc: 'Choisis parmi 8 tirages. De 3 à 7 cartes selon ta question.' },
  { icon: '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><circle cx="22" cy="10" r="4"/><path d="M22 14v14"/><path d="M14 20l8 4 8-4"/><path d="M18 36l4-8 4 8"/><path d="M8 30c4-2 8 2 14-2s10 0 14-2"/></svg></div>', title: 'Arcanes', desc: 'Explore les 22 Arcanes Majeurs et leur symbolisme.' },
  { icon: '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><circle cx="22" cy="14" r="6"/><path d="M8 38c0-7 6-12 14-12s14 5 14 12"/></svg></div>', title: 'Moi', desc: 'Entre ta clé API et ton profil pour des lectures personnalisées.' },
];

  let current = 0;
  const overlay = document.createElement('div');
  overlay.id = 'tuto-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:2000;background:rgba(200,200,210,.25);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);display:flex;align-items:center;justify-content:center;padding:16px;`;

  const render = () => {
    const s = steps[current];
    overlay.innerHTML = `
  <div style="background:var(--glass-bg-strong);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-radius:var(--r-lg);border:1px solid var(--glass-border-outer);box-shadow:var(--glass-shadow-md);max-width:320px;width:100%;padding:40px 28px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;">
    <div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;">${s.icon}</div>
    <div style="font-size:17px;font-weight:700;color:var(--label);letter-spacing:.1px;">${s.title}</div>
    <div style="font-size:13px;color:var(--label-2);line-height:1.7;min-height:44px;">${s.desc}</div>
    <div style="display:flex;gap:6px;justify-content:center;">
      ${steps.map((_,i) => `<div style="width:6px;height:6px;border-radius:50%;background:${i===current?'var(--tint)':'var(--fill-2)'};transition:background .2s;"></div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;width:100%;margin-top:4px;">
      <button onclick="document.getElementById('tuto-overlay').remove();try{localStorage.setItem('tuto_done','1')}catch(e){}" style="flex:1;background:var(--fill);border:none;color:var(--label-2);font-family:var(--font);font-size:11px;font-weight:600;letter-spacing:.5px;padding:13px;border-radius:100px;cursor:pointer;">Passer</button>
      <button id="tuto-next" style="flex:2;background:var(--tint);border:none;color:#fff;font-family:var(--font);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:13px;border-radius:100px;cursor:pointer;">${current < steps.length-1 ? 'Suivant →' : 'Commencer'}</button>
    </div>
  </div>`;
    $('tuto-next').onclick = () => {
      if (current < steps.length - 1) { current++; render(); }
      else { overlay.remove(); try { localStorage.setItem('tuto_done', '1'); } catch(e) {} }
    };
  };

  document.body.appendChild(overlay);
  render();
}

// ─── INIT ───
setTimeout(hideSplash, 1500);

function init() {
  loadSavedSession();
  buildSpreads();
  buildLibrary();
  buildSpreadsWithDaily();

  const audio = $('bg-audio');
  audio.volume = 0.35;
  document.addEventListener('click', () => audio.play().catch(() => {}), { once: true });

  setInterval(() => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const saved = JSON.parse(localStorage.getItem('daily_card') || '{}');
      if (saved.date !== today) buildSpreadsWithDaily();
    } catch(e) {}
  }, 60000);

  // Sync lang buttons dans Moi
  const pfr = $('pref-lang-fr'); if (pfr) pfr.classList.toggle('active', lang === 'fr');
  const ppt = $('pref-lang-pt'); if (ppt) ppt.classList.toggle('active', lang === 'pt');

  try {
    if (!localStorage.getItem('tuto_done')) setTimeout(showTuto, 2000);
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', init);

function toggleLangMenu() {
  const m = $('lang-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

function closeLangMenu() {
  const m = $('lang-menu');
  if (m) m.style.display = 'none';
}

function startSessionFromAccueil() {
  const name = $('user-name-input-acc').value.trim();
  const raw = $('groq-key-input-acc').value;
  const key = raw.replace(/[\s\u00a0\u200b\ufeff]/g, '');
  const st = $('groq-status-acc');
  if (!name) { st.textContent = t().err_name; st.className = 'api-status err'; st.style.display = 'block'; return; }
  if (key.length < 10) { st.textContent = t().err_key; st.className = 'api-status err'; st.style.display = 'block'; return; }

  const btn = $('session-banner-accueil').querySelector('.api-btn');
  btn.disabled = true;
  btn.textContent = '· · ·';

  setTimeout(() => {
    groqKey = key;
    try { localStorage.setItem('groq_key', key); localStorage.setItem('groq_name', name); } catch(e) {}
    const un = $('user-name-input'); if (un) un.value = name;
    const gk = $('groq-key-input'); if (gk) gk.value = key;

    // Flash de confirmation
    const banner = $('session-banner-accueil');
    banner.innerHTML = `
      <div style="background:var(--glass-bg);backdrop-filter:var(--blur);border-radius:var(--r-lg);border:1px solid var(--glass-border-outer);padding:20px 22px;margin-bottom:24px;text-align:center;animation:fadeInUp .4s ease;">
        <div style="font-size:22px;margin-bottom:8px;">✦</div>
        <div style="font-size:16px;font-weight:600;color:var(--label);">Bonjour, ${name}</div>
      </div>`;

    setTimeout(() => {
      activateSession(name);
      buildSpreadsWithDaily();
      loadDailyReadingAccueil();
    }, 1200);
  }, 1000);
}

// ─── SWIPE INTER-PAGES ───
(function() {
  const ORDER = ['accueil', 'tirages', 'arcanes', 'moi'];
  const NAV_IDS = { accueil: 'nav-accueil', tirages: 'nav-tirages', arcanes: 'nav-arcanes', moi: 'nav-moi' };

  let tx0 = null, ty0 = null, animating = false;

  function animateTransition(currentEl, nextEl, direction) {
    if (animating) return;
    animating = true;
    currentEl.classList.remove('active');
    nextEl.classList.add('active');
    window.scrollTo(0, 0);
    animating = false;
  }

  document.addEventListener('touchstart', e => {
    if (animating) return;
    if (e.target.closest('.picker-overlay,.modal-overlay,#tuto-overlay,.chat-messages,.spread-visual-container')) return;
    if (e.touches.length !== 1) return;
    tx0 = e.touches[0].clientX;
    ty0 = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (tx0 === null || animating) return;
    const dx = e.changedTouches[0].clientX - tx0;
    const dy = e.changedTouches[0].clientY - ty0;
    tx0 = null; ty0 = null;

    if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.6) return;

    const active = document.querySelector('.screen.active');
    if (!active) return;
    const currentId = active.id.replace('screen-', '');
    const idx = ORDER.indexOf(currentId);
    if (idx === -1) return;

    const direction = dx < 0 ? 1 : -1;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ORDER.length) return;

    const nextId = ORDER[nextIdx];
    const btn = $(NAV_IDS[nextId]);
    const nextEl = document.getElementById('screen-' + nextId);
    if (!btn || !nextEl) return;

    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (nextId === 'tirages') goStep1();

    animateTransition(active, nextEl, direction);
  }, { passive: true });
})();

// ─── SUGGESTIONS ───
async function generateSuggestions(history, inputId, sendFnName) {
  const existingBlock = document.querySelector('.suggestions-row');
  if (existingBlock) existingBlock.remove();

  const block = document.createElement('div');
  block.className = 'suggestions-row';
  block.style.cssText = 'display:flex;flex-wrap:nowrap;gap:6px;padding:10px 16px;border-top:1px solid rgba(255,255,255,.4);overflow-x:scroll;scrollbar-width:none;-ms-overflow-style:none;';
  block.innerHTML = [1,2,3].map(() => `<div style="height:28px;width:90px;border-radius:20px;background:var(--fill);animation:pulse 2s infinite;"></div>`).join('');

  const chatSection = inputId === 'chat-input' ? $('chat-section') : $('quick-chat-section');
  if (!chatSection) return;
  const inputArea = chatSection.querySelector('.chat-input-area');
  if (!inputArea) return;
  chatSection.insertBefore(block, inputArea);

  try {
    const raw = await callGroq([
      ...history,
      { role: 'user', content: 'Génère exactement 3 questions très courtes (max 6 mots chacune) pour approfondir. Une par ligne, sans numéro, sans tiret.' }
    ]);

    const questions = raw.split('\n')
      .map(q => q.trim().replace(/^[-•\d.)]+\s*/, ''))
      .filter(q => q.length > 4)
      .slice(0, 3);

    block.innerHTML = questions.map(q =>
      `<button onclick="useSuggestion('${q.replace(/'/g,"\\'")}','${inputId}','${sendFnName}')"
        style="background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);border-radius:20px;padding:6px 12px;font-family:var(--font);font-size:12px;font-weight:500;color:var(--tint);cursor:pointer;white-space:nowrap;">${q}</button>`
    ).join('');
  } catch(e) {
    block.innerHTML = `<div style="font-size:11px;color:var(--label-3);padding:4px 8px;">${e.message}</div>`;
  }
}

function useSuggestion(question, inputId, sendFnName) {
  const block = document.querySelector('.suggestions-row');
  if (block) block.remove();
  const input = $(inputId);
  if (!input) return;
  input.value = question;
  if (sendFnName === 'sendChatMessage') sendChatMessage();
  else sendQuickChatMessage();
}

block.style.cssText = 'display:flex;flex-wrap:nowrap;gap:6px;padding:10px 16px;border-top:1px solid rgba(255,255,255,.4);overflow:scroll;';

let isDown = false, startX, scrollLeft;
block.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - block.offsetLeft; scrollLeft = block.scrollLeft; });
block.addEventListener('mouseleave', () => isDown = false);
block.addEventListener('mouseup', () => isDown = false);
block.addEventListener('mousemove', e => {
  if (!isDown) return;
  e.preventDefault();
  block.scrollLeft = scrollLeft - (e.pageX - block.offsetLeft - startX);
});
block.addEventListener('wheel', e => { e.preventDefault(); block.scrollLeft += e.deltaY; }, { passive: false });