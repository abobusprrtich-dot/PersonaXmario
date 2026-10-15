# Super Dilyor — an interactive pixel CV

Dilyorbek Esonboyev's CV as a Mario-style (but original) 2D pixel platformer.

- **Green pipes = CV chapters.** Stand on a pipe and press **↓** to drop into its room.
  Each room is split into parts — bump the **!** blocks to read them.
- **3 worlds:** 1-1 Guliston Fields · 2-1 Circuit Cavern · 3-1 Comet Heights
- **Final boss:** King Bugzer, the final bug. Stomp him, zap him with Uno bolts, or hit the switch behind him.
- Certificates (Purple Comet, Mirzo Ulugbek Vorislari, IdeaThon) are pixelated and shown in the *Hall of Honors* pipe.
- Don't want to play? Hit **📜 CV mode** for the plain version.
- **Retro screen:** a CRT monitor with scanlines on desktop, and a handheld with an LCD pixel grid on phones.
  Switch between CRT / LCD / CLEAN with the screen button or **V**. Tap the *DILYOR BOY COLOR* logo to change the shell colour.

| Chapter | World |
| --- | --- |
| 1 About · 2 Education · 3 Skills | 1-1 |
| 4 Arduinium · 5 Hardware Lab · 6 Experience | 2-1 |
| 7 Honors · 8 Leadership | 3-1 |

## Controls

| Action | Keyboard | Handheld (phone) |
| --- | --- | --- |
| Move | ← → / A D | D-pad (slide your thumb) |
| Jump (hold = higher) | Space / Z / ↑ / W | A |
| Run / shoot bolts (with Uno power) | X / J / Shift | B (rest your thumb between A and B to press both) |
| Enter pipe | ↓ / S | D-pad ↓ |
| Read the ! block above you | E | D-pad ↑ or jump into it |
| Pause · CV mode | Esc · C | START · SELECT |
| Mute · screen effect | M · V | buttons under the screen |

## Run it

Plain HTML/JS, no build step:

```bash
npx serve .        # or: python3 -m http.server
```

Deploys as-is to Vercel / GitHub Pages / Netlify (static site, `index.html` at the root).

## Editing content

All CV text lives in `js/content.js` — one entry per pipe, one `parts` item per ! block.
Levels are in `js/levels.js` (small builder API), sprites are drawn in code in `js/sprites.js`.

## Files

```
index.html          page + overlays
css/style.css       pixel UI
js/content.js       CV data
js/font.js          5x7 bitmap font
js/sprites.js       characters, items, boss
js/tiles.js         dithered tiles, decorations, parallax backgrounds
js/audio.js         chiptune SFX + music (WebAudio)
js/input.js         keyboard + touch
js/levels.js        worlds 1-1, 2-1, 3-1, boss castle, pipe rooms
js/world.js         tiles, collision, rendering
js/entities.js      player, enemies, items, King Bugzer
js/game.js          game flow, HUD, overlays, main loop
assets/certs/       pixelated certificates
```
