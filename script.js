'use strict';

/* =====================================================
   РАСПИСАНИЕ. Правь здесь.
   Ключ — день недели: 0 = воскресенье, 1 = пн, 2 = вт ... 6 = суббота.
   Когда группа «Визуальное программирование» запустится —
   поставь active: true и впиши учеников.
   from: 'ГГГГ-ММ-ДД' — дата, с которой занятие появляется в расписании
   (до неё урок не показывается и не считается).
   ===================================================== */
const THEMES = {
  ege:    '#FFC400',
  start:  '#9B6BF2',
  pro:    '#FF7A3D',
  visual: '#2ABFA7',
};

const SCHEDULE = {
  6: [
    { id: 'sat-1', start: '10:20', end: '11:50', course: 'Подготовка к ЕГЭ по информатике', theme: 'ege',   students: ['Полина'] },
    { id: 'sat-2', start: '11:50', end: '13:20', course: 'Python Start', level: '1 год', theme: 'start', students: ['Игорь'] },
    { id: 'sat-3', start: '13:30', end: '15:00', course: 'Python Start', level: '1 год', theme: 'start', students: ['Терентий'], from: '2026-10-10' },
  ],
  0: [
    { id: 'sun-1', start: '10:20', end: '11:50', course: 'Подготовка к ЕГЭ по информатике', theme: 'ege', students: ['Полина'] },
    { id: 'sun-2', start: '11:50', end: '13:20', course: 'Python Pro', level: '1 год', theme: 'pro', students: ['Ярик', 'Дима'] },
    { id: 'sun-3', start: '13:30', end: '15:00', course: 'Визуальное программирование', theme: 'visual', students: [], active: false, note: 'Группа пока не запустилась' },
  ],
  2: [
    { id: 'tue-1', start: '17:00', end: '18:00', course: 'Python Start', theme: 'start', students: [], from: '2026-11-01' },
  ],
};

/* ===================== Данные ===================== */
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STORE_KEY = 'algoritmika-schedule-v1';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isActive = (l) => l.active !== false;
const lessonsOf = (date) => {
  const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
  return (SCHEDULE[date.getDay()] || []).filter((l) => !l.from || key >= l.from);
};

let state = load();
const today = new Date();
let view = { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
let pending = null; // урок, для которого сейчас вводится причина отмены {key, id}
const QUICK_REASONS = ['Ученик заболел', 'Ученик не пришёл', 'Перенос занятия', 'Технические проблемы'];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return { days: s.days || {}, extra: s.extra || {} };
  } catch { return { days: {}, extra: {} }; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* память браузера недоступна */ }
}

const studentsOf = (l) => [...l.students, ...(state.extra[l.id] || [])];
const getRec = (key, id) => (state.days[key] && state.days[key][id]) || { status: null, present: {} };
function ensureRec(key, id) {
  state.days[key] = state.days[key] || {};
  state.days[key][id] = state.days[key][id] || { status: null, present: {} };
  return state.days[key][id];
}

/* ===================== Подсчёты ===================== */
function monthStats(y, m) {
  const s = { planned: 0, done: 0, cancel: 0, visits: 0, courses: {}, cancelled: [] };
  const days = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const key = dateKey(y, m, d);
    for (const l of lessonsOf(new Date(y, m, d)).filter(isActive)) {
      const rec = getRec(key, l.id);
      const c = (s.courses[l.course] = s.courses[l.course] || { planned: 0, done: 0, visits: 0, color: THEMES[l.theme] });
      s.planned++; c.planned++;
      if (rec.status === 'cancel') s.cancel++, s.cancelled.push({ d, start: l.start, course: l.course, reason: rec.reason || '' });
      if (rec.status === 'done') { s.done++; c.done++; }
      const v = rec.status === 'cancel' ? 0 : studentsOf(l).filter((n) => rec.present[n]).length;
      s.visits += v; c.visits += v;
    }
  }
  return s;
}

/* ===================== Отрисовка ===================== */
function render() {
  renderHero();
  renderCalendar();
  renderDay();
  renderCourses();
  renderCancelled();
}

function renderHero() {
  const st = monthStats(view.y, view.m);
  $('monthSelect').value = view.m;
  $('yearSelect').value = view.y;
  $('doneCount').textContent = st.done;
  $('planCount').textContent = st.planned;
  $('leftCount').textContent = st.planned - st.done - st.cancel;
  $('cancelCount').textContent = st.cancel;
  $('visitCount').textContent = st.visits;
  const pct = st.planned ? Math.round((st.done / st.planned) * 100) : 0;
  $('progressBar').style.width = pct + '%';
  $('progress').setAttribute('aria-valuenow', pct);
}

