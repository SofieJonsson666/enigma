// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let adminAuthed = false, currentAgent = null;
let cfg = {  warn_threshold: 2, flag_threshold: 3 };
let allLogs = [], logFilter = 'all', realtimeSub = null;

// ══════════════════════════════════════════════
//  CLOCK
// ══════════════════════════════════════════════
setInterval(() => {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
async function init() {
  try {
    const { data, error } = await db.from('admin_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    if (data) {
      cfg = data;
      document.getElementById('s-warn').value = cfg.warn_threshold;
      document.getElementById('s-flag').value = cfg.flag_threshold;
    }
    document.getElementById('db-status').textContent = 'SECURE LINK. WELCOME AGENT';
  } catch (e) {
    document.getElementById('db-status').textContent = 'DB ERROR';
    toast('Database connection failed — check backend settings', 'terr');
  }
  document.getElementById('loading-overlay').style.display = 'none';
}
window.addEventListener('load', init);

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function showView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.getElementById('nav-' + v).classList.add('active');
}

function adminTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'agents') loadRoster();
  if (name === 'log') loadAccessLog();
  if (name === 'messages') loadAdminMessages();
}

// ══════════════════════════════════════════════
//  CIPHER — Vigenère + noise
// ══════════════════════════════════════════════
function vigenere(text, key, enc) {
  const K = key.toUpperCase().replace(/[^A-Z]/g, '');
  if (!K.length) return text;
  let res = '', ki = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], code = c.charCodeAt(0), shift = K.charCodeAt(ki % K.length) - 65;
    if (code >= 65 && code <= 90) { res += String.fromCharCode((enc ? (code - 65 + shift) % 26 : (code - 65 - shift + 26) % 26) + 65); ki++; }
    else if (code >= 97 && code <= 122) { res += String.fromCharCode((enc ? (code - 97 + shift) % 26 : (code - 97 - shift + 26) % 26) + 97); ki++; }
    else if (code === 32) { res += ' '; }
    else { res += enc ? String.fromCharCode(((code + shift) % 94) + 33) : String.fromCharCode(((code - 33 - shift % 94) % 94 + 94) % 94 + 33); ki++; }
  }
  return res;
}

function noise(text, key, enc) {
  const K = key.toUpperCase().replace(/[^A-Z]/g, '') || 'A';
  return text.split('').map((c, i) => {
    const code = c.charCodeAt(0);
    if (code === 32) return ' ';
    if (code >= 33 && code <= 126) {
      const s = K.charCodeAt((i * 3) % K.length) % 10;
      return String.fromCharCode(enc ? ((code - 33 + s) % 94) + 33 : ((code - 33 - s + 94) % 94) + 33);
    }
    return c;
  }).join('');
}

const encrypt = (t, k) => noise(vigenere(t, k, true), k, true);
const decrypt = (t, k) => vigenere(noise(t, k, false), k, false);

// ══════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════
function genPassword() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

const KEYS = ['PINE','CREST','ECON','ISHSTATE','VIDLORE','LYCHEE','TARNISH','AZIMUTH','GOOSE','DOLLOP','AUGUR','GLOBULE','SERAPH','GRISTLE','WADDLE','MIASMA','ORION','SUNFORGE','ACTING','FROST','QUARTERMASTER','ELANUELO','SAMMIE','JACKBOX','ACCOUNT','SOFIE','APPLEPIE','POLAR','BEAR','ARASAKA','NETRUNNER','NIGHT'];
const genKey = () => KEYS[Math.floor(Math.random() * KEYS.length)];
const todayStr = () => new Date().toISOString().split('T')[0];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function toast(msg, cls = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (cls ? ' ' + cls : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 4000);
}

function setBtn(id, dis, txt) {
  const b = document.getElementById(id);
  if (!b) return;
  b.disabled = dis;
  if (txt) b.textContent = txt;
}

