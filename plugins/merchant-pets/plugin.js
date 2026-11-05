// Merchant Pets: when the Black Cloud Merchant's Pets or Special tab opens
// (frame 91 56, tab CC or C9), a label under each pet card: souls toward the pet's max (x/105),
// IMPORTANT (only dungeons, chests or the merchant give it) or RARE (few spawns),
// and its genus and where it drops. Souls are counted as Pet Soul Tracker
// counts them: the login's pet list, then each soul and level-up.
const NEEDED = [5, 25, 75];
const BASE = [0, 5, 30, 105]; // souls behind each level
const SLOTS = 10; // cards on the merchant's page
const PET_TABS = new Set([0xcc, 0xc9]); // the list's first byte: CC Pets, C9 Special (sells pets too), CB Skins
// The game says nothing when the shop closes (2026-11-05 capture), so labels go
// on Esc or a click on the shop's X or Exit (the meter's "input" event), a
// click on a label, another tab, a skill of yours, a soul (for a pet not on
// the list: one bought keeps them), talking to an NPC,
// a new map, or this long after the last list.
const HIDE_MS = 3 * 60_000;
const DUNGEONS = new Set(["Fire Temple", "Krao Cave", "Draupnir"]); // regions, by English name
const LABEL = { width: 148, height: 40 }; // fits "105/105 IMPORTANT"
// Where things go is a layout per aspect ratio of the game's window, that the
// player aligns (Align). Until then it is guessed from the shop as it stands
// in a 1920x1080 game (measured 2026-11-05): each card's middle and the bottom
// of its sides, just under the price; the cards keep to the middle of the
// screen. A card is CARD wide and tall, its sides `body` of that, the point
// at its bottom the rest.
const REF = { width: 1920, height: 1080 };
const CARD = { width: 160, height: 244, body: 222 };
// What a click does where on a card (left, top, right, bottom as fractions
// of it, measured 2026-11-06): the tick at its top marks it, the eye opens a
// preview page (MARKS: the player can move and size them, Align, the same on
// every card); the rest, its body and the point, its purchase window.
const MARKS = { tick: [65 / 160, 0, 95 / 160, 21 / 244], preview: [18 / 160, 81 / 244, 49 / 160, 108 / 244] };
const BODY = [[0, 0, 1, 222 / 244], [0.25, 222 / 244, 0.75, 236 / 244]];
const CARDS = [[383, 487], [614, 539], [844, 558], [1074.5, 558], [1305, 539], [1535, 487],
  [428, 776], [658, 817], [1260.5, 817], [1491, 776]];
// The shop's own close buttons, X and Exit (left, top, right, bottom), and the
// side of the screen each keeps to.
const CLOSE = [{ box: [1840, 0, 1920, 80], side: "right" }, { box: [130, 15, 335, 60], side: "left" }];
// The list changes every hour, on the hour: with the shop shut, a note at the
// top of the screen says so (a click on it, or 20 s, takes it away), while you
// play, or always if the player wants (Settings). The interval is learned
// once a list comes as the last one runs out, and kept while the plugin runs.
const HOUR = 3_600_000;
const NOTE = { name: "note", top: 96, width: 280, height: 50 }; // top middle
const states = new Map(); // "server-<id>" -> { levels, points }
let key = null;
let meterLang = "en";
let pickedLang = ""; // Settings: "" the meter's, or "tr"
let lang = "en"; // what the window, the labels and the note say (i18n.js)
const text = () => MP_UI[lang] || MP_UI.en;
// The game's names (data.js): this language's, else English.
const local = (names) => names?.[lang] || names?.en || "";
const petName = (pet) => local(MP_NAMES[pet]) || `Pet #${pet}`;
const genusName = (genus) => local(MP_GENUS[genus]);
const regionName = (region) => local(MP_REGIONS[region]).replace(/^Chaotic /, "") || region;
let shop = null; // { rows: [{ slot, name, pet, item }], refreshAt }
let shown = false;
let game = false; // AION2 open
let area = null; // where the game's client area is or last was (meter 2.0.89 on); else a 1920x1080 game at 0,0
let every = HOUR; // how often the list changes
// The first meter that tells Esc and clicks on the shop's X and Exit
// (a2.watchInput), and where the game is (the game event's area). The meter
// does not say its version: one without a2.watchInput is older. Change this
// if it ships later.
const METER = "2.0.89";
const canWatch = () => typeof a2.watchInput === "function";
let watching = null; // the zones asked for, as sent
let zoneWhat = []; // what each of them is
let few = false; // the meter takes 16 zones at most
let unsaved = false; // the last Save could not see where the boxes were
let noteClosed = true; // the refresh note while the game is closed too (Settings)
let layouts = {}; // aspect ratio ("1.78") -> the player's layout (see `guess`)
let aligning = false; // the boxes are out to be dragged into place
const alignSent = {}; // what each widget shows while aligning
let alignMarks = MARKS; // where the tick and the eye are on every card, while aligning
let noteOn = false;
let noteTimer = 0;
let refreshTimer = 0;
let hideTimer = 0;

