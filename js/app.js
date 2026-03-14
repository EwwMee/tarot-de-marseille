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

// ─── FONT SIZE ───
function setFontSize(level) {
  document.body.classList.remove('font-large', 'font-xlarge');
  if (level === 1) document.body.classList.add('font-large');
  if (level === 2) document.body.classList.add('font-xlarge');
  try { localStorage.setItem('tarot_fontsize', level); } catch(e) {}
  updateFontSizeUI(level);
}

function loadFontSize() {
  try {
    const saved = parseInt(localStorage.getItem('tarot_fontsize') || '0');
    setFontSize(isNaN(saved) ? 0 : saved);
  } catch(e) { setFontSize(0); }
}

function updateFontSizeUI(level) {
  const slider = $('pref-fontsize-slider');
  if (slider) slider.value = level;
  ['pref-fs-normal', 'pref-fs-large', 'pref-fs-xlarge'].forEach((id, i) => {
    const el = $(id);
    if (el) el.classList.toggle('active', i === level);
  });
}

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
    if (typeof t().profil_ctx === 'function') return t().profil_ctx(p);
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

  ['btn-lang-fr','pref-lang-fr'].forEach(id => { const el=$(id); if(el) el.classList.toggle('active', l==='fr'); });
  ['btn-lang-pt','pref-lang-pt'].forEach(id => { const el=$(id); if(el) el.classList.toggle('active', l==='pt'); });

  const T = t();

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
    'btn-quick-shuffle': T.quick_shuffle_btn || 'Tirer & analyser en un clic →',
    'label-prefs': T.prefs_title || (l === 'pt' ? 'Preferências' : 'Préférences'),
    'quick-desc': T.quick_desc || (l === 'pt' ? '3 cartas · Passado · Presente · Futuro' : '3 cartes · Passé · Présent · Futur'),
    'question-label-text': T.question_label || (l === 'pt' ? 'A tua questão' : 'Ta question'),
    'btn-back-step1': T.back || (l === 'pt' ? '← Mudar de tiragem' : '← Changer de tirage'),
    'btn-back-step3': T.new_spread || (l === 'pt' ? '← Nova tiragem' : '← Nouveau tirage'),
    'btn-start-session': T.start_btn,
    'pref-fontsize-label': T.pref_fontsize || (l === 'pt' ? 'Tamanho do texto' : 'Taille du texte'),
    'collection-modal-title': l === 'pt' ? 'Histórico das cartas do dia' : 'Historique des cartes du jour',
    'pref-fs-normal': T.pref_fontsize_normal || 'Normal',
    'pref-fs-large': T.pref_fontsize_large || (l === 'pt' ? 'Grande' : 'Grand'),
    'pref-fs-xlarge': T.pref_fontsize_xlarge || (l === 'pt' ? 'Muito grande' : 'Très grand'),
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

  const sbl = $('session-bar-label');
  if (sbl) sbl.textContent = (T.session_end_label || (l === 'pt' ? 'SESSÃO' : 'SESSION')) + ' · ';

  const profileLabels = [
    ['profil-label-age', T.profil_age],
    ['profil-label-situation', T.profil_situation],
    ['profil-label-domaine', T.profil_domaine],
    ['profil-label-intention', T.profil_intention],
    ['profil-note-text', T.profil_note],
    ['pref-label-theme', T.pref_theme],
    ['pref-label-lang', T.pref_lang],
  ];
  profileLabels.forEach(([id, val]) => { const el=$(id); if(el && val) el.textContent = val; });

  const piEl = $('profil-intention');
  if (piEl && T.profil_intention_ph) piEl.placeholder = T.profil_intention_ph;

  const apiNoteEl = $('api-note');
  if (apiNoteEl && T.api_note) apiNoteEl.innerHTML = T.api_note;

  const sb = $('session-bar');
  if (sb) {
    const endBtn = sb.querySelector('button');
    if (endBtn) endBtn.textContent = T.btn_end || 'Terminer';
  }

  const selSit = $('profil-situation');
  if (selSit && T.situation_opts) {
    Array.from(selSit.options).forEach((opt, i) => { if (T.situation_opts[i]) opt.text = T.situation_opts[i]; });
  }

  const selDom = $('profil-domaine');
  if (selDom && T.domaine_opts) {
    Array.from(selDom.options).forEach((opt, i) => { if (T.domaine_opts[i]) opt.text = T.domaine_opts[i]; });
  }

  // lang-menu note — via id maintenant
  const lmn = $('lang-menu-note');
  if (lmn && T.lang_menu_note) lmn.textContent = T.lang_menu_note;

  updatePrefsThemeBtn();
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
  loadFontSize();
  const sb = $('session-bar');
  if (sb) { const endBtn = sb.querySelector('button'); if (endBtn) endBtn.textContent = t().btn_end || 'Terminer'; }
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
  btn.textContent = dark ? (t().pref_theme_dark || '☾ Sombre') : (t().pref_theme_light || '☀ Clair');
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
  $('spread-layout').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const scrollY = window.scrollY;
    renderAll();
    window.scrollTo(0, scrollY);

    setTimeout(() => {
      const filled = document.querySelectorAll('#spread-layout .vcard.filled');
      filled.forEach((el, i) => {
        el.style.opacity = '0'; el.style.transform = 'translateY(-16px) scale(.95)'; el.style.transition = 'none';
        void el.offsetWidth;
        el.style.transition = `opacity .3s ${i * 55}ms ease, transform .3s ${i * 55}ms cubic-bezier(.34,1.4,.64,1)`;
        el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)';
        const delay = i * 55 + 350;
        setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; }, delay);
      });
      $('spread-layout').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      h += k in used
        ? `<div style="grid-column:${c};grid-row:${r};">${vcardHTML(used[k])}</div>`
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
        <div class="pos-num">${t().pos_label} ${i + 1}</div>
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
  $('picker-title').textContent = `${t().pos_label} ${i + 1} — ${selectedSpread.positions[i].split('—')[0].trim()}`;
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
  $('reading-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('step2').style.display = 'none';
  $('step3').style.display = 'block';
  chatHistory = [];
  $('chat-section').style.display = 'none';
  $('chat-messages').innerHTML = '';

  const revCount = slots.filter(s => s.reversed).length;
  $('result-title').textContent = selectedSpread.name;
  $('result-meta').textContent = `${t().cards(slots.length)} · ${t().revs(revCount)}`;

  $('result-cards').innerHTML = slots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `<div class="analysis-card${slot.reversed ? ' rev' : ''}">
      <div class="ac-row"><div class="ac-pos-num">${i + 1}</div><div class="ac-body">
        <div class="ac-pos-label">${selectedSpread.positions[i]}</div>
        <div class="ac-card-name">${a.name}</div>
        <div class="ac-arcanum">Arcane ${a.roman}${slot.reversed ? ' · <span style="color:var(--red)">${t().rev_label}</span>' : ''}</div>
        <div class="ac-kws">${(lang === 'pt' ? ARCANES_PT[slot.arcanaIndex] : a).keywords.map(k => `<span class="ac-kw">${k}</span>`).join('')}</div>
      </div></div>
    </div>`;
  }).join('');

  $('reading-result').innerHTML = `<div class="loading-block"><div class="loading-text">${t().loading}</div></div>`;

  readingContext = slots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    return `${t().pos_label} ${i + 1} (${selectedSpread.positions[i]}) : ${a.name} (Arcane ${a.roman})${slot.reversed ? ' RENVERSÉE' : ''}`;
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
    setTimeout(() => {
      const el = $('reading-result');
      const y = el.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 100);
  } catch (err) {
    $('reading-result').innerHTML = `<div class="error-block"><div class="error-text">Erreur : ${err.message}</div></div>`;
  }
}

