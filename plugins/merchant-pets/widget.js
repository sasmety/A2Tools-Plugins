// One card's label, or the note that the list changed. A click hides them;
// while aligning (the shop's X and Exit too, as boxes), a press drags it. Only
// the label's own box takes the mouse, so the card above stays clickable. A
// card's box while aligning also sizes at its grip, and holds its tick and
// eye, moved and sized in it: the plugin does the same to every card.
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
  const mark = marks && e.target.closest(".mark");
  const grip = e.target.classList.contains("grip");
  if (mark) {
    const k = mark.classList.contains("tick") ? "tick" : "preview";
    const [l, t, r, b] = marks[k];
    const W = innerWidth, H = innerHeight;
    return follow(e, (dx, dy) => {
      const fx = dx / W, fy = dy / H;
      const at = grip ? [l, t, Math.max(l + 0.03, clamp(r + fx)), Math.max(t + 0.02, clamp(b + fy))] : [l + fx, t + fy, r + fx, b + fy].map(clamp);
      marks = { ...marks, [k]: at };
      drawMarks();
    }, () => a2.widget.post({ marks }).catch(() => {}));
  }
  if (grip) {
    const w = innerWidth, h = innerHeight;
    let frame = 0;
    return follow(e, (dx, dy) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => a2.widget.post({ size: { width: w + dx, height: h + dy } }).catch(() => {}));
    });
  }
  a2.widget.drag().catch(() => {});
});
document.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", fit);
a2.ready();
a2.widget.post({ hello: true }).catch(() => {});
