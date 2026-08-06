'use strict';

/* ============================================================
   Cal Track
   ------------------------------------------------------------
   All data lives in localStorage — a small storage box the
   browser keeps on THIS device. Nothing is ever uploaded.

   SAFETY NOTE: every piece of text a person types (food names,
   brands) is put on screen with .textContent, never .innerHTML.
   That means a food called "<script>..." is shown as plain
   letters instead of being run as code. That is XSS protection.
   ============================================================ */

/* ---------- 1. Starter foods (phase 13) ---------- */

const STARTER_FOODS = [
  // name,                       brand,             kcal,  protein, carbs, fat   (all per 100 g)
  ['Kefir 2.5%',                 'Rokiškio',          52,  3.3,  4.0,  2.5],
  ['Rye bread',                  'Vilniaus duona',   230,  6.5, 44.0,  1.2],
  ['Curd cheese 5%',             'Žemaitijos',       121, 16.0,  3.5,  5.0],
  ['Greek yoghurt 0%',           'Pilos',             57,  9.0,  4.0,  0.2],
  ['Cottage cheese 9%',          'Dvaro',            155, 14.0,  2.8,  9.0],
  ['Milk 2.5%',                  '',                  51,  3.3,  4.7,  2.5],
  ['Chicken breast, raw',        '',                 120, 23.0,  0.0,  2.6],
  ['Pork loin, lean',            '',                 143, 21.0,  0.0,  6.0],
  ['Egg',                        '',                 143, 12.6,  0.7,  9.5],
  ['White rice, cooked',         '',                 130,  2.7, 28.0,  0.3],
  ['Buckwheat, cooked',          '',                 110,  3.8, 21.3,  1.1],
  ['Oats, dry',                  '',                 375, 13.0, 60.0,  7.0],
  ['Potato, boiled',             '',                  87,  2.0, 20.0,  0.1],
  ['Pasta, cooked',              '',                 158,  5.8, 31.0,  0.9],
  ['Gouda-type cheese',          '',                 356, 25.0,  2.2, 27.0],
  ['Butter 82%',                 '',                 736,  0.9,  0.6, 82.0],
  ['Olive oil',                  '',                 884,  0.0,  0.0, 100.0],
  ['Banana',                     '',                  89,  1.1, 23.0,  0.3],
  ['Apple',                      '',                  52,  0.3, 14.0,  0.2],
  ['Cucumber',                   '',                  15,  0.7,  3.6,  0.1],
  ['Tomato',                     '',                  18,  0.9,  3.9,  0.2],
  ['Sugar',                      '',                 387,  0.0, 100.0, 0.0]
];

/* ---------- 2. Storage ---------- */

const KEY = {
  foods:    'ct_foods',
  entries:  'ct_entries',
  weights:  'ct_weights',
  settings: 'ct_settings'
};

function loadStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function saveStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    toast('Could not save — device storage is full');
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let foods    = loadStore(KEY.foods, null);
let entries  = loadStore(KEY.entries, []);
let weights  = loadStore(KEY.weights, {});
let settings = Object.assign(
  { kcalGoal: 2200, pGoal: 150, cGoal: 220, fGoal: 70, unit: 'kg' },
  loadStore(KEY.settings, {})
);

// First ever run: fill the food list with the starter set.
if (foods === null) {
  foods = STARTER_FOODS.map(function (row) {
    return {
      id: uid(), barcode: '',
      name: row[0], brand: row[1],
      kcal100: row[2], p100: row[3], c100: row[4], f100: row[5],
      lastGrams: 100
    };
  });
  saveStore(KEY.foods, foods);
}

/* ---------- 3. Small helpers ---------- */

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const $ = function (id) { return document.getElementById(id); };

// Build a "2026-08-06" key from LOCAL time.
// (Using toISOString() here would be a bug: it converts to UTC and
// can hand you yesterday's date late in the evening.)
function dateKey(d) {
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function addDays(d, n) {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + n);
  return copy;
}

function round1(n) { return Math.round(n * 10) / 10; }

function num(value, fallback) {
  const n = parseFloat(String(value).replace(',', '.'));
  return isFinite(n) ? n : fallback;
}

function guessMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'Breakfast';
  if (h < 16) return 'Lunch';
  if (h < 21) return 'Dinner';
  return 'Snacks';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;   // safe: never innerHTML
  return node;
}

let toastTimer = null;
function toast(message) {
  const box = $('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { box.hidden = true; }, 2400);
}

/* ---------- 4. Which day are we looking at? (phase 8) ---------- */

let viewDate = new Date();

function viewKey() { return dateKey(viewDate); }

function dateLabelText() {
  const today = dateKey(new Date());
  const key = viewKey();
  if (key === today) return 'Today';
  if (key === dateKey(addDays(new Date(), -1))) return 'Yesterday';
  if (key === dateKey(addDays(new Date(), 1))) return 'Tomorrow';
  return viewDate.getDate() + ' ' + MONTHS[viewDate.getMonth()];
}

/* ---------- 5. Today screen (phases 3-7) ---------- */

const RING_C = 2 * Math.PI * 52;   // circumference of the ring circle

function entriesFor(key) {
  return entries.filter(function (e) { return e.date === key; });
}

function totalsFor(key) {
  return entriesFor(key).reduce(function (sum, e) {
    sum.kcal += e.kcal; sum.p += e.p; sum.c += e.c; sum.f += e.f;
    return sum;
  }, { kcal: 0, p: 0, c: 0, f: 0 });
}

function renderToday() {
  $('date-label').textContent = dateLabelText();

  const t = totalsFor(viewKey());
  const goal = settings.kcalGoal || 0;
  const left = goal - t.kcal;
  const over = left < 0;

  $('kcal-left').textContent = Math.abs(Math.round(left));
  $('kcal-left').classList.toggle('is-over', over);
  $('kcal-left-label').textContent = over ? 'kcal over' : 'kcal left';

  const pct = goal > 0 ? Math.min(t.kcal / goal, 1) : 0;
  const ring = $('ring-fill');
  ring.style.strokeDasharray = (pct * RING_C) + ' ' + RING_C;
  ring.classList.toggle('is-over', over);

  $('kcal-eaten').textContent = Math.round(t.kcal);
  $('kcal-goal').textContent = goal;

  const macros = [
    ['p', t.p, settings.pGoal],
    ['c', t.c, settings.cGoal],
    ['f', t.f, settings.fGoal]
  ];
  macros.forEach(function (m) {
    $(m[0] + '-eaten').textContent = Math.round(m[1]);
    $(m[0] + '-goal').textContent = m[2];
    const width = m[2] > 0 ? Math.min(m[1] / m[2], 1) * 100 : 0;
    $(m[0] + '-bar').style.width = width + '%';
  });

  renderMeals();
}

function renderMeals() {
  const host = $('meals');
  host.textContent = '';                       // clear
  const dayEntries = entriesFor(viewKey());

  MEALS.forEach(function (meal) {
    const mine = dayEntries.filter(function (e) { return e.meal === meal; });
    const kcal = mine.reduce(function (s, e) { return s + e.kcal; }, 0);

    const section = el('section');

    const head = el('div', 'mealhead');
    head.appendChild(el('span', 'mealname', meal));
    head.appendChild(el('span', 'mealkcal', Math.round(kcal) || ''));
    const add = el('button', 'mealadd', '+');
    add.type = 'button';
    add.setAttribute('aria-label', 'Add food to ' + meal);
    add.addEventListener('click', function () {
      pendingMeal = meal;
      goto('foods');
      $('food-search').focus();
    });
    head.appendChild(add);
    section.appendChild(head);

    const body = el('div', 'card mealbody');

    if (mine.length === 0) {
      body.appendChild(el('p', 'emptymeal', 'Nothing yet — tap + to add something.'));
    } else {
      mine.forEach(function (entry) {
        const row = el('div', 'food');

        const left = el('div', 'food-l');
        left.appendChild(el('div', 'food-name', entry.name));   // safe
        left.appendChild(el('div', 'food-sub',
          entry.grams + ' g · ' + round1(entry.p) + ' P · ' + round1(entry.c) + ' C · ' + round1(entry.f) + ' F'));
        row.appendChild(left);

        row.appendChild(el('div', 'food-kcal', Math.round(entry.kcal)));

        const del = el('button', 'food-del', '×');
        del.type = 'button';
        del.setAttribute('aria-label', 'Remove ' + entry.name);
        del.addEventListener('click', function () { deleteEntry(entry.id); });
        row.appendChild(del);

        body.appendChild(row);
      });
    }

    section.appendChild(body);
    host.appendChild(section);
  });
}

function addEntry(food, grams, meal) {
  const factor = grams / 100;
  entries.push({
    id: uid(),
    date: viewKey(),
    foodId: food.id || '',
    name: food.brand ? food.name + ' (' + food.brand + ')' : food.name,
    grams: grams,
    meal: meal,
    kcal: Math.round(food.kcal100 * factor),
    p: round1(food.p100 * factor),
    c: round1(food.c100 * factor),
    f: round1(food.f100 * factor)
  });
  saveStore(KEY.entries, entries);

  // remember the portion so next time it is one tap
  const stored = foods.find(function (f) { return f.id === food.id; });
  if (stored) { stored.lastGrams = grams; saveStore(KEY.foods, foods); }

  renderToday();
}

function deleteEntry(id) {
  entries = entries.filter(function (e) { return e.id !== id; });
  saveStore(KEY.entries, entries);
  renderToday();
  toast('Removed');
}

/* ---------- 6. Foods screen (phase 10) ---------- */

let pendingMeal = null;   // set when you tap + on a meal header

function renderFoods() {
  const query = $('food-search').value.trim().toLowerCase();
  const host = $('food-list');
  host.textContent = '';

  const list = foods
    .filter(function (f) {
      if (!query) return true;
      return (f.name + ' ' + f.brand).toLowerCase().indexOf(query) !== -1;
    })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });

  list.forEach(function (food) {
    const item = el('button', 'fooditem');
    item.type = 'button';

    const left = el('div', 'fooditem-l');
    left.appendChild(el('div', 'fooditem-name', food.name));       // safe
    const sub = (food.brand ? food.brand + ' · ' : '')
      + Math.round(food.kcal100) + ' kcal / 100 g';
    left.appendChild(el('div', 'fooditem-sub', sub));
    item.appendChild(left);

    const edit = el('span', 'fooditem-edit', 'Edit');
    edit.addEventListener('click', function (event) {
      event.stopPropagation();          // don't also open the portion sheet
      openForm({ food: food });
    });
    item.appendChild(edit);

    item.addEventListener('click', function () { openPortion(food, 'Saved food'); });
    host.appendChild(item);
  });

  if (list.length === 0) {
    host.appendChild(el('p', 'hint-text',
      query ? 'No food matches “' + $('food-search').value.trim() + '”. Tap + New to add it.'
            : 'No foods yet. Tap + New, or scan a barcode.'));
  }

  $('food-count').textContent = foods.length + ' food' + (foods.length === 1 ? '' : 's') + ' saved on this device';
}

