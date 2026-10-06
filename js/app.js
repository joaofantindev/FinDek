/* ================= storage ================= */
const K = {
  transactions: 'findek.transactions',
  notes: 'findek.notes',
  prefs: 'findek.prefs',
  categories: 'findek.categories',
  budgets: 'findek.budgets',
  history: 'findek.history',
  wallpaper: 'findek.wallpaper',
  salary: 'findek.salary',
  fixed: 'findek.fixed',
  external: 'findek.external'
};

const load = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch { toast('Falha ao salvar no localStorage', 'warn'); }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const shiftISO = days => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const parseISO = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysUntil = s => Math.round((parseISO(s) - parseISO(todayISO())) / 86400000);

const fmtDate = s => {
  const d = parseISO(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};
const fmtDateTs = ts => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const fmtDateTime = ts => new Date(ts).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});
const fmtBRL = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const monthKey = (ref = new Date()) =>
  `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}`;

/* data efetiva da transação: vencimento ou criação */
const txDate = t => t.due || new Date(t.createdAt || Date.now()).toISOString().slice(0, 10);
const inMonth = (t, ref = new Date()) => txDate(t).startsWith(monthKey(ref));

const TYPES = {
  despesa: { label: 'Despesa', weight: 0, color: 'var(--text)' },
  receita: { label: 'Receita', weight: 1, color: 'var(--ok)' }
};

const CATEGORY_COLORS = ['#16a34a','#0d9488','#84cc16','#0ea5e9','#8b5cf6','#ec4899','#f59e0b','#64748b','#14b8a6','#4d7c0f','#a16207'];

const CATEGORIES_DEFAULT = [
  'Alimentação','Moradia','Transporte','Saúde','Educação','Lazer',
  'Assinaturas','Contas','Renda','Investimentos','Outros'
];

const BUDGET_STATUS = {
  ativo: { label: 'Ativo', color: 'var(--accent)' },
  pausado: { label: 'Pausado', color: 'var(--warn)' },
  concluido: { label: 'Concluído', color: 'var(--ok)' }
};

const DAY = 86400000;
const HISTORY_DAYS = 7;
const HISTORY_MAX = 400;
const WALL_MAX_SIZE = 1920;

/* ================= state ================= */
const defaultPrefs = {
  theme: 'verde',
  accent: '#16a34a',
  density: 'normal',
  motion: 'on',
  font: 'system',
  notesMode: 'split',
  accentCustom: false,
  categoryColors: {}
};

let transactions = load(K.transactions, []);
let notes = load(K.notes, []);
let prefs = Object.assign({}, defaultPrefs, load(K.prefs, {}));
let budgets = load(K.budgets, []);
let history = load(K.history, []);
let wallpaper = load(K.wallpaper, null);
let salaries = (() => {
  const raw = load(K.salary, null);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
})();
let fixed = (Array.isArray(load(K.fixed, [])) ? load(K.fixed, []) : []).map(normalizeFixed).filter(Boolean);
let external = (Array.isArray(load(K.external, [])) ? load(K.external, []) : []).map(normalizeExternal).filter(Boolean);

const slug = name => String(name || '').trim().toLowerCase();

function migrateCategories() {
  const set = new Set(CATEGORIES_DEFAULT);
  transactions.forEach(t => t.category && set.add(t.category));
  const list = Array.from(set);
  save(K.categories, list);
  return list;
}

let categories = (() => {
  const stored = load(K.categories, null);
  if (Array.isArray(stored) && stored.length) {
    return Array.from(new Set(stored.map(s => String(s).trim()).filter(Boolean)));
  }
  return migrateCategories();
})();

const findCategory = name => categories.find(s => slug(s) === slug(name));

budgets = (Array.isArray(budgets) ? budgets : []).map(b => ({
  id: b.id || uid(),
  title: b.title || 'Orçamento',
  category: b.category || '',
  status: BUDGET_STATUS[b.status] ? b.status : 'ativo',
  limit: Number(b.limit) || 0,
  due: b.due || '',
  desc: b.desc || '',
  items: (Array.isArray(b.items) ? b.items : []).map(normalizeItem).filter(Boolean),
  links: (Array.isArray(b.links) ? b.links : []).map(l => ({
    id: l.id || uid(),
    label: l.label || l.url || 'link',
    url: l.url || ''
  })).filter(l => l.url),
  note: { content: (b.note && b.note.content) || '', updatedAt: (b.note && b.note.updatedAt) || Date.now() },
  createdAt: b.createdAt || Date.now(),
  updatedAt: b.updatedAt || Date.now()
}));

transactions.forEach(t => { if (!Array.isArray(t.subtasks)) t.subtasks = []; });
history = (Array.isArray(history) ? history : []).filter(h => h && h.id && h.title);

let ui = {
  view: 'dashboard',
  search: '',
  filters: { category: '', type: '', status: 'pending', overdue: false, sort: 'smart' },
  editingTransactionId: null,
  activeNoteId: notes[0]?.id || null,
  editingCategory: null,
  categorySearch: '',
  activeBudgetId: budgets[0]?.id || null,
  budgetSearch: '',
  budgetNoteLoadedFor: null,
  goalFilters: { status: 'pending' },
  editingBudgetId: null,
  editingGoalId: null,
  editingGoalBudgetId: null,
  editingFixedId: null,
  editingExternalId: null,
  openGroups: new Set(),
  confirmAction: null
};

const persistAll = () => {
  save(K.transactions, transactions);
  save(K.notes, notes);
  save(K.prefs, prefs);
  save(K.categories, categories);
  save(K.budgets, budgets);
  save(K.history, history);
  save(K.salary, salaries);
  save(K.fixed, fixed);
  save(K.external, external);
};
const persistTransactions = () => save(K.transactions, transactions);
const persistNotes = () => save(K.notes, notes);
const persistCategories = () => save(K.categories, categories);
const persistBudgets = () => save(K.budgets, budgets);
const persistHistory = () => save(K.history, history);
const persistSalary = () => save(K.salary, salaries);
const persistFixed = () => save(K.fixed, fixed);
const persistExternal = () => save(K.external, external);

/* ================= dom ================= */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const el = id => document.getElementById(id);

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ================= toast ================= */
const TOAST_ICONS = {
  ok: '<path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  warn: '<path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
};

function toast(msg, kind = 'info') {
  const box = el('toasts');
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.innerHTML = `<svg viewBox="0 0 24 24">${TOAST_ICONS[kind] || TOAST_ICONS.info}</svg><span></span>`;
  node.querySelector('span').textContent = msg;
  box.appendChild(node);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => {
    node.style.transition = 'opacity .2s,transform .2s';
    node.style.opacity = '0';
    node.style.transform = 'translateX(20px)';
    setTimeout(() => node.remove(), 220);
  }, 2600);
}

function setStatus(msg) { el('status-left').textContent = msg; }

/* ================= modal ================= */
const openModal = id => {
  el(id).classList.add('is-open');
  el('backdrop').classList.add('is-open');
};
const closeModals = () => {
  $$('.modal').forEach(m => m.classList.remove('is-open'));
  el('backdrop').classList.remove('is-open');
};

function confirmAction(title, text, cb) {
  el('confirm-title').textContent = title;
  el('confirm-text').textContent = text;
  ui.confirmAction = cb;
  openModal('confirm-modal');
}

/* ================= theme / prefs ================= */
const THEMES = [
  { id:'verde', name:'Verde', desc:'branco e verde' },
  { id:'floresta', name:'Floresta', desc:'verde escuro' },
  { id:'hortela', name:'Hortelã', desc:'menta suave' },
  { id:'azul', name:'Azul noite', desc:'verde sobre azul' },
  { id:'amber', name:'Âmbar', desc:'quente e claro' },
  { id:'papel', name:'Papel', desc:'neutro e limpo' }
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(n.slice(0,2),16), parseInt(n.slice(2,4),16), parseInt(n.slice(4,6),16)];
}
const shade = (hex, amt) => {
  const [r,g,b] = hexToRgb(hex);
  const f = c => Math.max(0, Math.min(255, Math.round(c + amt)));
  return `#${[f(r),f(g),f(b)].map(c => c.toString(16).padStart(2,'0')).join('')}`;
};

const relLum = rgb => {
  const f = c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
const contrastWith = (rgb, ref) => {
  const a = relLum(rgb), b = relLum(ref);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const toHex = rgb => '#' + rgb.map(c =>
  Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');

function readableFill(hex) {
  let rgb = hexToRgb(hex);
  if (contrastWith(rgb, [255, 255, 255]) >= 4.5) return hex;
  for (let i = 0; i < 30 && rgb.some(c => c > 0); i++) rgb = rgb.map(c => c * 0.92);
  return toHex(rgb);
}

function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.density = prefs.density;
  document.documentElement.dataset.motion = prefs.motion;
  document.documentElement.dataset.font = prefs.font;
  document.documentElement.style.setProperty('--accent', prefs.accent);
  document.documentElement.style.setProperty('--accent-fill', readableFill(prefs.accent));
  document.documentElement.style.setProperty('--accent-2', shade(prefs.accent, 45));
  el('accent-picker').value = prefs.accent;
  el('accent-picker-2').value = prefs.accent;
  el('opt-compact').checked = prefs.density === 'compact';
  el('opt-motion').checked = prefs.motion === 'on';
  el('opt-font').value = prefs.font;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', ['floresta','azul'].includes(prefs.theme) ? '#0a0f0c' : '#f6faf7');
  if (el('editor-body')) setNotesMode(prefs.notesMode);
  renderThemeGrid();
}

const THEME_ACCENT = {
  verde: '#16a34a', floresta: '#22c55e', hortela: '#0d9488',
  azul: '#34d399', amber: '#d97706', papel: '#16a34a'
};

function setTheme(id) {
  prefs.theme = id;
  if (!prefs.accentCustom) prefs.accent = THEME_ACCENT[id] || THEME_ACCENT.verde;
  applyPrefs();
  persistAll();
  renderAll();
  toast(`Tema "${THEMES.find(t => t.id === id).name}" aplicado`, 'ok');
}

function renderThemeGrid() {
  const accent = THEME_ACCENT;
  const bg = { verde:'#ffffff', floresta:'#0a1710', hortela:'#ffffff', azul:'#0e1322', amber:'#ffffff', papel:'#ffffff' };
  el('theme-grid').innerHTML = THEMES.map(t => `
    <button class="theme-card ${t.id === prefs.theme ? 'is-active' : ''}" data-theme-id="${t.id}">
      <div class="theme-prev" style="background:${bg[t.id]}">
        <div class="side" style="background:${bg[t.id]};box-shadow:inset 0 0 0 1px ${accent[t.id]}33"></div>
        <div class="main">
          <div class="bar" style="background:${accent[t.id]}"></div>
          <div class="bar" style="background:${accent[t.id]}55"></div>
          <div class="bar w60" style="background:${accent[t.id]}33"></div>
        </div>
      </div>
      <div class="meta">
        <strong>${t.name}</strong>
        <small>${t.desc}</small>
      </div>
    </button>`).join('');
}

/* ================= wallpaper ================= */
const kb = bytes => bytes > 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function applyWallpaperVars() {
  const root = document.documentElement;
  const on = !!(wallpaper && wallpaper.url);
  root.dataset.wall = on ? 'on' : 'off';
  if (on) {
    root.style.setProperty('--wallpaper', `url("${wallpaper.url}")`);
    root.style.setProperty('--wall-veil', String(wallpaper.veil ?? 0.35));
    root.style.setProperty('--wall-alpha', `${wallpaper.alpha ?? 90}%`);
    root.style.setProperty('--wall-blur', `${wallpaper.blur ?? 3}px`);
  } else {
    ['--wallpaper', '--wall-veil', '--wall-alpha', '--wall-blur'].forEach(p => root.style.removeProperty(p));
  }
}

function renderWallpaperUI() {
  const box = el('wall-preview');
  const on = !!(wallpaper && wallpaper.url);
  if (box) {
    box.classList.toggle('is-hidden', !on);
    if (on) {
      box.innerHTML = `
        <img src="${wallpaper.url}" alt="Plano de fundo atual">
        <div class="wall-info">
          <strong>${escapeHtml(wallpaper.name || 'wallpaper')}</strong>
          <small>${wallpaper.w}&times;${wallpaper.h} · ${kb(wallpaper.size || 0)} · enviado ${fmtDateTime(wallpaper.setAt || Date.now())}</small>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="wall-remove">Remover</button>`;
    } else {
      box.innerHTML = '';
    }
  }
  const range = id => { const n = el(id); if (n) n.disabled = !on; return n; };
  const veil = range('wall-veil');
  const alpha = range('wall-alpha');
  const blur = range('wall-blur');
  if (veil) veil.value = Math.round((wallpaper?.veil ?? 0.35) * 100);
  if (alpha) alpha.value = wallpaper?.alpha ?? 90;
  if (blur) blur.value = wallpaper?.blur ?? 3;
  el('wall-veil-val').textContent = `${Math.round((wallpaper?.veil ?? 0.35) * 100)}%`;
  el('wall-alpha-val').textContent = `${wallpaper?.alpha ?? 90}%`;
  el('wall-blur-val').textContent = `${wallpaper?.blur ?? 3}px`;
}

function applyWallpaper() {
  applyWallpaperVars();
  renderWallpaperUI();
}

function storeWallpaper(next) {
  const prev = wallpaper;
  wallpaper = next;
  try {
    localStorage.setItem(K.wallpaper, JSON.stringify(wallpaper));
  } catch {
    wallpaper = prev;
    applyWallpaper();
    toast('Imagem grande demais para o navegador — envie uma menor', 'warn');
    return false;
  }
  applyWallpaper();
  return true;
}

function downscaleImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, WALL_MAX_SIZE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      if (scale === 1) {
        resolve({ url: dataUrl, w, h });
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      try {
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ url: canvas.toDataURL('image/jpeg', 0.82), w, h });
      } catch {
        resolve({ url: dataUrl, w, h });
      }
    };
    img.onerror = () => reject(new Error('imagem inválida'));
    img.src = dataUrl;
  });
}

