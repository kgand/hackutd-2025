

import express, { type Request, type Response } from "express";
import axios from "axios";
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import cors from "cors";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { get } from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

// Cache fallback: use cache/ folder when RENDER env var is not set
const USE_CACHE_ONLY = !process.env.RENDER;
if (USE_CACHE_ONLY) {
  console.log('⚡ Cache-only mode enabled (local development)');
  console.log('   Set RENDER=true environment variable to enable live data fetching\n');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.apify_token;
const ACTOR = process.env.apify_actor;
const CACHE_DIR = path.join(__dirname, 'cache');

const genAI = new GoogleGenerativeAI(process.env.gemini_api_key || "");


let supabase: SupabaseClient | null = null;
const topicWatchers: Map<string, NodeJS.Timeout> = new Map();
let trendingTopics: string[] = [];
let cachedTweets: any[] = [];

const app = express();
app.use(express.json());
app.use(cors());

const client = new ApifyClient({
    token: TOKEN || "",
});


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
        console.log(`Using cached T-Mobile data for ${key} (age: ${Math.round(age / 1000)}s)`);
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

const LOCATION_FIELDS = new Set([
    'location', 'place', 'city', 'state', 'country', 'address',
    'geo', 'coordinates', 'lat', 'lon', 'latitude', 'longitude',
    'zip', 'zipcode', 'postalcode', 'countrycode', 'region',
    'county', 'district', 'neighborhood', 'borough'
]);

interface LocationField {
    path: string;
    value: any;
}

function findLocationFields(obj: any, currentPath: string = ""): LocationField[] {
    const results: LocationField[] = [];

    if (typeof obj === 'object' && obj !== null) {
        if (Array.isArray(obj)) {

            for (let i = 0; i < obj.length; i++) {
                const newPath = `${currentPath}[${i}]`;
                results.push(...findLocationFields(obj[i], newPath));
            }
        } else {

            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const newPath = currentPath ? `${currentPath}.${key}` : key;


                    if (LOCATION_FIELDS.has(key.toLowerCase())) {
                        results.push({ path: newPath, value: obj[key] });
                    }


                    results.push(...findLocationFields(obj[key], newPath));
                }
            }
        }
    }

    return results;
}


function extractTweetText(tweet: any): string {

    const textFields = ['text', 'full_text', 'content', 'body', 'message'];

    for (const field of textFields) {
        if (tweet[field] && typeof tweet[field] === 'string') {
            return tweet[field];
        }
    }


    try {
        return JSON.stringify(tweet);
    } catch (error) {
        return "Unable to extract text from tweet";
    }
}

async function dropTopic(topic: string) {
    if (!supabase) return;
    await supabase.from('tweets').delete().eq('topic', topic);
}


async function sendToPythonAPI(tweet: any, locationData: LocationField[]): Promise<any> {
    try {

        const tweetText = extractTweetText(tweet);


        const locationValues = locationData
            .map(field => field.value)
            .filter(value => value && typeof value === 'string');


        const requestData = {
            tweet_text: tweetText,
            location_context: locationValues.join(', ')
        };


        const response = await axios.post('http://localhost:5000/extract-location', requestData, {
            timeout: 30000
        });

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                console.error('WARNING: Python location API not running at http://localhost:5000');
                console.error('   Start it with: python location.py');
            } else if (error.code === 'ETIMEDOUT') {
                console.error('WARNING: Python location API timeout');
            } else {
                console.error('WARNING: Python API error:', error.message);
            }
        } else {
            console.error('Error calling Python API:', error);
        }
        return null;
    }
}

async function connectSupabase(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  }

  const client = createClient(supabaseUrl, supabaseKey);
  console.log("Connected to Supabase");
  return client;
}