/* ---------- 7. Portion sheet ---------- */

let portionFood = null;
let portionGrams = 100;
let portionMeal = guessMeal();

function openPortion(food, sourceLabel) {
  portionFood = food;
  portionGrams = food.lastGrams || 100;
  portionMeal = pendingMeal || guessMeal();
  pendingMeal = null;

  $('portion-source').textContent = sourceLabel;
  $('portion-name').textContent = food.brand ? food.name + ' · ' + food.brand : food.name;  // safe
  $('portion-per100').textContent =
    'Per 100 g · ' + Math.round(food.kcal100) + ' kcal · '
    + round1(food.p100) + ' P · ' + round1(food.c100) + ' C · ' + round1(food.f100) + ' F';

  $('grams-input').value = portionGrams;
  syncPortion();
  $('portion-overlay').hidden = false;
}

function syncPortion() {
  $('grams-input').value = portionGrams;

  Array.prototype.forEach.call($('grams-chips').children, function (chip) {
    chip.classList.toggle('is-on', Number(chip.dataset.grams) === portionGrams);
  });
  Array.prototype.forEach.call($('meal-chips').children, function (chip) {
    chip.classList.toggle('is-on', chip.dataset.meal === portionMeal);
  });

  const kcal = portionFood ? Math.round(portionFood.kcal100 * portionGrams / 100) : 0;
  $('portion-kcal').textContent = kcal + ' kcal';
}