function uploadWallpaper(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    toast('Envie um arquivo de imagem', 'warn');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    downscaleImage(e.target.result)
      .then(img => {
        const prev = wallpaper || {};
        const ok = storeWallpaper({
          url: img.url,
          name: file.name,
          w: img.w,
          h: img.h,
          size: Math.round(img.url.length * 0.75),
          veil: prev.veil ?? 0.35,
          alpha: prev.alpha ?? 90,
          blur: prev.blur ?? 3,
          setAt: Date.now()
        });
        if (!ok) return;
        toast('Plano de fundo aplicado', 'ok');
        setStatus(`Wallpaper "${file.name}" aplicado`);
      })
      .catch(() => toast('Não consegui ler essa imagem', 'warn'));
  };
  reader.onerror = () => toast('Falha ao ler o arquivo', 'warn');
  reader.readAsDataURL(file);
}

function removeWallpaper() {
  wallpaper = null;
  try { localStorage.removeItem(K.wallpaper); } catch {}
  applyWallpaper();
  toast('Plano de fundo removido', 'warn');
  setStatus('Plano de fundo removido');
}

/* ================= categories ================= */
const nextColor = () => {
  const used = Object.values(prefs.categoryColors);
  const free = CATEGORY_COLORS.find(c => !used.includes(c));
  return free || CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
};

const categoryTransactions = name => transactions.filter(t => slug(t.category) === slug(name));

const allCategories = () => {
  const known = new Set(categories.map(slug));
  const strays = transactions
    .map(t => t.category)
    .filter(s => s && !known.has(slug(s)));
  return Array.from(new Set([...categories, ...strays]));
};

const categoryColor = s => {
  if (prefs.categoryColors[s]) return prefs.categoryColors[s];
  const match = findCategory(s) || s;
  if (prefs.categoryColors[match]) return prefs.categoryColors[match];
  const list = allCategories();
  const idx = list.findIndex(x => slug(x) === slug(s));
  return CATEGORY_COLORS[(idx < 0 ? 0 : idx) % CATEGORY_COLORS.length];
};

function addCategory(name) {
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, error: 'Digite um nome para a categoria.' };
  if (clean.length > 40) return { ok: false, error: 'Use no máximo 40 caracteres.' };
  if (findCategory(clean)) return { ok: false, error: `"${clean}" já existe.` };
  categories.push(clean);
  prefs.categoryColors[clean] = nextColor();
  persistCategories();
  save(K.prefs, prefs);
  renderAll();
  setStatus(`Categoria "${clean}" adicionada`);
  return { ok: true, name: clean };
}

function renameCategory(oldName, newName) {
  const from = findCategory(oldName);
  const clean = String(newName || '').trim();
  if (!from) return { ok: false, error: 'Categoria não encontrada.' };
  if (!clean) return { ok: false, error: 'Digite um nome para a categoria.' };
  if (clean.length > 40) return { ok: false, error: 'Use no máximo 40 caracteres.' };
  const clash = findCategory(clean);
  if (clash && clash !== from) return { ok: false, error: `"${clean}" já existe.` };
  if (clean === from) return { ok: true, name: from };

  const idx = categories.indexOf(from);
  categories[idx] = clean;
  if (prefs.categoryColors[from]) {
    prefs.categoryColors[clean] = prefs.categoryColors[from];
    delete prefs.categoryColors[from];
  } else {
    prefs.categoryColors[clean] = nextColor();
  }

  let txHits = 0;
  transactions.forEach(t => {
    if (slug(t.category) === slug(from)) { t.category = clean; txHits++; }
  });

  let noteHits = 0;
  notes.forEach(n => {
    if (!Array.isArray(n.tags)) return;
    n.tags = n.tags.map(tag => {
      if (slug(tag) !== slug(from)) return tag;
      noteHits++;
      return clean;
    });
  });

  budgets.forEach(b => {
    if (slug(b.category) === slug(from)) b.category = clean;
  });

  if (ui.filters.category === from) ui.filters.category = clean;
  if (el('filter-category').value === from) el('filter-category').value = clean;

  persistAll();
  renderAll();
  setStatus(`Categoria renomeada para "${clean}"`);
  return { ok: true, name: clean, txHits, noteHits };
}

function deleteCategory(name) {
  const target = findCategory(name);
  if (!target) return { ok: false, error: 'Categoria não encontrada.' };
  if (categories.length <= 1) return { ok: false, error: 'Mantenha ao menos uma categoria.' };

  const detached = categoryTransactions(target).length;
  categories = categories.filter(s => s !== target);
  transactions.forEach(t => {
    if (slug(t.category) === slug(target)) t.category = '';
  });
  notes.forEach(n => {
    if (Array.isArray(n.tags)) n.tags = n.tags.filter(tag => slug(tag) !== slug(target));
  });
  budgets.forEach(b => {
    if (slug(b.category) === slug(target)) b.category = '';
  });
  delete prefs.categoryColors[target];
  if (ui.filters.category === target) ui.filters.category = '';

  persistAll();
  renderAll();
  return { ok: true, detached };
}

function commitCategoryRename() {
  const pending = ui.editingCategory;
  ui.editingCategory = null;
  if (!pending) return;

  if (pending.value.trim() === pending.original) {
    renderCategoryManager();
    return;
  }

  const res = renameCategory(pending.original, pending.value);
  renderCategoryManager();

  if (!res.ok) {
    toast(res.error, 'warn');
    return;
  }
  const details = [];
  if (res.txHits) details.push(`${res.txHits} transação${res.txHits !== 1 ? 'ões' : ''}`);
  if (res.noteHits) details.push(`${res.noteHits} tag${res.noteHits !== 1 ? 's' : ''} de nota`);
  toast(`Categoria "${res.name}"${details.length ? ` · atualizou ${details.join(' e ')}` : ''}`, 'ok');
}

function openCategoryModal() {
  ui.categorySearch = '';
  ui.editingCategory = null;
  el('category-search').value = '';
  el('category-new').value = '';
  renderCategoryManager();
  openModal('category-modal');
  el('category-new').focus();
}

