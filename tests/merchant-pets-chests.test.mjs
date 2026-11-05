import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Merchant Pets counts souls as Pet Soul Tracker does: on the same three
// chests (pet-souls-chests.json), from the pet list before them, it must
// reach the list the game sent after.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const fixture = JSON.parse(read("./pet-souls-chests.json"));

test("merchant-pets: chests, souls past a level's cost, and the game's level-ups", async () => {
  const handlers = {};
  const store = { "server-1": structuredClone(fixture.before) };
  const element = () => ({ textContent: "", dataset: {}, replaceChildren() {}, append() {}, addEventListener() {} });
  const context = vm.createContext({
    // The plugin's timers (the hourly note) don't keep the test running.
    console, setTimeout: (fn, ms) => setTimeout(fn, ms).unref(), clearTimeout, setInterval: () => 0, Date, Math, JSON, Promise, devicePixelRatio: 1,
    document: { querySelector: element, querySelectorAll: () => [], createElement: element, documentElement: {} },
    a2: {
      on: (event, fn) => (handlers[event] ||= []).push(fn),
      ready() {},
      storage: { get: async (key) => store[key] ?? null, set: async (key, value) => { store[key] = value; } },
      widgets: { lock: async () => {} },
    },
  });
  for (const file of ["i18n.js", "data.js", "plugin.js"]) {
    vm.runInContext(read(`../plugins/merchant-pets/${file}`).replace(/^const (MP_\w+) =/gm, "globalThis.$1 ="), context);
  }
  const meta = { character: { serverId: 1 } };
  for (const [event, data] of fixture.events) for (const fn of handlers[event] || []) fn(data, meta);
  await new Promise((done) => setTimeout(done, 50));
  const st = vm.runInContext("states.get('server-1')", context);
  const pets = new Set([...Object.keys(fixture.after.levels), ...Object.keys(st.levels)]);
  for (const pet of pets) {
    assert.equal(st.levels[pet] || 0, fixture.after.levels[pet] || 0, `pet ${pet}'s level`);
    assert.equal(st.points[pet] || 0, fixture.after.points[pet] || 0, `pet ${pet}'s souls`);
  }
});