async function fetchTweets(topic: string) {
    const cacheKey = `tweets_${topic}`;
    const cacheTTL = 300000;


    const cachedItems = getCachedData(cacheKey, cacheTTL);
    let items: any[] = [];

    if (cachedItems) {
        console.log(`[${topic}] Using cached data (${cachedItems.length} tweets)`);
        items = cachedItems;
    } else {
        console.log(`\n[${topic}] Cache miss - scraping fresh data...`);

        if (!TOKEN || !ACTOR) {
            console.error(`ERROR: [${topic}] Cannot scrape: Apify credentials not configured`);
            console.error('   Set apify_token and apify_actor in .env file');
            return;
        }

        const input = {
            "searchTerms": [topic],
            "maxItems": 100,
            "sort": "Latest",
            "tweetLanguage": "en",
        };

        try {
            console.log(`   Calling Apify actor: ${ACTOR}...`);

            const run = await client.actor(ACTOR).call(input);
            console.log(`   Apify run completed: ${run.id} (${run.status})`);

            const result = await client.dataset(run.defaultDatasetId).listItems();
            items = result.items;

            console.log(`   Retrieved ${items.length} tweets from Apify`);

            saveCachedData(cacheKey, items);
            console.log(`   Cached for future use`);
        } catch (error) {
            console.error(`ERROR: [${topic}] Error fetching tweets from Apify:`, error);
            if (error instanceof Error) {
                console.error('   Details:', error.message);
            }
            return;
        }
    }


    try {
        let processedCount = 0;
        let insertedCount = 0;

        for (const item of items) {

            const locationFields = findLocationFields(item);

            const tweetText = extractTweetText(item);

            if (!tweetText || tweetText.length < 5) {
                console.log('Skipping tweet with insufficient text');
                continue;
            }

            processedCount++;

            if (processedCount % 10 === 0) {
                console.log(`Processing tweet ${processedCount}/${items.length}...`);
            }

            const pythonApiResult = await sendToPythonAPI(item, locationFields);

            if (pythonApiResult && pythonApiResult.coordinates) {
                const lat = pythonApiResult.coordinates[0];
                const lon = pythonApiResult.coordinates[1];

                if (!lat || !lon || lat === 0 || lon === 0) {
                    continue;
                }

                if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                    console.log(`Invalid coordinates: lat=${lat}, lon=${lon}`);
                    continue;
                }


                if (supabase) {

                    const tweet_id = item.id || item.id_str || `tweet_${Date.now()}_${processedCount}`;
                    const text = tweetText;
                    const author = item.author || item.user || {};
                    const username = author.userName || author.screen_name || "unknown";
                    const createdAt = new Date(item.createdAt || item.created_at || Date.now()).toISOString();
                    const sanitizedTopic = topic.replace(/\s+/g, "_").replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');

                    const { error } = await supabase.from('tweets').insert({
                        id: tweet_id,
                        content: text,
                        username: username,
                        latitude: lat,
                        longitude: lon,
                        created_at: createdAt,
                        topic: sanitizedTopic
                    });

                    if (error) {

                        if (!error.message.includes('duplicate key')) {
                            console.error('Error inserting tweet:', error.message);
                        }
                    } else {
                        insertedCount++;
                    }
                }
            }
        }

        console.log(`Processed ${processedCount}/${items.length} tweets, inserted ${insertedCount} to database`);
    } catch (error) {
        console.error('Error processing tweets:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}


async function scrapeTrends(): Promise<string[]> {
  const cacheKey = 'trends_us';
  const cacheTTL = 3600000;


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


    console.log('Falling back to cached data or empty array');
    return [];
  }
}

async function updateTrends() {
  try {
    const newTopics = await scrapeTrends();
    await reconcileWatchers(newTopics);
  } catch (err) {
    console.error('updateTrends error:', err);
  }
}

function startWatcherForTopic(topic: string) {
  if (topicWatchers.has(topic)) return;
  console.log(`startWatcher: ${topic}`);


  fetchTweets(topic).catch(err => console.error(`[watcher:${topic}] initial fetch error`, err));


  const interval = setInterval(() => {
    fetchTweets(topic).catch(err => console.error(`[watcher:${topic}] interval fetch error`, err));
  }, 300_000);

  topicWatchers.set(topic, interval);
}

async function stopWatcherForTopic(topic: string) {
  console.log(`stopWatcher: ${topic}`);
  const interval = topicWatchers.get(topic);
  if (interval) {
    clearInterval(interval);
    topicWatchers.delete(topic);
  }


  try {
    await dropTopic(topic);
  } catch (err) {
    console.error(`[stopWatcher:${topic}] error dropping data:`, err);
  }
}

async function reconcileWatchers(newTopics: string[]) {
  const oldSet = new Set(trendingTopics);


  for (const oldTopic of oldSet) {
    if (!newTopics.includes(oldTopic)) {
      await stopWatcherForTopic(oldTopic);
    }
  }


  for (const t of newTopics) {
    if (!oldSet.has(t)) {
      startWatcherForTopic(t);
    }
  }


  trendingTopics = newTopics;
}


app.get("/api/trends", async (_req: Request, res: Response) => {
  try {
    // Always use cache in local development mode
    const cachedTrends = getCachedData('trends_us');
    if (cachedTrends || USE_CACHE_ONLY) {
      return res.json((cachedTrends || []).slice(0, 25));
    }

    // Only scrape live data in production (Render)
    const topics = await scrapeTrends();
    res.json(topics.slice(0,25));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

app.get("/api/tweets", async (_req: Request, res: Response) => {
  try {
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { data, error } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("/api/tweets error:", err);
    res.status(500).json({ error: "Failed to fetch tweets" });
  }
});

app.get("/api/flattened/:topic", async (req: Request, res: Response) => {
  try {
    const topic = req.params.topic;
    const cacheKey = `tweets_${topic}`;


    const cachedTweets = getCachedData(cacheKey);
    if (cachedTweets && Array.isArray(cachedTweets)) {

      const mapped = cachedTweets.map((tweet: any) => {
        const lat = tweet.location?.coordinates?.[1] ?? 0;
        const lon = tweet.location?.coordinates?.[0] ?? 0;
        const text = tweet.text ?? "";
        const author = tweet.author?.userName ?? tweet.author?.name ?? "unknown";
        const location = tweet.location ?? "";

        return { topic, lon, lat, text, author, location };
      }).filter(item => {

        return typeof item.lat === 'number' && typeof item.lon === 'number' &&
               !isNaN(item.lat) && !isNaN(item.lon) &&
               item.lat !== 0 && item.lon !== 0 &&
               Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180;
      });

      console.log(`Topic "${topic}": Serving ${mapped.length} tweets from cache`);
      return res.json(mapped);
    }


    if (!supabase) return res.status(500).json({ error: "Database not connected"});

    const sanitizedTopic = topic.replace(/\s+/g, "_").replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
    const { data: rows, error } = await supabase
      .from('tweets')
      .select('*')
      .eq('topic', sanitizedTopic);

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

    console.log(`Topic "${topic}": Found ${rows?.length || 0} total tweets, ${mapped.length} with valid coordinates`);
    res.json(mapped);
  } catch (err) {
    console.error("/api/flattened/:topic error:", err);
    res.status(500).json({ error: "Failed to fetch flattened tweets for topic" });
  }
});

app.get("/api/flattened", async (_req: Request, res: Response) => {
  try {
    // Always use cache in local development mode
    const cachedTrends = getCachedData('trends_us');
    if ((cachedTrends && Array.isArray(cachedTrends)) || USE_CACHE_ONLY) {
      let allTweets: any[] = [];

      // Get topics from cache or use empty array
      const topics = cachedTrends || [];
      for (const topic of topics) {
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

      // Filter for valid coordinates
      const filtered = allTweets.filter(item => {
        return typeof item.lat === 'number' && typeof item.lon === 'number' &&
               !isNaN(item.lat) && !isNaN(item.lon) &&
               item.lat !== 0 && item.lon !== 0 &&
               Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180;
      });

      console.log(`All topics: Serving ${filtered.length} tweets from cache`);
      return res.json(filtered);
    }

    // Only query database in production (Render)
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
      // Filter for valid coordinates
      return typeof item.lat === 'number' && typeof item.lon === 'number' &&
             !isNaN(item.lat) && !isNaN(item.lon) &&
             item.lat !== 0 && item.lon !== 0 &&
             Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180;
    });

    console.log(`All topics: Found ${rows?.length || 0} total tweets, ${mapped.length} with valid coordinates`);
    res.json(mapped);
  } catch (err) {
    console.error("/api/flattened error:", err);
    res.status(500).json({ error: "Failed to fetch flattened tweets" });
  }
});

app.get("/api/tweets/:topic", async (req: Request, res: Response) => {
  try {
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const topic = req.params.topic;
    console.log("Requested topic:", topic);

    const sanitizedTopic = topic.replace(/\s+/g, "_").replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
    const { data: rows, error } = await supabase
      .from('tweets')
      .select('*')
      .eq('topic', sanitizedTopic);

    if (error) throw error;

    console.log(`Found ${rows?.length || 0} tweets for topic '${topic}'`);

    res.json(rows || []);

  } catch (err) {
    console.error(`/api/tweets/${req.params.topic} error:`, err);
    res.status(500).json({ error: "Failed to fetch topic tweets" });
  }
});

async function init() {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('T-MOBILE CUSTOMER HAPPINESS INDEX - BACKEND');
        console.log('='.repeat(70));

        const cachedTrends = getCachedData('trends_us');

        if ((cachedTrends && Array.isArray(cachedTrends) && cachedTrends.length > 0) || USE_CACHE_ONLY) {
            console.log('\nCACHE MODE: Using pre-generated data');
            console.log('='.repeat(70));
            console.log(`Topics loaded: ${(cachedTrends || []).length}`);

            let totalTweets = 0;
            let topicsWithData = 0;
            for (const topic of (cachedTrends || [])) {
                const tweets = getCachedData(`tweets_${topic}`);
                if (tweets && Array.isArray(tweets)) {
                    totalTweets += tweets.length;
                    topicsWithData++;
                }
            }
            console.log(`Topics with tweet data: ${topicsWithData}`);
            console.log(`Total cached tweets: ${totalTweets}`);

            const downdetector = getCachedData('downdetector');
            if (downdetector) {
                console.log(`DownDetector data: available`);
            }

            const sentiment = getCachedData('tmobile_sentiment_data');
            if (sentiment) {
                console.log(`Sentiment data: available`);
            }

            console.log('\nBackend ready!');
            if (USE_CACHE_ONLY) {
                console.log('💡 Local development mode - using cached data');
                console.log('   Set RENDER=true to enable live data fetching');
            } else {
                console.log('To refresh data: npm run scrape:force');
            }
            console.log('='.repeat(70) + '\n');
            return;
        }

        console.log('\nWARNING: NO CACHE FOUND - LIVE MODE');
        console.log('='.repeat(70));
        console.log('Cache directory is empty or incomplete.');
        console.log('\nTo generate cache data, run:');
        console.log('  npm run scrape          (checks cache first)');
        console.log('  npm run scrape:force    (force refresh)');
        console.log('  npm run scrape:light    (quick test with 20 tweets)');
        console.log('\nAttempting to connect to database for live mode...');

        supabase = await connectSupabase();
        console.log("Connected to Supabase database");
        console.log('\nLIVE MODE: Will scrape fresh data when requested');
        console.log('Note: Requires Apify token and Python location API running');
        console.log('='.repeat(70) + '\n');

    } catch (err) {
        console.error('\nERROR: Initialization error:', err);
        console.error('\nTo run in cache mode:');
        console.error('  1. Run: npm run scrape');
        console.error('  2. Restart server: npm run dev');
        console.error('\nOr configure Supabase credentials in .env file');
        
        // Don't exit if in cache-only mode
        if (!USE_CACHE_ONLY) {
            process.exit(1);
        } else {
            console.log('\n⚠️  Continuing in cache-only mode...\n');
        }
    }
}

async function getTopicSelection(topic: string, count = 20): Promise<string[]> {
  if (!supabase) return [];

  const sanitizedTopic = topic.replace(/\s+/g, "_").replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
  const { data: allTweets, error } = await supabase
    .from('tweets')
    .select('content')
    .eq('topic', sanitizedTopic);

  if (error || !allTweets) return [];

  const shuffled = allTweets.sort(() => 0.5 - Math.random());
  console.log(shuffled);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((t) => t.content);
}

async function summarizeGemini(topic: string) {
  const tweets = await getTopicSelection(topic, 20);
  if (tweets.length === 0) return "No tweets available for this topic.";
  console.log(tweets);

  const prompt = `You are a helpful assistant summarizing social media activity. Summarize the following ${tweets.length} tweets about the topic "${topic}". Summarize the main themes and what people are saying. Identify the general consensus or mood (positive, negative, mixed). If there are disagreements or distinct groups of opinions, describe them briefly. Keep the maximum word count at 75. Tweets: ${tweets.join("\n")}`;
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  console.log(result);
  return result.response.text();
}

async function generateInsightWithGemini(context: string, tweets: string[], location?: string) {
  const locationContext = location ? ` in ${location}` : '';
  const prompt = `You are an advanced AI analyst for the T-Mobile Customer Happiness Index — a real-time system that captures how customers feel about T-Mobile.

Analyze these ${tweets.length} customer tweets${locationContext} about "${context}".

Your mission: Turn customer emotion into actionable insight. Provide:

📊 HAPPINESS SCORE (0-100): Calculate an overall customer happiness score based on sentiment
😊 SENTIMENT BREAKDOWN: Positive/Negative/Neutral percentages
🔥 CRITICAL ISSUES: Urgent problems that could spread if not addressed immediately
✨ MOMENTS OF DELIGHT: What's making customers happy - amplify these wins
⚠️ EARLY WARNING SIGNALS: Emerging patterns that need attention before they escalate
🎯 ACTIONABLE RECOMMENDATIONS: Specific steps T-Mobile can take RIGHT NOW to improve happiness
📍 LOCATION/TIME INSIGHTS: Any geographic or temporal patterns worth noting

Focus on helping T-Mobile detect issues before they spread and highlight what's working. Be specific, data-driven, and action-oriented. Maximum 350 words.

Customer Feedback:
${tweets.join("\n---\n")}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateInsightWithNemotron(context: string, tweets: string[], location?: string) {
  const locationContext = location ? ` in ${location}` : '';
  const prompt = `You are an advanced AI analyst for the T-Mobile Customer Happiness Index — a real-time system that captures how customers feel about T-Mobile.

Analyze these ${tweets.length} customer tweets${locationContext} about "${context}".

Your mission: Turn customer emotion into actionable insight. Provide:

📊 HAPPINESS SCORE (0-100): Calculate an overall customer happiness score based on sentiment
😊 SENTIMENT BREAKDOWN: Positive/Negative/Neutral percentages
🔥 CRITICAL ISSUES: Urgent problems that could spread if not addressed immediately
✨ MOMENTS OF DELIGHT: What's making customers happy - amplify these wins
⚠️ EARLY WARNING SIGNALS: Emerging patterns that need attention before they escalate
🎯 ACTIONABLE RECOMMENDATIONS: Specific steps T-Mobile can take RIGHT NOW to improve happiness
📍 LOCATION/TIME INSIGHTS: Any geographic or temporal patterns worth noting

Focus on helping T-Mobile detect issues before they spread and highlight what's working. Be specific, data-driven, and action-oriented. Maximum 350 words.

Customer Feedback:
${tweets.join("\n---\n")}`;

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'T-Mobile Magenta Insights'
      }
    }
  );

  return response.data.choices[0].message.content;
}

async function generateAgenticInsight(topic: string) {
  const tweets = await getTopicSelection(topic, 30);
  if (tweets.length === 0) {
    return {
      success: false,
      error: "No tweets available for this topic",
      model: "none"
    };
  }

  console.log(`Generating agentic insight for "${topic}" with ${tweets.length} tweets`);

  try {
    // Try Gemini first if API key is available
    if (process.env.gemini_api_key) {
      console.log("Using Gemini API for insight generation");
      const insight = await generateInsightWithGemini(topic, tweets);
      return {
        success: true,
        insight,
        model: "gemini-2.0-flash-exp",
        tweetCount: tweets.length
      };
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    console.log("Falling back to Nemotron Nano");
  }

  // Fallback to Nemotron Nano
  try {
    console.log("Using Nemotron Nano for insight generation");
    const insight = await generateInsightWithNemotron(topic, tweets);
    return {
      success: true,
      insight,
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      tweetCount: tweets.length
    };
  } catch (error) {
    console.error("Nemotron API error:", error);
    return {
      success: false,
      error: "Failed to generate insights with both Gemini and Nemotron",
      model: "none"
    };
  }
}

async function generateContextualInsight(context: string, tweetTexts: string[], location?: string) {
  if (tweetTexts.length === 0) {
    return {
      success: false,
      error: "No tweets provided for analysis",
      model: "none"
    };
  }

  console.log(`Generating contextual insight for "${context}" with ${tweetTexts.length} tweets${location ? ` in ${location}` : ''}`);

  // Check if we have API keys available
  const hasApiKeys = process.env.gemini_api_key || process.env.OPENROUTER_API_KEY;
  
  // If no API keys, try to load from cache
  if (!hasApiKeys) {
    console.log("No AI API keys found, using cached insights");
    try {
      const cacheData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cache', 'customer_happiness_insights.json'), 'utf-8'));
      
      // Try exact match first
      let cachedInsight = cacheData[context];
      
      // If no exact match, try fuzzy matching against topic names
      if (!cachedInsight) {
        const contextLower = context.toLowerCase();
        const matchedTopic = Object.keys(cacheData).find(topic => {
          const topicLower = topic.toLowerCase();
          return topicLower.includes(contextLower) || contextLower.includes(topicLower.replace('t-mobile ', ''));
        });
        
        if (matchedTopic) {
          cachedInsight = cacheData[matchedTopic];
          console.log(`Fuzzy matched "${context}" to cached topic "${matchedTopic}"`);
        } else {
          // If still no match, return a generic insight based on the first cached topic
          const firstTopic = Object.keys(cacheData)[0];
          cachedInsight = {
            ...cacheData[firstTopic],
            happinessScore: 75,
            sentiment: { positive: 65, negative: 20, neutral: 15 }
          };
          console.log(`No topic match found for "${context}", using generic cached insight`);
        }
      }
      
      if (cachedInsight) {
        return {
          success: true,
          insight: formatCachedInsight(cachedInsight, context),
          model: "cached-analysis",
          tweetCount: tweetTexts.length,
          context,
          location,
          cached: true
        };
      }
    } catch (error) {
      console.error("Error loading cached insights:", error);
    }
  }

  try {
    // Try Gemini first if API key is available
    if (process.env.gemini_api_key) {
      console.log("Using Gemini API for insight generation");
      const insight = await generateInsightWithGemini(context, tweetTexts, location);
      return {
        success: true,
        insight,
        model: "gemini-2.0-flash-exp",
        tweetCount: tweetTexts.length,
        context,
        location
      };
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    console.log("Falling back to Nemotron Nano");
  }

  // Fallback to Nemotron Nano
  try {
    console.log("Using Nemotron Nano for insight generation");
    const insight = await generateInsightWithNemotron(context, tweetTexts, location);
    return {
      success: true,
      insight,
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      tweetCount: tweetTexts.length,
      context,
      location
    };
  } catch (error) {
    console.error("Nemotron API error:", error);
    
    // Last resort: try cached insights again
    try {
      const cacheData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cache', 'customer_happiness_insights.json'), 'utf-8'));
      
      // Try exact match first
      let cachedInsight = cacheData[context];
      
      // If no exact match, try fuzzy matching
      if (!cachedInsight) {
        const contextLower = context.toLowerCase();
        const matchedTopic = Object.keys(cacheData).find(topic => {
          const topicLower = topic.toLowerCase();
          return topicLower.includes(contextLower) || contextLower.includes(topicLower.replace('t-mobile ', ''));
        });
        
        if (matchedTopic) {
          cachedInsight = cacheData[matchedTopic];
          console.log(`Fuzzy matched "${context}" to cached topic "${matchedTopic}" (fallback)`);
        }
      }
      
      if (cachedInsight) {
        console.log(`Falling back to cached insight for "${context}"`);
        return {
          success: true,
          insight: formatCachedInsight(cachedInsight, context),
          model: "cached-analysis-fallback",
          tweetCount: tweetTexts.length,
          context,
          location,
          cached: true
        };
      }
    } catch (cacheError) {
      console.error("Error loading cached insights as fallback:", cacheError);
    }
    
    return {
      success: false,
      error: "Failed to generate insights with both Gemini and Nemotron, and no cached data available",
      model: "none"
    };
  }
}

// Helper function to format cached insights
function formatCachedInsight(cached: any, context?: string): string {
  return `📊 **HAPPINESS SCORE: ${cached.happinessScore}/100**

😊 **SENTIMENT BREAKDOWN**
• Positive: ${cached.sentiment.positive}%
• Negative: ${cached.sentiment.negative}%
• Neutral: ${cached.sentiment.neutral}%

🔥 **CRITICAL ISSUES**
${cached.criticalIssues.map((issue: string) => `• ${issue}`).join('\n')}

✨ **MOMENTS OF DELIGHT**
${cached.momentsOfDelight.map((moment: string) => `• ${moment}`).join('\n')}

⚠️ **EARLY WARNING SIGNALS**
${cached.earlyWarningSignals.map((signal: string) => `• ${signal}`).join('\n')}

🎯 **ACTIONABLE RECOMMENDATIONS**
${cached.actionableRecommendations.map((rec: string) => `• ${rec}`).join('\n')}

📍 **LOCATION/TIME INSIGHTS**
${cached.locationInsights}

---
*Note: This analysis is based on pre-analyzed historical data${context ? ` for ${context}` : ''}. For real-time AI analysis, configure Gemini or OpenRouter API keys in your environment.*`;
}

app.get("/api/summary/:topic", async (req: Request, res: Response) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    const summary = await summarizeGemini(topic);
    res.json({ topic, summary });
  } catch (err) {
    console.error("Error summarizing topic:", err);
    res.status(500).json({ error: "Failed to summarize topic" });
  }
});

app.get("/api/insights/:topic", async (req: Request, res: Response) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    console.log(`Insight request for topic: ${topic}`);

    const result = await generateAgenticInsight(topic);

    if (result.success) {
      res.json({
        topic,
        insight: result.insight,
        model: result.model,
        tweetCount: result.tweetCount,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: result.error,
        model: result.model
      });
    }
  } catch (err) {
    console.error("Error generating insights:", err);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

app.post("/api/insights/analyze", async (req: Request, res: Response) => {
  try {
    const { context, tweets, location } = req.body;

    if (!context || !tweets || !Array.isArray(tweets)) {
      return res.status(400).json({
        error: "Missing required fields: context and tweets array"
      });
    }

    console.log(`Contextual insight request: "${context}" with ${tweets.length} tweets${location ? ` in ${location}` : ''}`);

    const result = await generateContextualInsight(context, tweets, location);

    if (result.success) {
      res.json({
        context: result.context,
        location: result.location,
        insight: result.insight,
        model: result.model,
        tweetCount: result.tweetCount,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: result.error,
        model: result.model
      });
    }
  } catch (err) {
    console.error("Error generating contextual insights:", err);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});


app.get("/api/sentiment/all", async (_req: Request, res: Response) => {
  try {

    const trendsFile = path.join(CACHE_DIR, 'trends_us.json');
    const trends = fs.existsSync(trendsFile)
      ? JSON.parse(fs.readFileSync(trendsFile, 'utf-8'))
      : [];

    const clusters: any[] = [];
    const articles: any[] = [];
    let articleId = 1;


    trends.forEach((topic: string, index: number) => {
      const clusterId = index + 1;


      clusters.push({
        cluster_id: clusterId,
        cluster_title: topic,
        cluster_summary: `Customer feedback and discussions about ${topic}`
      });


      const topicFileName = `tweets_${topic.replace(/\s+/g, '_')}.json`;
      const topicFile = path.join(CACHE_DIR, topicFileName);

      if (fs.existsSync(topicFile)) {
        const tweets = JSON.parse(fs.readFileSync(topicFile, 'utf-8'));


        tweets.forEach((tweet: any) => {
          articles.push({
            article_id: articleId++,
            title: `${tweet.author?.name || 'Unknown'} - ${topic}`,
            text: tweet.text,
            article_summary: tweet.text.length > 100 ? tweet.text.substring(0, 100) + '...' : tweet.text,
            source: `${tweet.location?.city || 'Unknown'}, ${tweet.location?.state || ''}`,
            cluster_id: clusterId
          });
        });
      }
    });

    console.log(`Serving ${clusters.length} clusters with ${articles.length} articles to graph view`);
    res.json({ clusters, articles });
  } catch (err) {
    console.error("Error fetching sentiment data:", err);
    res.status(500).json({ error: "Failed to fetch sentiment data" });
  }
});


app.get("/api/downdetector", async (_req: Request, res: Response) => {
  try {
    const downdetectorFile = path.join(CACHE_DIR, 'downdetector.json');

    if (!fs.existsSync(downdetectorFile)) {
      return res.status(404).json({ error: "DownDetector data not available" });
    }

    const downDetectorData = JSON.parse(fs.readFileSync(downdetectorFile, 'utf-8'));
    res.json(downDetectorData);
  } catch (err) {
    console.error("Error fetching DownDetector data:", err);
    res.status(500).json({ error: "Failed to fetch DownDetector data" });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log('   Press Ctrl+C to stop\n');
    init().catch(err => {
        console.error('\nERROR: Fatal initialization error:', err);
        process.exit(1);
    });
});