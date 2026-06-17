# Yoga Circuit

A web app (installable PWA) for building timed yoga circuits from your pose cards.
Pick cards, sequence them, set hold times, and run a full-screen timed flow.

## Tech
Vite + React + Tailwind + lucide-react, with PWA support (installs to your phone,
works offline once loaded).

## Deploy (GitHub -> Netlify, no terminal needed)

1. Create a new repository on GitHub (e.g. "yoga-circuit").
2. On the repo page: **Add file -> Upload files**. Drag in EVERYTHING from this
   folder EXCEPT `node_modules` (there is none here) — that means: the `public`
   and `src` folders, plus `index.html`, `package.json`, `vite.config.js`,
   `tailwind.config.js`, `postcss.config.js`, `netlify.toml`, `.gitignore`,
   `README.md`. Commit.
3. Go to **netlify.com -> Add new site -> Import an existing project -> GitHub**,
   and pick the repo.
4. Netlify auto-detects the settings from `netlify.toml`
   (build command `npm run build`, publish directory `dist`). Click **Deploy**.
5. Wait ~1-2 min. Your site is live at a `*.netlify.app` URL.

From then on, any change you commit to GitHub redeploys automatically.

## Add more cards later

1. Put the card image in `public/cards/` (e.g. `card-83.jpg`).
2. Add a line to the `DECK` array in `src/deck.js`:
   `{"name":"Pose Name","group":"slate","img":"cards/card-83.jpg"}`
   (group must be one of the keys in `GROUPS`: cream, coral, crimson, slate, indigo, teal)
3. Commit. Netlify redeploys.

You can also add cards from inside the app (the **Add** button opens the
crop & straighten tool); those are saved in your browser.

## Run locally (optional, needs Node.js)
```
npm install
npm run dev
```