function closePortion() {
  $('portion-overlay').hidden = true;
  portionFood = null;
}

/* ---------- 8. New / edit food form ---------- */

let formState = { food: null, barcode: '', thenPortion: false };

function openForm(options) {
  options = options || {};
  formState = {
    food: options.food || null,
    barcode: options.barcode || (options.food ? options.food.barcode : ''),
    thenPortion: !!options.thenPortion
  };

  const editing = !!options.food;
  $('form-title').textContent = editing ? 'Edit food' : 'New food';
  $('form-save').firstChild.nodeValue = editing ? 'Save changes' : 'Save food';
  $('form-delete').hidden = !editing;

  const notFound = !!options.notFound;
  $('form-notice').hidden = !notFound;
  $('form-barcode').textContent = formState.barcode;

  const f = options.food || {};
  $('form-name').value  = f.name || '';
  $('form-brand').value = f.brand || '';
  $('form-kcal').value  = f.kcal100 === undefined ? '' : f.kcal100;
  $('form-p').value     = f.p100 === undefined ? '' : f.p100;
  $('form-c').value     = f.c100 === undefined ? '' : f.c100;
  $('form-f').value     = f.f100 === undefined ? '' : f.f100;

  $('form-error').hidden = true;
  $('form-overlay').hidden = false;
  if (!editing) $('form-name').focus();
}

function closeForm() { $('form-overlay').hidden = true; }

function saveForm() {
  const name = $('form-name').value.trim();
  const kcal = num($('form-kcal').value, NaN);

  if (name.length === 0) { return showFormError('Give the food a name.'); }
  if (!isFinite(kcal) || kcal < 0) { return showFormError('Calories per 100 g is missing.'); }

  const record = formState.food || { id: uid(), lastGrams: 100 };
  record.name    = name;
  record.brand   = $('form-brand').value.trim();
  record.barcode = formState.barcode || '';
  record.kcal100 = kcal;
  record.p100    = Math.max(0, num($('form-p').value, 0));
  record.c100    = Math.max(0, num($('form-c').value, 0));
  record.f100    = Math.max(0, num($('form-f').value, 0));

  if (!formState.food) foods.push(record);
  saveStore(KEY.foods, foods);

  closeForm();
  renderFoods();

  if (formState.thenPortion) {
    openPortion(record, record.barcode ? 'Saved from barcode' : 'New food');
  } else {
    toast('Saved to My foods');
  }
}

function showFormError(message) {
  const box = $('form-error');
  box.textContent = message;
  box.hidden = false;
}

function deleteFood() {
  if (!formState.food) return;
  if (!confirm('Delete “' + formState.food.name + '” from My foods?\n\nMeals you already logged stay where they are.')) return;
  foods = foods.filter(function (f) { return f.id !== formState.food.id; });
  saveStore(KEY.foods, foods);
  closeForm();
  renderFoods();
  toast('Food deleted');
}

/* ---------- 9. Barcode scanner (phase 11) ---------- */

let scanStream = null;
let scanTimer = null;
let detector = null;

async function startScan() {
  $('scan-overlay').hidden = false;
  const hint = $('scan-hint');

  if (!('BarcodeDetector' in window)) {
    hint.textContent = 'This browser cannot scan barcodes. Use “Type the barcode instead”, or open the app in Chrome on Android.';
    return;
  }

  try {
    detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
    });
  } catch (err) {
    detector = new BarcodeDetector();
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
  } catch (err) {
    hint.textContent = 'No camera access. Allow the camera in your browser settings, or type the barcode instead.';
    return;
  }

  const video = $('scan-video');
  video.srcObject = scanStream;
  await video.play().catch(function () { /* autoplay can be fussy; ignore */ });

  hint.textContent = 'Point the camera at the barcode';

  scanTimer = setInterval(async function () {
    if (!detector || video.readyState < 2) return;
    try {
      const found = await detector.detect(video);
      if (found.length > 0 && found[0].rawValue) {
        const code = found[0].rawValue;
        stopScan();
        handleBarcode(code);
      }
    } catch (err) { /* a bad frame is normal — try the next one */ }
  }, 350);
}

