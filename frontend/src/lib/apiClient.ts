// API client with automatic fallback to local cache when backend is unavailable

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to check if backend is available
let backendAvailable: boolean | null = null;

async function checkBackendAvailability(): Promise<boolean> {
  if (backendAvailable !== null) {
    return backendAvailable;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/trends`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    backendAvailable = response.ok;
    return backendAvailable;
  } catch {
    backendAvailable = false;
    return false;
  }
}

// Fetch with fallback to local cache
export async function fetchWithFallback(endpoint: string): Promise<any> {
  try {
    // Try backend first
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    if (response.ok) {
      backendAvailable = true;
      return await response.json();
    }
  } catch (error) {
    console.log(`Backend unavailable, falling back to cache for ${endpoint}`);
    backendAvailable = false;
  }

  // Fallback to local cache
  return fetchFromCache(endpoint);
}

// Map API endpoints to cache files
function getCacheFilePath(endpoint: string): string {
  const cacheMap: Record<string, string> = {
    '/api/trends': '/cache/trends_us.json',
    '/api/flattened': '/cache/tweets_realistic_bulk.json',
    '/api/sentiment/all': '/cache/tmobile_sentiment_data.json',
    '/api/downdetector': '/cache/downdetector.json',
  };

  // Handle topic-specific endpoints
  if (endpoint.startsWith('/api/flattened/')) {
    const topic = endpoint.replace('/api/flattened/', '');
    return `/cache/tweets_${topic}.json`;
  }

  return cacheMap[endpoint] || cacheMap['/api/flattened'];
}

async function fetchFromCache(endpoint: string): Promise<any> {
  try {
    const cachePath = getCacheFilePath(endpoint);
    console.log(`Fetching from cache: ${cachePath}`);
    
    const response = await fetch(cachePath);
    if (!response.ok) {
      throw new Error(`Cache file not found: ${cachePath}`);
    }
    
    const data = await response.json();
    
    // Transform cache data to match API format if needed
    if (endpoint === '/api/flattened' || endpoint.startsWith('/api/flattened/')) {
      return transformCacheToFlattenedFormat(data);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching from cache for ${endpoint}:`, error);
    return endpoint === '/api/trends' ? [] : [];
  }
}

// Transform cached tweet data to match the /api/flattened format
function transformCacheToFlattenedFormat(tweets: any[]): any[] {
  if (!Array.isArray(tweets)) {
    return [];
  }

  return tweets
    .map((tweet: any) => {
      const lat = tweet.location?.coordinates?.[1] ?? 0;
      const lon = tweet.location?.coordinates?.[0] ?? 0;
      const text = tweet.text ?? "";
      const author = tweet.author?.userName ?? tweet.author?.name ?? "unknown";
      const location = tweet.location ?? "";
      const topic = tweet.topic || "T-Mobile";

      return { topic, lon, lat, text, author, location };
    })
    .filter((item: any) => {
      // Filter for valid coordinates
      return (
        typeof item.lat === 'number' &&
        typeof item.lon === 'number' &&
        !isNaN(item.lat) &&
        !isNaN(item.lon) &&
        item.lat !== 0 &&
        item.lon !== 0 &&
        Math.abs(item.lat) <= 90 &&
        Math.abs(item.lon) <= 180
      );
    });
}

export const api = {
  getTrends: () => fetchWithFallback('/api/trends'),
  getFlattened: () => fetchWithFallback('/api/flattened'),
  getFlattenedByTopic: (topic: string) => fetchWithFallback(`/api/flattened/${topic}`),
  getSentimentAll: () => fetchWithFallback('/api/sentiment/all'),
  getDownDetector: () => fetchWithFallback('/api/downdetector'),
  getSummary: (topic: string) => fetchWithFallback(`/api/summary/${topic}`),
};