// ══════════════════════════════════════════════
//  ADMIN AUTH
// ══════════════════════════════════════════════
async function adminLogin() {
  const pass = document.getElementById('admin-pass-input').value;
  const errEl = document.getElementById('admin-login-err');
  setBtn('admin-login-btn', true, 'AUTHENTICATING...');

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPA_KEY}`
      },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    setBtn('admin-login-btn', false, 'AUTHENTICATE ›');

    if (data.success) {
      adminAuthed = true;
      errEl.style.display = 'none';
      document.getElementById('admin-login-screen').style.display = 'none';
      document.getElementById('admin-dashboard').style.display = 'block';
      document.getElementById('s-warn').value = cfg.warn_threshold;
      document.getElementById('s-flag').value = cfg.flag_threshold;
      toast('WELCOME KAZ');
      await refreshStats();
      startRealtime();
    } else {
      errEl.style.display = 'block';
      errEl.textContent = 'AUTHENTICATION FAILED — INVALID PASSPHRASE';
      await logAccess('UNKNOWN', 'ADMIN_FAIL', 'flag', null);
    }
  } catch (e) {
    setBtn('admin-login-btn', false, 'AUTHENTICATE ›');
    errEl.style.display = 'block';
    errEl.textContent = 'CONNECTION ERROR — TRY AGAIN';
  }
}

function adminLogout() {
  adminAuthed = false;
  if (realtimeSub) { db.removeChannel(realtimeSub); realtimeSub = null; }
  document.getElementById('admin-dashboard').style.display = 'none';
  document.getElementById('admin-login-screen').style.display = 'block';
  document.getElementById('admin-pass-input').value = '';
  toast('LOGOUT');
}

// ══════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════
async function refreshStats() {
  const { count: ac } = await db.from('agents').select('*', { count: 'exact', head: true });
  document.getElementById('stat-agents').textContent = ac ?? 0;
  const { data: kd } = await db.from('daily_keys').select('key').eq('date', todayStr()).maybeSingle();
  const k = kd?.key || '—';
  document.getElementById('stat-key').textContent = k;
  document.getElementById('decode-key').value = k !== '—' ? k : '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: logs } = await db.from('access_log').select('flagged').gte('logged_at', today.toISOString());
  document.getElementById('stat-warns').textContent = (logs || []).filter(l => l.flagged === 'warn').length;
  document.getElementById('stat-flags').textContent = (logs || []).filter(l => l.flagged === 'flag').length;
}

// ══════════════════════════════════════════════
//  AGENT REGISTRATION
// ══════════════════════════════════════════════
async function registerAgent() {
  const codename = document.getElementById('reg-codename').value.trim().toUpperCase();
  const password = document.getElementById('reg-password').value.trim() || genPassword();
  if (!codename) { toast('Enter a codename', 'terr'); return; }
  const { error } = await db.from('agents').insert({ codename, password });
  if (error) { toast(error.code === '23505' ? 'Codename already in use' : error.message, 'terr'); return; }
  document.getElementById('reg-codename').value = '';
  document.getElementById('reg-password').value = '';
  toast(`AGENT ${codename} ENROLLED // PWD: ${password}`);
  await refreshStats();
  if (document.getElementById('tab-agents').classList.contains('active')) loadRoster();
}