const $ = (s) => document.querySelector(s);
const keyFor = (c) => (Number(c?.serverId) > 0 ? `server-${Number(c.serverId)}` : null);
const load = async (k) => {
  if (!states.has(k)) {
    const st = (await a2.storage.get(k).catch(() => null)) || {};
    states.set(k, { levels: st.levels || {}, points: st.points || {} });
  }
  return states.get(k);
};
const saveTimers = {}; // one per server, so one's save never drops another's
const save = (k) => {
  clearTimeout(saveTimers[k]);
  saveTimers[k] = setTimeout(() => a2.storage.set(k, states.get(k)).catch(() => {}), 1000);
};

const souls = (st, pet) => {
  const level = st.levels[pet] || 0;
  return level >= 3 ? 105 : BASE[level] + (st.points[pet] || 0);
};
// A pet whose souls reach its level's cost goes up, the souls past it kept
// (as Pet Soul Tracker 0.5.4: 24 + 5 at a cost of 25 is level 1 with 4).
function gain(st, pet, amount) {
  st.points[pet] = (st.points[pet] || 0) + amount;
  levelUp(st, pet);
}
function levelUp(st, pet) {
  const level = st.levels[pet] || 0;
  if (level < 3 && st.points[pet] >= NEEDED[level]) {
    st.levels[pet] = level + 1;
    st.points[pet] -= NEEDED[level];
    levelUp(st, pet);
  }
}

// Where a pet comes from, for you: its tag, and a line saying genus and place.
function about(pet) {
  const [genusKey, drops] = MP_PETS[pet] || ["", []];
  const genus = genusName(genusKey);
  const places = drops.map((d) => text().places(regionName(d[0]), d[1], d[2])).join(", ") || text().chestOnly;
  if (!drops.length) return { tag: "important", sub: `${genus} · ${text().chest}`, places };
  // Open maps first, dungeons after: a pet only dungeons drop is IMPORTANT.
  const open = drops.filter(([region]) => !DUNGEONS.has(region));
  const shown = open.length ? open : drops;
  const more = drops.length > 1 ? ` +${drops.length - 1}` : "";
  const sub = `${genus} · ${regionName(shown[0][0])}${more}`;
  if (!open.length) return { tag: "important", sub, places };
  const spawns = open.reduce((n, d) => n + d[1], 0);
  const best = Math.max(...open.map((d) => d[2]));
  return { tag: spawns <= 5 || best < 1 ? "hard" : "", sub, places };
}

// One event at a time, in order (loading a server's counts waits on storage).
let chain = Promise.resolve();
const queued = (fn) => {
  chain = chain.then(fn).catch((e) => console.error(e));
};
const onPets = (event, fn) =>
  a2.on(event, (data, meta) => queued(async () => {
    // A pet list without a server (a new character's) never takes the
    // current server's counts, as in Pet Soul Tracker.
    const k = keyFor(meta?.character) || (event === "decoded:pet-list" ? "server-unknown" : key || "server-unknown");
    fn(await load(k), data);
    save(k);
    if (k === key) refresh();
  }));

