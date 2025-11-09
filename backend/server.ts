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
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