function renderCategoryManager() {
  const box = el('category-manager');
  if (!box) return;
  const q = ui.categorySearch || '';
  const list = allCategories()
    .filter(s => !q || s.toLowerCase().includes(slug(q)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  box.innerHTML = list.length ? list.map(s => {
    const pending = categoryTransactions(s).filter(t => !t.paid).length;
    const total = categoryTransactions(s).length;
    return `
      <li class="sm-row" data-category-row="${escapeHtml(s)}">
        <input type="color" class="sm-color" data-act="color" value="${categoryColor(s)}" title="Cor da categoria">
        <input type="text" class="sm-name" data-act="name" value="${escapeHtml(s)}" maxlength="40" aria-label="Nome da categoria">
        <span class="sm-count" title="${total} transação${total !== 1 ? 'ões' : ''} no total">${pending}<span class="muted">/${total}</span></span>
        <button class="sm-btn" data-act="del" title="Excluir categoria">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </li>`;
  }).join('') : '<li class="empty">Nenhuma categoria encontrada.</li>';

  el('category-count').textContent = allCategories().length;
}

/* ================= transactions ================= */
const isLate = t => !t.paid && t.due && daysUntil(t.due) < 0;

function filteredTransactions() {
  const f = ui.filters;
  const q = ui.search.trim().toLowerCase();
  let list = transactions.filter(t => {
    if (f.status === 'pending' && t.paid) return false;
    if (f.status === 'paid' && !t.paid) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.overdue && !isLate(t)) return false;
    if (q && !(`${t.title} ${t.category || ''} ${t.notes || ''} ${t.method || ''}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const byDue = (a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  };
  const byDateDesc = (a, b) => (txDate(b) + (b.due ? '' : 'z')).localeCompare(txDate(a) + (a.due ? '' : 'z')) || b.createdAt - a.createdAt;

  list.sort((a, b) => {
    if (f.sort === 'date') return byDateDesc(a, b);
    if (f.sort === 'amount') return (b.amount || 0) - (a.amount || 0);
    if (f.sort === 'created') return b.createdAt - a.createdAt;
    if (f.sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
    return (a.paid - b.paid)
      || byDue(a, b)
      || (b.amount || 0) - (a.amount || 0);
  });

  return list;
}

const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EDIT_SVG = '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16zM13.5 5.5l4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DEL_SVG = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOSE_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24"><path d="M9 9h10v10H9z"/><path d="M15 9V5H5v10h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';
const UNDO_SVG = '<svg viewBox="0 0 24 24"><path d="M4 10h9a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HOURS_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function dueTag(t) {
  if (!t.due) return '';
  const d = daysUntil(t.due);
  if (t.paid) return `<span class="tag">✓ ${fmtDate(t.due)}</span>`;
  if (d < 0) return `<span class="tag due-late">vencida</span>`;
  if (d === 0) return `<span class="tag due-today">hoje</span>`;
  if (d === 1) return `<span class="tag due-today">amanhã</span>`;
  if (d <= 7) return `<span class="tag">${fmtDate(t.due)} · ${d}d</span>`;
  return `<span class="tag">${fmtDate(t.due)}</span>`;
}

function renderTransactionList() {
  const list = filteredTransactions();
  el('transactions-heading').textContent =
    ui.filters.category ? ui.filters.category : 'Todas as transações';

  const box = el('transaction-list');
  if (!list.length) {
    box.innerHTML = `<li class="empty">${ui.search ? 'Nenhum resultado para "' + escapeHtml(ui.search) + '"' : 'Nenhuma transação aqui. Crie a primeira!'}</li>`;
    return;
  }

  box.innerHTML = list.map(t => `
    <li class="tgroup" data-scope="transaction" data-id="${t.id}">
      <div class="task ${t.paid ? 'is-done' : ''} ${isLate(t) ? 'is-late' : ''}" style="--p:${t.type === 'receita' ? 'var(--ok)' : 'var(--accent)'}">
        <button class="check" data-act="toggle" aria-label="Alternar pagamento">${CHECK_SVG}</button>
        <div class="task-info">
          <span class="t-title">${escapeHtml(t.title)}${subCountBadge(t, 'parcelas')}</span>
          <div class="t-meta">
            ${t.category ? `<span class="tag" style="color:${categoryColor(t.category)};border-color:${categoryColor(t.category)}55">${escapeHtml(t.category)}</span>` : ''}
            <span class="tag type-${t.type}">${TYPES[t.type].label}</span>
            ${t.method ? `<span class="tag">${escapeHtml(t.method)}</span>` : ''}
            ${dueTag(t)}
            ${t.notes ? `<span class="t-note">— ${escapeHtml(t.notes)}</span>` : ''}
          </div>
        </div>
        <span class="t-amount ${t.type === 'receita' ? 'in' : ''}">${t.type === 'receita' ? '+' : '−'} ${fmtBRL(t.amount)}</span>
        <div class="task-actions">
          <button data-act="edit" title="Editar">${EDIT_SVG}</button>
          <button data-act="del" class="del" title="Excluir">${DEL_SVG}</button>
        </div>
      </div>
      ${subPanel(t, 'transaction', '', 'parcelas')}
    </li>`).join('');
}

function renderCategorySidebar() {
  const counts = {};
  transactions.forEach(t => {
    if (!t.paid && t.category) counts[t.category] = (counts[t.category] || 0) + 1;
  });
  const list = allCategories();
  const wrap = el('sidebar-categories');
  wrap.innerHTML = list.map(s => `
    <button class="category-chip ${ui.filters.category === s && ui.view === 'transactions' ? 'is-active' : ''}" data-category="${escapeHtml(s)}">
      <span class="dot" style="background:${categoryColor(s)}"></span>
      <span>${escapeHtml(s)}</span>
      <span class="n">${counts[s] || 0}</span>
    </button>`).join('');

  const sel = el('filter-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas</option>' + list.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  sel.value = list.includes(cur) ? cur : '';

  el('category-list').innerHTML = list.map(s => `<option value="${escapeHtml(s)}"></option>`).join('');

  const budgetSel = el('j-category');
  if (budgetSel) {
    const bcur = budgetSel.value;
    budgetSel.innerHTML = list.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    budgetSel.value = list.includes(bcur) ? bcur : (list[0] || '');
  }
}

/* ---------- parcelas / submetas ---------- */
const subtasks = node => {
  if (!Array.isArray(node.subtasks)) node.subtasks = [];
  return node.subtasks;
};

const subProgress = node => {
  const list = subtasks(node);
  const done = list.filter(s => s.done).length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
};

const groupKey = (scope, budgetId, id) => `${scope}:${budgetId || ''}:${id}`;

function findNode(scope, budgetId, id) {
  if (scope === 'goal') {
    const budget = budgets.find(b => b.id === budgetId);
    const node = budget && budget.items.find(i => i.id === id);
    return node ? { node, budget } : null;
  }
  const node = transactions.find(t => t.id === id);
  return node ? { node, budget: null } : null;
}

const persistNode = found => found.budget ? persistBudgets() : persistTransactions();

const subCountBadge = (node, noun = 'subtarefas') => {
  const p = subProgress(node);
  if (!p.total) return '';
  return `<span class="sub-count ${p.done === p.total ? 'is-full' : ''}">${p.done}/${p.total} ${noun}</span>`;
};

function subPanel(node, scope, budgetId, noun = 'subtarefas') {
  const key = groupKey(scope, budgetId, node.id);
  if (!ui.openGroups.has(key)) return '';
  const list = subtasks(node);
  const rows = list.length
    ? list.map(s => `
      <li class="sub-row ${s.done ? 'is-done' : ''}" data-sub-id="${s.id}">
        <button class="sub-check" data-act="sub-toggle" aria-label="Alternar item">${CHECK_SVG}</button>
        <span class="sub-title">${escapeHtml(s.title)}</span>
        <button class="sub-del" data-act="sub-del" title="Excluir item">${CLOSE_SVG}</button>
      </li>`).join('')
    : '<li class="sub-empty muted">Nenhum item ainda.</li>';

  const placeholder = scope === 'goal' ? 'Nova submeta — Enter para adicionar' : 'Nova parcela — Enter para adicionar';

  return `
    <div class="subs" style="--p:${node.type === 'receita' ? 'var(--ok)' : 'var(--accent)'}">
      <ul class="subs-list">${rows}</ul>
      <form class="subs-form" data-scope="${scope}" data-budget="${budgetId || ''}" data-id="${node.id}">
        <input type="text" class="subs-input" placeholder="${placeholder}" maxlength="120" autocomplete="off">
        <button type="submit" class="subs-add" title="Adicionar item">${PLUS_SVG}</button>
      </form>
    </div>`;
}

const toggleGroup = (scope, budgetId, id) => {
  const key = groupKey(scope, budgetId, id);
  if (ui.openGroups.has(key)) ui.openGroups.delete(key);
  else ui.openGroups.add(key);
  scope === 'goal' ? renderGoalList() : renderTransactionList();
};

function addSubtask(found, title) {
  const clean = String(title || '').trim();
  if (!clean || !found) return false;
  subtasks(found.node).push({
    id: uid(), title: clean, done: false, createdAt: Date.now(), completedAt: null
  });
  found.node.completedAt = found.node.paid || found.node.done ? (found.node.completedAt || Date.now()) : null;
  if (found.budget) found.budget.updatedAt = Date.now();
  persistNode(found);
  renderAll();
  return true;
}

function toggleSubtask(found, subId) {
  const sub = found && subtasks(found.node).find(s => s.id === subId);
  if (!sub) return;
  sub.done = !sub.done;
  sub.completedAt = sub.done ? Date.now() : null;
  persistNode(found);
  renderAll();
}

function deleteSubtask(found, subId) {
  if (!found) return;
  found.node.subtasks = subtasks(found.node).filter(s => s.id !== subId);
  persistNode(found);
  renderAll();
}

/* ================= history ================= */
const purgeHistory = () => {
  const now = Date.now();
  const before = history.length;
  history = history.filter(h => !h.expiresAt || h.expiresAt > now);
  if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
  if (history.length !== before) persistHistory();
};

function recordCompletion(node, kind, budgetId = null) {
  purgeHistory();
  const at = node.completedAt || Date.now();
  const key = `${kind}:${node.id}`;
  history = history.filter(h => h.key !== key);
  history.unshift({
    id: uid(),
    key,
    kind,
    budgetId,
    originId: node.id,
    title: node.title,
    category: node.category || '',
    type: node.type || 'despesa',
    amount: node.amount || 0,
    due: node.due || '',
    notes: node.notes || '',
    subtasks: subtasks(node).map(s => Object.assign({}, s)),
    completedAt: at,
    expiresAt: at + HISTORY_DAYS * DAY
  });
  persistHistory();
}

const unrecordCompletion = (kind, originId) => {
  const before = history.length;
  history = history.filter(h => h.key !== `${kind}:${originId}`);
  if (history.length !== before) persistHistory();
};

const relTime = ts => {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return fmtDateTime(ts);
};

function renderHistory() {
  purgeHistory();
  const q = ui.search.trim().toLowerCase();
  const list = history
    .filter(h => !q || `${h.title} ${h.category || ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.completedAt - a.completedAt);

  el('nav-count-history').textContent = history.length;
  el('history-sub').textContent = history.length
    ? `${history.length} item${history.length !== 1 ? 'ns' : ''} · some em ${HISTORY_DAYS} dias`
    : `guardado por ${HISTORY_DAYS} dias no navegador`;

  const box = el('history-list');
  if (!list.length) {
    box.innerHTML = `<li class="empty">${ui.search ? 'Nenhum resultado para "' + escapeHtml(ui.search) + '"' : 'Nada no histórico ainda. Marque uma transação como paga para começar.'}</li>`;
    return;
  }

  box.innerHTML = list.map(h => {
    const left = Math.max(0, Math.ceil((h.expiresAt - Date.now()) / DAY));
    return `
    <li class="tgroup" data-scope="history" data-id="${h.id}">
      <div class="task is-done" style="--p:var(--ok)">
        <span class="hist-icon">${HOURS_SVG}</span>
        <div class="task-info">
          <span class="t-title">${escapeHtml(h.title)}</span>
          <div class="t-meta">
            ${h.category ? `<span class="tag">${escapeHtml(h.category)}</span>` : ''}
            <span class="tag type-${h.type || 'despesa'}">${TYPES[h.type || 'despesa']?.label || 'Despesa'}</span>
            <span class="tag">${fmtBRL(h.amount || 0)}</span>
            ${h.due ? `<span class="tag">venc. ${fmtDate(h.due)}</span>` : ''}
            <span class="tag">paga ${relTime(h.completedAt)}</span>
            <span class="tag">expira em ${left}d</span>
          </div>
        </div>
        <div class="task-actions">
          <button data-act="restore" title="Restaurar como pendente">${UNDO_SVG}</button>
        </div>
      </div>
    </li>`;
  }).join('');
}

function restoreHistoryEntry(entry) {
  if (!entry) return;
  transactions.unshift({
    id: uid(),
    title: entry.title,
    category: entry.category || '',
    type: TYPES[entry.type] ? entry.type : 'despesa',
    amount: Number(entry.amount) || 0,
    due: entry.due || '',
    method: '',
    paid: false,
    notes: entry.notes || '',
    subtasks: (entry.subtasks || []).map(s => Object.assign({}, s, { id: uid() })),
    createdAt: Date.now(),
    completedAt: null
  });
  history = history.filter(h => h.id !== entry.id);
  persistHistory();
  persistTransactions();
  renderAll();
  toast(`"${entry.title}" restaurada como pendente`, 'ok');
  setStatus('Transação restaurada do histórico');
}

/* ================= budgets ================= */
function normalizeItem(i) {
  if (!i || !i.title) return null;
  return {
    id: i.id || uid(),
    title: i.title,
    due: i.due || '',
    done: !!i.done,
    notes: i.notes || '',
    subtasks: (Array.isArray(i.subtasks) ? i.subtasks : [])
      .filter(s => s && s.title)
      .map(s => ({
        id: s.id || uid(), title: s.title, done: !!s.done,
        createdAt: s.createdAt || Date.now(), completedAt: s.completedAt || null
      })),
    createdAt: i.createdAt || Date.now(),
    completedAt: i.completedAt || null
  };
}

const activeBudget = () => budgets.find(b => b.id === ui.activeBudgetId) || null;

const goalProgress = budget => {
  const items = budget.items || [];
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
};

/* quanto já foi gasto na categoria deste orçamento no mês */
const budgetSpent = budget => {
  if (!budget.category) return 0;
  return transactions
    .filter(t => t.type === 'despesa' && inMonth(t) && slug(t.category) === slug(budget.category))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
};

const budgetUsage = budget => {
  const spent = budgetSpent(budget);
  const limit = Number(budget.limit) || 0;
  return { spent, limit, pct: limit > 0 ? (spent / limit) * 100 : 0 };
};

const isLateItem = i => !i.done && i.due && daysUntil(i.due) < 0;

const dueTagFor = (due, done) => {
  if (!due) return '';
  const d = daysUntil(due);
  if (done) return `<span class="tag">✓ ${fmtDate(due)}</span>`;
  if (d < 0) return `<span class="tag due-late">vencida</span>`;
  if (d === 0) return '<span class="tag due-today">hoje</span>';
  if (d === 1) return '<span class="tag due-today">amanhã</span>';
  if (d <= 7) return `<span class="tag">${fmtDate(due)} · ${d}d</span>`;
  return `<span class="tag">${fmtDate(due)}</span>`;
};

function budgetQuery() {
  return (ui.search.trim() || ui.budgetSearch.trim()).toLowerCase();
}

function renderBudgetList() {
  const q = budgetQuery();
  const list = budgets
    .filter(b => !q || `${b.title} ${b.category || ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const pendingGoals = budgets.reduce((n, b) => n + b.items.filter(i => !i.done).length, 0);
  el('nav-count-budgets').textContent = pendingGoals;

  const box = el('budget-list');
  if (!list.length) {
    box.innerHTML = `<li class="empty">${q ? 'Nenhum resultado para "' + escapeHtml(q) + '"' : 'Nenhum orçamento ainda. Crie o primeiro!'}</li>`;
    return;
  }

  box.innerHTML = list.map(b => {
    const u = budgetUsage(b);
    const st = BUDGET_STATUS[b.status] || BUDGET_STATUS.ativo;
    const pctW = u.limit > 0 ? Math.min(u.pct, 100) : 0;
    return `
    <li>
      <button class="budget-item ${b.id === ui.activeBudgetId ? 'is-active' : ''}" data-budget-id="${b.id}">
        <span class="budget-item-top">
          <strong>${escapeHtml(b.title)}</strong>
          <em class="tag" style="color:${st.color};border-color:${st.color}55">${st.label}</em>
        </span>
        ${b.category ? `<span class="budget-co">${escapeHtml(b.category)}</span>` : ''}
        <span class="budget-bar"><span class="budget-bar-done ${u.pct > 100 ? 'is-over' : ''}" style="width:${pctW}%"></span></span>
        <span class="budget-meta-line">
          <span>${fmtBRL(u.spent)} de ${fmtBRL(u.limit)}</span>
          <span>${goalProgress(b).done}/${goalProgress(b).total} metas</span>
        </span>
      </button>
    </li>`;
  }).join('');
}

function renderBudgetDetail() {
  const budget = activeBudget();
  el('budget-empty').classList.toggle('is-hidden', !!budget);
  el('budget-body').classList.toggle('is-hidden', !budget);
  if (!budget) {
    ui.budgetNoteLoadedFor = null;
    return;
  }

  const st = BUDGET_STATUS[budget.status] || BUDGET_STATUS.ativo;
  const u = budgetUsage(budget);
  const pct = Math.round(u.pct);
  el('budget-detail-title').textContent = budget.title;
  el('budget-detail-meta').innerHTML = [
    `<span class="tag" style="color:${st.color};border-color:${st.color}55">${st.label}</span>`,
    budget.category ? `<span class="tag" style="color:${categoryColor(budget.category)};border-color:${categoryColor(budget.category)}55">${escapeHtml(budget.category)}</span>` : '',
    `<span class="tag">limite ${fmtBRL(u.limit)}</span>`,
    `<span class="tag" style="${u.pct > 100 ? 'color:#fff;background:var(--warn);border-color:var(--warn)' : ''}">gasto ${fmtBRL(u.spent)} · ${pct}%</span>`,
    budget.due ? dueTagFor(budget.due, budget.status === 'concluido') : '',
    budget.desc ? `<span class="budget-desc">${escapeHtml(budget.desc)}</span>` : ''
  ].join('');

  renderLinks(budget);
  renderGoalList();

  if (ui.budgetNoteLoadedFor !== budget.id) {
    ui.budgetNoteLoadedFor = budget.id;
    el('budget-note-content').value = budget.note.content;
    updateBudgetNoteMeta();
    renderBudgetPreview();
  }
}

function renderLinks(budget) {
  const box = el('link-list');
  if (!budget.links.length) {
    box.innerHTML = '<li class="empty">Sem links. Adicione o site do banco, do banco digital ou da fatura.</li>';
    return;
  }
  box.innerHTML = budget.links.map(l => `
    <li class="link-card">
      <a class="link-main" href="${safeUrl(l.url)}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(l.label)}</strong>
        <small>${escapeHtml(hostOf(l.url))}</small>
      </a>
      <button class="link-copy" data-act="link-copy" data-link="${l.id}" title="Copiar URL">${COPY_SVG}</button>
      <button class="link-del" data-act="link-del" data-link="${l.id}" title="Remover link">${DEL_SVG}</button>
    </li>`).join('');
}

const hostOf = url => {
  try { return new URL(url).host || url; } catch { return url; }
};

function filteredGoals(budget) {
  const f = ui.goalFilters;
  const q = budgetQuery();
  return (budget.items || [])
    .filter(i => {
      if (f.status === 'pending' && i.done) return false;
      if (f.status === 'done' && !i.done) return false;
      if (q && !`${i.title} ${i.notes || ''}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.done - b.done)
      || String(a.due || '9999').localeCompare(String(b.due || '9999'))
      || (b.createdAt - a.createdAt));
}

function renderGoalList() {
  const budget = activeBudget();
  if (!budget || !el('goal-list')) return;
  const list = filteredGoals(budget);
  const total = budget.items.length;
  el('goals-heading').textContent = `${list.length} de ${total} meta${total !== 1 ? 's' : ''}`;

  const box = el('goal-list');
  if (!list.length) {
    box.innerHTML = `<li class="empty">${budgetQuery() ? 'Nenhum resultado para "' + escapeHtml(budgetQuery()) + '"' : 'Nenhuma meta ainda. Adicione a primeira acima.'}</li>`;
    return;
  }

  box.innerHTML = list.map(i => `
    <li class="tgroup" data-scope="goal" data-budget="${budget.id}" data-id="${i.id}">
      <div class="task ${i.done ? 'is-done' : ''} ${isLateItem(i) ? 'is-late' : ''}" style="--p:var(--accent)">
        <button class="check" data-act="toggle" aria-label="Alternar conclusão">${CHECK_SVG}</button>
        <div class="task-info">
          <span class="t-title">${escapeHtml(i.title)}${subCountBadge(i, 'submetas')}</span>
          <div class="t-meta">
            ${dueTagFor(i.due, i.done)}
            ${i.notes ? `<span class="t-note">— ${escapeHtml(i.notes)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button data-act="edit" title="Editar">${EDIT_SVG}</button>
          <button data-act="del" class="del" title="Excluir">${DEL_SVG}</button>
        </div>
      </div>
      ${subPanel(i, 'goal', budget.id, 'submetas')}
    </li>`).join('');
}

function toggleGoal(budget, item) {
  if (!budget || !item) return;
  item.done = !item.done;
  item.completedAt = item.done ? Date.now() : null;
  budget.updatedAt = Date.now();
  persistBudgets();
  renderAll();
  if (item.done) toast(`Meta "${item.title}" concluída`, 'ok');
}

function deleteGoal(budget, item) {
  if (!budget || !item) return;
  confirmAction('Excluir meta', `Remover "${item.title}" do orçamento "${budget.title}"?`, () => {
    budget.items = budget.items.filter(i => i.id !== item.id);
    ui.openGroups.delete(groupKey('goal', budget.id, item.id));
    budget.updatedAt = Date.now();
    persistBudgets();
    renderAll();
    toast('Meta excluída', 'warn');
  });
}

function openGoalModal(item = null, budget = null) {
  ui.editingGoalId = item ? item.id : null;
  ui.editingGoalBudgetId = item ? budget.id : null;
  el('goal-modal-title').textContent = item ? 'Editar meta' : 'Nova meta';
  el('wi-title').value = item ? item.title : '';
  el('wi-due').value = item ? (item.due || '') : '';
  el('wi-done').value = item && item.done ? '1' : '0';
  el('wi-notes').value = item ? (item.notes || '') : '';
  openModal('goal-modal');
  el('wi-title').focus();
}

function saveGoalFromForm() {
  const title = el('wi-title').value.trim();
  if (!title) return;
  const budget = budgets.find(b => b.id === ui.editingGoalBudgetId) || activeBudget();
  if (!budget) { toast('Abra um orçamento primeiro', 'warn'); return; }

  const data = {
    title,
    due: el('wi-due').value || '',
    done: el('wi-done').value === '1',
    notes: el('wi-notes').value.trim()
  };

  if (ui.editingGoalId) {
    const item = budget.items.find(i => i.id === ui.editingGoalId);
    if (!item) return;
    Object.assign(item, data);
    item.completedAt = data.done ? (item.completedAt || Date.now()) : null;
    toast('Meta atualizada', 'ok');
  } else {
    budget.items.unshift(normalizeItem(Object.assign({ createdAt: Date.now() }, data)));
    toast('Meta adicionada ao orçamento', 'ok');
  }

  budget.updatedAt = Date.now();
  persistBudgets();
  closeModals();
  renderAll();
  setStatus('Meta salva');
}

function openBudgetModal(budget = null) {
  ui.editingBudgetId = budget ? budget.id : null;
  el('budget-modal-title').textContent = budget ? 'Editar orçamento' : 'Novo orçamento';
  el('j-title').value = budget ? budget.title : '';
  renderCategorySidebar();
  if (budget && budget.category) el('j-category').value = budget.category;
  el('j-status').value = budget ? budget.status : 'ativo';
  el('j-limit').value = budget ? budget.limit : '';
  el('j-due').value = budget ? (budget.due || '') : shiftISO(30);
  el('j-desc').value = budget ? (budget.desc || '') : '';
  openModal('budget-modal');
  el('j-title').focus();
}

function saveBudgetFromForm() {
  const title = el('j-title').value.trim();
  if (!title) return;
  const data = {
    title,
    category: el('j-category').value,
    status: el('j-status').value,
    limit: Math.max(0, parseFloat(el('j-limit').value) || 0),
    due: el('j-due').value || '',
    desc: el('j-desc').value.trim()
  };

  if (ui.editingBudgetId) {
    const budget = budgets.find(b => b.id === ui.editingBudgetId);
    if (!budget) return;
    Object.assign(budget, data, { updatedAt: Date.now() });
    toast('Orçamento atualizado', 'ok');
  } else {
    const budget = Object.assign({
      id: uid(),
      items: [],
      links: [],
      note: { content: '', updatedAt: Date.now() },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, data);
    budgets.unshift(budget);
    ui.activeBudgetId = budget.id;
    toast('Orçamento criado', 'ok');
  }

  persistBudgets();
  closeModals();
  renderAll();
  setStatus('Orçamento salvo');
}

function deleteBudget(budget) {
  if (!budget) return;
  const p = goalProgress(budget);
  confirmAction('Excluir orçamento', `"${budget.title}" e suas ${p.total} meta(s), links e notas serão removidos. As transações não são afetadas.`, () => {
    budgets = budgets.filter(b => b.id !== budget.id);
    if (ui.activeBudgetId === budget.id) {
      ui.activeBudgetId = budgets[0]?.id || null;
      ui.budgetNoteLoadedFor = null;
    }
    persistBudgets();
    renderAll();
    toast('Orçamento excluído', 'warn');
  });
}

const normalizeUrl = raw => {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
  return `https://${v}`;
};

function addLink(budget) {
  const url = normalizeUrl(el('link-url').value);
  const label = el('link-label').value.trim();
  if (!budget) return;
  if (!url) { toast('Informe uma URL válida (ex.: banco.com.br)', 'warn'); el('link-url').focus(); return; }
  budget.links.unshift({ id: uid(), label: label || url, url });
  budget.updatedAt = Date.now();
  el('link-label').value = '';
  el('link-url').value = '';
  persistBudgets();
  renderAll();
  toast('Link adicionado', 'ok');
  setStatus('Link adicionado ao orçamento');
}

function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('URL copiada', 'ok'); }
    catch { toast('Não consegui copiar a URL', 'warn'); }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast('URL copiada', 'ok'))
      .catch(fallback);
  } else fallback();
}

function updateBudgetNoteMeta() {
  const v = el('budget-note-content').value;
  const words = v.trim() ? v.trim().split(/\s+/).length : 0;
  el('budget-note-meta').textContent = `${words} palavra${words !== 1 ? 's' : ''} • ${v.length} caracteres`;
}

function renderBudgetPreview() {
  const box = el('budget-note-preview');
  if (!box) return;
  const html = mdToHtml(el('budget-note-content').value);
  box.innerHTML = html || '<p class="md-empty">Nada para visualizar ainda — comece a escrever em Markdown.</p>';
}

function saveBudgetNote() {
  const budget = activeBudget();
  if (!budget) return;
  budget.note.content = el('budget-note-content').value;
  budget.note.updatedAt = Date.now();
  budget.updatedAt = Date.now();
  persistBudgets();
}

function downloadBudgetNoteAsMd() {
  const budget = activeBudget();
  if (!budget) { toast('Abra um orçamento antes de exportar', 'warn'); return; }
  const front = [`# ${budget.title}`];
  if (budget.category) front.push(`_${budget.category}_`);
  front.push(`_atualizado em ${fmtDateTime(budget.note.updatedAt)} · FinDek_`, '');
  const body = `${front.join('\n')}\n${budget.note.content.trim()}\n`;
  const name = budget.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'orcamento';
  const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`"${name}.md" baixado`, 'ok');
  setStatus('Notas do orçamento exportadas como Markdown');
}

/* ================= dashboard ================= */
const monthExpenses = (ref = new Date()) => transactions
  .filter(t => t.type === 'despesa' && inMonth(t, ref))
  .reduce((s, t) => s + (Number(t.amount) || 0), 0);

const STAT_TARGETS = {
  gastos: ['transactions', { type: 'despesa', status: 'all' }],
  receitas: ['transactions', { type: 'receita', status: 'all' }],
  saldo: ['fixos', null],
  salario: ['fixos', null],
  fixos: ['fixos', null],
  pendentes: ['transactions', { type: 'despesa', status: 'pending' }],
  orcamento: ['budgets', null],
  notas: ['notes', null],
  ext: ['rendaExterna', null]
};

function renderStats() {
  const now = new Date();
  const monthTx = transactions.filter(t => inMonth(t, now));
  const expenses = monthExpenses(now);
  const income = monthTx.filter(t => t.type === 'receita').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const salary = salaryFor();

  const pending = transactions.filter(t => !t.paid && t.type === 'despesa');
  const pendingSum = pending.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const active = budgets.filter(b => b.status === 'ativo');
  const budgetTotal = active.reduce((s, b) => s + (Number(b.limit) || 0), 0);
  const spentTotal = active.reduce((s, b) => s + budgetSpent(b), 0);
  const usage = budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : 0;

  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const extM = extsOfMonth();
  const extPaidN = extM.list.filter(x => x.paid).length;
  const extPendingN = extM.list.filter(x => !x.paid).length;
  const balance = salary + extM.paid - expenses;

  const stats = [
    { stat: 'gastos', lbl: `Gastos · ${monthName}`, val: fmtBRL(expenses), hint: 'Ver e editar as despesas do mês', sub: `${monthTx.filter(t => t.type === 'despesa').length} despesa${monthTx.filter(t => t.type === 'despesa').length !== 1 ? 's' : ''}`, c: 'var(--accent)' },
    { stat: 'receitas', lbl: `Receitas · ${monthName}`, val: fmtBRL(income), hint: 'Ver e editar as receitas do mês', sub: `${monthTx.filter(t => t.type === 'receita').length} entrada${monthTx.filter(t => t.type === 'receita').length !== 1 ? 's' : ''}`, c: 'var(--info)' },
    { stat: 'saldo', lbl: 'Saldo do mês', val: `${balance < 0 ? '−' : ''}${fmtBRL(Math.abs(balance))}`, hint: 'Saldo = salário + renda externa − gastos do mês', sub: salary > 0 ? 'salário + renda externa − gastos' : 'defina o salário em Salário & Fixos', c: balance >= 0 ? 'var(--ok)' : 'var(--danger)' },
    { stat: 'salario', lbl: `Salário · ${monthName}`, val: fmtBRL(salaryFor()), hint: 'Ajustar o salário do mês', sub: fixed.length ? `${fixed.length} gasto${fixed.length !== 1 ? 's' : ''} fixo${fixed.length !== 1 ? 's' : ''} cadastrado${fixed.length !== 1 ? 's' : ''}` : 'cadastre na área Salário & Fixos', c: 'var(--ok)' },
    { stat: 'fixos', lbl: 'Gastos fixos', val: fmtBRL(fixedTotal()), hint: 'Administrar os gastos fixos', sub: 'recorrentes todo mês — ver Salário & Fixos', c: 'var(--warn)' },
    { stat: 'ext', lbl: `Renda externa · ${monthName}`, val: fmtBRL(extM.total), hint: 'Administrar trabalhos freelance / PJ', sub: extM.count ? `${extPaidN} recebida${extPaidN !== 1 ? 's' : ''} · ${extPendingN} pendente${extPendingN !== 1 ? 's' : ''}` : 'cadastre trabalhos freelance / PJ', c: 'var(--info)' },
    { stat: 'pendentes', lbl: 'Contas pendentes', val: fmtBRL(pendingSum), hint: 'Pagar as contas pendentes', sub: `${pending.length} transação${pending.length !== 1 ? 'ões' : ''} para pagar`, c: pending.length ? 'var(--warn)' : 'var(--muted)' },
    { stat: 'orcamento', lbl: 'Orçamento usado', val: budgetTotal ? `${usage}%` : '—', hint: 'Ver e editar orçamentos', sub: budgetTotal ? `${fmtBRL(spentTotal)} de ${fmtBRL(budgetTotal)}` : 'nenhum orçamento ativo', c: usage > 100 ? 'var(--danger)' : 'var(--accent)' },
    { stat: 'notas', lbl: 'Notas', val: notes.length, hint: 'Abrir as notas', sub: `${notes.filter(n => n.pinned).length} fixada${notes.filter(n => n.pinned).length !== 1 ? 's' : ''}`, c: 'var(--accent)' }
  ];

  el('stat-grid').innerHTML = stats.map(s => `
    <div class="stat" data-stat="${s.stat}" title="${s.hint}" style="--c:${s.c}">
      <span class="lbl">${s.lbl}</span>
      <span class="open-hint">
        <svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <div class="val">${s.val}</div>
      <span class="sub">${s.sub}</span>
    </div>`).join('');

  el('progress-ring').style.setProperty('--p', budgetTotal ? Math.min(usage, 100) : 0);
  el('progress-value').textContent = budgetTotal ? `${usage}%` : '—';
  el('progress-chip').textContent = budgetTotal
    ? `${fmtBRL(spentTotal)} de ${fmtBRL(budgetTotal)}`
    : 'sem orçamento ativo';

  const legend = budgetTotal
    ? [
        { lbl: 'Gasto', v: fmtBRL(spentTotal), c: 'var(--accent)' },
        { lbl: 'Restante', v: fmtBRL(Math.max(0, budgetTotal - spentTotal)), c: 'var(--info)' },
        { lbl: 'Receita', v: fmtBRL(income), c: 'var(--ok)' }
      ]
    : [
        { lbl: 'Gasto', v: fmtBRL(expenses), c: 'var(--accent)' },
        { lbl: 'Receita', v: fmtBRL(income), c: 'var(--info)' },
        { lbl: 'Saldo', v: `${balance < 0 ? '−' : ''}${fmtBRL(Math.abs(balance))}`, c: balance >= 0 ? 'var(--ok)' : 'var(--danger)' }
      ];
  el('progress-legend').innerHTML = legend.map(l => `
    <li><span class="sw" style="background:${l.c}"></span>${l.lbl}<span class="v">${l.v}</span></li>`).join('');
}

function renderCategoryBars() {
  const now = new Date();
  const map = {};
  transactions.forEach(t => {
    if (t.type !== 'despesa' || !inMonth(t, now)) return;
    const s = t.category || 'Sem categoria';
    map[s] = (map[s] || 0) + (Number(t.amount) || 0);
  });
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const box = el('category-bars');

  if (!rows.length) {
    box.innerHTML = '<div class="empty">Nenhuma despesa este mês. Crie transações para ver o gráfico.</div>';
    return;
  }
  const max = Math.max(...rows.map(([, v]) => v)) || 1;

  box.innerHTML = rows.map(([s, v]) => {
    const w = (v / max) * 100;
    return `
      <div class="bar-row" title="${escapeHtml(s)}: ${fmtBRL(v)}">
        <span class="nm">${escapeHtml(s)}</span>
        <span class="bar-track" style="width:100%">
          <span class="bar-fill" style="width:${w}%"></span>
        </span>
        <span class="n">${fmtBRL(v)}</span>
      </div>`;
  }).join('');
}

function renderUpcoming() {
  const list = transactions
    .filter(t => !t.paid && t.due)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 7);
  const box = el('upcoming-list');

  if (!list.length) {
    box.innerHTML = '<li class="empty">Nenhuma conta com vencimento pendente.</li>';
    return;
  }
  box.innerHTML = list.map(t => {
    const d = daysUntil(t.due);
    const cls = d < 0 ? 'tag due-late' : d <= 1 ? 'tag due-today' : 'tag';
    const label = d < 0 ? `${Math.abs(d)}d atrás` : d === 0 ? 'hoje' : d === 1 ? 'amanhã' : fmtDate(t.due);
    return `
      <li data-open-transaction="${t.id}" style="cursor:pointer">
        <span class="t">${escapeHtml(t.title)}</span>
        <span class="r"><span class="${cls}">${label}</span>&nbsp;${fmtBRL(t.amount)}</span>
      </li>`;
  }).join('');
}