function buildPrompt() {
  const lines = slots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    const aPt = lang === 'pt' ? ARCANES_PT[slot.arcanaIndex] : a;
    return `${t().pos_label} ${i + 1} (${selectedSpread.positions[i]}) : ${a.name} (Arcane ${a.roman})${slot.reversed ? ' — RENVERSÉE' : ''}\nMots-clés : ${aPt.keywords.join(', ')}\nSens endroit : ${aPt.upright}\nSens renversé : ${aPt.reversed}`;
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
  const p1 = raw.match(/PA(?:R?TIE|RT?E?)\s*1[^:\n]*[:\n]([\s\S]*?)(?=PA(?:R?TIE|RT?E?)\s*2|$)/i);
  const p2 = raw.match(/PA(?:R?TIE|RT?E?)\s*2[^:\n]*[:\n]([\s\S]*)/i);
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

  const tid = 't' + Date.now();
  $('chat-messages').insertAdjacentHTML('beforeend',
    `<div class="chat-typing" id="${tid}"><span style="min-width:36px;font-size:9px;letter-spacing:2px;color:var(--label-3)">${t().ai}</span><span>· · ·</span></div>`);
  scrollChat('chat-messages');

  try {
    const raw = await callGroq(chatHistory);
    $(tid)?.remove();
    const msgs = $('chat-messages').querySelectorAll('.chat-msg.user');
    const lastUserMsg = msgs[msgs.length - 1];
    if (lastUserMsg) lastUserMsg.scrollIntoView({ behavior: 'smooth' });
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
  generateSuggestions(quickChatHistory, 'quick-chat-input', 'sendQuickChatMessage');

  const tid = 't' + Date.now();
  $('quick-chat-messages').insertAdjacentHTML('beforeend',
    `<div class="chat-typing" id="${tid}"><span style="min-width:36px;font-size:9px;letter-spacing:2px;color:var(--label-3)">${t().ai}</span><span>· · ·</span></div>`);
  scrollChat('quick-chat-messages');

  try {
    const raw = await callGroq(quickChatHistory);
    $(tid)?.remove();
    const msgs = $('quick-chat-messages').querySelectorAll('.chat-msg.user');
    const lastUserMsg = msgs[msgs.length - 1];
    if (lastUserMsg) lastUserMsg.scrollIntoView({ behavior: 'smooth' });
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
  if (role !== 'ai') scrollChat(containerId || 'chat-messages');
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
  const ico = $('drawer-mute-icon');
  if (ico) ico.textContent = $('bg-audio').muted ? '♩' : '♪';
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
  const lbl = $('drawer-theme-label');
  if (lbl) lbl.textContent = document.body.classList.contains('dark') ? (lang === 'pt' ? 'Tema escuro' : 'Thème sombre') : (lang === 'pt' ? 'Tema claro' : 'Thème clair');
  const ico = $('drawer-theme-icon');
  if (ico) ico.textContent = document.body.classList.contains('dark') ? '☾' : '☀';
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
    try {
      const hist = JSON.parse(localStorage.getItem('daily_history') || '[]');
      if (!hist.find(h => (typeof h === 'object' ? h.date : h) === today)) {
        hist.push({ date: today, index, reversed });
        localStorage.setItem('daily_history', JSON.stringify(hist));
      }
    } catch(e) {}
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
  buildCardCollection();
}

// ─── DAILY READING (accueil) ───
async function loadDailyReadingAccueil() {
  if (!groqKey) return;
  const daily = getDailyCard();
  if (!daily.unlocked) return;
  const a = ARCANES[daily.index];
  const prompt = t().daily_prompt
    ? t().daily_prompt(a, daily.reversed)
    : `Carte du jour : ${a.name} (Arcane ${a.roman})${daily.reversed ? ' — RENVERSÉE' : ''}.\nMots-clés : ${a.keywords.join(', ')}.\nEn 2-3 phrases courtes et directes, dis ce que cette carte signifie pour aujourd'hui. Pas de titre, pas de "PARTIE", pas de structure. Juste le texte brut.`;

  try {
    const today = new Date().toISOString().split('T')[0];
    const savedRaw = localStorage.getItem('daily_reading_' + today + '_' + lang);
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
    localStorage.setItem('daily_reading_' + today + '_' + lang, raw);
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


// ─── CARD COLLECTION ───
function openCardCollection() {
  buildCardCollection();
  const modal = $('collection-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCardCollection() {
  const modal = $('collection-modal');
  if (modal) modal.style.display = 'none';
}

function buildCardCollection() {
  const container = $('collection-modal-content');
  if (!container) return;
  const T = t();
  try {
    const history = JSON.parse(localStorage.getItem('daily_history') || '[]');
    const emptyMsg = lang === 'pt'
      ? '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 0;"><div style="font-size:28px;color:var(--tint);opacity:.4;">✦</div><div style="font-size:13px;color:var(--label-3);text-align:center;line-height:1.6;">Nenhuma carta do dia<br>desbloqueada ainda.</div></div>'
      : '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 0;"><div style="font-size:28px;color:var(--tint);opacity:.4;">✦</div><div style="font-size:13px;color:var(--label-3);text-align:center;line-height:1.6;">Aucune carte du jour<br>débloquée pour l\'instant.</div></div>';
    if (!history.length) { container.innerHTML = emptyMsg; return; }
    const entries = history.filter(h => typeof h === 'object').reverse().slice(0, 30);
    if (!entries.length) { container.innerHTML = emptyMsg; return; }
    const label = lang === 'pt' ? 'Histórico das cartas do dia' : 'Historique des cartes du jour';
    const cards = entries.map(e => {
      const a = ARCANES[e.index];
      const aPt = lang === 'pt' ? ARCANES_PT[e.index] : a;
      const rev = e.reversed ? '<span style="font-size:9px;color:var(--red);margin-left:3px;">↓</span>' : '';
      const d = new Date(e.date);
      const day = d.getDate();
      const mon = d.toLocaleString(lang === 'pt' ? 'pt-BR' : 'fr-FR', { month: 'short' });
      return `<div onclick="openModal(${e.index})" style="display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;">
        <div style="width:56px;height:88px;border-radius:8px;background:var(--glass-bg);border:1px solid ${e.reversed ? 'rgba(180,60,60,.35)' : 'var(--glass-border-outer)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;box-sizing:border-box;position:relative;overflow:hidden;transition:transform .15s;" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:8px;font-weight:700;letter-spacing:1px;color:${e.reversed ? 'var(--red)' : 'var(--label-3)'};">${a.roman}</div>
          <div style="color:${e.reversed ? 'var(--red)' : 'var(--tint)'};width:28px;height:28px;${e.reversed ? 'transform:rotate(180deg)' : ''}">${ARCANA_SVG[e.index]}</div>
        </div>
        <div style="font-size:9px;font-weight:600;color:var(--label-2);text-align:center;line-height:1.2;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${aPt.name}</div>
        <div style="font-size:9px;color:var(--label-3);">${day} ${mon}</div>
      </div>`;
    }).join('');
    const empty = lang === 'pt' ? 'Nenhuma carta ainda.' : 'Aucune carte encore.';
    container.innerHTML = entries.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:12px;">${cards}</div>`
      : `<div style="font-size:13px;color:var(--label-3);text-align:center;padding:20px 0;">${empty}</div>`;
  } catch(e) { container.innerHTML = ''; }
}

// ─── BUILD DAILY CARD (accueil) ───
function buildSpreadsWithDaily() {
  const T = t();
  const bannerAccueil = $('session-banner-accueil');
  if (bannerAccueil) {
    if (!groqKey) {
      bannerAccueil.innerHTML = `
        <div class="api-banner" style="margin-bottom:24px;">
          <div class="api-banner-title">${T.session_title}</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input id="user-name-input-acc" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="${T.name_ph}" style="display:block;width:100%;background:var(--fill);border:none;border-radius:var(--r-sm);color:var(--label);font-family:var(--font);font-size:15px;padding:13px 14px;outline:none;caret-color:var(--tint);">
            <textarea id="groq-key-input-acc" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${T.key_ph}" style="font-family:monospace;font-size:12px;height:56px;resize:none;word-break:break-all;display:block;width:100%;background:var(--fill);border:none;border-radius:var(--r-sm);color:var(--label);padding:13px 14px;outline:none;caret-color:var(--tint);"></textarea>
            <button class="api-btn" onclick="startSessionFromAccueil()">${T.start_btn}</button>
          </div>
          <div class="api-note">${T.api_note}</div>
          <div id="groq-status-acc" class="api-status" style="display:none;"></div>
        </div>`;
    } else {
      const name = localStorage.getItem('groq_name') || '';
      const greeting = lang === 'pt' ? 'Olá' : 'Bonjour';

      // Phase lunaire
      const moonPhase = (() => {
        const now = new Date();
        const known = new Date(2000, 0, 6);
        const diff = (now - known) / (1000 * 60 * 60 * 24);
        const cycle = diff % 29.53;
        if (cycle < 1.85)  return ['🌑', lang === 'pt' ? 'Lua nova' : 'Nouvelle lune'];
        if (cycle < 7.38)  return ['🌒', lang === 'pt' ? 'Crescente' : 'Croissant'];
        if (cycle < 9.22)  return ['🌓', lang === 'pt' ? 'Quarto crescente' : 'Premier quartier'];
        if (cycle < 14.76) return ['🌔', lang === 'pt' ? 'Gibosa crescente' : 'Gibbeuse croissante'];
        if (cycle < 16.61) return ['🌕', lang === 'pt' ? 'Lua cheia' : 'Pleine lune'];
        if (cycle < 22.15) return ['🌖', lang === 'pt' ? 'Gibosa minguante' : 'Gibbeuse décroissante'];
        if (cycle < 23.99) return ['🌗', lang === 'pt' ? 'Quarto minguante' : 'Dernier quartier'];
        return ['🌘', lang === 'pt' ? 'Minguante' : 'Décroissant'];
      })();

      // Streak
      const streak = (() => {
        try {
          const history = JSON.parse(localStorage.getItem('daily_history') || '[]');
          if (!history.length) return 0;
          const dates = history.map(h => typeof h === 'object' ? h.date : h);
          let count = 0;
          let check = new Date();
          for (let i = 0; i < 365; i++) {
            const d = check.toISOString().split('T')[0];
            if (dates.includes(d)) { count++; check.setDate(check.getDate() - 1); }
            else break;
          }
          return count;
        } catch(e) { return 0; }
      })();

      const streakLabel = streak > 1 ? (lang === 'pt' ? `${streak} 🔥` : `${streak} 🔥`) : '';

      bannerAccueil.innerHTML = `
        <div style="padding:2px 2px 4px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="font-size:20px;color:var(--tint);flex-shrink:0;">✦</div>
            <div style="font-size:20px;font-weight:600;color:var(--label);">${greeting}, ${name}</div>
            <span style="font-size:11px;color:var(--label-3);background:var(--fill);border-radius:20px;padding:2px 9px;">${moonPhase[0]} ${moonPhase[1]}</span>
            ${streakLabel ? `<span style="font-size:11px;color:var(--tint);background:rgba(201,120,50,.1);border-radius:20px;padding:2px 9px;font-weight:600;">${streakLabel}</span>` : ''}
            <button onclick="openCardCollection()" style="margin-left:auto;flex-shrink:0;width:40px;height:40px;border-radius:50%;border:1px solid var(--glass-border-outer);background:var(--glass-bg);backdrop-filter:var(--blur-sm);-webkit-backdrop-filter:var(--blur-sm);color:var(--label-3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .18s;" title="Collection"><svg width="20" height="20" viewBox="0 0 18 20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17 Q3.5 17 3.5 15.5 L3.5 3.5 Q3.5 2 5 2 L13 2 Q14.5 2 14.5 3.5 L14.5 15.5 Q14.5 17 13 17 L7 17" stroke-width="1.4"/><polyline points="9,15 7,17 9,19" stroke-width="1.4"/><line x1="9" y1="8" x2="9" y2="10.5" stroke-width="1.3"/><line x1="9" y1="10.5" x2="11" y2="11.8" stroke-width="1.3"/></svg></button>
          </div>
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
  const timeStr = `${h}h ${m}m`;

  if (!daily.unlocked) {
    container.innerHTML = `
      <p class="section-label">${T.daily_label || 'Carte du jour'}</p>
      <div onclick="unlockDailyCard()" class="daily-locked" style="margin-bottom:24px;">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--tint-bg);border:1.5px solid var(--tint);display:flex;align-items:center;justify-content:center;font-size:22px;">✦</div>
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tint);">${T.daily_reveal}</div>
        <div style="font-size:12px;color:var(--label-3);text-align:center;line-height:1.6;">${typeof T.daily_locked_desc === 'function' ? T.daily_locked_desc(timeStr) : `Votre carte quotidienne vous attend.<br>Elle changera dans ${timeStr}.`}</div>
      </div>`;
    return;
  }

  const aPt = lang === 'pt' ? ARCANES_PT[daily.index] : a;
  const revLabel = daily.reversed ? ` · <span style="color:var(--red)">${T.rev_label}</span>` : '';

  container.innerHTML = `
    <p class="section-label">${T.daily_label || 'Carte du jour'}</p>
    <div style="background:var(--glass-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--glass-shadow);border:1px solid var(--glass-border-outer);margin-bottom:10px;">
      <div style="padding:20px 22px;display:flex;align-items:center;gap:20px;">
        <div style="width:64px;height:64px;flex-shrink:0;color:${daily.reversed ? 'var(--red)' : 'var(--tint)'};">${ARCANA_SVG[daily.index]}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--label-3);margin-bottom:4px;">Arcane ${a.roman}${revLabel}</div>
          <div style="font-size:18px;font-weight:500;color:var(--label);margin-bottom:8px;">${a.name}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">${aPt.keywords.map(k => `<span style="font-size:11px;font-weight:500;color:var(--label-2);background:var(--fill);padding:3px 10px;border-radius:20px;">${k}</span>`).join('')}</div>
        </div>
      </div>
      <div style="padding:0 22px 20px;font-size:14px;color:var(--label-2);line-height:1.7;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--label-3);margin-bottom:8px;">${T.daily_reading_label || 'Lecture du jour'}</div>
        <div id="daily-text-accueil"><span style="color:var(--label-3);animation:pulse 2s infinite;display:inline-block;">· · ·</span></div>
      </div>
      <div style="padding:12px 22px;border-top:1px solid var(--glass-border-outer);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--label-3);">${typeof T.daily_next === 'function' ? T.daily_next(timeStr) : `Nouvelle carte dans ${timeStr}`}</span>
        <span style="font-size:11px;font-weight:600;color:var(--tint);cursor:pointer;" onclick="openDailyCardDetail('${daily.date}', ${daily.index}, ${daily.reversed})">${T.daily_see || "Voir l'arcane →"}</span>
      </div>
    </div>`;

  loadDailyReadingAccueil();
  buildCardCollection();
}

// ─── TIRAGE RAPIDE ───
async function quickShuffleAndAnalyze() {
  document.querySelectorAll('.btn-shuffle').forEach(b => { if (!b.id) b.remove(); });

  if (!groqKey) {
    showScreen('moi', $('nav-moi'));
    return;
  }

  const btn = $('btn-quick-shuffle');
  btn.disabled = true;
  btn.textContent = '· · ·';

  const quickResult = $('quick-result');
  quickResult.style.display = 'block';
  setTimeout(() => $('quick-layout').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  $('quick-chat-section').style.display = 'none';
  $('quick-chat-messages').innerHTML = '';
  quickChatHistory = [];

  const indices = Array.from({ length: 22 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const quickSlots = indices.slice(0, 3).map(idx => ({ arcanaIndex: idx, reversed: Math.random() < .3 }));
  const positions = t().spreads[0].positions;

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

  setTimeout(() => {
    layout.querySelectorAll('.vcard').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(-12px) scale(.95)'; el.style.transition = 'none';
      void el.offsetWidth;
      el.style.transition = `opacity .3s ${i * 80}ms ease, transform .3s ${i * 80}ms cubic-bezier(.34,1.4,.64,1)`;
      el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)';
    });
    setTimeout(() => $('quick-layout').scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }, 50);

  const resultEl = $('quick-reading-result');
  resultEl.innerHTML = `<div class="loading-block"><div class="loading-text">${t().loading}</div></div>`;

  const lines = quickSlots.map((slot, i) => {
    const a = ARCANES[slot.arcanaIndex];
    const aPt = lang === 'pt' ? ARCANES_PT[slot.arcanaIndex] : a;
    return `${t().pos_label} ${i + 1} (${positions[i]}) : ${a.name} (Arcane ${a.roman})${slot.reversed ? ' — RENVERSÉE' : ''}\nMots-clés : ${aPt.keywords.join(', ')}\nSens endroit : ${aPt.upright}\nSens renversé : ${aPt.reversed}`;
  }).join('\n\n');

  const sysPrompt = t().sys + getProfilContext();
  const userPrompt = t().prompt(t().spreads[0].name, t().spreads[0].desc, lines, '');

  try {
    const raw = await callGroq([{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }]);

    const p1 = raw.match(/PA(?:R?TIE|RT?E?)\s*1[^:\n]*[:\n]([\s\S]*?)(?=PA(?:R?TIE|RT?E?)\s*2|$)/i);
    const p2 = raw.match(/PA(?:R?TIE|RT?E?)\s*2[^:\n]*[:\n]([\s\S]*)/i);
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

  btn.style.display = 'none';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn-shuffle';
  newBtn.textContent = t().quick_new || 'Nouveau tirage →';
  newBtn.style.margin = '16px 0 -8px 0';
  newBtn.onclick = () => {
    newBtn.remove();
    $('quick-layout').scrollIntoView({ behavior: 'instant', block: 'center' });
    quickShuffleAndAnalyze();
  };
  $('quick-reading-result').insertAdjacentElement('afterend', newBtn);
}

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
    const suggestPrompt = t().suggestions_prompt || 'Génère exactement 3 questions très courtes (max 6 mots chacune) à la première personne pour approfondir. Une par ligne, sans numéro, sans tiret.';
    const raw = await callGroq([
      ...history,
      { role: 'user', content: suggestPrompt }
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

// ─── TUTO ───
function showTuto() {
  const T = t();
  const tutoData = T.tuto || [
    { title: 'Accueil', desc: "Ta carte du jour t'attend chaque matin. Tire aussi 3 cartes en un clic." },
    { title: 'Tirages', desc: 'Choisis parmi 8 tirages. De 3 à 7 cartes selon ta question.' },
    { title: 'Arcanes', desc: 'Explore les 22 Arcanes Majeurs et leur symbolisme.' },
    { title: 'Moi', desc: 'Entre ta clé API et ton profil pour des lectures personnalisées.' },
  ];

  const icons = [
    '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><path d="M6 20L22 6l16 14"/><path d="M10 16v20h9v-10h6v10h9V16"/></svg></div>',
    '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><rect x="8" y="6" width="20" height="30" rx="3"/><rect x="16" y="10" width="20" height="30" rx="3"/><path d="M16 18h8M16 24h6"/></svg></div>',
    '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><circle cx="22" cy="10" r="4"/><path d="M22 14v14"/><path d="M14 20l8 4 8-4"/><path d="M18 36l4-8 4 8"/><path d="M8 30c4-2 8 2 14-2s10 0 14-2"/></svg></div>',
    '<div style="width:56px;height:56px;border-radius:14px;background:var(--tint-bg);border:1px solid rgba(201,120,50,.2);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;color:var(--tint);"><circle cx="22" cy="14" r="6"/><path d="M8 38c0-7 6-12 14-12s14 5 14 12"/></svg></div>',
  ];

  const steps = tutoData.map((d, i) => ({ ...d, icon: icons[i] || icons[icons.length - 1] }));

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
      <button onclick="document.getElementById('tuto-overlay').remove();try{localStorage.setItem('tuto_done','1')}catch(e){}" style="flex:1;background:var(--fill);border:none;color:var(--label-2);font-family:var(--font);font-size:11px;font-weight:600;letter-spacing:.5px;padding:13px;border-radius:100px;cursor:pointer;">${T.btn_skip || 'Passer'}</button>
      <button id="tuto-next" style="flex:2;background:var(--tint);border:none;color:#fff;font-family:var(--font);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:13px;border-radius:100px;cursor:pointer;">${current < steps.length-1 ? (T.btn_next || 'Suivant →') : (T.btn_start_tuto || 'Commencer')}</button>
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

// ─── MISC ───
function cleanScreenStyles() {
  document.querySelectorAll('.screen').forEach(el => {
    ['position','top','left','width','height','overflow-y','z-index','will-change','transform','transition','display'].forEach(p => {
      el.style.removeProperty(p);
    });
  });
}

function toggleLangInDrawer() {
  const newLang = lang === 'fr' ? 'pt' : 'fr';
  setLang(newLang);
  const lbl = $('drawer-lang-label');
  if (lbl) lbl.textContent = newLang === 'fr' ? 'Français' : 'Português';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#settings-trigger') &&
      !e.target.closest('#mute-btn') &&
      !e.target.closest('#theme-btn') &&
      !e.target.closest('#lang-btn') &&
      !e.target.closest('#lang-menu')) {
    document.body.classList.remove('settings-open');
  }
});

function resetAccueil() {
  $('quick-result').style.display = 'none';
  const bqs = $('btn-quick-shuffle');
  if (bqs) {
    bqs.style.display = '';
    bqs.disabled = false;
    bqs.textContent = t().quick_shuffle_btn || 'Tirer & analyser en un clic →';
  }
  quickChatHistory = [];
  window.scrollTo(0, 0);
}

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

    const greeting = lang === 'pt' ? 'Olá' : 'Bonjour';
    const banner = $('session-banner-accueil');
    banner.innerHTML = `
      <div style="background:var(--glass-bg);backdrop-filter:var(--blur);border-radius:var(--r-lg);border:1px solid var(--glass-border-outer);padding:20px 22px;margin-bottom:24px;text-align:center;animation:fadeInUp .4s ease;">
        <div style="font-size:22px;margin-bottom:8px;">✦</div>
        <div style="font-size:16px;font-weight:600;color:var(--label);">${greeting}, ${name}</div>
      </div>`;

    setTimeout(() => {
      activateSession(name);
      buildSpreadsWithDaily();
      loadDailyReadingAccueil();
    }, 1200);
  }, 1000);
}

// ─── INIT ───
cleanScreenStyles();
setTimeout(hideSplash, 1500);

function init() {
  loadSavedSession();
  setLang(lang);
  loadFontSize();
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

  try {
    if (!localStorage.getItem('tuto_done')) setTimeout(showTuto, 2000);
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', init);

// ─── DAILY CARD DETAIL ───
function openDailyCardDetail(date, index, reversed) {
  const a = ARCANES[index];
  const reading = localStorage.getItem('daily_reading_' + date);
  const d = new Date(date + 'T12:00:00');
  const dateLabel = d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  const overlay = $('modal-overlay');
  const modal = overlay.querySelector('.modal');

  modal.innerHTML = `
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;">
        <div class="modal-svg" style="color:${reversed ? 'var(--red)' : 'var(--tint)'};">${ARCANA_SVG[index]}</div>
        <div style="min-width:0;">
          <div class="modal-roman">Arcane ${a.roman}${reversed ? ' · <span style="color:var(--red)">Renversée</span>' : ''}</div>
          <div class="modal-name">${a.name}</div>
          <div class="modal-altname">${dateLabel}</div>
        </div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-sec">
        <div class="modal-sec-title">Mots-clés</div>
        <div class="modal-kws">${a.keywords.map(k => `<span class="modal-kw">${k}</span>`).join('')}</div>
      </div>
      <div class="modal-sec">
        <div class="modal-sec-title">Lecture du jour</div>
        <div class="modal-text" style="font-size:14px;line-height:1.7;color:var(--label-2);">
          ${reading ? (() => {
            const parts = reading.split('→');
            let html = fmt(parts[0].trim());
            if (parts[1]) html += `<span class="hl-point">→ ${parts[1].trim()}</span>`;
            return html;
          })() : `<span style="color:var(--label-3);">Lecture non disponible.</span>`}
        </div>
      </div>
      <div class="modal-sec modal-rev-block">
        <div class="modal-sec-title">${reversed ? 'Sens renversé' : 'Sens à l\'endroit'}</div>
        <div class="modal-text">${reversed ? a.reversed : a.upright}</div>
      </div>
      <div class="modal-sec">
        <div class="modal-sec-title">Symbolisme</div>
        <div class="modal-text">${a.symbolism}</div>
      </div>
    </div>`;

  overlay.classList.add('open');
}