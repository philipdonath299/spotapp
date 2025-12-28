// Utility for managing local listening history via IndexedDB
// Handles large datasets (lifetime history imports) that perform poorly in localStorage

const DB_NAME = 'statsify_db';
const DB_VERSION = 1;
const STORE_NAME = 'listening_history';

/**
 * Open the IndexedDB database
 */
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject('Database error: ' + event.target.errorCode);

        request.onsuccess = (event) => resolve(event.target.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                // Index for rapid queries
                objectStore.createIndex('artistName', 'artistName', { unique: false });
                objectStore.createIndex('trackName', 'trackName', { unique: false });
                objectStore.createIndex('endTime', 'endTime', { unique: false });
            }
        };
    });
};

/**
 * Generate a unique ID for a stream to prevent duplicates
 * Format: endTime_artistName_trackName
 */
const generateId = (item) => {
    // Standardize Spotify JSON vs API formats
    // JSON files usually have "endTime" (string), "artistName", "trackName"
    // API recently-played has .played_at, .track.artists[0].name, .track.name

    // Internal format for storage:
    // { id, endTime (ISO), artistName, trackName, msPlayed }

    const time = item.endTime || item.played_at;
    const artist = item.artistName || item.track?.artists?.[0]?.name || 'Unknown Artist';
    const track = item.trackName || item.track?.name || 'Unknown Track';

    // Sanitize for ID
    const cleanTime = new Date(time).getTime();
    const cleanArtist = artist.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTrack = track.replace(/[^a-zA-Z0-9]/g, '');

    return `${cleanTime}_${cleanArtist}_${cleanTrack}`;
};

/**
 * Convert API 'recently-played' item to DB format
 */
export const formatApiTrack = (apiItem) => {
    return {
        id: generateId({
            played_at: apiItem.played_at,
            track: apiItem.track
        }),
        endTime: apiItem.played_at,
        artistName: apiItem.track.artists[0].name,
        trackName: apiItem.track.name,
        msPlayed: apiItem.track.duration_ms, // Assume full play for API history
        source: 'api_sync'
    };
};

/**
 * Convert JSON import item to DB format
 */
export const formatJsonTrack = (jsonItem) => {
    const item = {
        endTime: jsonItem.endTime,
        artistName: jsonItem.artistName,
        trackName: jsonItem.trackName,
        msPlayed: jsonItem.msPlayed || 0,
        source: 'import'
    };
    item.id = generateId(item);
    return item;
};

/**
 * Batch add tracks to the database
 * Returns count of ANY newly added tracks
 */
export const addTracksToDb = async (tracks) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        let addedCount = 0;

        tracks.forEach(track => {
            // We use put() which overwrites if key exists, but since key is unique combo of time+track,
            // 'overwriting' effectively just deduplicates identical listen events.
            // To detect *new* items strictly we'd need get() first, but put() is faster for bulk.
            // For true 'new count', we can check existence, but it slows down imports of 10k+ items.
            // Strategy: Just put all.
            const request = store.put(track);
            request.onsuccess = () => { addedCount++; };
        });

        transaction.oncomplete = () => {
            resolve(addedCount);
        };

        transaction.onerror = (event) => {
            console.error('Transaction error:', event);
            reject('Error storing tracks');
        };
    });
};

/**
 * Get aggregated stats for Lifetime View
 * Heavily optimized to avoid loading all objects into memory at once if possible,
 * utilizing cursors.
 */
export const getLifetimeStats = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const artistStats = {};
        const trackStats = {};
        let totalMs = 0;
        let totalStreams = 0;
        let firstDate = new Date();
        let lastDate = new Date(0);

        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const track = cursor.value;

                // Update time range
                const currentPropsTime = new Date(track.endTime);
                if (currentPropsTime < firstDate) firstDate = currentPropsTime;
                if (currentPropsTime > lastDate) lastDate = currentPropsTime;

                // Only count significant plays (e.g. > 30 seconds)
                if (track.msPlayed > 30000) {
                    totalMs += track.msPlayed;
                    totalStreams++;

                    // Artist Aggregation
                    if (!artistStats[track.artistName]) {
                        artistStats[track.artistName] = { name: track.artistName, ms: 0, count: 0 };
                    }
                    artistStats[track.artistName].ms += track.msPlayed;
                    artistStats[track.artistName].count++;

                    // Track Aggregation
                    const trackKey = `${track.trackName} - ${track.artistName}`;
                    if (!trackStats[trackKey]) {
                        trackStats[trackKey] = { name: track.trackName, artist: track.artistName, ms: 0, count: 0 };
                    }
                    trackStats[trackKey].ms += track.msPlayed;
                    trackStats[trackKey].count++;
                }

                cursor.continue();
            } else {
                // Done iterating
                resolve({
                    totalMinutes: Math.floor(totalMs / 60000),
                    totalHours: Math.floor(totalMs / 3600000),
                    totalStreams,
                    firstDate: totalStreams > 0 ? firstDate : null,
                    lastDate: totalStreams > 0 ? lastDate : null,
                    topArtists: Object.values(artistStats).sort((a, b) => b.ms - a.ms).slice(0, 50),
                    topTracks: Object.values(trackStats).sort((a, b) => b.ms - a.ms).slice(0, 50)
                });
            }
        };

        request.onerror = () => reject('Failed to calculate stats');
    });
};

/**
 * Clear database
 */
export const clearDb = async () => {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
};
