// One card's label, or the note that the list changed. A click hides them;
// while aligning (the shop's X and Exit too, as boxes), a press drags it. Only
// the label's own box takes the mouse, so the card above stays clickable. A
// card's box while aligning also sizes at its grip, and holds its tick and
// eye, dragged and sized at theirs in it: let go, the plugin does the same to
// every card. While such a drag goes the window is grown (the pointer must
// stay in it), the box drawn in its top left as big as it is.
const box = document.querySelector(".label");
const fit = () => {
  // grown for a drag: all of the window takes the mouse
  const r = grown ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : box.getBoundingClientRect();
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
box.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  if (!box.classList.contains("align")) return a2.widget.post({ dismiss: true }).catch(() => {});
  const grip = e.target.classList.contains("grip");
  const m = marks && e.target.closest(".mark");
  if (!m && !grip) return a2.widget.drag().catch(() => {});
  const W = innerWidth, H = innerHeight;
  let size = { width: W, height: H };
  grown = { until: null };
  Object.assign(box.style, { width: `${W}px`, height: `${H}px`, minWidth: "0" });
  document.body.style.justifyContent = "flex-start";
  a2.widget.post({ grow: true }).catch(() => {});
  const back = (all) => {
    grown.until = size; // drawn so till the window is back to it
    a2.widget.post({ size, all }).catch(() => {});
  };
  if (m) { // its tick or eye: dragged, or sized at its grip, kept in the card
    const k = m.classList.contains("tick") ? "tick" : "preview";
    const [l, t, r, b] = marks[k];
    return follow(e, (dx, dy) => {
      const [fx, fy] = [dx / W, dy / H];
      if (grip) marks = { ...marks, [k]: [l, t, Math.min(1, Math.max(l + 0.03, r + fx)), Math.min(1, Math.max(t + 0.02, b + fy))] };
      else {
        const x = Math.min(1 - (r - l), Math.max(0, l + fx)), y = Math.min(1 - (b - t), Math.max(0, t + fy));
        marks = { ...marks, [k]: [x, y, x + r - l, y + b - t] };
      }
      drawMarks();
    }, () => {
      a2.widget.post({ marks }).catch(() => {});
      back(false);
    });
  }
  // the card: sized here as it goes; let go, every card
  follow(e, (dx, dy) => {
    size = { width: Math.max(20, W + dx), height: Math.max(20, H + dy) };
    Object.assign(box.style, { width: `${size.width}px`, height: `${size.height}px` });
  }, () => back(true));
});
let grown = null; // a drag's grown window: { until } the size it goes back to
addEventListener("resize", () => {
  const u = grown?.until;
  if (u && innerWidth <= u.width + 1 && innerHeight <= u.height + 1) {
    grown = null;
    box.style.width = box.style.height = box.style.minWidth = document.body.style.justifyContent = "";
  }
  fit();
});
document.addEventListener("contextmenu", (e) => e.preventDefault());
a2.ready();
a2.widget.post({ hello: true }).catch(() => {});