function stopScan() {
  clearInterval(scanTimer);
  scanTimer = null;
  if (scanStream) {
    scanStream.getTracks().forEach(function (track) { track.stop(); });
    scanStream = null;
  }
  $('scan-video').srcObject = null;
  $('scan-overlay').hidden = true;
}

async function handleBarcode(code) {
  // 1. Do we already know it? Instant, works offline.
  const known = foods.find(function (f) { return f.barcode === code; });
  if (known) { openPortion(known, 'Your food'); return; }

  // 2. Ask Open Food Facts.
  toast('Looking it up…');
  const fromWeb = await lookupOpenFoodFacts(code);
  if (fromWeb) {
    fromWeb.id = uid();
    fromWeb.lastGrams = 100;
    foods.push(fromWeb);
    saveStore(KEY.foods, foods);
    renderFoods();
    openPortion(fromWeb, 'Open Food Facts');
    return;
  }

  // 3. Nobody knows it — you teach it once.
  openForm({ barcode: code, notFound: true, thenPortion: true });
}

async function lookupOpenFoodFacts(code) {
  const url = 'https://world.openfoodfacts.org/api/v2/product/'
    + encodeURIComponent(code)
    + '.json?fields=product_name,brands,nutriments';

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};

    // Some products only list kilojoules — convert to calories.
    let kcal = num(n['energy-kcal_100g'], NaN);
    if (!isFinite(kcal)) {
      const kj = num(n['energy_100g'], NaN);
      if (isFinite(kj)) kcal = kj / 4.184;
    }

    const name = (p.product_name || '').trim();
    if (!name || !isFinite(kcal)) return null;

    return {
      barcode: code,
      name: name,
      brand: (p.brands || '').split(',')[0].trim(),
      kcal100: Math.round(kcal),
      p100: round1(Math.max(0, num(n['proteins_100g'], 0))),
      c100: round1(Math.max(0, num(n['carbohydrates_100g'], 0))),
      f100: round1(Math.max(0, num(n['fat_100g'], 0)))
    };
  } catch (err) {
    return null;    // offline, or the database is down — fall through to typing it in
  }
}

/* ---------- 10. Stats (phase 14) ---------- */

function renderStats() {
  renderWeekChart();
  renderWeight();
}

function renderWeekChart() {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    days.push({ date: d, key: dateKey(d), kcal: totalsFor(dateKey(d)).kcal });
  }

  const goal = settings.kcalGoal || 0;
  const peak = Math.max.apply(null, days.map(function (d) { return d.kcal; }).concat([goal, 1]));
  const top = peak * 1.08;

  const chart = $('week-chart');
  chart.textContent = '';

  if (goal > 0) {
    const mark = el('div', 'goalmark');
    mark.style.bottom = (goal / top * 100) + '%';
    mark.appendChild(el('span', 'goaltag', 'GOAL'));
    chart.appendChild(mark);
  }

  const todayKey = dateKey(today);
  days.forEach(function (d) {
    const bar = el('div', 'bar');
    if (d.key === todayKey) bar.classList.add('is-today');
    else if (goal > 0 && d.kcal > goal) bar.classList.add('is-over');
    const inner = el('i');
    inner.style.height = (d.kcal / top * 100) + '%';
    bar.appendChild(inner);
    bar.title = Math.round(d.kcal) + ' kcal';
    chart.appendChild(bar);
  });

  const labels = $('week-days');
  labels.textContent = '';
  days.forEach(function (d) {
    const span = el('span', d.key === todayKey ? 'is-today' : '', DAY_LETTERS[d.date.getDay()]);
    labels.appendChild(span);
  });

  const logged = days.filter(function (d) { return d.kcal > 0; });
  $('week-avg').textContent = logged.length
    ? 'avg ' + Math.round(logged.reduce(function (s, d) { return s + d.kcal; }, 0) / logged.length)
    : 'nothing logged yet';
}

