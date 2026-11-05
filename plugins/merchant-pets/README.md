# Merchant Pets

At the Black Cloud Merchant (Pets and Special tabs), a small label under each pet card:

- **x/105**: your souls toward the pet's last level (5 + 25 + 75), counted as Pet Soul Tracker counts them. Greyed at 105.
- **IMPORTANT**: no monster on an open map drops its souls, as far as Pet Soul Tracker's data knows (it covers Altgard, Verteron, Chaotic Lower Reshanta and three dungeons): only dungeons, chests or the merchant. **RARE**: few monsters drop them (5 spawns or fewer, or under 1%).
- Under it, the pet's genus and the region with the most spawns of a monster that drops its souls (+N more regions).

The window lists the same pets with every region, how many spawns and the best drop chance, and when the list refreshes. With the shop shut, a note at the top of the screen says when the list has refreshed (also while the game is closed, unless turned off in Settings).

Counts start from the pet list the game sends at login: installed mid-session, the plugin shows 0 for your pets until you log in again.

Names come from the game's own texts, in the meter's language (all ten). Turkish can be picked in Settings, since the meter has none.

## Where the labels go

The game draws its shop at a size set by the window's shorter side, centred, so the labels are placed from a measured 1920×1080 shop, scaled to the game's window. Settings → **Align** puts every card (as blue boxes, sized at a corner: all take the size, and the tick and eye in one, yellow, move and size for all), the shop's two close buttons (as red boxes) and the note out to be dragged into place over the open shop; **Save** keeps that layout for the window's aspect ratio (16:9, 21:9, …), each ratio its own. **Reset to estimate** goes back. Each label sits under its card, or on it at its bottom, middle or top (Settings → **Label**).

## When the labels go

The game sends nothing when the shop closes. The labels go on:

- **Esc**, or a left click on the shop's X or Exit button (meter 2.0.89 or newer, `events:input`: while the labels show, the plugin marks parts of the game's window as zones, and hears only "Esc" or which zone a click was in, never where the mouse is);
- a click on a label, the Skins tab, a skill of yours, a soul for a pet that isn't on the list (buying one keeps them, with its new count), talking to an NPC, a new map, or 3 minutes after the last list.

A click on a card opens the game's purchase window over the labels, and one on its eye a preview page (it closes with Esc or its X, back to the shop): they step aside until it closes (Esc, its Cancel or X, or a purchase, which brings them back with the new count), and the shop stays open. With meter 2.0.89 or newer.

On an older meter all of these but Esc and the buttons still work, and the window says which meter is needed. The game's window position and size (the `game` event's `area`) also come with 2.0.89; before it, a 1920×1080 game at the top left is assumed.

## What it reads

| Decoder | Frame | What it reads |
|---|---|---|
| `pet-list`, `soul-gained`, `level-up`, `pet-unlocked` | `00 90`, `0D 90`, `14 90`, `09 90` | Your pets' levels and souls, and a pet a chest gives you, as Pet Soul Tracker 0.5.4 counts them (the same decoders). |
| `shop-list` | `91 56` | The merchant's list as you open a tab: which tab (first byte: `CC` Pets, `C9` Special, `CB` Skins) and how many cards, each card's product id and item id, and when the list refreshes. Nothing else of it (prices are skipped). The cards stand on screen in product id order. Read from captures at the merchant on all three tabs (2026-11-05). |
| `own-position` | `2A 38` | Pet Soul Tracker's decoder, with `"self"`: only records about your own character. Used only to see that you used a skill (kind `0x11` on yourself), which means you've left the shop. |
| `npc-talk` | `61 E2` | That you talked to an NPC (one number, not kept). |
| `zone` | `21 36` | That a map loaded (its id, not kept). |

The shop's item ids map to pet ids by name (the ids and English item names from aion2hub.com's item list; `tools/merchant-pets/build_data.py`); genus, names and soul drops come from Pet Soul Tracker's data. After that data changes: `python tools/merchant-pets/build_data.py`.

## Permissions

- `storage`: your pets' counts per server, your layouts, the label position, the language and the note setting.
- `events:character`: which server's counts to use.
- `window`, `widgets`: the labels, the align boxes and the note are the plugin's small windows.
- `events:input`: Esc, and clicks on the shop's X and Exit, its cards (the tick at the top of one does nothing here) and its purchase window's buttons, as above.

Nothing leaves your computer.
