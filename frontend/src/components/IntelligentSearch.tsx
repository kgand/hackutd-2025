import React, { useState, useEffect, useRef } from 'react';
import DecryptedText from './DecryptedText';
import { api } from '../lib/apiClient';

interface IntelligentSearchProps {
  onSearch: (query: string, type: 'city' | 'topic' | 'both', city?: string, topic?: string) => void;
}

const IntelligentSearch: React.FC<IntelligentSearchProps> = ({ onSearch }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trends, setTrends] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    Promise.all([
      api.getSentimentAll(),
      api.getFlattened()
    ])
      .then(([trendsData, tweetsData]) => {

        const topics = trendsData.clusters.map((c: any) => c.cluster_title);
        setTrends(topics.slice(0, 5));


        const citySet = new Set<string>();
        tweetsData.forEach((tweet: any) => {
          if (tweet.location && tweet.location.city) {
            citySet.add(tweet.location.city);
          }
        });
        setCities(Array.from(citySet).slice(0, 10));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  const detectCityAndTopic = (query: string): { city?: string; topic?: string } => {
    const lowerQuery = query.toLowerCase();
    let foundCity: string | undefined;
    let foundTopic: string | undefined;


    for (const city of cities) {
      if (lowerQuery.includes(city.toLowerCase())) {
        foundCity = city;
        break;
      }
    }


    for (const topic of trends) {
      if (lowerQuery.includes(topic.toLowerCase())) {
        foundTopic = topic;
        break;
      }
    }


    const topicKeywords: Record<string, string> = {
      '5g': 'T-Mobile 5G',
      'network': 'T-Mobile Network',
      'customer service': 'T-Mobile Customer Service',
      'service': 'T-Mobile Customer Service',
      'deals': 'T-Mobile Deals',
      'pricing': 'Pricing & Value',
      'value': 'Pricing & Value',
      'phone': 'Device & Phone Deals',
      'coverage': 'Network Reliability & Coverage',
      'reliable': 'Network Reliability & Coverage',
    };

    if (!foundTopic) {
      for (const [keyword, topic] of Object.entries(topicKeywords)) {
        if (lowerQuery.includes(keyword) && trends.includes(topic)) {
          foundTopic = topic;
          break;
        }
      }
    }

    return { city: foundCity, topic: foundTopic };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (query === '') return;

    const { city, topic } = detectCityAndTopic(query);

    if (city && topic) {

      onSearch(query, 'both', city, topic);
    } else if (city) {

      onSearch(query, 'city', city, undefined);
    } else if (topic) {

      onSearch(query, 'topic', undefined, topic);
    } else {

      onSearch(query, 'topic', undefined, trends[0]);
    }

    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="w-full max-w-2xl relative">
      <form onSubmit={handleSubmit} className="relative">
        {}
        <div className="relative bg-black/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          {}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

          {}
          <div className="relative flex items-center p-4 gap-3">
            <button
              type="submit"
              className="flex-shrink-0 text-white/60 hover:text-white/90 transition-colors"
            >
              <img src="/assets/img/tmobile.png" alt="T-Mobile" className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-lg font-light"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder=""
            />

            {!inputValue && (
              <div className="absolute left-14 pointer-events-none text-white/40">
                <DecryptedText
                  text="search cities or topics..."
                  animateOn="view"
                  sequential={true}
                  speed={50}
                />
              </div>
            )}

            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('');
                  inputRef.current?.focus();
                }}
                className="flex-shrink-0 text-white/60 hover:text-white/90 transition-colors"
              >
                <img src="/assets/img/tmobile.png" alt="T-Mobile" className="w-5 h-5" />
              </button>
            )}
          </div>

          {}
          {showSuggestions && (
            <div className="border-t border-white/10 p-4 space-y-4">
              <div>
                <h4 className="text-xs uppercase tracking-wide text-white/50 mb-2 font-light">
                  {loading ? 'loading...' : 'trending topics'}
                </h4>
                <div className="space-y-1">
                  {trends.slice(0, 3).map((trend) => (
                    <button
                      key={trend}
                      type="button"
                      onMouseDown={() => handleSuggestionClick(trend)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200 font-light lowercase"
                    >
                      <img src="/assets/img/tmobile.png" alt="T-Mobile" className="inline-block w-4 h-4 mr-2" />
                      {trend}
                    </button>
                  ))}
                </div>
              </div>

              {cities.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wide text-white/50 mb-2 font-light">
                    top cities
                  </h4>
                  <div className="space-y-1">
                    {cities.slice(0, 3).map((city) => (
                      <button
                        key={city}
                        type="button"
                        onMouseDown={() => handleSuggestionClick(city)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200 font-light lowercase"
                      >
                        <img src="/assets/img/tmobile.png" alt="T-Mobile" className="inline-block w-4 h-4 mr-2" />
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default IntelligentSearch;
