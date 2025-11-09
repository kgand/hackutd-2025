# Offline-First Frontend Setup

## Overview
The frontend has been configured to work completely standalone, without requiring the backend to be running. It automatically falls back to local cache files when the backend API is unavailable.

## How It Works

### 1. API Client (`frontend/src/lib/apiClient.ts`)
- **Smart Fallback**: Tries to connect to the backend API first
- **2-Second Timeout**: Quick detection if backend is unavailable
- **Automatic Cache Fallback**: On connection failure, reads from `/cache/*.json` files
- **Consistent Data Structure**: Returns the same format whether from API or cache

### 2. Cache Files (`frontend/public/cache/`)
Complete mirror of backend cache:
- `trends_us.json` - List of 23 T-Mobile topics
- `tweets_*.json` - 21 topic-specific tweet collections (geolocated)
- `tweets_realistic_bulk.json` - Combined dataset for "all topics" view
- `downdetector.json` - Network outage timeline data
- `tmobile_sentiment_data.json` - AI-clustered sentiment analysis

**Total**: 24 cache files bundled with the frontend

### 3. Updated Components
All components now use the apiClient instead of direct fetch calls:

#### Core Components
- ✅ `Explorer.tsx` - Main map visualization
- ✅ `Sidebar.tsx` - Topic trends list
- ✅ `SearchBar.tsx` - City autocomplete
- ✅ `IntelligentSearch.tsx` - Smart search with suggestions

#### Feature Components
- ✅ `GeminiExplanation.tsx` - AI topic summaries (offline when cached)
- ✅ `OutageMonitor.tsx` - DownDetector integration
- ⚠️ `InsightsPanel.tsx` - Requires backend (POST endpoint for live AI analysis)

## Usage

### Development Mode (Offline)
```bash
cd frontend
npm run dev
```
**Result**: Frontend runs on http://localhost:5173 and uses cache files from `/cache/` directory

### With Backend (Online)
```bash
# Terminal 1: Backend
cd backend
npm run dev  # or ts-node server.ts

# Terminal 2: Frontend
cd frontend
npm run dev
```
**Result**: Frontend detects running backend and uses live API endpoints

## Environment Variables

### Frontend `.env` (Optional)
```env
VITE_API_URL=http://localhost:3000  # Override default API URL
```

If not set, defaults to `http://localhost:3000`

## Testing Offline Functionality

1. **Start Frontend Only**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open Browser**: http://localhost:5173

3. **Check Console**:
   - Should see: "Backend unavailable, falling back to cache for /api/..."
   - Map should load with cached tweet data
   - Topics sidebar should populate from `trends_us.json`

4. **Features Available Offline**:
   - ✅ Interactive globe map with tweets
   - ✅ Topic filtering (21 topics)
   - ✅ City search with autocomplete
   - ✅ Sentiment analysis clusters
   - ✅ DownDetector outage monitoring
   - ✅ Cached AI summaries (if previously generated)

5. **Features Requiring Backend**:
   - ❌ Live AI insights generation (InsightsPanel)
   - ❌ Fresh Gemini explanations (if not cached)

## How Cache Fallback Works

### Example: Fetching Trends
```typescript
// Old way (hardcoded)
const response = await fetch("http://localhost:3000/api/trends");
const data = await response.json();

// New way (with fallback)
import { api } from '../lib/apiClient';
const data = await api.getTrends();  // Auto-fallback to /cache/trends_us.json
```

### Behind the Scenes
1. apiClient tries: `http://localhost:3000/api/trends`
2. If connection fails (2s timeout):
   - Logs: "Backend unavailable, falling back to cache"
   - Fetches: `/cache/trends_us.json`
   - Returns same data structure
3. Component receives data regardless of source

## File Structure
```
frontend/
├── public/
│   └── cache/                         # All cache files bundled here
│       ├── trends_us.json
│       ├── tweets_realistic_bulk.json
│       ├── tweets_T-Mobile_5G.json
│       └── ... (21 more topic files)
├── src/
│   ├── lib/
│   │   └── apiClient.ts              # Smart fetch with cache fallback
│   ├── components/
│   │   ├── Sidebar.tsx               # Uses api.getTrends()
│   │   ├── SearchBar.tsx             # Uses api.getFlattened()
│   │   └── ...
│   └── routes/
│       └── Explorer.tsx              # Uses api.getFlattened() / getFlattenedByTopic()
```

## Benefits

### 1. **Development Workflow**
- Work on frontend without running backend
- Faster iteration cycles
- No backend dependencies for UI work

### 2. **Demos & Presentations**
- Frontend works standalone
- No backend setup required
- Instant load from cache

### 3. **Resilience**
- Graceful degradation when backend down
- No ERR_CONNECTION_REFUSED errors
- Seamless fallback

### 4. **Deployment Flexibility**
- Frontend can deploy separately (Vercel)
- Backend can deploy separately (Render)
- Frontend works even if backend is cold-starting

## API Client Reference

### Available Methods
```typescript
import { api } from '@/lib/apiClient';

// Get all topics/trends
await api.getTrends();  
// Fallback: /cache/trends_us.json

// Get all tweets (flattened)
await api.getFlattened();
// Fallback: /cache/tweets_realistic_bulk.json

// Get tweets for specific topic
await api.getFlattenedByTopic('T-Mobile_5G');
// Fallback: /cache/tweets_T-Mobile_5G.json

// Get sentiment analysis
await api.getSentimentAll();
// Fallback: /cache/tmobile_sentiment_data.json

// Get outage data
await api.getDownDetector();
// Fallback: /cache/downdetector.json

// Get AI summary (may fail offline if not cached)
await api.getSummary('T-Mobile_5G');
// Fallback: /cache/summary_T-Mobile_5G.json (if exists)
```

## Troubleshooting

### Cache Files Not Loading
**Problem**: 404 errors for `/cache/*.json`  
**Solution**: Verify files exist in `frontend/public/cache/`  
```bash
ls frontend/public/cache/
```

### Backend Detection Slow
**Problem**: 2-second delay on every request  
**Solution**: This is intentional for offline detection. Once backend is detected as unavailable, subsequent requests skip the check.

### Mixed Data Sources
**Problem**: Some data from API, some from cache  
**Solution**: This is normal! The system uses whichever source is available per endpoint.

## Next Steps

To fully enable offline operation for ALL features:
1. Cache Gemini AI summaries after first generation
2. Pre-generate all topic summaries and bundle in cache
3. Consider service worker for full PWA offline support

---

**Status**: ✅ Fully Implemented  
**Commit**: `739a750` - "Implement offline-first frontend with cache fallback"  
**Date**: 2025-11-09