onPets("decoded:pet-list", (st, data) => {
  st.levels = {};
  st.points = {};
  for (const { pet, level } of data.levels || []) st.levels[pet] = level;
  for (const { pet, points } of data.points || []) st.points[pet] = points;
});
onPets("decoded:soul-gained", (st, data) => {
  for (const { pet, amount } of data.souls || []) gain(st, pet, amount);
  // Bought here, the souls are a card's pet's (2026-11-05: each buy, then its
  // pet's 5 souls 50 ms later): the labels stay, with the new count. Any
  // other soul: you're fighting, not shopping.
  const listed = new Set((shop?.rows || []).map((r) => r.pet));
  if (!(data.souls || []).every(({ pet }) => listed.has(pet))) hideLabels();
  else buying = false; // bought: the labels come back, with the new count
});
onPets("decoded:level-up", (st, { pet, level }) => {
  // The game takes the levels' cost from the pet's souls; already levelled
  // from them, the souls picked up since stay.
  const was = st.levels[pet] || 0;
  if (was >= level) return;
  st.levels[pet] = level;
  st.points[pet] = Math.max(0, (st.points[pet] || 0) - NEEDED.slice(was, level).reduce((n, x) => n + x, 0));
});
// A pet from a chest (09 90): yours now, at its level, with the souls it had.
onPets("decoded:pet-unlocked", (st, { pet, level }) => {
  if ((st.levels[pet] || 0) < level) st.levels[pet] = level;
  buying = false; // bought (a pet new to you)
});

a2.on("character", (c) => queued(async () => {
  const k = keyFor(c);
  if (!k) return;
  a2.storage.set("last", k).catch(() => {});
  if (k !== key) {
    key = k;
    await load(k);
    refresh();
  }
}));

// A list: Pets or Special shows labels, Skins hides them. Cards stand on
// screen in product id order (Pets, 2026-11-05 capture; Special taken alike).
a2.on("decoded:shop-list", (d) => {
  if (!PET_TABS.has(d.head & 0xff)) return hideLabels();
  const count = Math.min(d.head >> 8, SLOTS);
  const slots = [];
  for (let i = 0; i < count; i++) slots.push({ product: d["p" + i], item: d["i" + i] });
  slots.sort((a, b) => a.product - b.product);
  // Mounts and looks have no souls: not listed.
  const rows = slots.map((s, slot) => ({ slot, item: s.item, pet: MP_ITEMS[s.item] || 0 })).filter((r) => r.pet);
  every = learnEvery(shop?.refreshAt, d.refreshAt, Date.now()) || every;
  shop = { rows, refreshAt: d.refreshAt };
  shown = true;
  buying = false; // another tab, or the list again
  if (noteOn) note(false);
  scheduleNote();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideLabels, HIDE_MS);
  refresh();
});

