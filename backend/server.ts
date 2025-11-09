import express, { type Request, type Response } from "express";
import axios from "axios";
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import cors from "cors";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, 'cache');

const TOKEN = process.env.apify_token;
const ACTOR = process.env.apify_actor;

const genAI = new GoogleGenerativeAI(process.env.gemini_api_key || "");

let supabase: SupabaseClient | null = null;

const app = express();
app.use(express.json());
app.use(cors());

const client = new ApifyClient({
    token: TOKEN || "",
});

// Cache management functions
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`Created cache directory: ${CACHE_DIR}`);
  }
}

function getCacheFilePath(key: string): string {
  const sanitizedKey = key.replace(/[^a-z0-9_-]/gi, '_');
  return path.join(CACHE_DIR, `${sanitizedKey}.json`);
}

function getCachedData(key: string, ttlMs: number = 3600000): any | null {
  try {
    const cacheFile = getCacheFilePath(key);
    
    if (!fs.existsSync(cacheFile)) {
      console.log(`No cache file found for ${key}`);
      return null;
    }
    
    const stats = fs.statSync(cacheFile);
    const age = Date.now() - stats.mtimeMs;
    
    const data = fs.readFileSync(cacheFile, 'utf-8');
    console.log(`Using cached data for ${key} (age: ${Math.round(age / 1000)}s)`);
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return null;
  }
}

function saveCachedData(key: string, data: any): void {
  try {
    ensureCacheDir();
    const cacheFile = getCacheFilePath(key);
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved cache for ${key}`);
  } catch (error) {
    console.error(`Error saving cache for ${key}:`, error);
  }
}

// Connect to Supabase
async function connectSupabase(): Promise<SupabaseClient | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.warn('Supabase credentials not configured. Running without database.');
    return null;
  }

  try {
    const client = createClient(url, key);
    console.log('Connected to Supabase database');
    return client;
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return null;
  }
}

const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function scrapeTrends(): Promise<string[]> {
  const cacheKey = 'trends_us';
  const cacheTTL = 900000; // 15 minutes

  const cachedTrends = getCachedData(cacheKey, cacheTTL);
  if (cachedTrends) {
    console.log('Returning cached trends data');
    return cachedTrends;
  }

  try {
    console.log('Scraping fresh trends data from Trends24...');
    const url = "https://trends24.in/united-states/";
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    const response = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);

    const trendLinks: string[] = [];
    $("span.trend-name a.trend-link").each((_, el) => {
      const trend = $(el).text().trim();
      if (trend && trend.length > 0) {
        trendLinks.push(trend);
      }
    });

    const trends = trendLinks.slice(0, 50);
    console.log(`Scraped ${trends.length} trends from Trends24`);

    saveCachedData(cacheKey, trends);

    return trends;
  } catch (error) {
    console.error("Error scraping trends from Trends24:", error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return [];
  }
}

app.get("/api/trends", async (_req: Request, res: Response) => {
  try {
    const cachedTrends = getCachedData('trends_us');
    if (cachedTrends) {
      return res.json(cachedTrends.slice(0, 25));
    }

    const topics = await scrapeTrends();
    res.json(topics.slice(0, 25));
  } catch (err) {
    console.error("/api/trends error:", err);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

app.get("/api/flattened", async (_req: Request, res: Response) => {
  try {
    const cachedTrends = getCachedData('trends_us');
    if (cachedTrends && Array.isArray(cachedTrends)) {
      let allTweets: any[] = [];

      for (const topic of cachedTrends) {
        const cacheKey = `tweets_${topic}`;
        const cachedTopicTweets = getCachedData(cacheKey);

        if (cachedTopicTweets && Array.isArray(cachedTopicTweets)) {
          const mapped = cachedTopicTweets.map((tweet: any) => {
            const lat = tweet.location?.coordinates?.[1] ?? 0;
            const lon = tweet.location?.coordinates?.[0] ?? 0;
            const text = tweet.text ?? "";
            const author = tweet.author?.userName ?? tweet.author?.name ?? "unknown";
            const location = tweet.location ?? "";

            return { topic, lon, lat, text, author, location };
          });
          allTweets = allTweets.concat(mapped);
        }
      }

      const filtered = allTweets.filter(item => {
        return typeof item.lat === 'number' && typeof item.lon === 'number' &&
               !isNaN(item.lat) && !isNaN(item.lon) &&
               item.lat !== 0 && item.lon !== 0 &&
               Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180;
      });

      console.log(`All topics: Serving ${filtered.length} tweets from cache`);
      return res.json(filtered);
    }

    if (!supabase) return res.status(500).json({ error: "Database not connected"});

    const { data: rows, error } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = (rows || []).map((r: any) => {
      const lat = r.latitude ?? 0;
      const lon = r.longitude ?? 0;
      const text = r.content ?? "";
      const author = r.username ?? "unknown";
      const topic = r.topic ?? "";
      const location = r.location ?? "";

      return { topic, lon, lat, text, author, location };
    }).filter(item => {
      return typeof item.lat === 'number' && typeof item.lon === 'number' &&
             !isNaN(item.lat) && !isNaN(item.lon) &&
             item.lat !== 0 && item.lon !== 0 &&
             Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180;
    });

    console.log(`All topics: Found ${rows?.length || 0} total tweets, ${mapped.length} with valid coordinates`);
    res.json(mapped);
  } catch (err) {
    console.error("/api/flattened error:", err);
    res.status(500).json({ error: "Failed to fetch all tweets" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop');
  
  // Initialize Supabase connection
  connectSupabase().then(client => {
    supabase = client;
  });
});
