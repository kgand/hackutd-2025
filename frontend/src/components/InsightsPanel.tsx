import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { api } from '../lib/apiClient';

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
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  criticalIssues?: string[];
  momentsOfDelight?: string[];
}

export function InsightsPanel({ topic, currentData, hoveredTweets, className }: InsightsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedContext, setLastAnalyzedContext] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<'positive' | 'negative' | null>(null);

  const analyzeContext = async (context: string, tweets: string[], location?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.analyzeInsights(context, tweets, location);
      
      // Calculate sentiment breakdown from tweets
      const sentiment = calculateSentiment(tweets);
      const criticalIssues = extractCriticalIssues(tweets);
      const momentsOfDelight = extractMomentsOfDelight(tweets);
      
      setInsightData({
        ...data,
        sentiment,
        criticalIssues,
        momentsOfDelight
      });
      setLastAnalyzedContext(context + (location || ''));
    } catch (err) {
      console.error('Error generating Customer Happiness insights:', err);
      setError('Failed to analyze customer happiness. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSentiment = (tweets: string[]) => {
    // Simple sentiment analysis - in production this would use the API
    const total = tweets.length;
    const negativeKeywords = ['bad', 'terrible', 'worst', 'horrible', 'awful', 'disappointing', 'frustrated', 'angry', 'issue', 'problem'];
    const positiveKeywords = ['great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic', 'wonderful', 'perfect', 'impressed'];
    
    let negative = 0;
    let positive = 0;
    
    tweets.forEach(tweet => {
      const lowerTweet = tweet.toLowerCase();
      if (negativeKeywords.some(kw => lowerTweet.includes(kw))) negative++;
      else if (positiveKeywords.some(kw => lowerTweet.includes(kw))) positive++;
    });
    
    const neutral = total - negative - positive;
    
    return {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100)
    };
  };

  const extractCriticalIssues = (tweets: string[]) => {
    const negativeKeywords = ['bad', 'terrible', 'worst', 'horrible', 'awful', 'disappointing', 'frustrated', 'angry', 'issue', 'problem'];
    return tweets
      .filter(tweet => negativeKeywords.some(kw => tweet.toLowerCase().includes(kw)))
      .slice(0, 5);
  };

  const extractMomentsOfDelight = (tweets: string[]) => {
    const positiveKeywords = ['great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic', 'wonderful', 'perfect', 'impressed'];
    return tweets
      .filter(tweet => positiveKeywords.some(kw => tweet.toLowerCase().includes(kw)))
      .slice(0, 5);
  };

  // Auto-trigger insights when topic changes
  useEffect(() => {
    if (currentData.length > 0) {
      const tweetTexts = currentData
        .filter(d => d.text && d.text.trim().length > 0)
        .map(d => d.text)
        .slice(0, 50); // Limit to 50 tweets for performance

      if (tweetTexts.length > 0) {
        // Use "All Topics" when no specific topic is selected
        const contextKey = topic ? `topic_${topic}` : 'topic_All Topics';
        const analysisContext = topic || 'All Topics';
        
        if (contextKey !== lastAnalyzedContext) {
          console.log(`Auto-generating insights for topic: ${analysisContext} (${tweetTexts.length} tweets)`);
          analyzeContext(analysisContext, tweetTexts);
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
      {/* Content */}
      <div className="p-4 overflow-y-auto overflow-x-hidden max-h-[650px] no-scrollbar">
        {!hoveredTweets && currentData.length === 0 && (
          <p className="text-sm text-white/50 font-light text-center py-8">
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
            {/* Happiness Score Card */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-white/20">
              <CardHeader className="pb-2">
                {insightData?.location && (
                  <CardTitle className="text-xs text-white/50 font-light">
                    {insightData.location}
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Score Display */}
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    {/* SVG Pie Chart */}
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="10"
                      />
                      
                      {/* Positive segment */}
                      {insightData.sentiment && insightData.sentiment.positive > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="10"
                          strokeDasharray={`${(insightData.sentiment.positive / 100) * 283} 283`}
                          className="cursor-pointer transition-all duration-300 hover:stroke-width-[12] hover:opacity-80"
                          onClick={() => setSelectedSegment('positive')}
                        />
                      )}
                      
                      {/* Neutral segment */}
                      {insightData.sentiment && insightData.sentiment.neutral > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#6b7280"
                          strokeWidth="10"
                          strokeDasharray={`${(insightData.sentiment.neutral / 100) * 283} 283`}
                          strokeDashoffset={`-${(insightData.sentiment.positive / 100) * 283}`}
                          className="transition-all duration-300"
                        />
                      )}
                      
                      {/* Negative segment */}
                      {insightData.sentiment && insightData.sentiment.negative > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="10"
                          strokeDasharray={`${(insightData.sentiment.negative / 100) * 283} 283`}
                          strokeDashoffset={`-${((insightData.sentiment.positive + insightData.sentiment.neutral) / 100) * 283}`}
                          className="cursor-pointer transition-all duration-300 hover:stroke-width-[12] hover:opacity-80"
                          onClick={() => setSelectedSegment('negative')}
                        />
                      )}
                    </svg>
                    
                    {/* Center score */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">
                          {((insightData.sentiment?.positive || 0) + (insightData.sentiment?.neutral || 0))}%
                        </div>
                        <div className="text-[10px] text-white/50 uppercase tracking-wide">satisfaction</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-4 text-xs">
                  <button
                    onClick={() => setSelectedSegment('positive')}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-white/70">{insightData.sentiment?.positive || 0}%</span>
                  </button>
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span className="text-white/70">{insightData.sentiment?.neutral || 0}%</span>
                  </div>
                  <button
                    onClick={() => setSelectedSegment('negative')}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                  >
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-white/70">{insightData.sentiment?.negative || 0}%</span>
                  </button>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                  <span className="px-2 py-1 bg-[#E20074]/20 border border-[#E20074]/30 rounded-md text-xs text-white/70 font-light">
                    {insightData.tweetCount} analyzed
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues / Moments of Delight */}
            {selectedSegment === 'negative' && insightData.criticalIssues && insightData.criticalIssues.length > 0 && (
              <Card className="bg-red-500/10 border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-light text-red-300 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <span>Critical Issues</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {insightData.criticalIssues.map((issue, idx) => (
                      <div key={idx} className="p-2 bg-black/30 rounded-lg border border-red-500/20">
                        <p className="text-xs text-white/80 leading-relaxed">{issue}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedSegment === 'positive' && insightData.momentsOfDelight && insightData.momentsOfDelight.length > 0 && (
              <Card className="bg-green-500/10 border-green-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-light text-green-300 flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    <span>Moments of Delight</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {insightData.momentsOfDelight.map((moment, idx) => (
                      <div key={idx} className="p-2 bg-black/30 rounded-lg border border-green-500/20">
                        <p className="text-xs text-white/80 leading-relaxed">{moment}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightsPanel;