function renderRecentNotes() {
  const list = [...notes].sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)).slice(0, 6);
  const box = el('recent-notes');

  if (!list.length) {
    box.innerHTML = '<li class="empty">Nenhuma nota ainda.</li>';
    return;
  }
  box.innerHTML = list.map(n => `
    <li data-open-note="${n.id}" style="cursor:pointer">
      <span class="t">${n.pinned ? '📌 ' : ''}${escapeHtml(n.title || 'Sem título')}</span>
      <span class="r tag">${escapeHtml((n.tags[0] || 'geral'))}</span>
    </li>`).join('');
}

/* ================= fixos (salário + gastos fixos) ================= */
function normalizeFixed(f) {
  if (!f || !f.title) return null;
  return {
    id: f.id || uid(),
    title: String(f.title).trim(),
    amount: Math.max(0, Number(f.amount) || 0),
    category: String(f.category || '').trim(),
    day: Math.min(31, Math.max(1, Number(f.day) || 1)),
    paid: !!f.paid,
    createdAt: f.createdAt || Date.now()
  };
}

const salaryFor = (month = monthKey()) => Math.max(0, Number(salaries[month]) || 0);
const fixedTotal = () => fixed.reduce((s, f) => s + f.amount, 0);

function renderSalaryForm() {
  const month = el('s-month').value || monthKey();
  const salary = salaryFor(month);
  const gastos = monthExpenses();
  const ext = extsOfMonth().paid;
  const saldo = salary + ext - gastos;
  el('s-month').value = month;
  const amt = el('s-amount');
  if (document.activeElement !== amt) amt.value = salary || '';
  el('salary-summary').innerHTML = `
    <div class="salary-line">
      <span>Salário de <strong>${escapeHtml(monthNameShort(month))}</strong></span>
      <b>${fmtBRL(salary)}</b>
    </div>
    <div class="salary-line">
      <span>Renda externa recebida no mês</span>
      <b class="out">${fmtBRL(ext)}</b>
    </div>
    <div class="salary-line">
      <span>Gastos fixos do mês</span>
      <b class="out">${fmtBRL(fixedTotal())}</b>
    </div>
    <div class="salary-line">
      <span>Gastos do mês (todas as despesas)</span>
      <b class="out">${fmtBRL(gastos)}</b>
    </div>
    <div class="salary-line ${saldo >= 0 ? 'ok' : ''}">
      <span>Saldo do mês (salário + renda externa − gastos)</span>
      <b>${saldo < 0 ? '−' : ''}${fmtBRL(Math.abs(saldo))}</b>
    </div>`;
}

