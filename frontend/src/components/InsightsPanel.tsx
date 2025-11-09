import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface InsightsPanelProps {
  topic: string | null;
  currentData: any[];
  hoveredTweets?: Array<{text: string; author: string; topic: string; location?: any}>;
  className?: string;
}

interface InsightData {
  insight: string;
  model: string;
  tweetCount: number;
  timestamp: string;
  context: string;
  location?: string;
}

export function InsightsPanel({ topic, currentData, hoveredTweets, className }: InsightsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedContext, setLastAnalyzedContext] = useState<string>('');

  const analyzeContext = async (context: string, tweets: string[], location?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/insights/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          tweets,
          location
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate Customer Happiness insights');
      }

      const data = await response.json();
      setInsightData(data);
      setLastAnalyzedContext(context + (location || ''));
    } catch (err) {
      console.error('Error generating Customer Happiness insights:', err);
      setError('Failed to analyze customer happiness. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger insights when topic changes
  useEffect(() => {
    if (topic && currentData.length > 0) {
      const tweetTexts = currentData
        .filter(d => d.text && d.text.trim().length > 0)
        .map(d => d.text)
        .slice(0, 50); // Limit to 50 tweets for performance

      if (tweetTexts.length > 0) {
        const contextKey = `topic_${topic}`;
        if (contextKey !== lastAnalyzedContext) {
          console.log(`Auto-generating insights for topic: ${topic} (${tweetTexts.length} tweets)`);
          analyzeContext(topic, tweetTexts);
        }
      }
    }
  }, [topic, currentData]);

  // Auto-trigger insights when hovering over a location
  useEffect(() => {
    if (hoveredTweets && hoveredTweets.length > 0) {
      const location = hoveredTweets[0].location;
      const locationName = location && location.city
        ? `${location.city}, ${location.state || location.country || ''}`.trim()
        : 'this location';

      const tweetTexts = hoveredTweets
        .filter(t => t.text && t.text.trim().length > 0)
        .map(t => t.text);

      const context = topic || 'Customer Feedback';
      const contextKey = `hover_${locationName}_${context}`;

      if (contextKey !== lastAnalyzedContext && tweetTexts.length > 0) {
        console.log(`Auto-generating insights for ${locationName}: ${context} (${tweetTexts.length} tweets)`);
        analyzeContext(context, tweetTexts, locationName);
      }
    }
  }, [hoveredTweets, topic]);

  return (
    <div className={cn(
      "flex flex-col bg-black/40 backdrop-blur-lg border border-[#E20074]/30 rounded-xl overflow-hidden transition-all duration-300",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E20074]/20">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <div className="flex flex-col">
            <h3 className="text-sm font-light tracking-wide text-white/90 lowercase">
              customer happiness index
            </h3>
            {insightData?.location && (
              <p className="text-xs text-white/50 font-light">{insightData.location}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto max-h-[500px] no-scrollbar">
        {!topic && !hoveredTweets && (
          <p className="text-sm text-white/50 font-light">
            select a topic or hover over a location to analyze customer happiness
          </p>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-8 h-8 border-2 border-[#E20074]/30 border-t-[#E20074] rounded-full animate-spin"></div>
            <p className="text-sm text-white/70 font-light lowercase">
              analyzing customer happiness...
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400 font-light">{error}</p>
          </div>
        )}

        {insightData && !isLoading && (
          <div className="space-y-4">
            {/* Insight Content */}
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-white/80 font-light leading-relaxed whitespace-pre-wrap">
                {insightData.insight}
              </p>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
              <span className="px-2 py-1 bg-[#E20074]/20 border border-[#E20074]/30 rounded-md text-xs text-white/70 font-light">
                {insightData.tweetCount} customers analyzed
              </span>
              <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-md text-xs text-white/70 font-light">
                {insightData.model.includes('gemini') ? '✨ AI' : '🚀 AI'}
              </span>
              <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-md text-xs text-white/70 font-light">
                real-time
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightsPanel;
