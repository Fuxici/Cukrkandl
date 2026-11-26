// Kavárna Cukrkandl – interakce a animace (bez knihoven)
document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---------- Plynulý (setrvačný) scroll jako Lenis ve Frameru ---------- */
// Jen pro myš/touchpad na desktopu; dotyk a klávesnice zůstávají nativní.
const smooth = !reduceMotion && window.matchMedia('(pointer: fine)').matches;
let target = window.scrollY;
let current = window.scrollY;
let rafId = 0;
let last = 0;

const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

function smoothLoop(now) {
  const dt = last ? Math.min(64, now - last) : 16.7;
  last = now;
  current += (target - current) * (1 - Math.pow(0.9, dt / 16.7)); // lerp 0.1 při 60 fps
  if (Math.abs(target - current) < 0.5) current = target;
  window.scrollTo(0, current);
  if (current !== target) rafId = requestAnimationFrame(smoothLoop);
  else { rafId = 0; last = 0; }
}
function scrollToY(y) {
  if (!smooth) { window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
  if (!rafId) current = window.scrollY;
  target = Math.max(0, Math.min(maxScroll(), y));
  if (!rafId) rafId = requestAnimationFrame(smoothLoop);
}

if (smooth) {
  document.documentElement.classList.add('smooth-scroll');
  window.addEventListener('wheel', (e) => {
    // zoom, vodorovný posun a prvky s vlastním scrollem nechat prohlížeči
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest('textarea, iframe, .mobile-menu')) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
    scrollToY((rafId ? target : window.scrollY) + e.deltaY * unit);
  }, { passive: false });
  // posun klávesnicí / posuvníkem: srovnat cíl, ať animace nebojuje s uživatelem
  window.addEventListener('scroll', () => { if (!rafId) target = current = window.scrollY; }, { passive: true });
}

/* ---------- Kotvy (#sekce) – plynulý posun ---------- */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  if (link.dataset.bookingType) setBookingType(link.dataset.bookingType);
  scrollToY(id === 'uvod' ? 0 : el.getBoundingClientRect().top + window.scrollY);
  history.replaceState(null, '', '#' + id);
});

/* ---------- Mobilní menu ---------- */
const burger = document.querySelector('.burger');
const menu = document.getElementById('mobile-menu');

function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
  menu.hidden = !open;
}
burger.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', (e) => {
  if (e.target.closest('a, [data-close-menu]')) setMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); }
});
window.matchMedia('(min-width: 810px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

/* ---------- Animace řízené scrollem (hodnoty změřené z Frameru) ---------- */
const line1 = document.querySelector('.hero__line--1');
const line2 = document.querySelector('.hero__line--2');
const heroCake = document.querySelector('.hero__cake');
const heroLeft = document.querySelector('[data-deco="hero-left"]');
const heroRight = document.querySelector('[data-deco="hero-right"]');
const about = document.getElementById('o-nas');
const aboutDecos = [
  { el: document.querySelector('[data-deco="about-left"]'), tx: -250, ty: 250, rot: -40 },
  { el: document.querySelector('[data-deco="about-right"]'), tx: 350, ty: 350, rot: 37 },
];
// Framer hodnoty navázané na scroll ještě vyhlazuje: po skoku scrollu hodnota dojíždí
// exponenciálně s τ ≈ 160 ms (změřeno), takže dekorace doplují a necvaknou na místo.
const FOLLOW_MS = 160;
const cur = targets();
let followRaf = 0;
let followLast = 0;

// cílové hodnoty 0–1 pro aktuální scroll
function targets() {
  const y = window.scrollY;
  const vh = window.innerHeight;
  if (reduceMotion) return { shift: 0, hero: 1, about: 1 };
  const top = about.getBoundingClientRect().top;
  return {
    shift: clamp01((y - 80) / 500),                  // nadpis: rozjezd řádků mezi scrollem 80–580 px
    hero: clamp01(y / 130),                          // dekorace v hero: prvních 130 px scrollu
    about: clamp01((0.421 * vh - top) / (0.21 * vh)), // „O nás“: horní hrana sekce z 42 % na 21 % okna
  };
}

function render() {
  const shift = 350 * cur.shift;
  line1.style.transform = `translateX(${-shift}px)`;
  line2.style.transform = `translateX(${shift}px)`;
  // `rotate`, ne `transform` – ten drží úvodní animace cake-in a přebila by ho
  heroCake.style.rotate = `${40 * cur.shift}deg`;

  const k = 1 - cur.hero;
  const s = 1.5 - 0.5 * cur.hero;
  heroLeft.style.transform = `translate(${-250 * k}px, ${250 * k}px) scale(${s})`;
  heroRight.style.transform = `translate(${250 * k}px, ${250 * k}px) scale(${s})`;

  const a = cur.about;
  for (const d of aboutDecos) {
    d.el.style.transform = `translate(${d.tx * (1 - a)}px, ${d.ty * (1 - a)}px) rotate(${d.rot}deg) scale(${1.5 - 0.5 * a})`;
  }}

function follow(now) {
  const dt = followLast ? Math.min(64, now - followLast) : 16.7;
  followLast = now;
  const t = targets();
  const f = 1 - Math.exp(-dt / FOLLOW_MS);
  let moving = false;
  for (const key in cur) {
    cur[key] += (t[key] - cur[key]) * f;
    if (Math.abs(t[key] - cur[key]) < 0.0005) cur[key] = t[key];
    else moving = true;
  }
  render();
  if (moving) followRaf = requestAnimationFrame(follow);
  else { followRaf = 0; followLast = 0; }
}
function onScroll() {
  if (!followRaf) followRaf = requestAnimationFrame(follow);
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
render();

/* ---------- Objevení nadpisů, textů a karet při scrollu ---------- */
const appear = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    appear.unobserve(e.target);
  }
});
document.querySelectorAll('[data-appear]').forEach((el) => {
  if (reduceMotion) el.classList.add('is-in');
  else appear.observe(el);
});