const monthNameShort = m => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

function saveSalaryFromForm() {
  const month = el('s-month').value;
  if (!month) { toast('Escolha o mês', 'warn'); return; }
  salaries[month] = Math.max(0, parseFloat(el('s-amount').value) || 0);
  persistSalary();
  renderAll();
  toast('Salário do mês salvo', 'ok');
  setStatus(`Salário de ${monthNameShort(month)} definido`);
}

function openFixedForm(f = null) {
  ui.editingFixedId = f ? f.id : null;
  el('fx-title').value = f ? f.title : '';
  el('fx-amount').value = f ? f.amount : '';
  el('fx-category').value = f ? (f.category || '') : '';
  el('fx-day').value = f ? f.day : '';
  el('fixed-form-title').textContent = f ? `Editar "${f.title}"` : 'Adicionar gasto fixo';
  el('fixed-cancel').classList.toggle('is-hidden', !f);
  el('fx-title').focus();
}

function saveFixedFromForm() {
  const title = el('fx-title').value.trim();
  if (!title) { el('fx-title').focus(); return; }
  const data = {
    title,
    amount: Math.max(0, parseFloat(el('fx-amount').value) || 0),
    category: el('fx-category').value.trim(),
    day: Math.min(31, Math.max(1, Number(el('fx-day').value) || 1))
  };

  if (ui.editingFixedId) {
    const f = fixed.find(x => x.id === ui.editingFixedId);
    if (f) Object.assign(f, data);
    toast('Gasto fixo atualizado', 'ok');
  } else {
    fixed.push(normalizeFixed({ ...data, id: uid(), createdAt: Date.now() }));
    toast('Gasto fixo adicionado', 'ok');
  }
  ui.editingFixedId = null;
  el('fx-title').value = '';
  el('fx-amount').value = '';
  el('fx-category').value = '';
  el('fx-day').value = '';
  el('fixed-form-title').textContent = 'Adicionar gasto fixo';
  el('fixed-cancel').classList.add('is-hidden');
  persistFixed();
  renderAll();
  el('fx-title').focus();
}

function toggleFixed(id) {
  const f = fixed.find(x => x.id === id);
  if (!f) return;
  f.paid = !f.paid;
  persistFixed();
  renderAll();
  if (f.paid) toast(`"${f.title}" marcado como pago`, 'ok');
}

function deleteFixed(id) {
  const f = fixed.find(x => x.id === id);
  if (!f) return;
  confirmAction('Excluir gasto fixo', `Remover "${f.title}" (${fmtBRL(f.amount)}) dos gastos fixos?`, () => {
    fixed = fixed.filter(x => x.id !== id);
    if (ui.editingFixedId === id) ui.editingFixedId = null;
    persistFixed();
    renderAll();
    toast('Gasto fixo excluído', 'warn');
  });
}

function renderFixedList() {
  const box = el('fixed-list');
  if (!box) return;
  const total = fixedTotal();
  const paidCount = fixed.filter(f => f.paid).length;
  if (el('fixed-total')) el('fixed-total').textContent = total ? `${paidCount}/${fixed.length} pagos · ${fmtBRL(total)}/mês` : 'nenhum cadastrado';
  if (!fixed.length) {
    box.innerHTML = '<li class="empty">Nenhum gasto fixo cadastrado. Adicione os que se repetem todo mês (aluguel, internet, plano...).</li>';
    return;
  }
  const sorted = [...fixed].sort((a, b) => (a.paid - b.paid) || a.day - b.day || b.amount - a.amount);
  box.innerHTML = sorted.map(f => `
    <div class="task ${f.paid ? 'is-done' : ''}" style="--p:${categoryColor(f.category)}">
      <button class="check" data-act="fx-toggle" data-id="${f.id}" aria-label="Marcar como pago">${CHECK_SVG}</button>
      <div class="task-info">
        <span class="t-title">${escapeHtml(f.title)}</span>
        <span class="t-meta">
          <span class="tag">dia ${f.day}</span>
          ${f.category ? `<span class="tag">${escapeHtml(f.category)}</span>` : ''}
          ${f.paid ? '<span class="tag">pago ✓</span>' : ''}
        </span>
      </div>
      <span class="t-amount">${fmtBRL(f.amount)}</span>
      <div class="task-actions">
        <button data-act="fx-edit" data-id="${f.id}" title="Editar">
          <svg viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <button data-act="fx-del" data-id="${f.id}" class="del" title="Excluir">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`).join('');
}

/* painel do dashboard: salário × gastos fixos */
function renderSalaryPanel() {
  const box = el('salary-ring');
  if (!box) return;
  const salary = salaryFor();
  const total = fixedTotal();
  const gastos = monthExpenses();
  const ext = extsOfMonth().paid;
  const saldo = salary + ext - gastos;
  const pct = salary > 0 ? Math.round((total / salary) * 100) : 0;

  box.style.setProperty('--p', salary > 0 ? Math.min(pct, 100) : 0);
  el('salary-value').textContent = salary > 0 ? `${pct}%` : '—';
  el('salary-chip').textContent = salary > 0
    ? `saldo ${saldo < 0 ? '−' : ''}${fmtBRL(Math.abs(saldo))}`
    : (fixed.length ? 'salário não cadastrado' : 'sem gastos fixos');

  const legend = salary > 0
    ? [
        { lbl: 'Salário', v: fmtBRL(salary), c: 'var(--ok)' },
        { lbl: 'Renda externa (recebida)', v: fmtBRL(ext), c: 'var(--info)' },
        { lbl: 'Gastos fixos', v: fmtBRL(total), c: 'var(--warn)' },
        { lbl: 'Gastos do mês', v: fmtBRL(gastos), c: 'var(--accent)' },
        { lbl: 'Saldo do mês', v: `${saldo < 0 ? '−' : ''}${fmtBRL(Math.abs(saldo))}`, c: saldo >= 0 ? 'var(--ok)' : 'var(--danger)' }
      ]
    : [
        { lbl: 'Gastos fixos', v: fmtBRL(total), c: 'var(--warn)' },
        { lbl: 'Salário do mês', v: '— não definido', c: 'var(--muted)' }
      ];
  el('salary-legend').innerHTML = legend.map(l => `
    <li><span class="sw" style="background:${l.c}"></span>${l.lbl}<span class="v">${l.v}</span></li>`).join('');
}

function renderDashboardFixed() {
  const box = el('dashboard-fixed-list');
  if (!box) return;
  const list = [...fixed].sort((a, b) => b.amount - a.amount).slice(0, 6);
  if (!list.length) {
    box.innerHTML = '<li class="empty">Cadastre os gastos fixos na área <b>Salário & Fixos</b>.</li>';
    return;
  }
  box.innerHTML = list.map(f => `
    <li>
      <span class="t">${escapeHtml(f.title)}</span>
      <span class="r"><span class="tag">dia ${f.day}</span>&nbsp;${fmtBRL(f.amount)}</span>
    </li>`).join('');
}
/* ================= renda externa (freelance / PJ) ================= */
function normalizeExternal(x) {
  if (!x || !x.title) return null;
  return {
    id: x.id || uid(),
    title: String(x.title).trim(),
    amount: Math.max(0, Number(x.amount) || 0),
    client: String(x.client || '').trim(),
    due: x.due || '',
    paid: !!x.paid,
    notes: String(x.notes || '').trim(),
    createdAt: x.createdAt || Date.now(),
    completedAt: x.paid ? (x.completedAt || Date.now()) : (x.completedAt || null)
  };
}

const extTerm = x => x.due || new Date(x.createdAt || Date.now()).toISOString().slice(0, 10);
const extInMonth = x => extTerm(x).startsWith(monthKey());

function extsOfMonth() {
  const list = external.filter(extInMonth);
  const paid = list.filter(x => x.paid).reduce((s, x) => s + x.amount, 0);
  const pending = list.filter(x => !x.paid).reduce((s, x) => s + x.amount, 0);
  return { list, paid, pending, total: paid + pending, count: list.length };
}

function openExternalForm(x = null) {
  ui.editingExternalId = x ? x.id : null;
  el('x-title').value = x ? x.title : '';
  el('x-amount').value = x ? x.amount : '';
  el('x-client').value = x ? (x.client || '') : '';
  el('x-due').value = x ? (x.due || '') : shiftISO(0);
  el('x-notes').value = x ? (x.notes || '') : '';
  el('ext-form-title').textContent = x ? `Editar "${x.title}"` : 'Adicionar renda externa';
  el('ext-cancel').classList.toggle('is-hidden', !x);
  el('x-title').focus();
}

function saveExternalFromForm() {
  const title = el('x-title').value.trim();
  if (!title) { el('x-title').focus(); return; }
  const data = {
    title,
    amount: Math.max(0, parseFloat(el('x-amount').value) || 0),
    client: el('x-client').value.trim(),
    due: el('x-due').value || '',
    notes: el('x-notes').value.trim()
  };

  if (ui.editingExternalId) {
    const x = external.find(i => i.id === ui.editingExternalId);
    if (x) Object.assign(x, data);
    toast('Renda externa atualizada', 'ok');
  } else {
    external.push(normalizeExternal({ ...data, id: uid(), paid: false, createdAt: Date.now() }));
    toast('Renda externa adicionada', 'ok');
  }
  ui.editingExternalId = null;
  el('ext-form').reset();
  el('ext-form-title').textContent = 'Adicionar renda externa';
  el('ext-cancel').classList.add('is-hidden');
  persistExternal();
  renderAll();
  el('x-title').focus();
}

function deleteExternal(id) {
  const x = external.find(i => i.id === id);
  if (!x) return;
  confirmAction('Excluir renda externa', `Remover "${x.title}" (${fmtBRL(x.amount)})?`, () => {
    external = external.filter(i => i.id !== id);
    if (ui.editingExternalId === id) ui.editingExternalId = null;
    persistExternal();
    renderAll();
    toast('Renda externa excluída', 'warn');
  });
}

function toggleExternal(id, force = null) {
  const x = external.find(i => i.id === id);
  if (!x) return;
  x.paid = force ?? !x.paid;
  x.completedAt = x.paid ? (x.completedAt || Date.now()) : null;
  persistExternal();
  renderAll();
  if (x.paid) toast(`"${x.title}" marcada como recebida`, 'ok');
}

