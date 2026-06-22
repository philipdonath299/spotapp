# Statsify: AI Playlist Manager 🎵

Statsify is a powerful playlist management tool and AI-driven music discovery engine. Organize your library with advanced sorting, create custom playlists using AI, and discover physical media for your favorite music.

## Features
- **AI Magic**: Brainstorms song lists based on text prompts using Gemini 2.x/2.5.
- **Playlist Manager**: Advanced tools to sort, merge, split, and shuffle your existing playlists.
- **Vinyl Scanner**: Scan your liked songs to find albums you love that are available on vinyl.
- **Large Playlists**: Supports generating up to 80-100 songs with real-time progress tracking.
- **Save to Library**: Effortlessly create a new Spotify playlist with all your discoveries in one click.
- **Premium UI**: Clean, dark-mode focused experience.

## Getting Started Locally

1. **Clone the repository**:
   ```bash
   git clone [your-repo-url]
   cd statsify
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Spotify**:
   - Create a developer app at [developer.spotify.com](https://developer.spotify.com).
   - Add `http://localhost:5173/callback` as a Redirect URI.
   - Create a `.env` file:
     ```env
     VITE_SPOTIFY_CLIENT_ID=your_client_id_here
     VITE_GEMINI_API_KEY=your_gemini_api_key_here
     ```

4. **Run**:
   ```bash
   npm run dev
   ```

## Cloud Storage (GitHub)
Store your code on GitHub to keep it safe and enable one-click deployments. See [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions.