// Signs you've left the shop. A record about you (kind 11) comes only when
// you use a skill: none came in ten minutes of standing at the merchant.
a2.on("decoded:own-position", (d) => {
  if (d.target === d.source && d.one === 1 && d.p === 1 && d.kind === 0x11) hideLabels();
});
// Talking to an NPC (the merchant too: its list comes right after and shows them again).
a2.on("decoded:npc-talk", () => hideLabels());
a2.on("decoded:zone", () => hideLabels());
// A click on a card opens the shop's purchase window over the labels, or its
// eye a preview page: they step aside ("buy", "preview") until it closes, the
// shop still open. The window: Esc, its Cancel or X, or the pet's souls of a
// purchase. The page: Esc, or its X (where the shop's is).
let buying = false;
function setBuying(on) {
  if (buying === on) return;
  buying = on;
  refresh();
}
// Esc, or a click in a zone (what it is: `zoneWhat`), while the labels show.
a2.on("input", (e) => {
  if (!shown || aligning) return;
  const what = e.key === "Escape" ? "esc" : zoneWhat[e.zone];
  if (buying === "preview") {
    if (what === "esc" || what === "close") setBuying(false);
  } else if (buying) {
    if (what === "esc" || what === "cancel") setBuying(false);
    // Bought: a pet's souls come at once (and bring the labels back); a mount
    // or a look brings none.
    if (what === "purchase") setTimeout(() => setBuying(false), 600);
  } else if (what === "esc" || what === "close") hideLabels();
  else if (what === "card") setBuying("buy");
  else if (what === "preview") setBuying("preview");
});
// The purchase window, measured in a 1920x1080 game (2026-11-06): in the
// middle of the screen, its Cancel, X and Purchase buttons (left, top, right,
// bottom).
const PURCHASE = [[765, 706, 957, 746], [1284, 233, 1324, 273], [963, 706, 1155, 746]];
// The zones to watch, each with what it is: the shop's X and Exit, the cards'
// parts, the purchase window's Cancel, X and Purchase. `few`: a meter that
// takes 16 at most gets each card whole.
function zonesFor(a, few) {
  const l = layoutFor(a);
  const f = (p) => [(p.x - a.x) / a.width, (p.y - a.y) / a.height];
  const part = ([x0, y0, x1, y1], [px0, py0, px1, py1]) => {
    const w = x1 - x0, h = y1 - y0;
    return [x0 + px0 * w, y0 + py0 * h, x0 + px1 * w, y0 + py1 * h];
  };
  const m = l.marks || MARKS;
  const parts = few ? [["card", [0, 0, 1, 1]]] : [["tick", m.tick], ["preview", m.preview], ...BODY.map((b) => ["card", b])];
  return [
    ...l.close.map((r) => ["close", r]),
    ...parts.flatMap(([what, p]) => l.cards.map((c) => [what, part(c, p)])),
    ...PURCHASE.map(([x0, y0, x1, y1], k) => [k < 2 ? "cancel" : "purchase", [...f(at(a, x0, y0)), ...f(at(a, x1, y1))]]),
  ];
}
// The meter watches only while the labels show (zones of the game's window,
// kept in it so the meter takes them; one off the window shrinks to its corner).
function watchClose() {
  if (!canWatch()) return;
  const inside = (v) => Math.min(1, Math.max(0, v));
  const zone = ([x0, y0, x1, y1]) => {
    const z = { x: inside(x0), y: inside(y0), width: inside(x1) - inside(x0), height: inside(y1) - inside(y0) };
    return z.width > 0 && z.height > 0 ? z : { x: 0, y: 0, width: 1e-6, height: 1e-6 };
  };
  const list = shown && !aligning ? zonesFor(gameArea(), few) : null;
  const zones = list && list.map(([, r]) => zone(r));
  const key = JSON.stringify(zones);
  if (key === watching) return;
  watching = key;
  zoneWhat = list ? list.map(([what]) => what) : [];
  a2.watchInput(zones).catch(() => {
    if (!zones || zones.length <= 16 || few) return;
    few = true; // a meter that takes fewer
    watching = null;
    watchClose();
  });
}