function renderExternalList() {
  const box = el('ext-list');
  if (!box) return;
  if (el('x-due') && !el('x-due').value) el('x-due').value = shiftISO(0);
  const { paid, pending, total, count } = extsOfMonth();
  if (el('ext-total')) el('ext-total').textContent = count ? `${fmtBRL(total)} no mês` : 'nenhuma no mês';
  el('ext-summary').innerHTML = `
    <div class="salary-line"><span>Recebido no mês</span><b>${fmtBRL(paid)}</b></div>
    <div class="salary-line"><span>Pendente no mês</span><b class="out">${fmtBRL(pending)}</b></div>
    <div class="salary-line ok"><span>Previsto (recebido + pendente)</span><b>${fmtBRL(total)}</b></div>`;

  if (!external.length) {
    box.innerHTML = '<li class="empty">Nenhuma renda externa. Adicione trabalhos freelance, PJ, consultorias e serviços.</li>';
    return;
  }
  const sorted = [...external].sort((a, b) => (a.paid - b.paid) || (a.due || '').localeCompare(b.due || ''));
  box.innerHTML = sorted.map(x => `
    <div class="task ${x.paid ? 'is-done' : ''}" style="--p:var(--ok)">
      <button class="check" data-act="toggle" aria-label="Marcar como recebida">${CHECK_SVG}</button>
      <div class="task-info">
        <span class="t-title">${escapeHtml(x.title)}</span>
        <div class="t-meta">
          ${x.client ? `<span class="tag">${escapeHtml(x.client)}</span>` : ''}
          ${dueTag(x)}
          ${x.notes ? `<span class="t-note">— ${escapeHtml(x.notes)}</span>` : ''}
        </div>
      </div>
      <span class="t-amount in">+ ${fmtBRL(x.amount)}</span>
      <div class="task-actions">
        <button data-act="x-edit" data-id="${x.id}" title="Editar">${EDIT_SVG}</button>
        <button data-act="x-del" class="del" data-id="${x.id}" title="Excluir">${DEL_SVG}</button>
      </div>
    </div>`).join('');
}

/* ================= notes ================= */
/* ================= markdown ================= */
const safeUrl = u => /^(https?:\/\/|mailto:|#|\/|\.{1,2}\/)/i.test(String(u).trim()) ? String(u).trim() : '#';

const mdInline = raw => escapeHtml(raw)
  .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
    `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy">`)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) =>
    `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${txt}</a>`)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  .replace(/(^|[^_\w])__([^_\n]+)__/g, '$1<strong>$2</strong>')
  .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>')
  .replace(/~~([^~]+)~~/g, '<del>$1</del>')
  .replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

function mdToHtml(md) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null;
  let quote = false;
  let i = 0;

  const closePara = () => {
    if (para.length) {
      out.push(`<p>${mdInline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };
  const closeQuote = () => {
    if (quote) { out.push('</blockquote>'); quote = false; }
  };
  const closeBlocks = () => { closePara(); closeList(); closeQuote(); };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```+\s*([\w+#.-]*)\s*$/);
    if (fence) {
      closeBlocks();
      const lang = fence[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```+\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre data-lang="${escapeHtml(lang)}"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeBlocks();
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${mdInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^([-*_])\s*(\1\s*){2,}$/.test(line)) {
      closeBlocks();
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closePara();
      closeList();
      const inner = [];
      if (!quote) { out.push('<blockquote>'); quote = true; }
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        inner.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(mdToHtml(inner.join('\n')));
      continue;
    }

    const task = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      closePara();
      closeQuote();
      if (list !== 'ul') { closeList(); out.push('<ul class="md-tasks">'); list = 'ul'; }
      out.push(`<li><input type="checkbox" disabled${task[1].toLowerCase() === 'x' ? ' checked' : ''}><span>${mdInline(task[2])}</span></li>`);
      i++;
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      closePara();
      closeQuote();
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${mdInline(ul[1])}</li>`);
      i++;
      continue;
    }

    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      closePara();
      closeQuote();
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${mdInline(ol[1])}</li>`);
      i++;
      continue;
    }

    if (!line.trim()) {
      closeBlocks();
      i++;
      continue;
    }

    para.push(line.trim());
    i++;
  }

  closeBlocks();
  return out.join('');
}

function renderNoteList() {
  const q = ui.search.trim().toLowerCase();
  const list = [...notes]
    .filter(n => !q || `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

  const box = el('note-list');
  if (!list.length) {
    box.innerHTML = '<li class="empty">Nenhuma nota. Crie uma!</li>';
    return;
  }
  box.innerHTML = list.map(n => {
    const metaParts = [];
    const area = (n.area || '').trim();
    const subarea = (n.subarea || '').trim();
    if (area) metaParts.push(escapeHtml(area));
    if (subarea) metaParts.push(escapeHtml(subarea));
    const tags = (n.tags || []).slice(0, 2).map(escapeHtml).join(' • ');
    if (tags) metaParts.push(tags);
    const meta = metaParts.join(' • ') || 'Sem tags';
    return `
    <button class="note-item ${n.id === ui.activeNoteId ? 'is-active' : ''}" data-note-id="${n.id}">
      <strong>${n.pinned ? '📌 ' : ''}${escapeHtml(n.title || 'Sem título')}</strong>
      <span class="n-meta">${meta}</span>
      <span class="n-date">${fmtDateTs(n.updatedAt)}</span>
    </button>`;
  }).join('');
}

function renderEditor() {
  let n = notes.find(x => x.id === ui.activeNoteId);
  if (!n && notes.length) {
    ui.activeNoteId = notes[0].id;
    n = notes[0];
  }
  const has = !!n;
  ['note-title', 'note-tags', 'note-content', 'note-area', 'note-subarea'].forEach(id => {
    const e = el(id);
    if (e) {
      e.disabled = !has;
      e.style.opacity = has ? '' : '.5';
    }
  });
  const toolbarNote = el('note-editor')?.querySelector('.editor-toolbar');
  if (toolbarNote) toolbarNote.style.opacity = has ? '' : '.5';

  if (!n) {
    if (el('note-title')) el('note-title').value = '';
    if (el('note-tags')) el('note-tags').value = '';
    if (el('note-area')) el('note-area').value = '';
    if (el('note-subarea')) el('note-subarea').value = '';
    if (el('note-content')) el('note-content').value = '';
    if (el('note-meta')) el('note-meta').textContent = '0 palavras • 0 caracteres';
    renderPreview();
    return;
  }
  if (el('note-title')) el('note-title').value = n.title || '';
  if (el('note-tags')) el('note-tags').value = (n.tags || []).join(', ');
  if (el('note-area')) el('note-area').value = n.area || '';
  if (el('note-subarea')) el('note-subarea').value = n.subarea || '';
  if (el('note-content')) el('note-content').value = n.content || '';
  updateNoteMeta();
  renderPreview();
}

function updateNoteMeta() {
  const v = el('note-content').value;
  const words = v.trim() ? v.trim().split(/\s+/).length : 0;
  el('note-meta').textContent = `${words} palavra${words !== 1 ? 's' : ''} • ${v.length} caracteres`;
}

function renderPreview() {
  const box = el('note-preview');
  if (!box) return;
  const html = mdToHtml(el('note-content').value);
  box.innerHTML = html || '<p class="md-empty">Nada para visualizar ainda — comece a escrever em Markdown.</p>';
}

function setNotesMode(mode) {
  prefs.notesMode = ['edit', 'split', 'preview'].includes(mode) ? mode : 'split';
  $$('.editor-body').forEach(b => { b.dataset.mode = prefs.notesMode; });
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === prefs.notesMode));
  save(K.prefs, prefs);
}

function downloadNoteAsMd() {
  const n = notes.find(x => x.id === ui.activeNoteId);
  if (!n) { toast('Abra uma nota antes de exportar', 'warn'); return; }
  const title = n.title.trim() || 'nota';
  const front = [`# ${title}`];
  if (n.tags.length) front.push(`_${n.tags.join(' · ')}_`);
  front.push(`_atualizado em ${fmtDateTime(n.updatedAt)} · FinDek_`, '');
  const body = `${front.join('\n')}\n${n.content.trim()}\n`;
  const slugName = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nota';
  const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugName}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`"${slugName}.md" baixado`, 'ok');
  setStatus('Nota exportada como Markdown');
}