/* ---------- Lightbox: fotka u recenze ---------- */
// <dialog> sám řeší fokus, Esc a překrytí; miniatura je <a>, takže bez JS funguje jako odkaz.
const photobox = document.getElementById('photobox');
const pbImg = photobox.querySelector('.photobox__img');
const pbCap = photobox.querySelector('.photobox__cap');
const pbNav = photobox.querySelectorAll('[data-photobox-step]');
let pbSet = [];
let pbIndex = 0;

// zobrazí fotku pbIndex z fotek téže recenze (šipky dokola)
function showPhoto(i) {
  pbIndex = (i + pbSet.length) % pbSet.length;
  const link = pbSet[pbIndex];
  pbImg.src = link.getAttribute('href');
  pbImg.alt = link.querySelector('img')?.alt || '';
  pbCap.textContent = 'Fotka od zákazníka · ' + (link.dataset.author || '') + (pbSet.length > 1 ? ` · ${pbIndex + 1} / ${pbSet.length}` : '');
}
document.addEventListener('click', (e) => {
  const link = e.target.closest('.review__photo');
  if (!link || typeof photobox.showModal !== 'function') return;
  e.preventDefault();
  pbSet = [...link.closest('.review').querySelectorAll('.review__photo')];
  pbNav.forEach((b) => { b.hidden = pbSet.length < 2; });
  showPhoto(pbSet.indexOf(link));
  photobox.showModal();
});
// zavřít křížkem nebo klikem mimo fotku, šipky listují
photobox.addEventListener('click', (e) => {
  const step = e.target.closest('[data-photobox-step]');
  if (step) showPhoto(pbIndex + Number(step.dataset.photoboxStep));
  else if (e.target === photobox || e.target.closest('[data-close-photobox]')) photobox.close();
});
photobox.addEventListener('keydown', (e) => {
  if (pbSet.length < 2) return;
  if (e.key === 'ArrowRight') showPhoto(pbIndex + 1);
  if (e.key === 'ArrowLeft') showPhoto(pbIndex - 1);
});
// mobil: přejetí prstem doleva / doprava
let touchX = null;
photobox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
photobox.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (touchX !== null && pbSet.length > 1 && Math.abs(dx) > 40) showPhoto(pbIndex + (dx < 0 ? 1 : -1));
  touchX = null;
});

/* ---------- Formulář: rezervace / objednávka dortu / dotaz ---------- */
const form = document.querySelector('[data-booking]');
const statusEl = form.querySelector('.booking__status');
const submitBtn = form.querySelector('.booking__submit');
const dateInput = form.querySelector('input[name="Datum"]');
const timeInput = form.querySelector('input[name="Čas"]');
const noteInput = form.querySelector('textarea[name="Zpráva"]');

// minimální datum = dnes (místní čas)
const today = new Date();
dateInput.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function setBookingType(type) {
  const radio = form.querySelector(`input[name="Typ"][data-type="${type}"]`);
  if (radio) { radio.checked = true; applyType(); }
}