// A point of the 1920x1080 shop in game area `a`. The game scales its
// interface with the window's shorter side; `side` is what the point keeps
// its distance to (left, right, else the middle), `top` likewise.
function at(a, rx, ry, side, top) {
  const s = Math.min(a.width / REF.width, a.height / REF.height);
  const x = side === "left" ? rx * s : side === "right" ? a.width - (REF.width - rx) * s : a.width / 2 + (rx - REF.width / 2) * s;
  const y = top ? ry * s : a.height / 2 + (ry - REF.height / 2) * s;
  return { x: a.x + x, y: a.y + y };
}
const gameArea = () => area || { x: 0, y: 0, ...REF };
// A layout: where things stand in the game's area, as fractions of its width
// and height. cards and close (X, Exit): each one's left, top, right, bottom;
// note: the note's middle and top.
function guess(a) {
  const f = (p) => [(p.x - a.x) / a.width, (p.y - a.y) / a.height];
  return {
    cards: CARDS.map(([x, y]) => [...f(at(a, x - CARD.width / 2, y - CARD.body)), ...f(at(a, x + CARD.width / 2, y + CARD.height - CARD.body))]),
    close: CLOSE.map(({ box: [l, t, r, b], side }) => [...f(at(a, l, t, side, true)), ...f(at(a, r, b, side, true))]),
    note: f(at(a, REF.width / 2, NOTE.top, "middle", true)),
  };
}
const ratioKey = (a) => (a.width / a.height).toFixed(2);
const RATIO_NAMES = { "1.78": "16:9", "1.60": "16:10", "2.33": "21:9", "2.37": "21:9", "2.39": "21:9", "3.56": "32:9", "1.33": "4:3", "1.25": "5:4" };
const ratioName = (k) => RATIO_NAMES[k] || k;
const layoutFor = (a) => layouts[ratioKey(a)] || guess(a);
// Where a card's label goes (Settings): under the card's sides (on its point),
// or on it at its bottom, middle or top; its top middle in screen pixels, for
// zoom `z`.
const LABEL_AT = ["under", "bottom", "middle", "top"];
let labelAt = "under";
function labelOn(a, [x0, y0, x1, y1], z) {
  const top = a.y + y0 * a.height;
  const bottom = top + ((y1 - y0) * a.height * CARD.body) / CARD.height;
  const h = LABEL.height * z * devicePixelRatio;
  const y = { under: bottom, bottom: bottom - h, middle: (top + bottom - h) / 2, top }[labelAt];
  return centred({ x: a.x + ((x0 + x1) / 2) * a.width, y }, LABEL.width * z);
}
// A point of a layout on screen, in game area `a`.
const onScreen = (a, [fx, fy]) => ({ x: a.x + fx * a.width, y: a.y + fy * a.height });
// How big labels and the note are drawn: as big as the game draws its
// interface (2 at 4K), less what the desktop's scaling already does, so they
// keep to the cards' size on any screen.
const zoomFor = (a) => Math.min(4, Math.max(0.5, Math.min(a.width / REF.width, a.height / REF.height) / devicePixelRatio));
const sized = ({ width, height }, z) => ({ width: Math.round(width * z), height: Math.round(height * z) });
// A widget `width` CSS px wide, its middle at `p`: its top left in screen pixels.
const centred = (p, width) => ({ x: Math.round(p.x - (width * devicePixelRatio) / 2), y: Math.round(p.y) });
function hideLabels() {
  if (!shown) return;
  shown = false;
  buying = false;
  clearTimeout(hideTimer);
  refresh();
}

// What each card's label says.
function labels() {
  const st = states.get(key) || { levels: {}, points: {} };
  const out = new Array(SLOTS).fill(null);
  if (!shown || buying || !shop || Date.now() >= shop.refreshAt) return out;
  const zoom = zoomFor(gameArea());
  for (const r of shop.rows) {
    if (!r.pet) continue; // a mount or a look: no souls to count
    const n = souls(st, r.pet);
    const { tag, sub } = about(r.pet);
    out[r.slot] = { text: `${n}/105`, tag, tagText: text()[tag] || "", sub, done: n >= 105, zoom };
  }
  return out;
}

const sent = new Array(SLOTS).fill(null);
// One pass at a time: a list that comes while the last one's labels are still
// opening (the first time, each takes the meter about half a second) is put
// up once that pass is done, so an older pass never undoes a newer one.
let pass = null;
let again = false;
function refresh() {
  if (pass) {
    again = true;
    return pass;
  }
  pass = (async () => {
    do {
      again = false;
      await putUp();
    } while (again);
  })().finally(() => {
    pass = null;
  });
  return pass;
}
async function putUp() {
  watchClose();
  if (aligning) return render();
  const all = labels();
  const a = gameArea();
  // All at once: the meter makes the ones it hasn't made yet side by side.
  await Promise.all(all.map(async (want, i) => {
    const name = `card-${i}`;
    if (JSON.stringify(want) === JSON.stringify(sent[i])) return;
    const was = sent[i];
    sent[i] = want;
    if (!want) return vanish(name, () => !sent[i]);
    // Placed before each open: KWin sometimes opens a widget mid-screen,
    // and the meter would keep it there.
    if (!was) await a2.widgets.place(name, labelOn(a, layoutFor(a).cards[i], want.zoom)).catch(() => {});
    await a2.widgets.open(name, sized(LABEL, want.zoom)).catch(() => {});
    a2.widgets.send(name, want).catch(() => {});
  }));
  render();
}
// The labels' windows, made (and put away, empty) once the game runs: the
// first time the merchant opens they come at once, not one by one.
let made = false;
async function makeLabels() {
  if (made || aligning) return;
  made = true;
  const a = gameArea();
  const z = zoomFor(a);
  await Promise.all(Array.from({ length: SLOTS }, async (_, i) => {
    const name = `card-${i}`;
    if (sent[i]) return;
    await a2.widgets.place(name, labelOn(a, layoutFor(a).cards[i], z)).catch(() => {});
    await a2.widgets.open(name, sized(LABEL, z)).catch(() => {});
    if (!sent[i] && !aligning) await a2.widgets.close(name).catch(() => {});
  }));
}