function createNote() {
  const n = {
    id: uid(),
    title: 'Nova nota',
    content: '',
    tags: [],
    pinned: false,
    area: '',
    subarea: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.unshift(n);
  ui.activeNoteId = n.id;
  persistNotes();
  renderAll();
  setStatus('Nota criada');
  el('note-title').focus();
  el('note-title').select();
  toast('Nota criada', 'ok');
}

function updateNote(patch) {
  const n = notes.find(x => x.id === ui.activeNoteId);
  if (!n) return;
  Object.assign(n, patch, { updatedAt: Date.now() });
  persistNotes();
  renderNoteList();
  renderRecentNotes();
  renderStats();
  el('nav-count-notes').textContent = notes.length;
}

/* ================= views ================= */
const VIEW_META = {
  dashboard: ['Dashboard', 'Visão geral das suas finanças'],
  fixos: ['Salário & Fixos', 'Renda do mês e despesas fixas'],
  rendaExterna: ['Renda externa', 'Freelance, PJ e serviços'],
  transactions: ['Transações', 'Despesas e receitas por categoria'],
  budgets: ['Orçamentos', 'Limites e metas por categoria'],
  notes: ['Notas', 'Metas, resumos e referências financeiras'],
  history: ['Histórico', 'Transações pagas nos últimos 7 dias'],
  themes: ['Temas', 'Personalize a aparência do FinDek']
};

function setView(view) {
  if (!VIEW_META[view]) return;
  ui.view = view;
  $$('.view').forEach(v => v.classList.toggle('is-hidden', v.id !== `view-${view}`));
  $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
  el('view-title').textContent = VIEW_META[view][0];
  el('view-sub').textContent = VIEW_META[view][1];
  el('sidebar').classList.remove('is-open');
  renderAll();
  setStatus(VIEW_META[view][0]);
}

function renderAll() {
  el('nav-count-transactions').textContent = transactions.filter(t => !t.paid).length;
  el('nav-count-notes').textContent = notes.length;
  renderCategorySidebar();
  renderStats();
  renderCategoryBars();
  renderUpcoming();
  renderRecentNotes();
  renderSalaryPanel();
  renderDashboardFixed();
  renderSalaryForm();
  renderFixedList();
  renderExternalList();
  renderTransactionList();
  renderBudgetList();
  renderBudgetDetail();
  renderNoteList();
  renderEditor();
  renderHistory();
  el('filter-type').value = ui.filters.type;
  el('filter-status').value = ui.filters.status;
  el('filter-overdue').checked = ui.filters.overdue;
  el('transaction-sort').value = ui.filters.sort;
  el('goal-filter-status').value = ui.goalFilters.status;
}

/* ================= transaction modal ================= */
function openTransactionModal(t = null) {
  ui.editingTransactionId = t ? t.id : null;
  el('transaction-modal-title').textContent = t ? 'Editar transação' : 'Nova transação';
  el('f-title').value = t ? t.title : '';
  el('f-category').value = t ? (t.category || '') : (ui.filters.category || '');
  el('f-type').value = t ? t.type : 'despesa';
  el('f-amount').value = t ? (t.amount ?? '') : '';
  el('f-due').value = t ? (t.due || '') : shiftISO(0);
  el('f-paid').value = t && t.paid ? '1' : '0';
  el('f-method').value = t ? (t.method || 'Pix') : 'Pix';
  el('f-notes').value = t ? (t.notes || '') : '';
  openModal('transaction-modal');
  el('f-title').focus();
}

function saveTransactionFromForm() {
  const title = el('f-title').value.trim();
  if (!title) return;
  const data = {
    title,
    category: el('f-category').value.trim(),
    type: el('f-type').value,
    amount: Math.max(0, parseFloat(el('f-amount').value) || 0),
    due: el('f-due').value || '',
    method: el('f-method').value,
    paid: el('f-paid').value === '1',
    notes: el('f-notes').value.trim()
  };

  if (ui.editingTransactionId) {
    const t = transactions.find(x => x.id === ui.editingTransactionId);
    if (!t) return;
    const wasPaid = t.paid;
    Object.assign(t, data);
    t.completedAt = data.paid ? (t.completedAt || Date.now()) : null;
    if (data.paid && !wasPaid) recordCompletion(t, 'transaction');
    else if (!data.paid && wasPaid) unrecordCompletion('transaction', t.id);
    toast('Transação atualizada', 'ok');
  } else {
    const created = {
      id: uid(), ...data,
      subtasks: [],
      createdAt: Date.now(),
      completedAt: data.paid ? Date.now() : null
    };
    transactions.unshift(created);
    if (data.paid) recordCompletion(created, 'transaction');
    toast('Transação criada', 'ok');
  }

  persistTransactions();
  closeModals();
  renderAll();
  setStatus('Transação salva');
}

function toggleTransaction(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  t.paid = !t.paid;
  t.completedAt = t.paid ? Date.now() : null;
  if (t.paid) recordCompletion(t, 'transaction');
  else unrecordCompletion('transaction', t.id);
  persistTransactions();
  renderAll();
  if (t.paid) toast(`"${t.title}" marcada como paga`, 'ok');
}

function deleteTransaction(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  confirmAction('Excluir transação', `Remover "${t.title}" (${fmtBRL(t.amount)}) permanentemente?`, () => {
    transactions = transactions.filter(x => x.id !== id);
    unrecordCompletion('transaction', id);
    persistTransactions();
    renderAll();
    toast('Transação excluída', 'warn');
  });
}

/* ================= actions ================= */
function seedData() {
  const base = Date.now();
  const t = (title, category, type, amount, due, paid, notes, method, offset) => ({
    id: uid() + offset, title, category, type, amount, due, paid, notes, method: method || '',
    subtasks: [],
    createdAt: base - offset * 1000, completedAt: paid ? base - offset * 500 : null
  });
  transactions = [
    t('Salário mensal', 'Renda', 'receita', 7500, shiftISO(0), true, 'folha de pagamento', 'Transferência', 1),
    t('Aluguel', 'Moradia', 'despesa', 2800, shiftISO(2), false, 'vencimento dia 10', 'Boleto', 2),
    t('Freelance design', 'Renda', 'receita', 1200, shiftISO(6), false, 'segunda parcela do projeto', 'Pix', 3),
    t('Conta de luz', 'Contas', 'despesa', 213.45, shiftISO(-2), false, 'fatura atrasada', 'Boleto', 4),
    t('Mercado da semana', 'Alimentação', 'despesa', 432.50, shiftISO(-3), true, '', 'Cartão', 5),
    t('Combustível', 'Transporte', 'despesa', 200, shiftISO(1), false, '', 'Pix', 6),
    t('Curso de Python', 'Educação', 'despesa', 199, shiftISO(5), false, 'plano de estudos', 'Pix', 7),
    t('Celular', 'Assinaturas', 'despesa', 89.90, shiftISO(4), false, '', 'Cartão', 8),
    t('Aporte mensal', 'Investimentos', 'despesa', 500, shiftISO(3), false, 'ETF de renda fixa', 'Transferência', 9),
    t('Farmácia', 'Saúde', 'despesa', 87.90, shiftISO(-1), true, '', 'Pix', 10),
    t('Streaming', 'Assinaturas', 'despesa', 45.90, shiftISO(-5), true, '', 'Cartão', 11),
    t('Internet fibra', 'Contas', 'despesa', 99.90, shiftISO(-4), true, '', 'Pix', 12),
    t('Jantar fora', 'Lazer', 'despesa', 156, shiftISO(-2), true, 'aniversário de amigo', 'Cartão', 13),
    t('Café com cliente', 'Lazer', 'despesa', 38, shiftISO(-6), true, '', 'Dinheiro', 14)
  ];
  transactions[6].subtasks = [
    { id: uid() + 's1', title: '1ª parcela', done: true, createdAt: base, completedAt: base },
    { id: uid() + 's2', title: '2ª parcela', done: false, createdAt: base, completedAt: null },
    { id: uid() + 's3', title: '3ª parcela', done: false, createdAt: base, completedAt: null }
  ];
  notes = [
    {
      id: uid() + 'n1', title: 'Método 50/30/20',
      tags: ['Orçamento', 'Planejamento'],
      pinned: true,
      area: 'Planejamento',
      subarea: 'Orçamento',
      createdAt: base, updatedAt: base,
      content: `# Regra 50/30/20\n\n- **50%** da renda → necessidades (moradia, comida, contas)\n- **30%** → desejos (lazer, compras)\n- **20%** → investimentos e dívidas\n\n## Aplicando\n\nRenda de ${fmtBRL(7500)}:\n\n1. Necessidades: até ${fmtBRL(3750)}\n2. Desejos: até ${fmtBRL(2250)}\n3. Investimentos: ${fmtBRL(1500)}\n\n> Ajuste os percentuais à sua realidade — o importante é **consistência**.`
    },
    {
      id: uid() + 'n2', title: 'Planilha de gastos — macros',
      tags: ['Planilha'],
      pinned: false,
      area: 'Ferramentas',
      subarea: 'Planilhas',
      createdAt: base - 1e6, updatedAt: base - 5e5,
      content: `# Atalhos úteis\n\n1. \`=SOMA(B2:B30)\` — total do mês\n2. \`=SUMIF(A:A;"Moradia";B:B)\` — gasto por categoria\n3. \`=B2-A2\` — saldo corrente\n\n**Dica:** categorize tudo no mesmo dia do vencimento.`
    },
    {
      id: uid() + 'n3', title: 'Primeiros investimentos',
      tags: ['Investimentos'],
      pinned: false,
      area: 'Riqueza',
      subarea: 'Renda fixa',
      createdAt: base - 2e6, updatedAt: base - 2e6,
      content: `Ordem de prioridade:\n\n- [ ] Reserva de emergência (6 meses)\n- [ ] Quitar dívidas caras\n- [ ] Tesouro Selic / CDB\n- [ ] ETF de índice\n\nLembre: **liquidez antes de rentabilidade**.`
    }
  ];
  categories = CATEGORIES_DEFAULT.slice();
  prefs.categoryColors = {};
  categories.forEach((s, i) => { prefs.categoryColors[s] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]; });

  const goal = (title, due, done, notes, offset) => normalizeItem({
    id: uid() + 'g' + offset, title, due, done, notes,
    subtasks: [],
    createdAt: base - offset * 1000,
    completedAt: done ? base - offset * 500 : null
  });

  budgets = [
    {
      id: uid() + 'b1',
      title: 'Essenciais do mês',
      category: 'Moradia',
      status: 'ativo',
      limit: 3200,
      due: shiftISO(20),
      desc: 'Moradia e contas fixas. O aluguel entra aqui; variáveis ficam em outros orçamentos.',
      items: [
        goal('Renegociar aluguel no fim do ano', shiftISO(30), false, 'pesquisar índices de reajuste', 1),
        goal('Auditar assinaturas ativas', shiftISO(10), false, 'cancelar o que não usa', 2),
        goal('Trocar plano de internet', shiftISO(15), true, 'já migrei para o plano mais barato', 3)
      ],
      links: [
        { id: uid() + 'l1', label: 'Banco — faturas', url: 'https://example.com/faturas' },
        { id: uid() + 'l2', label: 'Imobiliária', url: 'https://example.com/imobiliaria' }
      ],
      note: {
        content: `# Regras do orçamento\n\n- Conta apenas **despesas fixas**\n- Variáveis (mercado, lazer) ficam fora\n- Revisar todo dia **10**\n\n> Se passar de 90% do limite, congelar gastos opcionais.`,
        updatedAt: base - 3600000
      },
      createdAt: base - 8e6,
      updatedAt: base - 3600000
    },
    {
      id: uid() + 'b2',
      title: 'Lazer e cultura',
      category: 'Lazer',
      status: 'ativo',
      limit: 600,
      due: shiftISO(25),
      desc: 'Jantares, cinema, cursos e hobbies.',
      items: [
        goal('Máximo 1 jantar fora por semana', shiftISO(7), false, '', 1),
        goal('Usar biblioteca municipal', shiftISO(12), false, 'cadastro gratuito', 2)
      ],
      links: [
        { id: uid() + 'l3', label: 'Cinema da cidade', url: 'https://example.com/cinema' }
      ],
      note: {
        content: `# Lazer consciente\n\nPreferir experiências a coisas. Registrar **toda** saída aqui.\n\n- Pix direto, sem parcela\n- Planejar o mês inteiro no dia 1`,
        updatedAt: base - 5e6
      },
      createdAt: base - 6e6,
      updatedAt: base - 5e6
    }
  ];
  ui.activeBudgetId = budgets[0].id;

  salaries = { [monthKey()]: 7500 };
  fixed = [
    normalizeFixed({ id: uid() + 'x1', title: 'Aluguel', amount: 2800, category: 'Moradia', day: 10, paid: true }),
    normalizeFixed({ id: uid() + 'x2', title: 'Internet fibra', amount: 99.90, category: 'Contas', day: 5 }),
    normalizeFixed({ id: uid() + 'x3', title: 'Celular', amount: 89.90, category: 'Assinaturas', day: 8, paid: true }),
    normalizeFixed({ id: uid() + 'x4', title: 'Streaming', amount: 45.90, category: 'Assinaturas', day: 15 })
  ];
  external = [
    normalizeExternal({ id: uid() + 'e1', title: 'Landing page — clientX', amount: 1500, client: 'ClientX', due: shiftISO(4), paid: false, notes: '50% na assinatura, 50% na entrega' }),
    normalizeExternal({ id: uid() + 'e2', title: 'Identidade visual', amount: 3200, client: 'Café Aurora', due: shiftISO(12), paid: false, notes: 'contrato PJ, NF emitida' }),
    normalizeExternal({ id: uid() + 'e3', title: 'Manutenção mensal', amount: 800, client: 'Loja ABC', due: shiftISO(-3), paid: true })
  ];

  history = [
    {
      id: uid() + 'h1', key: 'transaction:' + transactions[4].id, kind: 'transaction', budgetId: null,
      originId: transactions[4].id, title: transactions[4].title, category: transactions[4].category,
      type: transactions[4].type, amount: transactions[4].amount, due: transactions[4].due,
      notes: transactions[4].notes, subtasks: [],
      completedAt: base - 86400000, expiresAt: base - 86400000 + 7 * DAY
    },
    {
      id: uid() + 'h2', key: 'transaction:' + transactions[10].id, kind: 'transaction', budgetId: null,
      originId: transactions[10].id, title: transactions[10].title, category: transactions[10].category,
      type: transactions[10].type, amount: transactions[10].amount, due: transactions[10].due,
      notes: transactions[10].notes, subtasks: [],
      completedAt: base - 3 * 86400000, expiresAt: base - 3 * 86400000 + 7 * DAY
    }
  ];

  ui.activeNoteId = notes[0].id;
  ui.filters.category = '';
  ui.budgetNoteLoadedFor = null;
  ui.openGroups = new Set([groupKey('transaction', '', transactions[6].id)]);
  persistAll();
  renderAll();
  renderCategoryManager();
  closeModals();
  toast('Dados de exemplo carregados', 'ok');
}

