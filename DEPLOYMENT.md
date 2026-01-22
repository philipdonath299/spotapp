# Deployment & Cloud Storage Guide

## Step 0: Storing Code in the Cloud (GitHub)

**Note:** If you don't have Git installed, download it here: [git-scm.com/download/win](https://git-scm.com/download/win) (Choose the "64-bit Git for Windows Setup").

Before hosting, you should store your code on GitHub. This keeps it safe and makes updates easy.

1.  Go to [GitHub.com](https://github.com) and create a new repository called `statsify`.
2.  In your terminal, run these commands:
    ```bash
    git init
    git add .
    git commit -m "Initial commit - Statsify"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/statsify.git
    git push -u origin main
    ```
    *(Replace YOUR_USERNAME with your actual GitHub username)*

---

## Step 1: Host the Website (Recommended: Vercel)

Vercel is the easiest way to host a React app. It's free and takes 2 minutes.

1.  Open your terminal in the project folder.
2.  Run:
    ```bash
    npm install -g vercel
    vercel
    ```
3.  Follow the prompts (Log in if needed).
4.  Once finished, Vercel will give you a **Production URL** (e.g., `https://statsify-yourname.vercel.app`).
5.  **Important**: In the Vercel Dashboard for your project, go to **Settings > Environment Variables** and add:
    *   `VITE_SPOTIFY_CLIENT_ID` = `[Your Client ID]`
    *   `VITE_REDIRECT_URI` = `https://your-app-url.vercel.app/callback`

---

## Step 2: Update Spotify Developer Dashboard

Spotify's security requires you to whitelist your new public URL.

1.  Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2.  Select your App.
3.  Click **Settings**.
4.  Under **Redirect URIs**, add your new link: `https://your-app-url.vercel.app/callback`.
5.  Click **Save**.

---

## Step 3: Enabling Access for Others (IMPORTANT)

By default, Spotify apps are in "Development Mode". This means **only people you explicitly authorize can log in.**

### To let a specific friend use it:
1.  In your Spotify Dashboard app, go to **User Management**.
2.  Add your friend's **Name** and **Email address** (the one they use for Spotify).
3.  They can now log in to your app.

### To let *anyone* in the world use it:
1.  You must submit your app for **Extension Request** (Approval) by Spotify.
2.  Click **"Dashboard"** -> **"Settings"** -> **"User Management"** -> **"Request Extension"**.
3.  Spotify will review your app. Once approved, the whitelist is removed and anyone can log in.

---

## Alternative: Temporary Public Access (Localtunnel)
If you just want to show someone *right now* while your computer is on:
1.  Run `npm run dev` in one terminal.
2.  In another terminal, run: `npx localtunnel --port 5173`
3.  Give them the link it provides (Note: You still need to add this temporary link to your Spotify Redirect URIs).