function renderWeight() {
  const keys = Object.keys(weights).sort();
  const unit = settings.unit || 'kg';
  document.querySelector('.wunit').textContent = unit;

  $('weight-for').textContent = 'Saves against today, ' + dateLabelForToday();

  if (keys.length === 0) {
    $('weight-latest').textContent = '--';
    $('weight-delta').textContent = 'no entries yet';
    $('weight-chart').textContent = '';
    return;
  }

  const recent = keys.slice(-14);
  const values = recent.map(function (k) { return weights[k]; });
  const latest = values[values.length - 1];

  $('weight-latest').textContent = round1(latest);

  if (values.length > 1) {
    const change = round1(latest - values[0]);
    const days = Math.round(
      (new Date(recent[recent.length - 1]) - new Date(recent[0])) / 86400000
    );
    $('weight-delta').textContent =
      (change > 0 ? '+' : '') + change + ' ' + unit + ' · ' + days + ' d';
  } else {
    $('weight-delta').textContent = 'first entry';
  }

  drawWeightChart(values);
}

function drawWeightChart(values) {
  const svg = $('weight-chart');
  svg.textContent = '';
  if (values.length < 2) return;

  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const span = (max - min) || 1;

  const points = values.map(function (v, i) {
    const x = 6 + (i / (values.length - 1)) * 228;
    const y = 52 - ((v - min) / span) * 44;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });

  const line = points.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
  const area = line + ' ' + points[points.length - 1][0] + ',60 ' + points[0][0] + ',60';

  const ns = 'http://www.w3.org/2000/svg';

  const areaEl = document.createElementNS(ns, 'polyline');
  areaEl.setAttribute('points', area);
  areaEl.setAttribute('class', 'warea');
  svg.appendChild(areaEl);

  const lineEl = document.createElementNS(ns, 'polyline');
  lineEl.setAttribute('points', line);
  lineEl.setAttribute('class', 'wline');
  svg.appendChild(lineEl);

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', points[points.length - 1][0]);
  dot.setAttribute('cy', points[points.length - 1][1]);
  dot.setAttribute('r', '4');
  dot.setAttribute('class', 'wdot');
  svg.appendChild(dot);
}

function dateLabelForToday() {
  const d = new Date();
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}

/* ---------- 11. Settings ---------- */

function fillSettings() {
  $('goal-kcal').value = settings.kcalGoal;
  $('goal-p').value = settings.pGoal;
  $('goal-c').value = settings.cGoal;
  $('goal-f').value = settings.fGoal;
  $('goal-unit').value = settings.unit;
}

function saveSettings() {
  settings.kcalGoal = Math.max(0, num($('goal-kcal').value, settings.kcalGoal));
  settings.pGoal    = Math.max(0, num($('goal-p').value, settings.pGoal));
  settings.cGoal    = Math.max(0, num($('goal-c').value, settings.cGoal));
  settings.fGoal    = Math.max(0, num($('goal-f').value, settings.fGoal));
  settings.unit     = $('goal-unit').value === 'lb' ? 'lb' : 'kg';
  saveStore(KEY.settings, settings);
  renderToday();
  renderStats();
  toast('Goals saved');
}

function exportBackup() {
  const payload = {
    app: 'cal-track', version: 1, exported: new Date().toISOString(),
    foods: foods, entries: entries, weights: weights, settings: settings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cal-track-backup-' + dateKey(new Date()) + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  toast('Backup downloaded');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.foods) || !Array.isArray(data.entries)) {
        toast('That file is not a Cal Track backup');
        return;
      }
      if (!confirm('Replace everything currently in the app with this backup?')) return;

      foods = data.foods;
      entries = data.entries;
      weights = data.weights || {};
      settings = Object.assign(settings, data.settings || {});

      saveStore(KEY.foods, foods);
      saveStore(KEY.entries, entries);
      saveStore(KEY.weights, weights);
      saveStore(KEY.settings, settings);

      fillSettings();
      renderToday();
      renderFoods();
      renderStats();
      toast('Backup restored');
    } catch (err) {
      toast('Could not read that file');
    }
  };
  reader.readAsText(file);
}

function eraseEverything() {
  if (!confirm('Erase every food, meal and weigh-in on this device?\n\nThis cannot be undone.')) return;
  if (!confirm('Really erase everything?')) return;
  Object.keys(KEY).forEach(function (k) { localStorage.removeItem(KEY[k]); });
  location.reload();
}

/* ---------- 12. Screen switching ---------- */