function applyType() {
  const type = form.querySelector('input[name="Typ"]:checked').dataset.type;
  form.dataset.type = type;
  for (const field of form.querySelectorAll('[data-for]')) {
    const show = field.dataset.for.split(' ').includes(type);
    field.hidden = !show;
    field.querySelectorAll('input, textarea').forEach((i) => { i.disabled = !show; });
  }
  for (const el of form.querySelectorAll('[data-label-rezervace], [data-label-dort], [data-label-dotaz]')) {
    const text = el.dataset['label' + type[0].toUpperCase() + type.slice(1)];
    if (text) el.textContent = text;
  }
  for (const el of form.querySelectorAll('[data-placeholder-rezervace]')) {
    const ph = el.dataset['placeholder' + type[0].toUpperCase() + type.slice(1)];
    if (ph) el.placeholder = ph;
  }
  // u dortu a dotazu je zpráva povinná
  noteInput.required = type !== 'rezervace';
}
form.querySelectorAll('input[name="Typ"]').forEach((r) => r.addEventListener('change', () => {
  statusEl.textContent = '';
  applyType();
}));
applyType();

// otevírací doba: út–pá 11:00–18:00, so 12:30–18:00, ne + po zavřeno
function checkOpeningHours() {
  dateInput.setCustomValidity('');
  timeInput.setCustomValidity('');
  if (dateInput.disabled || !dateInput.value) return;
  const day = new Date(dateInput.value + 'T12:00').getDay();
  if (day === 0 || day === 1) { dateInput.setCustomValidity('V neděli a v pondělí máme zavřeno.'); return; }
  if (!timeInput.value) return;
  const from = day === 6 ? '12:30' : '11:00';
  if (timeInput.value < from || timeInput.value > '18:00') {
    timeInput.setCustomValidity(`Tento den máme otevřeno ${from}–18:00.`);
  }
}
dateInput.addEventListener('change', checkOpeningHours);
timeInput.addEventListener('change', checkOpeningHours);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  checkOpeningHours();
  if (!form.reportValidity()) return;

  const key = form.querySelector('input[name="access_key"]').value;
  // shortcut: bez Web3Forms klíče formulář jen ukáže potvrzení (demo), po doplnění klíče odesílá
  if (!key || key === 'YOUR_ACCESS_KEY') {
    statusEl.className = 'booking__status is-ok';
    statusEl.textContent = 'Toto je ukázka návrhu, formulář zatím neodesílá.';
    form.reset();
    applyType();
    return;
  }

  submitBtn.disabled = true;
  statusEl.className = 'booking__status';
  statusEl.textContent = 'Odesílám…';
  try {
    const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || res.status);
    statusEl.className = 'booking__status is-ok';
    statusEl.textContent = 'Děkujeme! Brzy se vám ozveme.';
    form.reset();
    applyType();
  } catch (err) {
    statusEl.className = 'booking__status is-error';
    statusEl.textContent = 'Odeslání se nepovedlo. Zkuste to prosím znovu, nebo zavolejte na +420 608 770 746.';
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- Nabídka: záložky kategorií ---------- */
const menuTabs = document.querySelector('.menu__tabs');
if (menuTabs) {
  const tabs = [...menuTabs.querySelectorAll('[role="tab"]')];
  const headerNav = document.querySelector('.header__nav');
  // záložky se lepí těsně pod fixní hlavičku, jejíž výška se mění podle breakpointu
  const setHeaderH = () => document.documentElement.style.setProperty('--header-h', headerNav.offsetHeight + 'px');
  setHeaderH();
  window.addEventListener('resize', setHeaderH);

  // když záložky přilepené, hlavička dostane pozadí – jinak pod průhlednou hlavičkou prosvítají kartičky
  const header = document.querySelector('.header');
  const menuSection = menuTabs.closest('.menu');
  const updateStuck = () => {
    const h = headerNav.offsetHeight;
    header.classList.toggle('is-solid', menuTabs.parentElement.getBoundingClientRect().top <= h + 1 && menuSection.getBoundingClientRect().bottom > h);
  };
  window.addEventListener('scroll', updateStuck, { passive: true });
  window.addEventListener('resize', updateStuck);
  updateStuck();

  const updateEnd = () => menuTabs.classList.toggle('is-end', menuTabs.scrollLeft + menuTabs.clientWidth >= menuTabs.scrollWidth - 4);
  menuTabs.addEventListener('scroll', updateEnd, { passive: true });
  window.addEventListener('resize', updateEnd);
  updateEnd();

  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).classList.toggle('is-active', on);
    });
    // aktivní záložku posunout do středu lišty (mobil)
    menuTabs.scrollTo({ left: tab.offsetLeft - (menuTabs.clientWidth - tab.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    // přepnutí z konce dlouhé kategorie: skočit na začátek nové, hned pod záložky
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    const gap = panel.getBoundingClientRect().top - menuTabs.parentElement.getBoundingClientRect().bottom;
    if (gap < 0) scrollToY(window.scrollY + gap - 8);
  };
  menuTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) selectTab(tab);
  });
  menuTabs.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const i = (tabs.indexOf(document.activeElement) + step + tabs.length) % tabs.length;
    tabs[i].focus();
    selectTab(tabs[i]);
  });
}
