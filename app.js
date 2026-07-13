/* ================= Admotive CRM ================= */
/* Config — filled in at deploy time. Empty = demo mode with sample data. */
const SUPABASE_URL = window.KGEN_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.KGEN_SUPABASE_ANON_KEY || '';
const DEMO = !SUPABASE_URL;

const AUTH_DOMAIN = 'admotive-crm.local'; // username -> username@admotive-crm.local

const STATUSES = [
  { key: 'new',         label: 'New' },
  { key: 'contacted',   label: 'Contacted' },
  { key: 'responded',   label: 'Responded' },
  { key: 'call_booked', label: 'Call Booked' },
  { key: 'call_held',   label: 'Call Held' },
  { key: 'client',      label: 'Client' },
  { key: 'lost',        label: 'Lost' },
  { key: 'no_response', label: 'No Response' },
];
const ST = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));

let sb = null;
if (!DEMO) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------- state ---------------- */
let state = {
  user: null,           // {username, display}
  leads: [],            // lead rows
  activities: {},       // lead_id -> [activity]
  filters: { src: 'all', status: 'all', q: '', sort: 'newest' },
  view: (function(){ try { return localStorage.getItem('kgen_view') || 'table'; } catch(e){ return 'table'; } })(),
  openLeadId: null,
  fuLeadId: null,       // lead being edited in follow-up modal
  attach: null,         // pending screenshot {file, dataUrl}
};