function renderCalendar() {
  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // неделя с понедельника
  const days = new Date(view.y, view.m + 1, 0).getDate();
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cell blank"></div>';

  for (let d = 1; d <= days; d++) {
    const lessons = lessonsOf(new Date(view.y, view.m, d)).filter(isActive);
    const key = dateKey(view.y, view.m, d);
    const isToday = d === today.getDate() && view.m === today.getMonth() && view.y === today.getFullYear();
    const cls = ['cell', lessons.length ? 'has' : 'empty', isToday && 'today', d === view.d && 'selected'].filter(Boolean).join(' ');
    const dots = lessons.map((l) => {
      const s = getRec(key, l.id).status;
      return `<span class="dot ${s === 'done' ? 'dot-done' : s === 'cancel' ? 'dot-cancel' : 'dot-plan'}"></span>`;
    }).join('');
    html += `<button type="button" class="${cls}" data-day="${d}"${d === view.d ? ' aria-current="date"' : ''}>${d}<span class="dots">${dots}</span></button>`;
  }
  $('calendarGrid').innerHTML = html;
}

function renderDay() {
  const date = new Date(view.y, view.m, view.d);
  const key = dateKey(view.y, view.m, view.d);
  const lessons = lessonsOf(date);
  const active = lessons.filter(isActive).length;

  $('dayTitle').textContent = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  $('dayCount').textContent = active ? `Уроков: ${active}` : '';

  if (!lessons.length) {
    $('lessons').innerHTML = '<div class="empty-state"><span class="big">🌤</span>В этот день занятий нет</div>';
    return;
  }

  $('lessons').innerHTML = lessons.map((l) => {
    const color = THEMES[l.theme];
    const time = `<div class="time">${l.start}<small>до ${l.end}</small></div>`;
    const title = `<div class="lesson-top"><span class="lesson-name">${esc(l.course)}</span>${l.level ? `<span class="tag">${esc(l.level)}</span>` : ''}</div>`;

    if (!isActive(l)) {
      return `<article class="lesson idle" style="--c:${color}">${time}<div>${title}<p class="note">${esc(l.note || 'Не активно')}</p></div></article>`;
    }

    const rec = getRec(key, l.id);
    const students = studentsOf(l);
    const chips = students.map((n) =>
      `<button type="button" class="student${rec.present[n] ? ' on' : ''}" data-act="present" data-id="${l.id}" data-name="${esc(n)}" aria-pressed="${!!rec.present[n]}"><span class="box">✓</span>${esc(n)}</button>`
    ).join('');
    const empty = students.length ? '' : '<span class="note">Учеников пока нет</span>';
    const isPending = pending && pending.key === key && pending.id === l.id;
    let extra = '';
    if (isPending) {
      extra = `<form class="cancel-form" data-id="${l.id}" novalidate>
        <label for="reason-${l.id}">Почему урок не проведён?</label>
        <div class="quick">${QUICK_REASONS.map((q) => `<button type="button" class="quick-btn" data-act="quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <input id="reason-${l.id}" type="text" maxlength="200" placeholder="Укажи причину отмены" value="${esc(rec.reason || '')}">
        <p class="form-error" hidden>Нужно указать причину, иначе урок не будет отменён</p>
        <div class="actions"><button type="submit" class="act no active">Сохранить отмену</button><button type="button" class="act" data-act="abort">Назад</button></div>
      </form>`;
    } else if (rec.status === 'cancel') {
      extra = `<p class="reason"><b>Причина отмены:</b> ${esc(rec.reason || '—')} <button type="button" class="link" data-act="edit-reason" data-id="${l.id}">Изменить</button></p>`;
    }

    return `<article class="lesson ${rec.status || ''}" style="--c:${color}">
      ${time}
      <div>
        ${title}
        <div class="students">${chips}${empty}
          <form class="add-form" data-id="${l.id}">
            <input type="text" placeholder="Новый ученик" maxlength="30" aria-label="Имя ученика">
            <button type="submit" aria-label="Добавить ученика">+</button>
          </form>
        </div>
        ${extra}
        ${isPending ? '' : `<div class="actions">
          <button type="button" class="act ok${rec.status === 'done' ? ' active' : ''}" data-act="done" data-id="${l.id}">Урок проведён</button>
          <button type="button" class="act no${rec.status === 'cancel' ? ' active' : ''}" data-act="cancel" data-id="${l.id}">Не проведён</button>
        </div>`}
      </div>
    </article>`;
  }).join('');
}

function renderCourses() {
  const st = monthStats(view.y, view.m);
  const rows = Object.entries(st.courses);
  if (!rows.length) { $('courseList').innerHTML = '<p class="note">В этом месяце уроков нет</p>'; return; }
  $('courseList').innerHTML = rows.map(([name, c]) => {
    const pct = c.planned ? Math.round((c.done / c.planned) * 100) : 0;
    return `<div class="course-row" style="--c:${c.color}">
      <div class="course-name"><span class="swatch"></span>${esc(name)}</div>
      <div class="course-bar"><i style="width:${pct}%"></i></div>
      <div class="course-nums"><b>${c.done}</b> из ${c.planned} уроков · ${c.visits} посещений</div>
    </div>`;
  }).join('');
}

function renderCancelled() {
  const list = monthStats(view.y, view.m).cancelled;
  $('cancelList').innerHTML = list.length
    ? '<h3>Не проведённые уроки</h3>' + list.map((c) =>
        `<div class="cancel-row"><b>${pad(c.d)}.${pad(view.m + 1)}</b><span>${c.start} · ${esc(c.course)}</span><em>${esc(c.reason)}</em></div>`).join('')
    : '';
}

/* ===================== События ===================== */
function setMonth(y, m) {
  view.y = y; view.m = m; pending = null;
  const max = new Date(y, m + 1, 0).getDate();
  const isCurrent = y === today.getFullYear() && m === today.getMonth();
  view.d = isCurrent ? today.getDate() : Math.min(view.d, max);
  render();
}

$('prevMonth').onclick = () => setMonth(view.m === 0 ? view.y - 1 : view.y, (view.m + 11) % 12);
$('nextMonth').onclick = () => setMonth(view.m === 11 ? view.y + 1 : view.y, (view.m + 1) % 12);
$('monthSelect').onchange = (e) => setMonth(view.y, +e.target.value);
$('yearSelect').onchange = (e) => setMonth(+e.target.value, view.m);
$('todayBtn').onclick = () => { view.d = today.getDate(); setMonth(today.getFullYear(), today.getMonth()); };

$('calendarGrid').addEventListener('click', (e) => {
  const cell = e.target.closest('[data-day]');
  if (!cell) return;
  view.d = +cell.dataset.day; pending = null;
  renderCalendar();
  renderDay();
  if (window.innerWidth < 960) $('dayTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('lessons').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const key = dateKey(view.y, view.m, view.d);
  const id = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === 'quick') {
    const input = btn.closest('form').querySelector('input');
    input.value = btn.dataset.text;
    input.focus();
    return;
  }
  if (act === 'abort') { pending = null; renderDay(); return; }

  if (act === 'cancel' || act === 'edit-reason') {
    const cur = getRec(key, id);
    if (act === 'cancel' && cur.status === 'cancel') {          // снять отмену
      const r = ensureRec(key, id);
      r.status = null; delete r.reason; pending = null;
      save(); render(); return;
    }
    pending = { key, id };                                       // открыть ввод причины
    renderDay();
    const inp = document.getElementById('reason-' + id);
    if (inp) inp.focus();
    return;
  }

  const rec = ensureRec(key, id);
  if (act === 'done') {
    rec.status = rec.status === 'done' ? null : 'done';
    delete rec.reason; pending = null;
  } else if (act === 'present') {
    const name = btn.dataset.name;
    rec.present[name] = !rec.present[name];
    if (!rec.present[name]) delete rec.present[name];
    if (rec.present[name] && !rec.status) rec.status = 'done'; // отметил ученика — урок состоялся
  }
  save();
  render();
});

$('lessons').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = dateKey(view.y, view.m, view.d);

  const cf = e.target.closest('.cancel-form');
  if (cf) {
    const input = cf.querySelector('input');
    const reason = input.value.trim();
    if (!reason) {
      cf.querySelector('.form-error').hidden = false;
      input.classList.add('invalid');
      input.focus();
      return;
    }
    const rec = ensureRec(key, cf.dataset.id);
    rec.status = 'cancel'; rec.reason = reason; pending = null;
    save(); render();
    return;
  }

  const form = e.target.closest('.add-form');
  if (!form) return;
  const name = form.querySelector('input').value.trim();
  if (!name) return;
  const id = form.dataset.id;
  const list = (state.extra[id] = state.extra[id] || []);
  if (!list.includes(name)) list.push(name);
  save();
  renderDay();
});

/* ===================== Старт ===================== */
(function init() {
  $('weekdays').innerHTML = WEEKDAYS.map((d) => `<span>${d}</span>`).join('');
  $('monthSelect').innerHTML = MONTHS.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  const y = today.getFullYear();
  $('yearSelect').innerHTML = [y - 1, y, y + 1, y + 2].map((v) => `<option value="${v}">${v}</option>`).join('');
  render();
})();