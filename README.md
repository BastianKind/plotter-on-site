# plotter Studio

Clickable prototype of the third plotter variant for the M241/M245 user tests and the "Höhle der Löwen" pitch: the machine on site. The plotter comes along to a wedding, a fair booth or a company event, and this laptop app runs it. You design the card, fill in the guest list and the machine writes one card after the other, with a real pen. Nothing is really written: the machine, the USB/Wi-Fi connection and the writing are simulated.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5175 (the web shop uses 5173 and the kiosk 5174, so all three can run side by side). The app is made for a laptop or PC screen, at least about 1100 px wide.

## What you can click through

- **Projects:** three example projects (wedding place cards, graduation thank-you cards, fair name badges) and six templates (place cards, name badges, thank-you cards, envelopes, menu card, blank card).
- **Connect:** search for machines over USB and Wi-Fi, connect, see the status in the status bar. Writing pauses if the machine is disconnected.
- **Design:** drag and resize text and drawings on the card, change size and alignment, add one of 12 line drawings or draw your own. Undo and redo with Ctrl+Z / Ctrl+Y, nudge with the arrow keys. Choose paper, handwriting (Jamie, Noah, Lea or your own) and ink.
- **Fields:** put `{name}`, `{table}` or your own field into a text. The guest list gets a column for each field, and the preview steps through the guests.
- **Guest list:** type, paste lines straight from Excel, or import a CSV. Each guest shows if their card is written yet. A design without fields just asks how many copies.
- **Write:** a checklist before starting (machine connected, the right pen in, card in the corner guide, trace the edge). Then the machine view shows the pen writing card after card, with pause, skip, stop, a time estimate, "pause after each card" for feeding by hand, and "write one now" for guests who turn up on the day. It keeps going while you look at other pages.
- **Machine:** move the pen with the arrow pad or keyboard, lower and lift it, set the paper corner, change speed and pen lift, draw a test pattern, change the pen (guided), see how much of the pen is used up.
- **Settings:** teach the app your own handwriting by writing each letter once (all letters, or just the ones the open project needs).

Demo mode plays the writing 10 times faster than the real machine; "Real speed" shows how long it would really take. Reloading the page starts again with the example projects.

## Stack

React 18, TypeScript and Vite, no other libraries. The card renderer, the text layout and the handwriting pad are shared with the kiosk prototype, so a card looks the same in all three prototypes.

```
src/
  pages/        Projects, Design, Data (guest list), Write, Machine, Settings
  components/   window frame (title bar, sidebar, status bar), card renderer, writing pad, connect and pen-change pop-ups
  state/        store.tsx: projects, editor history, machine; run.tsx: the writing queue that runs in the background
  lib/          text layout and fields, drag maths, CSV import, timing
  data/         paper sizes, templates with example lists, handwriting styles and inks
```

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: type-check and build to `dist/`
- `npm run typecheck`: type-check only

`.github/workflows/deploy.yml` publishes the site to GitHub Pages on every push to `master`. In the repo settings, Pages has to use **GitHub Actions**, and the `github-pages` environment has to allow the `master` branch.