function exportData() {
  const blob = new Blob([JSON.stringify({ version: 2, app: 'findek', transactions, notes, prefs, categories, budgets, history, salaries, fixed, external }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `findek-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Arquivo exportado', 'ok');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.transactions)) transactions = data.transactions;
      if (Array.isArray(data.notes)) {
        notes = data.notes.map(n => ({
          ...n,
          area: n.area || '',
          subarea: n.subarea || ''
        }));
      }
      if (data.prefs) prefs = Object.assign({}, defaultPrefs, data.prefs);
      if (Array.isArray(data.categories) && data.categories.length) {
        categories = Array.from(new Set(data.categories.map(s => String(s).trim()).filter(Boolean)));
      } else {
        categories = migrateCategories();
      }
      if (Array.isArray(data.budgets)) {
        budgets = data.budgets.map(b => Object.assign({ items: [], links: [], note: { content: '' } }, b));
      }
      if (Array.isArray(data.history)) history = data.history;
      if (data.salaries && typeof data.salaries === 'object' && !Array.isArray(data.salaries)) salaries = data.salaries;
      if (Array.isArray(data.fixed)) fixed = data.fixed.map(normalizeFixed).filter(Boolean);
      if (Array.isArray(data.external)) external = data.external.map(normalizeExternal).filter(Boolean);
      ui.filters.category = '';
      ui.activeNoteId = notes[0]?.id || null;
      ui.activeBudgetId = budgets[0]?.id || null;
      ui.budgetNoteLoadedFor = null;
      ui.openGroups = new Set();
      persistAll();
      applyPrefs();
      renderAll();
      toast('Dados importados', 'ok');
    } catch {
      toast('Arquivo inválido', 'warn');
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  confirmAction('Apagar tudo', 'Transações, orçamentos, notas, histórico e preferências serão removidos. Continuar?', () => {
    transactions = [];
    notes = [];
    budgets = [];
    history = [];
    salaries = {};
    fixed = [];
    external = [];
    prefs = Object.assign({}, defaultPrefs);
    categories = CATEGORIES_DEFAULT.slice();
    ui.activeNoteId = null;
    ui.activeBudgetId = null;
    ui.budgetNoteLoadedFor = null;
    ui.openGroups = new Set();
    ui.filters.category = '';
    wallpaper = null;
    try { localStorage.removeItem(K.wallpaper); } catch {}
    persistAll();
    applyPrefs();
    applyWallpaper();
    renderAll();
    renderCategoryManager();
    toast('Dados apagados', 'warn');
  });
}

/* ================= events ================= */
function bindEvents() {
  $$('.nav-item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('[data-view-link]').forEach(b => b.addEventListener('click', () => setView(b.dataset.viewLink)));

  el('btn-menu').addEventListener('click', () => el('sidebar').classList.toggle('is-open'));
  el('backdrop').addEventListener('click', closeModals);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeModals));

  document.addEventListener('click', e => {
    const act = e.target.closest('[data-action]');
    if (act) {
      const a = act.dataset.action;
      if (a === 'new-transaction') openTransactionModal();
      if (a === 'new-note') createNote();
      if (a === 'open-categories') openCategoryModal();
      if (a === 'clear-filters') {
        ui.filters = { category: '', type: '', status: 'pending', overdue: false, sort: ui.filters.sort };
        el('filter-category').value = '';
        renderAll();
        setStatus('Filtros limpos');
      }
      if (a === 'export') exportData();
      if (a === 'import') el('import-file').click();
      if (a === 'seed') seedData();
      if (a === 'reset') resetAll();
      if (a === 'reset-accent') {
        prefs.accent = THEME_ACCENT[prefs.theme] || THEME_ACCENT.verde;
        prefs.accentCustom = false;
        applyPrefs();
        persistAll();
        renderAll();
        toast('Cor de destaque restaurada', 'ok');
      }
      if (a === 'note-download') downloadNoteAsMd();
      if (a === 'note-delete') {
        const n = notes.find(x => x.id === ui.activeNoteId);
        if (!n) return;
        confirmAction('Excluir nota', `Remover "${n.title || 'Sem título'}"?`, () => {
          notes = notes.filter(x => x.id !== n.id);
          ui.activeNoteId = notes[0]?.id || null;
          persistNotes();
          renderAll();
          toast('Nota excluída', 'warn');
        });
      }
      if (a === 'new-budget') openBudgetModal();
      if (a === 'edit-budget') openBudgetModal(activeBudget());
      if (a === 'delete-budget') deleteBudget(activeBudget());
      if (a === 'budget-note-download') downloadBudgetNoteAsMd();
      if (a === 'clear-history') {
        if (!history.length) { toast('Histórico vazio', 'info'); return; }
        confirmAction('Limpar histórico', `Remover ${history.length} registro(s) de até ${HISTORY_DAYS} dias?`, () => {
          history = [];
          persistHistory();
          renderAll();
          toast('Histórico limpo', 'warn');
        });
      }
      if (a === 'wall-pick') el('wall-file').click();
      if (a === 'wall-remove') removeWallpaper();
    }

    const themeCard = e.target.closest('[data-theme-id]');
    if (themeCard) setTheme(themeCard.dataset.themeId);

    const smBtn = e.target.closest('.sm-btn[data-act="del"]');
    if (smBtn) {
      const row = smBtn.closest('.sm-row');
      const name = row?.dataset.categoryRow;
      if (!name) return;
      const n = categoryTransactions(name).length;
      confirmAction(
        'Excluir categoria',
        `"${name}" será removida. ${n ? `${n} transação${n !== 1 ? 'ões' : ''} ficarão sem categoria` : 'Nenhuma transação usa esta categoria'} e a tag sai das notas.`,
        () => {
          const res = deleteCategory(name);
          if (!res.ok) { toast(res.error, 'warn'); return; }
          renderCategoryManager();
          toast(`Categoria "${name}" excluída${res.detached ? ` · ${res.detached} transações sem categoria` : ''}`, 'warn');
          setStatus(`Categoria "${name}" excluída`);
        }
      );
      return;
    }

    const fxBtn = e.target.closest('#fixed-list [data-act]');
    if (fxBtn) {
      const f = fixed.find(x => x.id === fxBtn.dataset.id);
      if (!f) return;
      if (fxBtn.dataset.act === 'fx-edit') openFixedForm(f);
      if (fxBtn.dataset.act === 'fx-del') deleteFixed(f.id);
      if (fxBtn.dataset.act === 'fx-toggle') toggleFixed(f.id);
      return;
    }

    const extBtn = e.target.closest('#ext-list [data-act]');
    if (extBtn) {
      const x = external.find(i => i.id === extBtn.dataset.id);
      if (!x) return;
      if (extBtn.dataset.act === 'x-edit') openExternalForm(x);
      if (extBtn.dataset.act === 'x-del') deleteExternal(x.id);
      if (extBtn.dataset.act === 'toggle') toggleExternal(x.id);
      return;
    }

    const statCard = e.target.closest('[data-stat]');
    if (statCard) {
      const jump = STAT_TARGETS[statCard.dataset.stat];
      if (jump) {
        const [view, flt] = jump;
        if (flt) {
          ui.filters.type = flt.type ?? ui.filters.type;
          ui.filters.status = flt.status ?? ui.filters.status;
          ui.filters.category = '';
          ui.filters.overdue = false;
        }
        ui.search = '';
        el('global-search').value = '';
        setView(view);
      }
      return;
    }

    const chip = e.target.closest('[data-category]');
    if (chip) {
      const s = chip.dataset.category;
      ui.filters.category = ui.filters.category === s ? '' : s;
      el('filter-category').value = ui.filters.category;
      setView('transactions');
      renderAll();
    }

    const group = e.target.closest('.tgroup');
    if (group) {
      const scope = group.dataset.scope;
      const btn = e.target.closest('[data-act]');

      if (scope === 'history') {
        if (btn && btn.dataset.act === 'restore') restoreHistoryEntry(history.find(h => h.id === group.dataset.id));
        return;
      }

      const found = findNode(scope, group.dataset.budget, group.dataset.id);
      if (!found) return;

      if (btn) {
        const a2 = btn.dataset.act;
        const subRow = btn.closest('.sub-row');
        if (a2 === 'toggle') {
          scope === 'transaction' ? toggleTransaction(found.node.id) : toggleGoal(found.budget, found.node);
        }
        if (a2 === 'edit') {
          scope === 'transaction' ? openTransactionModal(found.node) : openGoalModal(found.node, found.budget);
        }
        if (a2 === 'del') {
          scope === 'transaction' ? deleteTransaction(found.node.id) : deleteGoal(found.budget, found.node);
        }
        if (a2 === 'sub-toggle' && subRow) toggleSubtask(found, subRow.dataset.subId);
        if (a2 === 'sub-del' && subRow) deleteSubtask(found, subRow.dataset.subId);
        return;
      }

      if (!e.target.closest('.subs')) toggleGroup(scope, group.dataset.budget, group.dataset.id);
      return;
    }

    const budgetBtn = e.target.closest('[data-budget-id]');
    if (budgetBtn) {
      if (ui.activeBudgetId !== budgetBtn.dataset.budgetId) {
        ui.activeBudgetId = budgetBtn.dataset.budgetId;
        ui.budgetNoteLoadedFor = null;
      }
      renderBudgetList();
      renderBudgetDetail();
      return;
    }

    const linkBtn = e.target.closest('.link-card [data-act]');
    if (linkBtn) {
      const budget = activeBudget();
      const found = budget && budget.links.find(l => l.id === linkBtn.dataset.link);
      if (!found) return;
      if (linkBtn.dataset.act === 'link-copy') copyText(found.url);
      if (linkBtn.dataset.act === 'link-del') {
        budget.links = budget.links.filter(l => l.id !== found.id);
        budget.updatedAt = Date.now();
        persistBudgets();
        renderAll();
        toast('Link removido', 'warn');
      }
      return;
    }

    const noteBtn = e.target.closest('[data-note-id]');
    if (noteBtn) {
      ui.activeNoteId = noteBtn.dataset.noteId;
      renderNoteList();
      renderEditor();
      return;
    }

    const openTx = e.target.closest('[data-open-transaction]');
    if (openTx) {
      const t = transactions.find(x => x.id === openTx.dataset.openTransaction);
      if (t) { setView('transactions'); openTransactionModal(t); }
      return;
    }

    const openNote = e.target.closest('[data-open-note]');
    if (openNote) {
      ui.activeNoteId = openNote.dataset.openNote;
      setView('notes');
      renderNoteList();
      renderEditor();
    }
  });

  el('global-search').addEventListener('input', e => {
    ui.search = e.target.value;
    if (ui.search.trim() && ui.view === 'dashboard') setView('transactions');
    renderAll();
    setStatus(ui.search ? `Buscando: "${ui.search}"` : 'Pronto');
  });

  el('filter-category').addEventListener('change', e => { ui.filters.category = e.target.value; renderAll(); });
  el('filter-type').addEventListener('change', e => { ui.filters.type = e.target.value; renderAll(); });
  el('filter-status').addEventListener('change', e => { ui.filters.status = e.target.value; renderAll(); });
  el('filter-overdue').addEventListener('change', e => { ui.filters.overdue = e.target.checked; renderAll(); });
  el('transaction-sort').addEventListener('change', e => { ui.filters.sort = e.target.value; renderTransactionList(); });

  el('budget-search').addEventListener('input', e => { ui.budgetSearch = e.target.value; renderBudgetList(); });
  el('goal-filter-status').addEventListener('change', e => { ui.goalFilters.status = e.target.value; renderGoalList(); });

  el('budget-form').addEventListener('submit', e => { e.preventDefault(); saveBudgetFromForm(); });
  el('goal-item-form').addEventListener('submit', e => { e.preventDefault(); saveGoalFromForm(); });

  if (el('salary-form')) el('salary-form').addEventListener('submit', e => { e.preventDefault(); saveSalaryFromForm(); });
  if (el('fixed-form')) el('fixed-form').addEventListener('submit', e => { e.preventDefault(); saveFixedFromForm(); });
  if (el('ext-form')) el('ext-form').addEventListener('submit', e => { e.preventDefault(); saveExternalFromForm(); });
  if (el('s-month')) el('s-month').addEventListener('input', () => renderSalaryForm());
  if (el('fixed-cancel')) el('fixed-cancel').addEventListener('click', () => {
    ui.editingFixedId = null;
    el('fixed-form').reset();
    el('fixed-form-title').textContent = 'Adicionar gasto fixo';
    el('fixed-cancel').classList.add('is-hidden');
  });
  if (el('ext-cancel')) el('ext-cancel').addEventListener('click', () => {
    ui.editingExternalId = null;
    el('ext-form').reset();
    el('x-due').value = shiftISO(0);
    el('ext-form-title').textContent = 'Adicionar renda externa';
    el('ext-cancel').classList.add('is-hidden');
  });

  el('link-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!activeBudget()) { toast('Abra um orçamento primeiro', 'warn'); return; }
    addLink(activeBudget());
  });

  el('goal-form').addEventListener('submit', e => {
    e.preventDefault();
    const budget = activeBudget();
    const input = el('goal-title');
    const title = input.value.trim();
    if (!budget) { toast('Abra um orçamento primeiro', 'warn'); return; }
    if (!title) { input.focus(); return; }
    budget.items.unshift(normalizeItem({
      title,
      due: el('goal-due').value || '',
      notes: '',
      createdAt: Date.now()
    }));
    budget.updatedAt = Date.now();
    input.value = '';
    el('goal-due').value = '';
    persistBudgets();
    renderAll();
    input.focus();
    toast('Meta adicionada ao orçamento', 'ok');
  });

  document.addEventListener('submit', e => {
    const form = e.target.closest('.subs-form');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('.subs-input');
    const title = input.value.trim();
    if (!title) return;
    const found = findNode(form.dataset.scope, form.dataset.budget, form.dataset.id);
    if (!addSubtask(found, title)) return;
    const again = document.querySelector(`.subs-form[data-scope="${form.dataset.scope}"][data-id="${form.dataset.id}"] .subs-input`);
    if (again) { again.focus(); again.scrollIntoView({ block: 'nearest' }); }
  });

  el('transaction-form').addEventListener('submit', e => { e.preventDefault(); saveTransactionFromForm(); });
  el('category-add-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = el('category-new');
    const res = addCategory(input.value);
    if (!res.ok) { toast(res.error, 'warn'); input.focus(); return; }
    input.value = '';
    renderCategoryManager();
    toast(`Categoria "${res.name}" adicionada`, 'ok');
    const row = el('category-manager').querySelector('.sm-row:last-child');
    if (row) { row.classList.add('is-flash'); row.querySelector('.sm-name').focus(); }
  });

  el('category-search').addEventListener('input', e => {
    ui.categorySearch = e.target.value;
    renderCategoryManager();
  });

  el('category-manager').addEventListener('input', e => {
    const field = e.target.closest('[data-act]');
    if (!field) return;
    const row = field.closest('.sm-row');
    const name = row.dataset.categoryRow;

    if (field.dataset.act === 'color') {
      prefs.categoryColors[findCategory(name) || name] = field.value;
      save(K.prefs, prefs);
      renderCategorySidebar();
      renderTransactionList();
      renderCategoryBars();
      return;
    }

    if (field.dataset.act === 'name') {
      ui.editingCategory = { original: name, value: field.value };
    }
  });

  el('category-manager').addEventListener('keydown', e => {
    const field = e.target.closest('.sm-name');
    if (!field) return;
    const pending = ui.editingCategory;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCategoryRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ui.editingCategory = null;
      renderCategoryManager();
    } else if (e.key === 'Tab' && pending) {
      commitCategoryRename();
    }
  });

  el('category-manager').addEventListener('focusout', e => {
    if (e.target.closest('.sm-name') && ui.editingCategory) commitCategoryRename();
  });

  el('confirm-ok').addEventListener('click', () => {
    const cb = ui.confirmAction;
    ui.confirmAction = null;
    closeModals();
    if (cb) cb();
  });

  if (el('note-title')) el('note-title').addEventListener('input', e => updateNote({ title: e.target.value }));
  if (el('note-area')) el('note-area').addEventListener('input', e => updateNote({ area: e.target.value }));
  if (el('note-subarea')) el('note-subarea').addEventListener('input', e => updateNote({ subarea: e.target.value }));
  if (el('note-tags')) el('note-tags').addEventListener('input', e =>
    updateNote({ tags: (e.target.value || '').split(',').map(s => s.trim()).filter(Boolean) }));
  if (el('note-content')) el('note-content').addEventListener('input', e => {
    updateNoteMeta();
    renderPreview();
    updateNote({ content: e.target.value });
  });

  el('budget-note-content').addEventListener('input', e => {
    updateBudgetNoteMeta();
    renderBudgetPreview();
    saveBudgetNote();
  });

  $$('.editor-toolbar').forEach(bar => {
    bar.addEventListener('click', e => {
      const modeBtn = e.target.closest('.mode-btn');
      if (modeBtn) { setNotesMode(modeBtn.dataset.mode); return; }

      const tool = e.target.closest('.tool');
      if (!tool || (!tool.dataset.wrap && !tool.dataset.prefix)) return;
      const ta = el(bar.dataset.target);
      if (!ta) return;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const sel = ta.value.slice(start, end);
      let ins, caret;
      if (tool.dataset.wrap) {
        const w = tool.dataset.wrap;
        ins = w + sel + w;
        caret = start + ins.length;
      } else {
        const pfx = tool.dataset.prefix;
        ins = sel
          ? sel.split('\n').map(l => pfx + l).join('\n')
          : pfx;
        caret = start + ins.length;
      }
      ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
      ta.focus();
      ta.setSelectionRange(caret, caret);
      if (bar.dataset.kind === 'budget') {
        updateBudgetNoteMeta();
        renderBudgetPreview();
        saveBudgetNote();
      } else {
        updateNoteMeta();
        renderPreview();
        updateNote({ content: ta.value });
      }
    });
  });

  const wallRange = (id, key, factor) => {
    el(id).addEventListener('input', e => {
      if (!wallpaper) return;
      wallpaper[key] = Number(e.target.value) / factor;
      try { localStorage.setItem(K.wallpaper, JSON.stringify(wallpaper)); } catch {}
      applyWallpaperVars();
      renderWallpaperUI();
    });
  };
  wallRange('wall-veil', 'veil', 100);
  wallRange('wall-alpha', 'alpha', 1);
  wallRange('wall-blur', 'blur', 1);

  el('wall-file').addEventListener('change', e => {
    if (e.target.files[0]) uploadWallpaper(e.target.files[0]);
    e.target.value = '';
  });

  const pickAccent = e => {
    prefs.accent = e.target.value;
    prefs.accentCustom = true;
    applyPrefs();
    persistAll();
    renderAll();
  };
  el('accent-picker').addEventListener('input', pickAccent);
  el('accent-picker-2').addEventListener('input', pickAccent);

  el('opt-compact').addEventListener('change', e => {
    prefs.density = e.target.checked ? 'compact' : 'normal';
    applyPrefs(); persistAll();
  });
  el('opt-motion').addEventListener('change', e => {
    prefs.motion = e.target.checked ? 'on' : 'off';
    applyPrefs(); persistAll();
  });
  el('opt-font').addEventListener('change', e => {
    prefs.font = e.target.value;
    applyPrefs(); persistAll();
  });

  el('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModals(); el('sidebar').classList.remove('is-open'); }
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); el('global-search').focus(); }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTransactionModal(); }
  });

  function tick() {
    el('clock-time').textContent = new Date().toLocaleTimeString('pt-BR');
    el('clock-date').textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }
  tick();
  setInterval(tick, 1000);
}

/* ================= init ================= */
function init() {
  applyPrefs();
  applyWallpaper();
  if (!transactions.length && !notes.length) seedData();
  purgeHistory();
  bindEvents();
  setView('dashboard');
  setInterval(purgeHistory, 3600000);
}

init();