// KDE (its Scale effect) shrinks a closing window for 200 ms: the widget is
// emptied first, so that plays on nothing, and closed a moment later unless
// it was wanted again meanwhile (`still`), or is an align box now.
function vanish(name, still) {
  a2.widgets.send(name, { hide: true }).catch(() => {});
  setTimeout(() => {
    if (!aligning && still()) a2.widgets.close(name).catch(() => {});
  }, 100);
}

a2.on("widget-message", ({ name, data }) => {
  if (aligning) {
    if (data?.hello && alignSent[name]) a2.widgets.send(name, alignSent[name]).catch(() => {});
    if (!alignSent[name]?.card) return;
    // A card sized, or its tick or eye moved: every card the same.
    const size = data?.size;
    if (size && size.width >= 20 && size.height >= 20) {
      for (let i = 0; i < SLOTS; i++) a2.widgets.open(`card-${i}`, { width: Math.round(size.width), height: Math.round(size.height) }).catch(() => {});
    }
    if (data?.marks) {
      alignMarks = data.marks;
      for (let i = 0; i < SLOTS; i++) {
        const n = `card-${i}`;
        alignSent[n] = { ...alignSent[n], marks: alignMarks };
        if (n !== name) a2.widgets.send(n, alignSent[n]).catch(() => {});
      }
    }
    return;
  }
  if (name === NOTE.name) {
    if (data?.hello && noteOn) a2.widgets.send(name, noteData(zoomFor(gameArea()))).catch(() => {});
    if (data?.dismiss) note(false);
    return;
  }
  const i = Number(String(name).split("-")[1]);
  if (data?.hello && sent[i]) a2.widgets.send(name, sent[i]).catch(() => {});
  if (data?.dismiss) hideLabels(); // a click on a label: all of them go
});

// The next time the list changes: every `every` from the last list's time,
// or on the hour before any list.
function nextRefresh(now, refreshAt, step = HOUR) {
  const base = refreshAt || Math.ceil(now / HOUR) * HOUR;
  return base + Math.max(0, Math.ceil((now - base) / step)) * step;
}
// The interval, from a list that came as the one before ran out (the shop
// open at the turn, or opened just after it): its time moved on by one
// interval. Later, it may have moved on by several: no answer then.
function learnEvery(before, after, now) {
  if (!before || !(after > before) || Math.abs(now - before) > 2 * 60_000) return null;
  return after - before;
}
// Whether a refresh is to be told now.
function noteDue() {
  return (game || noteClosed) && !shown && !aligning;
}
function scheduleNote() {
  const now = Date.now();
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (noteDue()) note(true);
    refresh(); // labels of the list that ran out go
    scheduleNote();
  }, nextRefresh(now, shop?.refreshAt, every) - now + 2000);
}
const noteData = (zoom) => ({ text: text().noteTitle, sub: text().noteSub, tag: "toast", zoom });
async function note(on) {
  clearTimeout(noteTimer);
  noteOn = on;
  if (!on) return vanish(NOTE.name, () => !noteOn);
  const a = gameArea();
  const z = zoomFor(a);
  await a2.widgets.place(NOTE.name, centred(onScreen(a, layoutFor(a).note), NOTE.width * z)).catch(() => {});
  await a2.widgets.open(NOTE.name, sized(NOTE, z)).catch(() => {});
  a2.widgets.send(NOTE.name, noteData(z)).catch(() => {});
  noteTimer = setTimeout(() => note(false), 20_000);
}
a2.on("game", (g) => {
  game = g.running;
  if (g.area) area = g.area; // closed, the note still goes where the game was
  if (!game) hideLabels();
  else makeLabels();
  watchClose(); // another ratio: its own X and Exit
  render();
});