function goto(name) {
  Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
    screen.classList.toggle('is-active', screen.id === 'screen-' + name);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.classList.toggle('is-on', tab.dataset.goto === name);
  });
  if (name === 'foods') renderFoods();
  if (name === 'stats') renderStats();
  const scroller = document.querySelector('#screen-' + name + ' .scroll');
  if (scroller) scroller.scrollTop = 0;
}

/* ---------- 13. Wiring it all up ---------- */

// tabs and any button with data-goto
Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (button) {
  button.addEventListener('click', function () { goto(button.dataset.goto); });
});

// day switching
$('prev-day').addEventListener('click', function () { viewDate = addDays(viewDate, -1); renderToday(); });
$('next-day').addEventListener('click', function () { viewDate = addDays(viewDate, 1); renderToday(); });
$('date-label').addEventListener('click', function () { viewDate = new Date(); renderToday(); });

// foods
$('food-search').addEventListener('input', renderFoods);
$('new-food').addEventListener('click', function () { openForm({}); });

// portion sheet
$('portion-close').addEventListener('click', closePortion);
$('portion-overlay').addEventListener('click', function (event) {
  if (event.target === $('portion-overlay')) closePortion();
});
$('grams-minus').addEventListener('click', function () {
  portionGrams = Math.max(1, portionGrams - 10); syncPortion();
});
$('grams-plus').addEventListener('click', function () {
  portionGrams = Math.min(5000, portionGrams + 10); syncPortion();
});
$('grams-input').addEventListener('input', function () {
  portionGrams = Math.min(5000, Math.max(1, Math.round(num($('grams-input').value, 100))));
  const kcal = portionFood ? Math.round(portionFood.kcal100 * portionGrams / 100) : 0;
  $('portion-kcal').textContent = kcal + ' kcal';
});
Array.prototype.forEach.call($('grams-chips').children, function (chip) {
  chip.addEventListener('click', function () {
    portionGrams = Number(chip.dataset.grams); syncPortion();
  });
});
Array.prototype.forEach.call($('meal-chips').children, function (chip) {
  chip.addEventListener('click', function () {
    portionMeal = chip.dataset.meal; syncPortion();
  });
});
$('portion-add').addEventListener('click', function () {
  if (!portionFood) return;
  addEntry(portionFood, portionGrams, portionMeal);
  closePortion();
  goto('today');
  toast('Added to ' + portionMeal);
});

// food form
$('form-close').addEventListener('click', closeForm);
$('form-overlay').addEventListener('click', function (event) {
  if (event.target === $('form-overlay')) closeForm();
});
$('form-save').addEventListener('click', saveForm);
$('form-delete').addEventListener('click', deleteFood);

// scanner
$('scan-btn').addEventListener('click', startScan);
$('scan-close').addEventListener('click', stopScan);
$('manual-btn').addEventListener('click', function () {
  const code = prompt('Type the barcode digits from the packet:');
  if (code && code.trim()) {
    stopScan();
    handleBarcode(code.trim());
  }
});

// weight
$('weight-save').addEventListener('click', function () {
  const value = num($('weight-input').value, NaN);
  if (!isFinite(value) || value <= 0) { toast('Type your weight first'); return; }
  weights[dateKey(new Date())] = round1(value);
  saveStore(KEY.weights, weights);
  $('weight-input').value = '';
  renderWeight();
  toast('Weight logged');
});

// settings
$('goals-save').addEventListener('click', saveSettings);
$('export-btn').addEventListener('click', exportBackup);
$('import-btn').addEventListener('click', function () { $('import-file').click(); });
$('import-file').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file) importBackup(file);
  event.target.value = '';
});
$('reset-btn').addEventListener('click', eraseEverything);

// close sheets with Escape
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  if (!$('portion-overlay').hidden) closePortion();
  else if (!$('form-overlay').hidden) closeForm();
  else if (!$('scan-overlay').hidden) stopScan();
});

/* ---------- 14. Start ---------- */

fillSettings();
renderToday();
renderFoods();
renderStats();

// Register the service worker so the app works offline once installed.
// Guarded: opening index.html straight off the disk (file://) has no
// service workers, and trying would throw an error in the console.
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js').catch(function () {
      /* offline support just won't switch on — the app still works */
    });
  });
}
