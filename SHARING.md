# Sharing Sprocket & Sprout with friends

The game is a static web page: one `index.html` plus one JavaScript file, with no server code. Anything that hosts static files can host it, and your friends only need a browser.

## 1. Build it

Double-click **`Package for web.bat`**. It:

1. runs the type checker and builds the game into `dist/`;
2. zips `dist/` into **`sprocket-and-sprout-web.zip`** (about 300 KB).

Or run the same steps from a terminal:

```bash
npm run build
```

> Rebuild and re-upload whenever you change the game. Friends get the new version the next time they open the page.

## 2. Pick where to put it

### Option A: itch.io (recommended)

itch.io is the usual home for indie browser games. It is free, it gives you a page with screenshots and a description, and it can keep the game private to the friends you invite.

1. Make a free account at https://itch.io and choose **Upload new project** (from the dashboard).
2. **Kind of project:** *HTML*.
3. **Uploads:** add `sprocket-and-sprout-web.zip`, then tick **"This file will be played in the browser"**.
4. **Embed options:**
   - Viewport: **1280 × 720**.
   - Turn on **Fullscreen button**.
   - Leave **Mobile friendly** off. The game needs a keyboard and mouse.
5. **Visibility:**
   - **Draft** while you test it yourself.
   - **Restricted** + a password, to share with only your friends.
   - **Public** when you're ready for everyone.
6. Save, open the page and play. Send your friends the link (and the password if it's restricted).

### Option B: GitHub Pages (free, automatic updates)

The repo includes `.github/workflows/deploy.yml`. On every push to `main` it runs the tests, builds the game and publishes it.

1. Create a repo and push. The GitHub CLI is already installed on this PC:

   ```bash
   gh repo create sprocket-and-sprout --public --source . --push
   ```

2. On GitHub, open **Settings → Pages → Source: GitHub Actions**.
3. Each push publishes the game at `https://<your-username>.github.io/sprocket-and-sprout/`.

This works because the build uses relative paths (`base: './'` in `vite.config.ts`).

### Option C: Netlify Drop (no account setup, 1 minute)

Go to https://app.netlify.com/drop and drag the **`dist` folder** onto the page. It gives you a link straight away. You need a free account to keep the link longer than an hour.

### Option D: same Wi-Fi only (no upload at all)

Run the dev server on your local network:

```bash
npm run dev -- --host
```

Vite prints a "Network" address such as `http://192.168.1.23:5173`, and friends on the same Wi-Fi open that address. If Windows Firewall asks, allow Node.js on **private** networks. The game stops when you close the terminal.

## Good to know

- **Saves live in each player's browser** (`localStorage` for that website), so every friend has their own farm. Saves don't move between browsers or computers. Use **Pause → Export save** and **Title → Import Save** to move a farm. Clearing site data deletes saves, so tell friends to export a backup now and then.
- An itch.io save and a GitHub Pages save are separate, because they are different websites.
- Achievements are kept per farm and also in a profile for the whole browser (also stored in `localStorage`).
- Supported browsers: recent Chrome, Edge and Firefox on desktop. Safari works but is less tested.
- The first click or key press turns the sound on, because browsers block audio until you interact with the page.