// Aligning, for this aspect ratio: every label, X, Exit and the note out as
// boxes to drag (on the shop, its Pets tab open), then where they were left
// is this ratio's layout. A game on another screen with another ratio gets
// its own.
const ALIGN = [...Array.from({ length: SLOTS }, (_, i) => `card-${i}`), "close-x", "close-exit", NOTE.name];
async function startAlign() {
  if (aligning) return;
  unsaved = false;
  if (noteOn) await note(false);
  shown = false;
  buying = false;
  await refresh(); // the labels go
  aligning = true;
  const a = gameArea();
  const l = layoutFor(a);
  const z = zoomFor(a);
  const show = async (name, at, size, data) => {
    alignSent[name] = data;
    await a2.widgets.place(name, at).catch(() => {});
    await a2.widgets.open(name, size).catch(() => {});
    a2.widgets.send(name, data).catch(() => {});
  };
  // A box as big as what it stands for: each card (blue), X and Exit (red).
  const box = async (name, [x0, y0, x1, y1], data) => {
    const from = onScreen(a, [x0, y0]);
    const size = { width: Math.round(((x1 - x0) * a.width) / devicePixelRatio), height: Math.round(((y1 - y0) * a.height) / devicePixelRatio) };
    await show(name, { x: Math.round(from.x), y: Math.round(from.y) }, size, { ...data, exit: true, align: true });
  };
  alignMarks = l.marks || MARKS;
  for (let i = 0; i < SLOTS; i++) await box(`card-${i}`, l.cards[i], { text: `${text().card} ${i + 1}`, sub: text().drag, card: true, marks: alignMarks });
  for (const [k, rect] of l.close.entries()) await box(ALIGN[SLOTS + k], rect, { text: k ? "Exit" : "X" });
  await show(NOTE.name, centred(onScreen(a, l.note), NOTE.width * z), sized(NOTE, z), { ...noteData(z), align: true });
  render();
}
async function endAlign(keep) {
  if (!aligning) return;
  const a = gameArea();
  const rects = keep ? await Promise.all(ALIGN.map((name) => a2.widgets.where(name).catch(() => null))) : [];
  // A meter that cannot see where its windows are (before 2.0.89 on KDE
  // Wayland) says the same spot, the top left, for every one: saving that
  // would bring them all up there. The layout stays as it was then.
  unsaved = keep && rects.every((r) => r && r.x === rects[0].x && r.y === rects[0].y);
  if (keep && !unsaved) {
    const was = layoutFor(a);
    const f = (x, y) => [(x - a.x) / a.width, (y - a.y) / a.height];
    const rect = (r, was) => (r ? [...f(r.x, r.y), ...f(r.x + r.width, r.y + r.height)] : was);
    const cards = was.cards.map((c, i) => rect(rects[i], c));
    const close = was.close.map((c, k) => rect(rects[SLOTS + k], c));
    const n = rects[SLOTS + 2];
    layouts[ratioKey(a)] = { v: 2, cards, marks: alignMarks, close, note: n ? f(n.x + n.width / 2, n.y) : was.note, size: `${a.width}×${a.height}` };
    await a2.storage.set("layouts", layouts).catch(() => {});
  }
  for (const name of ALIGN) await a2.widgets.close(name).catch(() => {});
  aligning = false;
  sent.fill(null);
  refresh();
}
async function forget(k) {
  delete layouts[k];
  await a2.storage.set("layouts", layouts).catch(() => {});
  watchClose(); // the estimate's X and Exit again
  render();
}

