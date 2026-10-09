# Sharing Sprocket & Sprout

There are three ways to get the game to people:

| | What people get | You run | Cost |
|---|---|---|---|
| **1. Your own website** | Play in the browser at your link, and press **Install** to keep it as an offline app | `Package for web.bat` | Free (a custom domain is about $10/year) |
| **2. A Windows download** | An installer `.exe` (Start menu + desktop shortcut) or a portable `.exe` | `Build desktop app.bat` | Free |
| **3. itch.io** | A game page with the browser version and/or the download | either | Free |

You can do all three. They are built from the same code.

---

## 1. Host your own website

The game is a static website: an `index.html`, one JavaScript file, icons, a web-app manifest and a
small offline service worker. It needs no server code, which means free static hosts work.

### Build it

Double-click **`Package for web.bat`**. You get:

- `dist/`: the website folder (upload its contents);
- `sprocket-and-sprout-web.zip`: the same thing zipped.

### Option A: GitHub Pages (recommended: free, updates on every push)

The repo already has `.github/workflows/deploy.yml`. It runs the tests, builds the game and publishes `dist/`.

1. Make a free account at https://github.com, then log the GitHub CLI in. It is already installed on this PC:

   ```bash
   gh auth login
   ```

2. Create the repo and push (from the project folder):

   ```bash
   gh repo create sprocket-and-sprout --public --source . --push
   ```

3. On github.com, open the repo and go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Wait about a minute (watch the **Actions** tab). The game is live at:

   `https://<your-github-username>.github.io/sprocket-and-sprout/`

5. To update it later, commit and push. The site rebuilds itself:

   ```bash
   git push
   ```

### Option B: Netlify or Cloudflare Pages (drag and drop, or connect the repo)

- **Netlify:** sign in at https://app.netlify.com, then **Add new site → Deploy manually**, and drag the `dist` folder in. Or connect your GitHub repo with build command `npm run build` and publish directory `dist`.
- **Cloudflare Pages:** at https://dash.cloudflare.com go to **Workers & Pages → Create → Pages**. Connect the repo or upload `dist`. Use the same settings: `npm run build`, output `dist`.

Both give you a free `something.netlify.app` / `something.pages.dev` address and HTTPS.

### Your own domain (optional, e.g. `sprocketandsprout.com`)

1. Buy a domain from Cloudflare Registrar, Porkbun or Namecheap (about $10-12/year).
2. In your host's settings, add the custom domain:
   - GitHub Pages: **Settings → Pages → Custom domain**.
   - Netlify / Cloudflare Pages: **Domains**.
3. The host tells you which DNS records to add at your registrar (usually a `CNAME` to the host's address). HTTPS is set up automatically within an hour or so.

### "Install" from the website

Anyone who opens your site in Chrome or Edge can install the game like an app:
- a green **Install as an app** button appears on the title screen;
- or they can use the install icon in the address bar.

It then gets its own window, a Start-menu/desktop icon, and it **works offline**. This needs HTTPS,
which all the hosts above provide. On iPhone/iPad, Safari's **Share → Add to Home Screen** does the
same, but the game needs a keyboard and mouse.

---

## 2. A downloadable Windows app

### Build it

Double-click **`Build desktop app.bat`** (or run `npm run dist:win`). After a minute the `release` folder holds:

- **`Sprocket-and-Sprout-Setup-1.0.0.exe`**: a normal installer (about 80 MB). It asks where to install and adds Start-menu and desktop shortcuts. It uninstalls from Windows Settings like any app.
- **`Sprocket-and-Sprout-Portable-1.0.0.exe`**: one file that runs without installing. Good for a USB stick.

It's the same game in its own window (press F11 for fullscreen). Saves are stored per Windows user,
and you can move them with **Pause → Export save** / **Import Save**.

To run the desktop version straight from the code without building an installer: `npm run desktop`.

### Where to put the download

- **GitHub Releases (free, recommended).** On your repo page, go to **Releases → Draft a new release**.
  Tag it `v1.0.0`, drag in the Setup (and Portable) `.exe`, and publish. Link people to
  `https://github.com/<you>/sprocket-and-sprout/releases/latest`. From the terminal:

  ```bash
  gh release create v1.0.0 "release/Sprocket-and-Sprout-Setup-1.0.0.exe" "release/Sprocket-and-Sprout-Portable-1.0.0.exe" --title "Sprocket & Sprout 1.0" --notes "First release"
  ```

- **Your website.** Put a "Download for Windows" link on your site that points at the GitHub release, so you don't serve 80 MB files yourself.
- **itch.io.** It accepts `.exe` downloads too, and its free "itch app" can keep installs updated.
- **Google Drive / Dropbox.** Fine for a few friends: share the Setup `.exe` link.

### The "Windows protected your PC" warning

The installer isn't *code-signed*. Signing certificates cost money, roughly $100-400 a year, or about
$10/month for Azure Trusted Signing. So the first time someone runs it, Windows SmartScreen shows a
blue box. They click **More info → Run anyway**. Tell your friends in advance; it's normal for indie
downloads. If you sell the game later, buy signing, or ship on Steam or itch, which friends trust more.

### Releasing an update

1. Change `"version"` in `package.json` (e.g. `1.0.1`).
2. Run `Build desktop app.bat`.
3. Upload the new Setup `.exe` as a new GitHub release.

Installing over the old version keeps the player's saves.

### Mac and Linux

`electron-builder` can also make a Mac `.dmg` and a Linux `.AppImage` (configured in `package.json`),
but each has to be built on that system (`npx electron-builder --mac` on a Mac,
`npx electron-builder --linux` on Linux). The website version already works on every platform, so
for Mac and Linux friends, just send the link.

---

## 3. itch.io (optional)

1. Make a free account at https://itch.io and choose **Upload new project**.
2. Pick **Kind of project: HTML**.
3. Upload `sprocket-and-sprout-web.zip` and tick **"This file will be played in the browser"**. Set the viewport to 1280 × 720 and turn on the **Fullscreen button**.
4. Optionally also upload the Setup `.exe` as a Windows download.
5. Set visibility to **Draft** (just you), **Restricted** + password (friends), or **Public**.

---

## Good to know

- **Saves live with the player:**
  - On the website, saves sit in that browser for that site.
  - In the desktop app, saves are per Windows user.
  - They don't sync between the two. **Export / Import save** moves a farm, and players should export a backup now and then.
- **The first click or key turns the sound on**, because browsers block audio until you interact.
- **Browsers:** recent Chrome, Edge or Firefox on desktop. Safari works but is less tested.
- **Publishing makes the game public.** Once it's on a public site or a public GitHub repo, anyone with the link can play (and see the code, if the repo is public). Use a private repo plus Netlify or Cloudflare if you'd rather keep the code private.
