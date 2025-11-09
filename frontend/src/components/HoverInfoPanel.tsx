import React, { useEffect, useState, useRef } from 'react';

interface TweetInfo {
  text: string;
  author: string;
  topic: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    coordinates?: [number, number];
  };
}

interface HoverInfoPanelProps {
  className?: string;
  hoverInfo?: {
    coordinate: [number, number];
    tweets: TweetInfo[];
    city?: string;
    state?: string;
  } | null;
}

const HoverInfoPanel: React.FC<HoverInfoPanelProps> = ({ className, hoverInfo }) => {
  const [animationKey, setAnimationKey] = useState(0);
  const prevCoordinateRef = useRef<string | null>(null);


  useEffect(() => {
    if (hoverInfo) {

      const coordKey = `${hoverInfo.coordinate[0].toFixed(2)},${hoverInfo.coordinate[1].toFixed(2)}`;


      if (prevCoordinateRef.current !== coordKey) {
        prevCoordinateRef.current = coordKey;
        setAnimationKey(prev => prev + 1);
      }
    }
  }, [hoverInfo?.coordinate[0], hoverInfo?.coordinate[1]]);


  const getLocationData = (): { city: string; state: string } => {
    if (!hoverInfo || !hoverInfo.tweets || hoverInfo.tweets.length === 0) {
      return { city: 'Unknown', state: 'Unknown' };
    }


    const firstTweet = hoverInfo.tweets[0];
    if (firstTweet.location && typeof firstTweet.location === 'object') {
      return {
        city: firstTweet.location.city || 'Unknown',
        state: firstTweet.location.state || 'Unknown'
      };
    }

    return { city: 'Unknown', state: 'Unknown' };
  };

  const locationData = getLocationData();

  return (
    <div
      className={`bg-black/30 text-white font-mon rounded-xl p-4 backdrop-blur-lg border transition-all duration-500 max-h-[85vh] flex flex-col ${className} ${
        hoverInfo ? 'border-[#E20074]/40 shadow-lg shadow-[#E20074]/20' : 'border-white/20'
      }`}
    >
      <h3 className="text-lg font-light lowercase tracking-wide mb-3 border-b border-gray-600 pb-2 text-white/90">
        location information
      </h3>

      {hoverInfo ? (
        <div
          key={animationKey}
          className="space-y-3 flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{
            animation: 'slideInFade 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <style>{`
            @keyframes slideInFade {
              from {
                opacity: 0;
                transform: translateY(10px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
          <div className="space-y-2 flex-shrink-0">
            <div className="flex justify-between items-center group">
              <span className="text-gray-300">City:</span>
              <span className="font-semibold text-[#FF00A0] transition-all duration-300 group-hover:text-[#FF1493] group-hover:scale-105">
                {locationData.city}
              </span>
            </div>

            <div className="flex justify-between items-center group">
              <span className="text-gray-300">State:</span>
              <span className="font-semibold text-[#FF00A0] transition-all duration-300 group-hover:text-[#FF1493] group-hover:scale-105">
                {locationData.state}
              </span>
            </div>

            <div className="flex justify-between items-center group">
              <span className="text-gray-300">Longitude:</span>
              <span className="font-mono text-[#FF00A0] text-sm transition-all duration-300 group-hover:text-[#FF1493] group-hover:scale-105">
                {hoverInfo.coordinate[0].toFixed(4)}°
              </span>
            </div>

            <div className="flex justify-between items-center group">
              <span className="text-gray-300">Latitude:</span>
              <span className="font-mono text-[#FF00A0] text-sm transition-all duration-300 group-hover:text-[#FF1493] group-hover:scale-105">
                {hoverInfo.coordinate[1].toFixed(4)}°
              </span>
            </div>

            <div className="flex justify-between items-center group">
              <span className="text-gray-300">Tweets:</span>
              <span className="font-mono bg-gradient-to-r from-[#E20074] to-[#FF1493] bg-clip-text text-transparent font-bold transition-all duration-300 group-hover:scale-110">
                {hoverInfo.tweets.length}
              </span>
            </div>
          </div>

          {hoverInfo.tweets.length > 0 && (
            <div className="border-t border-gray-600 pt-3 flex-1 overflow-hidden flex flex-col min-h-0">
              <h4 className="text-sm font-medium lowercase tracking-wide mb-2 text-gray-200 flex-shrink-0">tweet details ({hoverInfo.tweets.length})</h4>
              <div
                className="space-y-2 overflow-y-auto overflow-x-hidden flex-1 pr-2"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4B5563 rgba(31, 41, 55, 0.5)',
                  overflowY: 'scroll'
                }}
              >
                {hoverInfo.tweets.map((tweet, index) => (
                  <div
                    key={index}
                    className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs flex-shrink-0 hover:bg-black/30 hover:border-[#E20074]/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#E20074]/20"
                    style={{
                      animation: `slideInFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`
                    }}
                  >
                    <div className="text-[#FF00A0] font-bold text-sm tracking-wide">@{tweet.author}</div>
                    <div className="text-[#FF1493] text-sm font-semibold tracking-wider mt-1">#{tweet.topic}</div>
                    <div className="text-gray-100 mt-2 break-words leading-relaxed font-normal text-[13px]">{tweet.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-4 lowercase font-light tracking-wide">
          hover over a cell to see details
        </div>
      )}
    </div>
  );
};

export default HoverInfoPanel;
