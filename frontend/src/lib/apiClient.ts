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
export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<any> {
  try {
    // Try backend first
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
      ...options,
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
  
  // POST endpoint for insights analysis with cache fallback
  analyzeInsights: async (context: string, tweets: string[], location?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/insights/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context, tweets, location }),
        signal: AbortSignal.timeout(5000), // 5 second timeout for AI operations
      });
      
      if (response.ok) {
        backendAvailable = true;
        return await response.json();
      }
    } catch (error) {
      console.log(`Backend unavailable for insights, falling back to cached happiness index`);
      backendAvailable = false;
    }
    
    // Fallback to cached customer happiness insights
    try {
      const cacheResponse = await fetch('/cache/customer_happiness_insights.json');
      if (cacheResponse.ok) {
        const allInsights = await cacheResponse.json();
        
        // Try exact match first
        let cachedInsight = allInsights[context];
        
        // If no exact match, try fuzzy matching
        if (!cachedInsight) {
          const contextLower = context.toLowerCase();
          
          // Check for "all topics" variations
          if (contextLower === 'customer feedback' || contextLower === 'all' || contextLower === '') {
            cachedInsight = allInsights['All Topics'];
            if (cachedInsight) {
              console.log(`Matched "${context}" to "All Topics"`);
            }
          } else {
            const matchedTopic = Object.keys(allInsights).find(topic => {
              const topicLower = topic.toLowerCase();
              return topicLower.includes(contextLower) || contextLower.includes(topicLower.replace('t-mobile ', ''));
            });
            
            if (matchedTopic) {
              cachedInsight = allInsights[matchedTopic];
              console.log(`Fuzzy matched "${context}" to "${matchedTopic}"`);
            }
          }
        }
        
        if (cachedInsight) {
          // Format cached insight to match API response
          const formattedInsight = `📊 **HAPPINESS SCORE: ${cachedInsight.happinessScore}/100**

😊 **SENTIMENT BREAKDOWN**
• Positive: ${cachedInsight.sentiment.positive}%
• Negative: ${cachedInsight.sentiment.negative}%
• Neutral: ${cachedInsight.sentiment.neutral}%

🔥 **CRITICAL ISSUES**
${cachedInsight.criticalIssues.map((issue: string) => `• ${issue}`).join('\n')}

✨ **MOMENTS OF DELIGHT**
${cachedInsight.momentsOfDelight.map((moment: string) => `• ${moment}`).join('\n')}

⚠️ **EARLY WARNING SIGNALS**
${cachedInsight.earlyWarningSignals.map((signal: string) => `• ${signal}`).join('\n')}

🎯 **ACTIONABLE RECOMMENDATIONS**
${cachedInsight.actionableRecommendations.map((rec: string) => `• ${rec}`).join('\n')}

📍 **LOCATION/TIME INSIGHTS**
${cachedInsight.locationInsights}

---
*Note: This analysis is based on pre-analyzed historical data. Backend unavailable.*`;
          
          return {
            success: true,
            insight: formattedInsight,
            model: 'cached-analysis',
            tweetCount: tweets.length,
            context,
            location,
            cached: true,
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (cacheError) {
      console.error('Error loading cached insights:', cacheError);
    }
    
    // Last resort: return error
    throw new Error('Unable to analyze insights: backend unavailable and no cached data found');
  }
};