// ══════════════════════════════════════════════
//  ROSTER + EDIT/REMOVE
// ══════════════════════════════════════════════
async function loadRoster() {
  document.getElementById('roster-loading').style.display = 'block';
  document.getElementById('agent-table').style.display = 'none';
  document.getElementById('roster-empty').style.display = 'none';
  const { data: agents } = await db.from('agents').select('*').order('created_at');
  const { data: logs } = await db.from('access_log').select('agent_id,flagged,action').gte('logged_at', todayStr());
  document.getElementById('roster-loading').style.display = 'none';
  if (!agents || !agents.length) { document.getElementById('roster-empty').style.display = 'block'; return; }
  document.getElementById('agent-table').style.display = 'table';
  const tbody = document.getElementById('agent-tbody');
  tbody.innerHTML = '';
  agents.forEach(ag => {
    const agLogs = (logs || []).filter(l => l.agent_id === ag.id);
    const lc = agLogs.filter(l => l.action === 'LOGIN').length;
    let st = '<span class="aok">NO ACCESS TODAY</span>';
    if (lc === 1) st = '<span class="aok">✓ 1 LOGIN</span>';
    else if (lc === 2) st = '<span class="awk">⚠ 2 LOGINS</span>';
    else if (lc >= 3) st = `<span class="afg">⛔ ${lc} LOGINS</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="cn">${esc(ag.codename)}</span></td>
      <td class="reveal"><span class="redacted">${esc(ag.password)}</span></td>
      <td style="font-size:11px;color:var(--text-dim);">${new Date(ag.created_at).toLocaleDateString('en-GB')}</td>
      <td>${st}</td>
      <td style="text-align:right;">
        <div class="flex-gap" style="justify-content:flex-end;">
          <button class="btn bs ba" onclick="openEditModal('${ag.id}','${esc(ag.codename)}','${esc(ag.password)}')">✎ EDIT</button>
          <button class="btn bs br" onclick="removeAgent('${ag.id}','${esc(ag.codename)}')">✕ REMOVE</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function openEditModal(id, codename, password) {
  document.getElementById('edit-agent-id').value = id;
  document.getElementById('edit-codename').value = codename;
  document.getElementById('edit-password').value = password;
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

async function saveAgentEdit() {
  const id = document.getElementById('edit-agent-id').value;
  const codename = document.getElementById('edit-codename').value.trim().toUpperCase();
  const password = document.getElementById('edit-password').value.trim();
  if (!codename) { toast('Codename cannot be empty', 'terr'); return; }
  if (!password) { toast('Password cannot be empty', 'terr'); return; }
  const { error } = await db.from('agents').update({ codename, password }).eq('id', id);
  if (error) { toast(error.code === '23505' ? 'Codename already in use by another agent' : error.message, 'terr'); return; }
  closeEditModal();
  toast(`AGENT UPDATED — ${codename}`);
  await refreshStats();
  loadRoster();
}

async function removeAgent(id, codename) {
  if (!confirm(`Remove agent ${codename}? This cannot be undone.`)) return;
  await db.from('agents').delete().eq('id', id);
  toast(`AGENT ${codename} REMOVED FROM ROSTER`);
  await refreshStats();
  loadRoster();
}

// ══════════════════════════════════════════════
//  DAILY KEY
// ══════════════════════════════════════════════
async function setDailyKey() {
  const k = document.getElementById('daily-key-input').value.trim().toUpperCase();
  if (!k) { toast('Enter a key', 'terr'); return; }
  const { error } = await db.from('daily_keys').upsert({ key: k, date: todayStr() }, { onConflict: 'date' });
  if (error) { toast(error.message, 'terr'); return; }
  toast(`DAILY KEY SET: ${k}`);
  await refreshStats();
}

async function generateKey() {
  const k = genKey();
  document.getElementById('daily-key-input').value = k;
  const { error } = await db.from('daily_keys').upsert({ key: k, date: todayStr() }, { onConflict: 'date' });
  if (error) { toast(error.message, 'terr'); return; }
  toast(`KEY GENERATED & SET: ${k}`);
  await refreshStats();
}

// ══════════════════════════════════════════════
//  DECODE
// ══════════════════════════════════════════════
function decodeMessage() {
  const raw = document.getElementById('decode-input').value.trim();
  const key = document.getElementById('decode-key').value.trim().toUpperCase();
  if (!raw) { toast('No message to decode', 'terr'); return; }
  if (!key) { toast("No key — set today's key first", 'terr'); return; }
  const plain = decrypt(raw, key);
  const m = plain.match(/^([A-Z0-9_]+)SPLIT/);
  const agentName = m ? m[1] : 'AGENT';
  const msg = m ? plain.substring(m[0].length).trim() : plain;
  document.getElementById('decode-output').style.display = 'block';
  document.getElementById('decode-meta').textContent = `SOURCE: ${agentName} // KEY: ${key} // ${new Date().toLocaleTimeString()}`;
  document.getElementById('decode-result').innerHTML = `<span style="color:var(--accent)">[${esc(agentName)}]</span> ${esc(msg)}`;
  toast('MESSAGE DECRYPTED');
}

// ══════════════════════════════════════════════
//  ACCESS LOG
// ══════════════════════════════════════════════
async function logAccess(codename, action, flagged, agentId) {
  await db.from('access_log').insert({ agent_id: agentId || null, codename, action, flagged: flagged || '' });
}

async function loadAccessLog() {
  document.getElementById('log-loading').style.display = 'block';
  document.getElementById('access-log-list').innerHTML = '';
  document.getElementById('log-empty').style.display = 'none';
  const { data } = await db.from('access_log').select('*').order('logged_at', { ascending: false }).limit(300);
  allLogs = data || [];
  document.getElementById('log-loading').style.display = 'none';
  renderLog();
}

function filterLog(f) {
  logFilter = f;
  document.querySelectorAll('[id^=flt-]').forEach(b => b.style.opacity = '.4');
  document.getElementById('flt-' + f).style.opacity = '1';
  renderLog();
}

function renderLog() {
  const list = document.getElementById('access-log-list');
  list.innerHTML = '';
  let entries = [...allLogs];
  if (logFilter === 'warn') entries = entries.filter(e => e.flagged === 'warn');
  if (logFilter === 'flag') entries = entries.filter(e => e.flagged === 'flag');
  if (logFilter === 'today') entries = entries.filter(e => e.logged_at.startsWith(todayStr()));
  if (!entries.length) { document.getElementById('log-empty').style.display = 'block'; return; }
  document.getElementById('log-empty').style.display = 'none';
  entries.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'log-entry';
    const time = new Date(entry.logged_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fl = entry.flagged === 'flag' ? '<span class="lff">⛔ FLAG</span>' : entry.flagged === 'warn' ? '<span class="lfw">⚠ WARN</span>' : '';
    li.innerHTML = `<span class="lt">${time}</span><span class="la">${esc(entry.codename)}</span><span class="lm">${esc(entry.action)}</span>${fl}`;
    list.appendChild(li);
  });
}

async function clearTodayLogs() {
  if (!confirm("DELETE ALL LOG ENTRIES AND MESSAGES FROM TODAY?")) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { error } = await db.from('access_log').delete().gte('logged_at', today.toISOString());
  if (error) { toast(error.message, 'terr'); return; }
  await db.from('messages').delete().gte('sent_at', today.toISOString());
  allLogs = allLogs.filter(e => !e.logged_at.startsWith(todayStr()));
  renderLog(); await refreshStats();
  toast("TODAY'S LOGS && MESSAGES CLEARED");
  if (!confirm("DELETE ALL LOG ENTRIES FROM TODAY?")) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { error } = await db.from('access_log').delete().gte('logged_at', today.toISOString());
  if (error) { toast(error.message, 'terr'); return; }
  allLogs = allLogs.filter(e => !e.logged_at.startsWith(todayStr()));
  renderLog(); await refreshStats();
  toast("TODAY'S LOGS CLEARED");
}

async function clearLoginLogs() {
  if (!confirm("DELETE ALL LOGINS FROM TODAY? OTHER ENTRIES ARE KEPT")) return;
  const { error } = await db.from('access_log').delete().eq('action', 'LOGIN');
  if (error) { toast(error.message, 'terr'); return; }
  allLogs = allLogs.filter(e => e.action !== 'LOGIN');
  renderLog(); await refreshStats();
  toast("ALL LOGIN ENTRIES CLEARED");
}

async function clearAllLogs() {
  if (!confirm("⛔ WIPE ENTIRE AUDIT LOG AND ALL MESSAGES? KILL SWITCH. THIS CANNOT BE UNDONE. DONT DO IT KAZ")) return;
  const { error } = await db.from('access_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) { toast(error.message, 'terr'); return; }
  await db.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  allLogs = [];
  renderLog(); await refreshStats();
  toast("FULL AUDIT LOG AND MESSAGES WIPED");
}

async function clearOldLogs() {
  if (!confirm("DELETE ALL LOG ENTRIES AND MESSAGES FROM BEFORE TODAY?")) return;
  const { error } = await db.from('access_log').delete().lt('logged_at', todayStr());
  if (error) { toast(error.message, 'terr'); return; }
  await db.from('messages').delete().lt('sent_at', todayStr());
  allLogs = allLogs.filter(e => e.logged_at.startsWith(todayStr()));
  renderLog();
  toast("PRE-TODAY LOGS AND MESSAGES PURGED");
}

function startRealtime() {
  if (realtimeSub) db.removeChannel(realtimeSub);
  realtimeSub = db.channel('access_log_rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_log' }, async payload => {
      allLogs.unshift(payload.new);
      if (document.getElementById('tab-log').classList.contains('active')) renderLog();
      await refreshStats();
      if (payload.new.flagged === 'flag') toast(`⛔ FLAG — ${payload.new.codename}: ${payload.new.action}`, 'terr');
      else if (payload.new.flagged === 'warn') toast(`⚠ WARN — ${payload.new.codename}: ${payload.new.action}`, 'twrn');
    }).subscribe();
}

// ══════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════
async function changeAdminPass() {
  const cur = document.getElementById('s-cur').value;
  const nxt = document.getElementById('s-new').value;
  const cnf = document.getElementById('s-conf').value;
  if (cur !== cfg.admin_password) { toast('Current password incorrect', 'terr'); return; }
  if (!nxt || nxt.length < 6) { toast('New password must be 6+ characters', 'terr'); return; }
  if (nxt !== cnf) { toast('Passwords do not match', 'terr'); return; }
  const { error } = await db.from('admin_settings').update({ admin_password: nxt }).eq('id', 1);
  if (error) { toast(error.message, 'terr'); return; }
  cfg.admin_password = nxt;
  ['s-cur', 's-new', 's-conf'].forEach(id => document.getElementById(id).value = '');
  toast('PASSWORD UPDATED');
}

async function saveThresholds() {
  const w = parseInt(document.getElementById('s-warn').value);
  const f = parseInt(document.getElementById('s-flag').value);
  if (w >= f) { toast('Flag threshold must be greater than warn threshold', 'terr'); return; }
  const { error } = await db.from('admin_settings').update({ warn_threshold: w, flag_threshold: f }).eq('id', 1);
  if (error) { toast(error.message, 'terr'); return; }
  cfg.warn_threshold = w; cfg.flag_threshold = f;
  toast(`THRESHOLDS SAVED — WARN:${w} FLAG:${f}`);
}

// ══════════════════════════════════════════════
//  AGENT PORTAL
// ══════════════════════════════════════════════
async function agentLogin() {
  const pass = document.getElementById('agent-pass-input').value.trim();
  const key = document.getElementById('agent-key-input').value.trim().toUpperCase();
  const errEl = document.getElementById('agent-login-error');
  setBtn('agent-login-btn', true, 'NETRUNNING...');
  const { data: agents } = await db.from('agents').select('*').eq('password', pass);
  setBtn('agent-login-btn', false, '◈ ACCESS RELAY ›');
  if (!agents || !agents.length) {
    errEl.style.display = 'block'; errEl.textContent = 'AUTHENTICATION FAILED — INVALID CREDENTIALS';
    await logAccess('AGENT', 'FAILED_LOGIN', 'flag', null); return;
  }
  const agent = agents[0];
  if (!key) { errEl.style.display = 'block'; errEl.textContent = 'DAILY KEY REQUIRED'; return; }
  const { data: kd } = await db.from('daily_keys').select('key').eq('date', todayStr()).maybeSingle();
  if (kd && key !== kd.key) {
    errEl.style.display = 'block'; errEl.textContent = 'INVALID KEY — ENTER CORRECT KEY';
    await logAccess(agent.codename, 'WRONG_KEY', 'flag', agent.id); return;
  }
  const { data: freshCfg } = await db.from('admin_settings').select('*').eq('id', 1).single();
  if (freshCfg) cfg = freshCfg;
  const { data: todayL } = await db.from('access_log').select('id').eq('agent_id', agent.id).eq('action', 'LOGIN').gte('logged_at', todayStr());
  const lc = (todayL?.length || 0) + 1;
  let flagged = '';
  if (lc >= cfg.flag_threshold) flagged = 'flag';
  else if (lc >= cfg.warn_threshold) flagged = 'warn';
  await logAccess(agent.codename, 'LOGIN', flagged, agent.id);
  currentAgent = { ...agent, sessionKey: key };
  errEl.style.display = 'none';
  document.getElementById('agent-login-screen').style.display = 'none';
  document.getElementById('agent-dashboard').style.display = 'block';

  // Populate identity bar
  document.getElementById('agent-id-codename').textContent = agent.codename;
  document.getElementById('agent-id-meta').textContent =
    `SESSION ACTIVE // KEY: ${key} // ${new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}`;

  // Reset to relay tab on login
  agentTab('relay', document.getElementById('atbtn-relay'));
  document.getElementById('agent-encrypted-output').style.display = 'none';
  document.getElementById('agent-message-input').value = '';

  if (lc > 1) {
    const wb = document.getElementById('agent-warning-banner');
    wb.style.display = 'block';
    wb.textContent = lc >= cfg.flag_threshold
      ? `⛔ SECURITY ALERT: ${lc} logins detected on your account today. Command has been notified.`
      : `⚠ WARNING: This is your #${lc} login today. Command has been notified.`;
  }
  toast(`CODENAME ${agent.codename} — RELAY ACTIVE`);
}

async function encryptAgentMessage() {
  const raw = document.getElementById('agent-message-input').value.trim();
  if (!raw) { toast('No message to encrypt', 'terr'); return; }
  if (!currentAgent) { toast('Session expired', 'terr'); return; }
  const tagged = `${currentAgent.codename}SPLIT${raw}`;
  const enc = encrypt(tagged, currentAgent.sessionKey);
  await logAccess(currentAgent.codename, 'RELAY_SENT', '', currentAgent.id);
  document.getElementById('agent-encrypted-output').style.display = 'block';
  document.getElementById('encrypted-text').textContent = enc;
  toast('MESSAGE ENCRYPTED — READY TO RELAY');
}

function copyEncrypted() {
  const txt = document.getElementById('encrypted-text').textContent;
  navigator.clipboard.writeText(txt).then(() => toast('COPIED TO CLIPBOARD')).catch(() => {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('COPIED TO CLIPBOARD');
  });
}

function clearAgentSession() {
  currentAgent = null;
  document.getElementById('agent-dashboard').style.display = 'none';
  document.getElementById('agent-login-screen').style.display = 'block';
  ['agent-pass-input', 'agent-key-input', 'agent-message-input'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('agent-encrypted-output').style.display = 'none';
  document.getElementById('agent-warning-banner').style.display = 'none';
  document.getElementById('history-list').innerHTML = '';
  document.getElementById('agent-id-codename').textContent = '—';
  toast('SESSION CLEARED');
}

// ══════════════════════════════════════════════
//  AGENT PORTAL TABS
// ══════════════════════════════════════════════
function agentTab(name, btn) {
  document.querySelectorAll('[id^=atbtn-]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('[id^=atab-]').forEach(c => c.classList.remove('active'));
  document.getElementById('atab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'history') loadAgentHistory();
}

// ══════════════════════════════════════════════
//  RESET RELAY (new message without logging out)
// ══════════════════════════════════════════════
function resetRelay() {
  document.getElementById('agent-message-input').value = '';
  document.getElementById('agent-encrypted-output').style.display = 'none';
}

// ══════════════════════════════════════════════
//  LOAD AGENT MESSAGE HISTORY
// ══════════════════════════════════════════════
async function loadAgentHistory() {
  if (!currentAgent) return;
  document.getElementById('history-loading').style.display = 'block';
  document.getElementById('history-list').innerHTML = '';
  document.getElementById('history-empty').style.display = 'none';

  const { data: messages } = await db.from('messages')
    .select('*')
    .eq('agent_id', currentAgent.id)
    .order('sent_at', { ascending: false });

  document.getElementById('history-loading').style.display = 'none';

  if (!messages || !messages.length) {
    document.getElementById('history-empty').style.display = 'block';
    return;
  }

  const list = document.getElementById('history-list');
  messages.forEach(msg => {
    // Decrypt the message to show plaintext
    const decrypted = decrypt(msg.encrypted_message, msg.key_used);
    // Strip the CODENAME SPLIT prefix
    const m = decrypted.match(/^([A-Z0-9_]+)SPLIT/);
    const plaintext = m ? decrypted.substring(m[0].length).trim() : decrypted;

    const time = new Date(msg.sent_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = 'msg-card';
    card.innerHTML = `
      <div class="msg-card-header">
        <span class="msg-card-time">${time}</span>
        <span class="msg-card-key">KEY: ${esc(msg.key_used)}</span>
      </div>
      <div class="msg-card-body">${esc(plaintext)}</div>
      <div class="msg-card-encrypted" title="Click to copy encrypted version" onclick="copyText('${esc(msg.encrypted_message)}')">
        ENCRYPTED: ${esc(msg.encrypted_message.substring(0, 60))}...
      </div>
    `;
    list.appendChild(card);
  });
}

function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => toast('ENCRYPTED VERSION COPIED'));
}

// ══════════════════════════════════════════════
//  ADMIN MESSAGES VIEW
// ══════════════════════════════════════════════
async function loadAdminMessages() {
  document.getElementById('admin-msg-loading').style.display = 'block';
  document.getElementById('admin-msg-list').innerHTML = '';
  document.getElementById('admin-msg-empty').style.display = 'none';

  const { data: messages } = await db.from('messages')
    .select('*')
    .order('sent_at', { ascending: false });

  document.getElementById('admin-msg-loading').style.display = 'none';

  if (!messages || !messages.length) {
    document.getElementById('admin-msg-empty').style.display = 'block';
    return;
  }

  const list = document.getElementById('admin-msg-list');
  messages.forEach(msg => {
    const decrypted = decrypt(msg.encrypted_message, msg.key_used);
    const m = decrypted.match(/^([A-Z0-9_]+)SPLIT/);
    const plaintext = m ? decrypted.substring(m[0].length).trim() : decrypted;
    const time = new Date(msg.sent_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = 'msg-card';
    card.innerHTML = `
      <div class="msg-card-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="cn" style="font-size:13px;">${esc(msg.codename)}</span>
          <span class="msg-card-time">${time}</span>
        </div>
        <span class="msg-card-key">KEY: ${esc(msg.key_used)}</span>
      </div>
      <div class="msg-card-body">${esc(plaintext)}</div>
      <div class="msg-card-encrypted" title="Click to copy encrypted" onclick="copyText('${msg.encrypted_message.replace(/'/g,"\\'")}')">
        ENCRYPTED: ${esc(msg.encrypted_message.substring(0, 80))}...
      </div>
    `;
    list.appendChild(card);
  });
}
