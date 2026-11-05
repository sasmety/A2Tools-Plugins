// One card's label, or the note that the list changed. A click hides them;
// while aligning (the shop's X and Exit too, as boxes), a press drags it. Only
// the label's own box takes the mouse, so the card above stays clickable. A
// card's box while aligning also scales with the wheel, and holds its tick
// and eye, dragged and scaled (the wheel) in it: the plugin does the same to
// every card.
const box = document.querySelector(".label");
const fit = () => {
  const r = box.getBoundingClientRect();
  const area = { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  if (typeof a2.widget.areas === "function") a2.widget.areas([area]).catch(() => {});
  else if (typeof a2.widget.area === "function") a2.widget.area(area).catch(() => {});
};
let marks = null; // the tick and the eye: fractions of the card (left, top, right, bottom)
function drawMarks() {
  for (const k of ["tick", "preview"]) {
    const [l, t, r, b] = marks?.[k] || [0, 0, 0, 0];
    Object.assign(box.querySelector(`.mark.${k}`).style, { left: `${l * 100}%`, top: `${t * 100}%`, width: `${(r - l) * 100}%`, height: `${(b - t) * 100}%` });
  }
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
  marks = d.marks || null;
  drawMarks();
  fit();
});
// From a press till it lets go (which the press keeps, even off the window):
// how far the pointer went.
function follow(e, move, done) {
  const go = (m) => move(m.clientX - e.clientX, m.clientY - e.clientY);
  const up = () => {
    removeEventListener("mousemove", go);
    removeEventListener("mouseup", up);
    done?.();
  };
  addEventListener("mousemove", go);
  addEventListener("mouseup", up);
}
const clamp = (v) => Math.min(1, Math.max(0, v));
box.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  if (!box.classList.contains("align")) return a2.widget.post({ dismiss: true }).catch(() => {});
  const k = markAt(e);
  if (!k) return a2.widget.drag().catch(() => {});
  const [l, t, r, b] = marks[k];
  const W = innerWidth, H = innerHeight;
  follow(e, (dx, dy) => {
    const [fx, fy] = [dx / W, dy / H];
    // kept in the card whole
    const x = Math.min(1 - (r - l), Math.max(0, l + fx)), y = Math.min(1 - (b - t), Math.max(0, t + fy));
    marks = { ...marks, [k]: [x, y, x + r - l, y + b - t] };
    drawMarks();
  }, () => a2.widget.post({ marks }).catch(() => {}));
});
const markAt = (e) => {
  const m = marks && e.target.closest?.(".mark");
  return m ? (m.classList.contains("tick") ? "tick" : "preview") : null;
};
// The wheel: up bigger, down smaller; a card (all of them) told once it rests.
let scale = 1, told = 0;
box.addEventListener("wheel", (e) => {
  if (!box.classList.contains("card")) return;
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.02 : 1 / 1.02;
  const k = markAt(e);
  if (k) {
    const [l, t, r, b] = marks[k];
    const [cx, cy] = [(l + r) / 2, (t + b) / 2];
    const [w, h] = [Math.min(1, Math.max(0.03, (r - l) * f)), Math.min(1, Math.max(0.03, (b - t) * f))];
    marks = { ...marks, [k]: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2].map(clamp) };
    drawMarks();
  } else scale *= f;
  clearTimeout(told);
  told = setTimeout(() => {
    if (k) a2.widget.post({ marks }).catch(() => {});
    else if (scale !== 1) a2.widget.post({ scale }).catch(() => {});
    scale = 1;
  }, 150);
}, { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", fit);
a2.ready();
a2.widget.post({ hello: true }).catch(() => {});
