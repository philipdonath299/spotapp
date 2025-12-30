export const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/callback`;

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-top-read",
  "user-read-recently-played",
  "user-follow-read",
  "user-library-modify"
].join(" ");

/**
 * Generates a random string for the code verifier
 */
function generateRandomString(length) {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Generates the code challenge from the code verifier
 */
async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 *Redirects user to Spotify Authorization Page
 */
export async function redirectToAuthCodeFlow() {
  const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

  if (!CLIENT_ID) {
    alert("❌ Vercel Deployment Error: VITE_SPOTIFY_CLIENT_ID is not found.");
    return;
  }

  const verifier = generateRandomString(128);
  localStorage.setItem("verifier", verifier);

  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("response_type", "code");
  params.append("redirect_uri", REDIRECT_URI);
  params.append("scope", SCOPES);
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Gets the access token given the authorization code
 */
export async function getAccessToken(code) {
  const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", REDIRECT_URI);
  params.append("code_verifier", verifier);

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const data = await result.json();
  if (data.access_token) {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    // Store timestamp to check expiry later if needed
    localStorage.setItem("token_timestamp", Date.now());
  }
  return data;
}

/**
 * API Fetch Helper
 */
export async function spotifyFetch(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem("access_token");
  if (!token) return null;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, options);

  // Handle Token Expiry
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Token expired. Redirecting to login...");
  }

  // Handle Rate Limiting
  if (res.status === 429) {
    throw new Error(`Rate limit exceeded. Retry after ${res.headers.get('Retry-After') || 60} seconds.`);
  }

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API Error ${res.status} on ${endpoint}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}
