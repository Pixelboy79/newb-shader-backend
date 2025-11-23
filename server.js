const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Enable CORS so your app can talk to this server
app.use(cors());

// --- CONFIGURATION ---
// Replace with your actual GitHub username and repo name
const GITHUB_BASE_URL = "https://raw.githubusercontent.com/BRSolanki/newbShaderTestApp/main";

// --- CACHE (Simple In-Memory) ---
// Prevents hitting GitHub limits by storing data for 5 minutes
let cache = {
  data: null,
  lastFetch: 0
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// --- HELPER: FETCH DATA ---
async function getRepositoryData() {
  const now = Date.now();
  
  // Return cached data if valid
  if (cache.data && (now - cache.lastFetch < CACHE_DURATION)) {
    return cache.data;
  }

  console.log("Fetching fresh data from GitHub...");

  try {
    // 1. Fetch the main lists in parallel
    const [shadersRes, devListRes] = await Promise.all([
      axios.get(`${GITHUB_BASE_URL}/shader-list-testing.json`),
      axios.get(`${GITHUB_BASE_URL}/developer-list-testing.json`)
    ]);

    const shaders = shadersRes.data;
    const devMap = devListRes.data; // e.g., { "0": "0_devendrn.json" }

    // 2. Fetch individual developer details
    // We create an array of promises to fetch all dev files at once
    const devPromises = Object.entries(devMap).map(async ([id, filename]) => {
      try {
        const devRes = await axios.get(`${GITHUB_BASE_URL}/developers/${filename}`);
        return { id: id, ...devRes.data }; // Merge ID into the data
      } catch (e) {
        console.error(`Failed to fetch dev ${filename}`, e.message);
        return null;
      }
    });

    const developersRaw = await Promise.all(devPromises);
    const developers = developersRaw.filter(d => d !== null); // Remove failed fetches

    // 3. Update Cache
    cache.data = { shaders, developers };
    cache.lastFetch = now;

    return cache.data;

  } catch (error) {
    console.error("Error fetching from GitHub:", error.message);
    throw new Error("Failed to sync with repository");
  }
}

// --- ENDPOINT: GET ALL DATA ---
app.get('/api/sync', async (req, res) => {
  try {
    const data = await getRepositoryData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

// --- ENDPOINT: SEARCH & FILTER ---
// Example: /api/shaders?tag=Ultra&q=Refined
app.get('/api/shaders', async (req, res) => {
  try {
    const { shaders } = await getRepositoryData();
    const { q, tag, platform } = req.query;

    let results = shaders;

    // Filter by Search Query
    if (q) {
      const lowerQ = q.toLowerCase();
      results = results.filter(s => s.title.toLowerCase().includes(lowerQ));
    }

    // Filter by Tag (Mocking tags since they aren't in your raw JSON yet)
    // In real implementation, ensure your JSON has "tags" array
    if (tag && tag !== 'All') {
       // This mimics the frontend logic you had
       results = results.filter(s => s.tags && s.tags.includes(tag));
    }

    // Filter by Platform
    if (platform) {
      results = results.filter(s => s.platforms && s.platforms.includes(platform.toUpperCase()));
    }

    res.json(results);

  } catch (error) {
    res.status(500).json({ error: "Search Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));