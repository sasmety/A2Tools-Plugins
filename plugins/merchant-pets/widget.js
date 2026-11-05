// One card's label, or the note that the list changed. A click hides them;
// while aligning (the shop's X and Exit too, as boxes), a press drags it. Only
// the label's own box takes the mouse, so the card above stays clickable.
const box = document.querySelector(".label");
const fit = () => {
  const r = box.getBoundingClientRect();
  const area = { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  if (typeof a2.widget.areas === "function") a2.widget.areas([area]).catch(() => {});
  else if (typeof a2.widget.area === "function") a2.widget.area(area).catch(() => {});
};
a2.on("widget", (d) => {
  if (!d) return;
  document.body.style.visibility = d.hide ? "hidden" : "visible"; // emptied just before it closes
  if (d.hide) return;
  document.documentElement.style.setProperty("--z", String(d.zoom || 1)); // bigger on big screens
  box.className = `label ${d.tag || ""}${d.done ? " done" : ""}${d.align ? " align" : ""}${d.exit ? " exit" : ""}${d.card ? " card" : ""}`;
  box.querySelector(".n").textContent = d.text;
  box.querySelector(".t").textContent = d.tagText || "";
  box.querySelector(".sub").textContent = d.sub || "";
  fit();
});
box.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  if (box.classList.contains("align")) a2.widget.drag().catch(() => {});
  else a2.widget.post({ dismiss: true }).catch(() => {});
});
document.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", fit);
a2.ready();
a2.widget.post({ hello: true }).catch(() => {});
