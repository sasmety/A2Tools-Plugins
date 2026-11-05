// One card's label, or the note that the list changed. A click hides them;
// while aligning (the shop's X and Exit too, as boxes), a press drags it. Only
// the label's own box takes the mouse, so the card above stays clickable.
//
// A card while aligning: its window is the box (drawn at `rect`) and a margin
// round it. The box is dragged by its middle and sized from an edge or corner
// in it (the pointer stays on the window); its tick and eye the same. Sizing
// the card keeps them where they are on screen. Let go, the plugin hears it,
// fits every card to it and draws each window round its box again.
const box = document.querySelector(".label");
let rect = null; // the card's box: left, top, width, height (CSS px of the window)
let marks = null; // its tick and eye: left, top, right, bottom as fractions of it
let dragging = false;
const fit = () => {
  // dragging: all of the window takes the mouse, so none of it is lost
  const r = dragging ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : box.getBoundingClientRect();
  const area = { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  if (typeof a2.widget.areas === "function") a2.widget.areas([area]).catch(() => {});
  else if (typeof a2.widget.area === "function") a2.widget.area(area).catch(() => {});
};
const px = (v) => `${v}px`;
function draw() {
  if (rect) Object.assign(box.style, { position: "absolute", left: px(rect[0]), top: px(rect[1]), width: px(rect[2]), height: px(rect[3]), minWidth: "0" });
  else box.style.cssText = "";
  for (const k of ["tick", "preview"]) {
    const [l, t, r, b] = marks?.[k] || [0, 0, 0, 0];
    Object.assign(box.querySelector(`.mark.${k}`).style, { left: `${l * 100}%`, top: `${t * 100}%`, width: `${(r - l) * 100}%`, height: `${(b - t) * 100}%` });
  }
  fit();
}
a2.on("widget", (d) => {
  if (!d) return;
  document.body.style.visibility = d.hide ? "hidden" : "visible"; // emptied just before it closes
  if (d.hide) return;
  document.documentElement.style.setProperty("--z", String(d.zoom || 1)); // bigger on big screens
  box.className = `label ${d.tag || ""}${d.done ? " done" : ""}${d.align ? " align" : ""}${d.exit ? " exit" : ""}${d.card ? " card" : ""}`;
  box.querySelector(".n").textContent = d.text;
  box.querySelector(".t").textContent = d.tagText || "";
  box.querySelector(".sub").textContent = d.sub || "";
  if (dragging) return; // the drag's own till it is let go
  rect = d.card && d.rect ? d.rect : null;
  marks = d.marks || null;
  draw();
});

// The marks as boxes in the window, and back to fractions of `r`.
const toPx = (r, [l, t, rr, b]) => [r[0] + l * r[2], r[1] + t * r[3], (rr - l) * r[2], (b - t) * r[3]];
const toFr = (r, [x, y, w, h]) => [(x - r[0]) / r[2], (y - r[1]) / r[3], (x + w - r[0]) / r[2], (y + h - r[1]) / r[3]];
// What a point is on: a mark (first) or the card, and which edge ("n", "se",
// …; "" its middle).
function hitAt(x, y) {
  const edge = (b, e) => {
    const [l, t, w, h] = b;
    if (x < l - 1 || x > l + w + 1 || y < t - 1 || y > t + h + 1) return null;
    return (y - t <= e ? "n" : t + h - y <= e ? "s" : "") + (x - l <= e ? "w" : l + w - x <= e ? "e" : "");
  };
  for (const k of ["tick", "preview"]) {
    const dir = marks ? edge(toPx(rect, marks[k]), 4) : null;
    if (dir !== null) return { what: k, dir };
  }
  return { what: "card", dir: edge(rect, 7) || "" };
}
// A box moved (no edge) or sized from `dir`, never under `min` across.
function dragged([l, t, w, h], dir, dx, dy, min) {
  if (!dir) return [l + dx, t + dy, w, h];
  let [x0, y0, x1, y1] = [l, t, l + w, t + h];
  if (dir.includes("w")) x0 = Math.min(x1 - min, x0 + dx);
  if (dir.includes("e")) x1 = Math.max(x0 + min, x1 + dx);
  if (dir.includes("n")) y0 = Math.min(y1 - min, y0 + dy);
  if (dir.includes("s")) y1 = Math.max(y0 + min, y1 + dy);
  return [x0, y0, x1 - x0, y1 - y0];
}
const CURSOR = { "": "move", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
box.addEventListener("mousemove", (e) => {
  if (rect && !dragging) box.style.cursor = CURSOR[hitAt(e.clientX, e.clientY).dir];
});

box.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  if (!box.classList.contains("align")) return a2.widget.post({ dismiss: true }).catch(() => {});
  if (!rect) return a2.widget.drag().catch(() => {}); // X, Exit, the note: their windows
  const hit = hitAt(e.clientX, e.clientY);
  const start = rect;
  const startMarks = marks && { tick: toPx(start, marks.tick), preview: toPx(start, marks.preview) };
  dragging = true;
  fit();
  const go = (m) => {
    if (!(m.buttons & 1)) return up(); // let go where it was not heard
    const [dx, dy] = [m.clientX - e.clientX, m.clientY - e.clientY];
    if (hit.what === "card") {
      rect = dragged(start, hit.dir, dx, dy, 20);
      // sized: its tick and eye stay put on screen
      if (hit.dir && startMarks) marks = { tick: toFr(rect, startMarks.tick), preview: toFr(rect, startMarks.preview) };
    } else marks = { ...marks, [hit.what]: toFr(rect, dragged(startMarks[hit.what], hit.dir, dx, dy, 6)) };
    draw();
  };
  const up = () => {
    if (!dragging) return;
    removeEventListener("mousemove", go);
    removeEventListener("mouseup", up);
    dragging = false;
    draw();
    if (hit.what !== "card") a2.widget.post({ marks }).catch(() => {});
    else a2.widget.post({ rect, marks }).catch(() => {});
  };
  addEventListener("mousemove", go);
  addEventListener("mouseup", up);
});
document.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", fit);
a2.ready();
a2.widget.post({ hello: true }).catch(() => {});