/* ---------------- demo data ---------------- */
const demoLeads = [
  { id: 1, created_at: '2026-07-11T21:26:00Z', name: 'Zach Bruno', email: 'brunozachary1@outlook.com', phone: '+12125550143', social: 'Bright Smile Dental', heard_from: 'meta', source: 'Booking page', status: 'call_booked', followup_at: '2026-07-15' },
  { id: 2, created_at: '2026-07-10T23:22:00Z', name: 'Bryan Landry', email: 'bryan@royalprestigeauto.com', phone: '+13055550188', social: 'Royal Prestige Realty', heard_from: 'google', source: 'Booking page', status: 'responded' },
  { id: 3, created_at: '2026-07-10T21:09:00Z', name: 'Daniel Walker', email: 'tobysdetails@gmail.com', phone: '+14155550111', social: 'Walker Mobile Services', heard_from: 'admotive', source: 'Booking page', status: 'contacted', followup_at: '2026-07-11' },
  { id: 4, created_at: '2026-07-10T20:26:00Z', name: 'Oliver Ferguson', email: 'oliverferguson445@gmail.com', phone: '+16465550129', social: 'Revive Wellness Studio', heard_from: 'meta', source: 'Booking page', status: 'call_held' },
  { id: 5, created_at: '2026-07-10T13:19:00Z', name: 'Yannick Aubry', email: 'yanaubry@hotmail.com', phone: '+13125550166', social: 'Nine Aesthetics', heard_from: 'form', source: 'Booking page', status: 'new' },
  { id: 6, created_at: '2026-07-10T09:02:00Z', name: 'Devanshu Sharma', email: 'devanshus742@gmail.com', phone: '+17185550174', social: 'Shine & Glow Co', heard_from: 'affiliate', source: 'Booking page', status: 'new' },
  { id: 7, created_at: '2026-06-30T15:40:00Z', name: 'Nikita Buria', email: 'nikitaburia68@gmail.com', phone: '+12065550118', social: '@imstudio.nyc', heard_from: 'admotive', source: 'Booking page', status: 'client' },
  { id: 8, created_at: '2026-06-29T11:15:00Z', name: 'Shian Jeremie', email: 'sjfinehomez@gmail.com', phone: '+14045550155', social: 'Auptics', heard_from: 'other', source: 'Booking page', status: 'no_response' },
  { id: 9, created_at: '2026-06-29T09:30:00Z', name: 'Chase Bangalie', email: 'chasebanglie@gmail.com', phone: '+13475550142', social: 'Chase Vibe Media', heard_from: 'google', source: 'Booking page', status: 'lost' },
];
const demoActivities = {
  1: [
    { id: 'a1', type: 'status', author: 'System', body: 'Lead created from Slack (#kgen-booking)', created_at: '2026-07-11T21:26:00Z' },
    { id: 'a2', type: 'comment', author: 'Kosta', body: 'Reached out on Instagram, he replied fast — very interested in scaling his PPF side.', created_at: '2026-07-11T22:10:00Z' },
    { id: 'a3', type: 'fathom', author: 'Mihajlo', body: 'https://fathom.video/calls/384112', created_at: '2026-07-12T10:05:00Z' },
    { id: 'a4', type: 'status', author: 'Mihajlo', body: 'Status changed: Contacted → Call Booked', created_at: '2026-07-12T10:06:00Z' },
  ],
  4: [
    { id: 'a5', type: 'status', author: 'System', body: 'Lead created from Slack (#kgen-booking)', created_at: '2026-07-10T20:26:00Z' },
    { id: 'a6', type: 'comment', author: 'Dan', body: 'Meta ad lead — booked straight from the funnel. Call went well, sending proposal tomorrow.', created_at: '2026-07-11T18:30:00Z' },
  ],
};

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => (s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const SRC = {
  admotive:  { label: 'Admotive',  color: '#1f8bff' },
  meta:      { label: 'Meta',      color: '#2b52d6' },
  affiliate: { label: 'Affiliate', color: '#8b5cf6' },
  google:    { label: 'Google',    color: '#f0a500' },
  form:      { label: 'Form',      color: '#14b8a6' },
  other:     { label: 'Other',     color: '#9aa1ab' },
};
function srcKey(heard) {
  const h = (heard || '').toLowerCase().trim();
  return SRC[h] ? h : 'other';
}
function heardBadge(heard) {
  const k = srcKey(heard);
  return `<span class="badge src-${k}"><span class="bdot"></span>${SRC[k].label}</span>`;
}
function statusPill(status) {
  return `<span class="pill st-${status}"><span class="pdot"></span>${ST[status] || status}</span>`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
         d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  return fmtDate(iso);
}
function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
const BELL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
// Tidy the social/business field: drop protocol + www, keep handles clean, cap length
function cleanSocial(s) {
  let v = (s || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || /^www\./i.test(v)) {
    v = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    v = v.length > 34 ? v.slice(0, 32) + '…' : v;
  }
  return v;
}
function dateStrLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayStr() { return dateStrLocal(new Date()); }
function addDaysStr(n) { const d = new Date(); d.setDate(d.getDate() + n); return dateStrLocal(d); }
function fuIsOverdue(lead) {
  return lead.followup_at && lead.followup_at < todayStr();
}
function fmtFuDate(iso) {
  const t = todayStr();
  if (iso === t) return 'Today';
  const d = new Date(iso + 'T00:00:00');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function fuBtnHtml(lead) {
  const cls = lead.followup_at ? (fuIsOverdue(lead) ? 'fu-btn overdue' : 'fu-btn on') : 'fu-btn';
  const title = lead.followup_at ? `Follow up: ${fmtFuDate(lead.followup_at)}` : 'Set follow-up';
  return `<button class="${cls}" data-fu="${lead.id}" title="${title}">${BELL_SVG}</button>`;
}
function lastActivity(leadId) {
  const acts = (state.activities[leadId] || []).filter(a => a.type !== 'status' || !a.body.startsWith('Lead created'));
  if (!acts.length) return null;
  return acts[acts.length - 1];
}

/* ---------------- auth ---------------- */
async function signIn(username, password) {
  if (DEMO) {
    return { username, display: cap(username) };
  }
  const { data, error } = await sb.auth.signInWithPassword({
    email: `${username.toLowerCase().trim()}@${AUTH_DOMAIN}`,
    password,
  });
  if (error) throw error;
  const display = data.user.user_metadata?.display_name || cap(username);
  return { username, display };
}
async function restoreSession() {
  if (DEMO) return null;
  const { data } = await sb.auth.getSession();
  if (data.session) {
    const u = data.session.user;
    const username = u.email.split('@')[0];
    return { username, display: u.user_metadata?.display_name || cap(username) };
  }
  return null;
}

/* ---------------- data ---------------- */
async function loadData() {
  if (DEMO) {
    state.leads = JSON.parse(JSON.stringify(demoLeads));
    state.activities = JSON.parse(JSON.stringify(demoActivities));
    return;
  }
  const [leadsRes, actsRes] = await Promise.all([
    sb.from('crm_leads').select('*').order('created_at', { ascending: false }),
    sb.from('crm_activities').select('*').order('created_at', { ascending: true }),
  ]);
  if (leadsRes.error) { toast('Error loading leads'); console.error(leadsRes.error); return; }
  state.leads = leadsRes.data;
  state.activities = {};
  (actsRes.data || []).forEach(a => {
    (state.activities[a.lead_id] = state.activities[a.lead_id] || []).push(a);
  });
}

async function saveStatus(lead, newStatus) {
  const old = lead.status;
  lead.status = newStatus;
  await addActivity(lead.id, 'status', `Status changed: ${ST[old]} → ${ST[newStatus]}`);
  if (!DEMO) {
    const { error } = await sb.from('crm_leads').update({ status: newStatus }).eq('id', lead.id);
    if (error) { toast('Failed to save status'); lead.status = old; }
  }
  renderAll();
  if (state.openLeadId === lead.id) renderDrawer();
}

async function addActivity(leadId, type, body, attachmentUrl) {
  const act = {
    id: 'tmp' + Math.random(),
    lead_id: leadId,
    type,
    author: state.user.display,
    body: body || '',
    attachment_url: attachmentUrl || null,
    created_at: new Date().toISOString(),
  };
  (state.activities[leadId] = state.activities[leadId] || []).push(act);
  if (!DEMO) {
    const { data, error } = await sb.from('crm_activities')
      .insert({ lead_id: leadId, type, author: act.author, body: act.body, attachment_url: act.attachment_url })
      .select().single();
    if (error) { toast('Failed to post'); console.error(error); }
    else Object.assign(act, data);
  }
  return act;
}

async function uploadScreenshot(file) {
  if (DEMO) {
    return state.attach.dataUrl; // demo: just embed the data url
  }
  const path = `${state.openLeadId}/${Date.now()}_${(file.name || 'screenshot.png').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await sb.storage.from('screenshots').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('screenshots').getPublicUrl(path);
  return data.publicUrl;
}

async function createLead(fields) {
  const lead = { id: 'tmp' + Math.random(), created_at: new Date().toISOString(), status: 'new', ...fields };
  if (!DEMO) {
    const { data, error } = await sb.from('crm_leads').insert({ ...fields, status: 'new' }).select().single();
    if (error) { toast('Failed to add lead'); console.error(error); return null; }
    Object.assign(lead, data);
  }
  state.leads.unshift(lead);
  await addActivity(lead.id, 'status', `Lead added manually by ${state.user.display}`);
  renderAll();
  return lead;
}

async function saveFollowup(lead, dateStr) {
  const old = lead.followup_at;
  lead.followup_at = dateStr;
  if (!DEMO) {
    const { error } = await sb.from('crm_leads').update({ followup_at: dateStr }).eq('id', lead.id);
    if (error) { toast('Failed to save follow-up'); lead.followup_at = old; renderAll(); return; }
  }
  if (dateStr) {
    await addActivity(lead.id, 'status', `Follow-up set for ${fmtFuDate(dateStr)} (${dateStr})`);
    toast(`Follow-up set: ${fmtFuDate(dateStr)}`);
  } else {
    await addActivity(lead.id, 'status', 'Follow-up completed ✓');
    toast('Follow-up done ✓');
  }
  renderAll();
  if (state.openLeadId === lead.id) renderDrawer();
}

async function moveStatus(lead, dir) {
  const i = STATUSES.findIndex(s => s.key === lead.status);
  const j = i + dir;
  if (j < 0 || j >= STATUSES.length) return;
  await saveStatus(lead, STATUSES[j].key);
}

async function deleteLead(lead) {
  if (!DEMO) {
    const { error } = await sb.from('crm_leads').delete().eq('id', lead.id);
    if (error) { toast('Failed to delete'); console.error(error); return; }
  }
  state.leads = state.leads.filter(l => String(l.id) !== String(lead.id));
  delete state.activities[lead.id];
  closeDrawer();
  renderAll();
  toast('Lead deleted');
}

/* ---------------- rendering ---------------- */
function filteredLeads() {
  const f = state.filters;
  let rows = state.leads.filter(l => {
    if (f.src !== 'all' && srcKey(l.heard_from) !== f.src) return false;
    if (f.status !== 'all' && l.status !== f.status) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = [l.name, l.email, l.phone, l.social, l.source, l.heard_from].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (f.sort === 'newest') rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (f.sort === 'oldest') rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (f.sort === 'activity') rows.sort((a, b) => {
    const la = lastActivity(a.id), lb = lastActivity(b.id);
    return new Date(lb ? lb.created_at : b.created_at) - new Date(la ? la.created_at : a.created_at);
  });
  return rows;
}

function renderStats() {
  const now = new Date();
  const thisMonth = state.leads.filter(l => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const newCount = state.leads.filter(l => l.status === 'new').length;
  const clients = state.leads.filter(l => l.status === 'client').length;
  const calls = state.leads.filter(l => ['call_booked', 'call_held', 'client'].includes(l.status)).length;
  const paid = state.leads.filter(l => ['meta','google'].includes(srcKey(l.heard_from))).length;
  $('stats').innerHTML = `
    <div class="stat"><div class="stat-label"><span class="stat-dot"></span>Total leads</div>
      <div class="stat-value">${state.leads.length}</div>
      <div class="stat-note"><b>${thisMonth}</b> this month</div></div>
    <div class="stat"><div class="stat-label"><span class="stat-dot"></span>New — not contacted</div>
      <div class="stat-value">${newCount}</div>
      <div class="stat-note">waiting for first touch</div></div>
    <div class="stat"><div class="stat-label"><span class="stat-dot"></span>Calls booked+</div>
      <div class="stat-value">${calls}</div>
      <div class="stat-note">booked, held or closed</div></div>
    <div class="stat"><div class="stat-label"><span class="stat-dot"></span>Clients</div>
      <div class="stat-value">${clients}</div>
      <div class="stat-note"><b>${paid}</b> from paid ads</div></div>`;
}

function renderFollowups() {
  const flagged = state.leads.filter(l => l.followup_at)
    .sort((a, b) => a.followup_at.localeCompare(b.followup_at));
  $('fuSection').style.display = flagged.length ? 'block' : 'none';
  $('fuCount').textContent = flagged.length;
  $('fuCards').innerHTML = flagged.map(l => {
    const overdue = fuIsOverdue(l);
    return `<div class="fu-card ${overdue ? 'overdue' : ''}" data-id="${l.id}">
      <div class="fu-card-top">
        <div style="min-width:0">
          <div class="fu-name">${esc(l.name)}</div>
          <div class="fu-date">${BELL_SVG} ${fmtFuDate(l.followup_at)}</div>
        </div>
        ${overdue ? '<span class="fu-overdue-tag">Overdue</span>' : ''}
      </div>
      <div class="fu-card-bottom">
        ${statusPill(l.status)}
        <button class="fu-done" data-fudone="${l.id}">✓ Done</button>
      </div>
    </div>`;
  }).join('');
}

function renderKanban() {
  const rows = filteredLeads();
  $('countLbl').textContent = `${rows.length} of ${state.leads.length} leads`;
  $('kanban').innerHTML = STATUSES.map((s, si) => {
    const col = rows.filter(l => l.status === s.key);
    return `<div class="kb-col" data-status="${s.key}">
      <div class="kb-col-head">
        <span class="pill st-${s.key}" style="padding:3px 10px;font-size:11px"><span class="pdot"></span>${s.label}</span>
        <span class="kb-col-count">${col.length}</span>
      </div>
      <div class="kb-cards">
        ${col.length ? col.map(l => {
          const k = srcKey(l.heard_from);
          const social = cleanSocial(l.social) || l.email || '';
          return `<div class="kb-card" style="border-left-color:${SRC[k].color}" data-id="${l.id}">
            <div class="kb-card-head">
              <div class="kb-name">${esc(l.name)}</div>
              ${fuBtnHtml(l)}
            </div>
            ${social ? `<div class="kb-social">${esc(social)}</div>` : ''}
            <div class="kb-meta">
              ${heardBadge(l.heard_from)}
              ${l.followup_at ? `<span class="kb-fu ${fuIsOverdue(l) ? 'overdue' : ''}">${BELL_SVG} ${fmtFuDate(l.followup_at)}</span>` : ''}
            </div>
          </div>`;
        }).join('') : '<div class="kb-empty">—</div>'}
      </div>
    </div>`;
  }).join('');
}

/* ---------------- kanban drag & drop ---------------- */
let drag = null;
let justDragged = false;

function initKanbanDrag() {
  const kanban = $('kanban');
  kanban.addEventListener('pointerdown', kbPointerDown);
}
function kbPointerDown(e) {
  if (e.button && e.button !== 0) return;              // left button / touch only
  const card = e.target.closest('.kb-card');
  if (!card) return;
  if (e.target.closest('[data-fu]')) return;           // let the bell do its thing
  const isTouch = e.pointerType === 'touch';
  drag = { id: card.dataset.id, card, sx: e.clientX, sy: e.clientY, moved: false, ready: !isTouch, ghost: null };
  if (isTouch) {
    drag.hold = setTimeout(() => { if (drag) { drag.ready = true; if (navigator.vibrate) navigator.vibrate(12); } }, 240);
  }
  window.addEventListener('pointermove', kbPointerMove, { passive: false });
  window.addEventListener('pointerup', kbPointerUp);
  window.addEventListener('pointercancel', kbPointerUp);
}
function kbPointerMove(e) {
  if (!drag) return;
  const dist = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  if (!drag.ready) { if (dist > 8) kbCleanup(); return; }   // touch: moved before hold = scroll
  if (!drag.moved) {
    if (dist < 5) return;
    drag.moved = true;
    const r = drag.card.getBoundingClientRect();
    drag.ox = drag.sx - r.left;
    drag.oy = drag.sy - r.top;
    const g = drag.card.cloneNode(true);
    g.classList.add('kb-drag-ghost');
    g.style.width = r.width + 'px';
    document.body.appendChild(g);
    drag.ghost = g;
    drag.card.classList.add('dragging');
    document.body.classList.add('kb-dragging');
  }
  drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
  drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const col = under && under.closest('.kb-col');
  document.querySelectorAll('.kb-col').forEach(c => c.classList.toggle('drop-target', c === col));
  drag.overCol = col;
  // edge auto-scroll for the horizontal board
  const kb = $('kanban');
  const kr = kb.getBoundingClientRect();
  if (e.clientX > kr.right - 60) kb.scrollLeft += 14;
  else if (e.clientX < kr.left + 60) kb.scrollLeft -= 14;
  e.preventDefault();
}
function kbPointerUp() {
  if (!drag) return;
  const d = drag;
  kbCleanup();
  if (!d.moved) return;                                // a tap → delegated click opens drawer
  justDragged = true;
  setTimeout(() => { justDragged = false; }, 80);
  if (d.overCol && d.overCol.dataset.status) {
    const lead = state.leads.find(l => String(l.id) === String(d.id));
    if (lead && lead.status !== d.overCol.dataset.status) saveStatus(lead, d.overCol.dataset.status);
  }
}
function kbCleanup() {
  window.removeEventListener('pointermove', kbPointerMove);
  window.removeEventListener('pointerup', kbPointerUp);
  window.removeEventListener('pointercancel', kbPointerUp);
  if (drag) {
    if (drag.hold) clearTimeout(drag.hold);
    if (drag.ghost) drag.ghost.remove();
    if (drag.card) drag.card.classList.remove('dragging');
  }
  document.body.classList.remove('kb-dragging');
  document.querySelectorAll('.kb-col').forEach(c => c.classList.remove('drop-target'));
  drag = null;
}

function renderView() {
  const isKb = state.view === 'pipeline';
  document.querySelector('.table-card').style.display = isKb ? 'none' : '';
  $('cards').style.display = isKb ? 'none' : '';
  $('kanban').style.display = isKb ? 'flex' : 'none';
  if (isKb) renderKanban(); else renderTableView();
}

function renderTable() { renderView(); }

function renderTableView() {
  const rows = filteredLeads();
  $('countLbl').textContent = `${rows.length} of ${state.leads.length} leads`;
  $('emptyState').style.display = rows.length ? 'none' : 'block';

  $('tbody').innerHTML = rows.map(l => {
    const la = lastActivity(l.id);
    const k = srcKey(l.heard_from);
    return `<tr data-id="${l.id}">
      <td class="lead-cell" style="position:relative">
        <span class="accent" style="background:${SRC[k].color}"></span>
        <div class="lead-name">${esc(l.name)}${fuBtnHtml(l)}</div>
        <div class="lead-social">${esc(cleanSocial(l.social))}</div>
      </td>
      <td><div class="contact"><div class="email">${esc(l.email || '—')}</div><div>${esc(l.phone || '')}</div></div></td>
      <td>${heardBadge(l.heard_from)}</td>
      <td><span class="src-plain">${esc(l.source || '—')}</span></td>
      <td>${statusPill(l.status)}</td>
      <td class="activity-cell">${la ? `<b>${esc(la.author)}</b> · ${la.type === 'comment' ? esc(la.body.slice(0, 40)) : (la.type === 'screenshot' ? 'added a screenshot' : la.type === 'fathom' ? 'added a Fathom link' : esc(la.body.slice(0, 40)))}` : '<span style="color:#b6b2a6">—</span>'}</td>
      <td class="date-cell">${fmtDate(l.created_at)}</td>
    </tr>`;
  }).join('');

  $('cards').innerHTML = rows.map(l => {
    const k = srcKey(l.heard_from);
    return `<div class="lead-card" data-id="${l.id}">
      <span class="accent" style="background:${SRC[k].color}"></span>
      <div class="lead-card-top">
        <div><div class="lead-name">${esc(l.name)}${fuBtnHtml(l)}</div><div class="lead-social">${esc(cleanSocial(l.social))}</div></div>
        ${statusPill(l.status)}
      </div>
      <div class="contact"><div class="email">${esc(l.email || '')}</div><div>${esc(l.phone || '')}</div></div>
      <div class="lead-card-badges">${heardBadge(l.heard_from)}<span class="src-plain" style="font-size:12px;color:var(--muted);align-self:center">${esc(l.source || '')} · ${fmtDate(l.created_at)}</span></div>
    </div>`;
  }).join('');
}

function renderAll() { renderStats(); renderFollowups(); renderView(); }

/* ---------------- drawer ---------------- */
function currentLead() {
  return state.leads.find(l => String(l.id) === String(state.openLeadId));
}
function openDrawer(id) {
  state.openLeadId = id;
  renderDrawer();
  $('overlay').classList.add('open');
  $('drawer').classList.add('open');
}
function closeDrawer() {
  state.openLeadId = null;
  $('overlay').classList.remove('open');
  $('drawer').classList.remove('open');
}
function renderDrawer() {
  const l = currentLead();
  if (!l) return;
  $('dTitle').textContent = l.name;
  $('dSub').textContent = `Added ${fmtDate(l.created_at)} · ${l.source || ''}`;
  $('dBadges').innerHTML = heardBadge(l.heard_from) + statusPill(l.status);

  $('dStatusSel').innerHTML = STATUSES.map(s =>
    `<option value="${s.key}" ${s.key === l.status ? 'selected' : ''}>${s.label}</option>`).join('');

  const dfu = $('dFuBtn');
  dfu.innerHTML = `${BELL_SVG} ${l.followup_at ? 'Follow up: ' + fmtFuDate(l.followup_at) : 'Set follow-up'}`;
  dfu.style.color = l.followup_at ? (fuIsOverdue(l) ? '#a32c2c' : 'var(--gold-deep)') : '';
  dfu.style.borderColor = l.followup_at ? (fuIsOverdue(l) ? '#f0d4d4' : '#e8d9ac') : '';
  dfu.onclick = () => openFuModal(l.id);

  $('infoGrid').innerHTML = [
    ['Full name', esc(l.name)],
    ['Email', l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '—'],
    ['Phone', l.phone ? `<a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>` : '—'],
    ['Social media', esc(l.social) || '—'],
    ['Heard from', heardBadge(l.heard_from)],
    ['Source', esc(l.source) || '—'],
    ['Added', fmtDateTime(l.created_at)],
    ['Note', esc(l.note) || '—'],
  ].map(([k, v]) => `<div class="info-row"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')
  + `<div style="margin-top:22px"><button class="mini-btn" id="deleteLeadBtn" style="color:#a32c2c;border-color:#f0d4d4">Delete lead</button></div>`;

  const delBtn = $('deleteLeadBtn');
  delBtn.addEventListener('click', () => {
    if (delBtn.dataset.armed) { deleteLead(l); return; }
    delBtn.dataset.armed = '1';
    delBtn.textContent = 'Click again to confirm delete';
    delBtn.style.background = '#fbe5e5';
    setTimeout(() => {
      if (!document.body.contains(delBtn)) return;
      delete delBtn.dataset.armed;
      delBtn.textContent = 'Delete lead';
      delBtn.style.background = '';
    }, 3500);
  });

  const acts = state.activities[l.id] || [];
  $('timeline').innerHTML = acts.length ? acts.map(a => {
    const icons = {
      comment: '💬', status: '⟳', fathom: '▶', screenshot: '🖼',
    };
    let body = '';
    if (a.type === 'status') {
      body = `<div class="t-status-line">${esc(a.body)}</div>`;
    } else if (a.type === 'screenshot') {
      body = `${a.body ? `<div class="t-body">${linkify(a.body)}</div>` : ''}<img class="t-img" src="${esc(a.attachment_url)}" onclick="showLightbox('${esc(a.attachment_url)}')">`;
    } else {
      body = `<div class="t-body">${linkify(a.body)}</div>`;
    }
    return `<div class="t-item">
      <div class="t-icon ${a.type}">${icons[a.type] || '•'}</div>
      <div class="t-content">
        <div class="t-meta"><b>${esc(a.author)}</b> · ${timeAgo(a.created_at)}</div>
        ${body}
      </div>
    </div>`;
  }).join('') : `<div class="empty" style="padding:30px 10px">No activity yet — be the first to leave a comment.</div>`;
}
window.showLightbox = (url) => {
  $('lightboxImg').src = url;
  $('lightbox').classList.add('open');
};

/* ---------------- composer ---------------- */
function setAttach(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.attach = { file, dataUrl: reader.result };
    $('attachThumb').src = reader.result;
    $('attachName').textContent = file.name || 'screenshot.png';
    $('attachPreview').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}
function clearAttach() {
  state.attach = null;
  $('attachPreview').style.display = 'none';
  $('fileInput').value = '';
}
async function postComposer() {
  const text = $('commentBox').value.trim();
  if (!text && !state.attach) return;
  const l = currentLead();
  if (!l) return;
  try {
    if (state.attach) {
      const url = await uploadScreenshot(state.attach.file);
      await addActivity(l.id, 'screenshot', text, url);
    } else if (/https?:\/\/(www\.)?fathom\.video/.test(text)) {
      await addActivity(l.id, 'fathom', text);
    } else {
      await addActivity(l.id, 'comment', text);
    }
    $('commentBox').value = '';
    clearAttach();
    renderDrawer();
    renderTable();
    toast('Posted ✓');
  } catch (e) {
    console.error(e);
    toast('Failed to post');
  }
}

/* ---------------- follow-up modal ---------------- */
function openFuModal(leadId) {
  const l = state.leads.find(x => String(x.id) === String(leadId));
  if (!l) return;
  state.fuLeadId = leadId;
  $('fuModalTitle').textContent = `Follow up — ${l.name}`;
  $('fuDate').value = l.followup_at || addDaysStr(1);
  $('fuDate').min = todayStr();
  $('fuRemove').style.display = l.followup_at ? 'block' : 'none';
  $('fuModalWrap').classList.add('open');
}
function closeFuModal() {
  state.fuLeadId = null;
  $('fuModalWrap').classList.remove('open');
}

/* ---------------- events ---------------- */
function bindEvents() {
  // capture-phase delegation: follow-up bells, done buttons, kanban arrows
  document.addEventListener('click', (e) => {
    const fu = e.target.closest('[data-fu]');
    if (fu) { e.stopPropagation(); e.preventDefault(); openFuModal(fu.dataset.fu); return; }
    const done = e.target.closest('[data-fudone]');
    if (done) {
      e.stopPropagation(); e.preventDefault();
      const l = state.leads.find(x => String(x.id) === String(done.dataset.fudone));
      if (l) saveFollowup(l, null);
      return;
    }
  }, true);

  // open drawer on any lead card/row click (bubble phase)
  document.addEventListener('click', (e) => {
    if (justDragged) return;                 // ignore the click that ends a drag
    const el = e.target.closest('[data-id]');
    if (el) openDrawer(el.dataset.id);
  });

  initKanbanDrag();

  // view toggle
  document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#viewSeg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.view = b.dataset.view;
    try { localStorage.setItem('kgen_view', state.view); } catch (err) {}
    renderView();
  }));

  // follow-up modal
  $('fuModalBg').addEventListener('click', closeFuModal);
  $('fuCancel').addEventListener('click', closeFuModal);
  document.querySelectorAll('.fu-quick button').forEach(b => b.addEventListener('click', () => {
    $('fuDate').value = addDaysStr(parseInt(b.dataset.days, 10));
  }));
  $('fuSave').addEventListener('click', async () => {
    const l = state.leads.find(x => String(x.id) === String(state.fuLeadId));
    const val = $('fuDate').value;
    if (!l || !val) { toast('Pick a date'); return; }
    closeFuModal();
    await saveFollowup(l, val);
  });
  $('fuRemove').addEventListener('click', async () => {
    const l = state.leads.find(x => String(x.id) === String(state.fuLeadId));
    closeFuModal();
    if (l) await saveFollowup(l, null);
  });
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginErr').style.display = 'none';
    try {
      const user = await signIn($('loginUser').value, $('loginPass').value);
      await enterApp(user);
    } catch (err) {
      $('loginErr').style.display = 'block';
    }
  });
  $('logoutBtn').addEventListener('click', async () => {
    if (!DEMO) await sb.auth.signOut();
    location.reload();
  });
  $('search').addEventListener('input', (e) => { state.filters.q = e.target.value; renderTable(); });
  $('statusFilter').addEventListener('change', (e) => { state.filters.status = e.target.value; renderTable(); });
  $('sortSel').addEventListener('change', (e) => { state.filters.sort = e.target.value; renderTable(); });
  document.querySelectorAll('#srcSeg button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#srcSeg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.filters.src = b.dataset.src;
    renderTable();
  }));
  $('overlay').addEventListener('click', closeDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);
  document.querySelectorAll('.drawer-tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.drawer-tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('tabActivity').style.display = b.dataset.tab === 'activity' ? 'block' : 'none';
    $('tabDetails').style.display = b.dataset.tab === 'details' ? 'block' : 'none';
  }));
  $('dStatusSel').addEventListener('change', (e) => {
    const l = currentLead();
    if (l) saveStatus(l, e.target.value);
  });
  $('postBtn').addEventListener('click', postComposer);
  $('commentBox').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') postComposer();
  });
  $('commentBox').addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); setAttach(item.getAsFile()); }
  });
  $('attachBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) setAttach(e.target.files[0]); });
  $('attachRemove').addEventListener('click', clearAttach);
  $('fathomBtn').addEventListener('click', () => {
    const box = $('commentBox');
    if (!/fathom\.video/.test(box.value)) box.value = (box.value ? box.value + '\n' : '') + 'https://fathom.video/calls/';
    box.focus();
    box.selectionStart = box.selectionEnd = box.value.length;
  });
  $('lightbox').addEventListener('click', () => $('lightbox').classList.remove('open'));
  $('newLeadBtn').addEventListener('click', () => $('modalWrap').classList.add('open'));
  $('modalBg').addEventListener('click', () => $('modalWrap').classList.remove('open'));
  $('mCancel').addEventListener('click', () => $('modalWrap').classList.remove('open'));
  $('mSave').addEventListener('click', async () => {
    const name = $('mName').value.trim();
    if (!name) { toast('Name is required'); return; }
    await createLead({
      name,
      email: $('mEmail').value.trim(),
      phone: $('mPhone').value.trim(),
      social: $('mSocial').value.trim(),
      heard_from: $('mHeard').value,
      source: $('mSource').value.trim() || 'Manual entry',
    });
    $('modalWrap').classList.remove('open');
    ['mName', 'mEmail', 'mPhone', 'mSocial'].forEach(id => $(id).value = '');
    toast('Lead added ✓');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeFuModal(); $('modalWrap').classList.remove('open'); $('lightbox').classList.remove('open'); } });
}

/* ---------------- boot ---------------- */
async function enterApp(user) {
  state.user = user;
  $('userName').textContent = user.display;
  $('avatar').textContent = user.display.charAt(0).toUpperCase();
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  await loadData();
  $('statusFilter').innerHTML = `<option value="all">All statuses</option>` +
    STATUSES.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
  renderAll();
  $('loginPage').style.display = 'none';
  $('app').style.display = 'block';
  if (!DEMO) {
    // light auto-refresh every 60s so the team sees each other's updates
    setInterval(async () => {
      if (document.hidden) return;
      await loadData();
      renderAll();
      if (state.openLeadId) renderDrawer();
    }, 60000);
  }
}

(async function init() {
  bindEvents();
  const existing = await restoreSession();
  if (existing) await enterApp(existing);
})();