// The window: the last list's pets, and the layouts.
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
};
function render() {
  const st = states.get(key) || { levels: {}, points: {} };
  const list = $(".list");
  list.replaceChildren();
  const t = text();
  if (!shop) {
    list.textContent = t.empty;
  } else {
    for (const r of [...shop.rows].sort((a, b) => a.slot - b.slot)) {
      const info = about(r.pet);
      const n = souls(st, r.pet);
      const row = el("div", `row ${info.tag}${n >= 105 ? " done" : ""}`, "");
      row.append(
        el("span", "name", petName(r.pet)),
        el("span", "count", `${n}/105`),
        el("span", "badge", t[info.tag] || ""),
        el("span", "where", `${genusName(MP_PETS[r.pet]?.[0])} · ${info.places}`),
      );
      list.append(row);
    }
  }
  const left = shop ? shop.refreshAt - Date.now() : 0;
  $(".refresh").textContent = shop && left > 0 ? t.refreshIn(Math.ceil(left / 60_000)) : shop ? t.refreshed : "";

  $(".meter").hidden = canWatch();
  $(".meter").textContent = t.old(METER);
  const a = gameArea();
  const k = ratioKey(a);
  $(".ratio").textContent = aligning
    ? t.alignHelp
    : `${t.game(`${a.width}×${a.height}`, ratioName(k))}: ${layouts[k] ? t.yours : t.estimated}` +
      (area ? "" : ` · ${t.unknownWindow}`) +
      (unsaved ? ` · ${t.notSaved(METER)}` : "");
  $(".align").textContent = aligning ? t.save : t.align;
  $(".cancel").hidden = !aligning;
  const saved = $(".saved");
  saved.replaceChildren();
  for (const [ratio, l] of Object.entries(layouts)) {
    const forgetIt = el("button", "forget", t.reset);
    forgetIt.type = "button";
    forgetIt.addEventListener("click", () => forget(ratio));
    const row = el("li", ratio === k ? "current" : "", `${t.alignedAt(ratioName(ratio), l.size)} `);
    row.append(forgetIt);
    saved.append(row);
  }
}
$(".align").addEventListener("click", () => (aligning ? endAlign(true) : startAlign()));
$(".cancel").addEventListener("click", () => endAlign(false));
$(".note-closed input").addEventListener("change", (e) => {
  noteClosed = e.target.checked;
  a2.storage.set("noteClosed", noteClosed).catch(() => {});
});
// The language: the meter's, or Turkish if picked (the meter has none).
function setLang() {
  lang = MP_UI[pickedLang] ? pickedLang : MP_UI[meterLang] ? meterLang : "en";
  document.documentElement.lang = lang;
  for (const e of document.querySelectorAll("[data-t]")) e.textContent = text()[e.dataset.t];
  if (aligning) return render(); // the boxes keep their words till Save
  sent.fill(null); // the labels and the note again, in it
  if (noteOn) note(true);
  refresh();
}
a2.on("language", (code) => {
  meterLang = code;
  setLang();
});
$(".lang select").addEventListener("change", (e) => {
  pickedLang = MP_UI[e.target.value] ? e.target.value : "";
  a2.storage.set("lang", pickedLang).catch(() => {});
  setLang();
});
$(".label-at select").addEventListener("change", (e) => {
  labelAt = LABEL_AT.includes(e.target.value) ? e.target.value : "under";
  a2.storage.set("labelAt", labelAt).catch(() => {});
  sent.fill(null); // placed again
  refresh();
});
setInterval(render, 30_000);

(async () => {
  key = (await a2.storage.get("last").catch(() => null)) || null;
  if (key) await load(key);
  layouts = (await a2.storage.get("layouts").catch(() => null)) || {};
  // Layouts from before the cards were whole (v 2) go.
  for (const [k, l] of Object.entries(layouts)) if (l.v !== 2) delete layouts[k];
  const savedAt = await a2.storage.get("labelAt").catch(() => null);
  labelAt = LABEL_AT.includes(savedAt) ? savedAt : "under";
  $(".label-at select").value = labelAt;
  const savedLang = await a2.storage.get("lang").catch(() => null);
  pickedLang = savedLang === "tr" ? "tr" : "";
  $(".lang select").value = pickedLang;
  setLang();
  noteClosed = (await a2.storage.get("noteClosed").catch(() => null)) !== false;
  $(".note-closed input").checked = noteClosed;
  // Unlocked: a label takes a click on itself (to hide them all); only its
  // own box does, so the cards stay clickable.
  await a2.widgets.lock(false).catch(() => {});
  scheduleNote();
  render();
  a2.ready();
})();
