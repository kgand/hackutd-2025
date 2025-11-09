import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FlyToInterpolator } from '@deck.gl/core';
import SimpleMap from '../components/SimpleMap';
import Sidebar from '../components/Sidebar';
import HoverInfoPanel from '../components/HoverInfoPanel';
import SearchBar from '../components/SearchBar';
import InsightsPanel from '../components/InsightsPanel';
import { api } from '../lib/apiClient';
import '../App.css';


interface TweetData {
  topic: string;
  lon: number;
  lat: number;
  text: string;
  author: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    coordinates?: [number, number];
  };
}

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
  transitionInterpolator?: any;
  transitionEasing?: (t: number) => number;
}

interface HoverInfo {
  object?: any;
  coordinate?: number[];
  pixel?: number[];
  layer?: any;
}

interface ExplorerProps {
  initialCity?: string;
}

const Explorer: React.FC<ExplorerProps> = ({ initialCity }) => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [hasInitializedCity, setHasInitializedCity] = useState(false);


  const [currentData, setCurrentData] = useState<TweetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showContent, setShowContent] = useState(false);


  const [hoverInfo, setHoverInfo] = useState<{
    coordinate: [number, number];
    tweets: Array<{text: string; author: string; topic: string; location?: {
      city?: string;
      state?: string;
      country?: string;
      coordinates?: [number, number];
    }}>;
  } | null>(null);


  const currentHoveredNodeIdRef = useRef<string | null>(null);


  const [layerRefreshKey, setLayerRefreshKey] = useState<number>(0);


  const [mapOpacity, setMapOpacity] = useState(1);


  const fetchData = useCallback(async (topic: string | null, isUserInitiated = false) => {
    setIsLoading(true);


    if (isUserInitiated) {
      setIsTransitioning(true);

      setMapOpacity(0);

      setViewState(prev => ({
        ...prev,
        zoom: Math.max(prev.zoom - 0.3, 3),
        transitionDuration: 900,
        transitionInterpolator: new FlyToInterpolator({
          speed: 1.0,
          curve: 1.5
        }),
        transitionEasing: (t: number) => {

          return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        }
      }));
    }

    try {
      console.log('Fetching data for topic:', topic || 'all topics');

      // Use apiClient with automatic fallback to cache
      const data = topic ? await api.getFlattenedByTopic(topic) : await api.getFlattened();


      const validData = data.filter((item: TweetData) => {
        const hasValidCoords = typeof item.lat === 'number' && typeof item.lon === 'number' &&
                              !isNaN(item.lat) && !isNaN(item.lon) &&
                              item.lat !== 0 && item.lon !== 0 &&
                              Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180;

        if (!hasValidCoords) {
          console.log('Filtering out invalid coordinates:', item);
        }
        return hasValidCoords;
      });


      if (isUserInitiated) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      setCurrentData([...validData]);
      console.log(`Loaded ${data.length} total items, ${validData.length} with valid coordinates for topic:`, topic || 'all topics');


      setLayerRefreshKey(prev => prev + 1);


      if (validData.length > 0) {
        console.log('Sample valid data points:', validData.slice(0, 3));
      }


      if (isUserInitiated) {
        setTimeout(() => {
          setMapOpacity(1);
          setViewState(prev => ({
            ...prev,
            zoom: prev.zoom + 0.3,
            transitionDuration: 1200,
            transitionInterpolator: new FlyToInterpolator({
              speed: 0.9,
              curve: 1.4
            }),
            transitionEasing: (t: number) => {

              return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
            }
          }));
          setTimeout(() => setIsTransitioning(false), 1200);
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setCurrentData([]);
      setMapOpacity(1);
      setIsTransitioning(false);
    } finally {
      setIsLoading(false);
    }
  }, []);


  const [viewState, setViewState] = useState<ViewState>({
    longitude: -95,
    latitude: 40,
    zoom: 4,
    pitch: 45,
    bearing: 0
  });


  const handleLocationSelect = useCallback((longitude: number, latitude: number, cityName?: string) => {
    console.log(`Flying to coordinates: [${longitude}, ${latitude}], City: ${cityName}`);

    setViewState(prevState => ({
      ...prevState,
      longitude,
      latitude,
      zoom: 6.5,
      transitionDuration: 3500,
      transitionInterpolator: new FlyToInterpolator({
        speed: 0.8,
        curve: 1.8
      }),
      transitionEasing: (t: number) => {

        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      }
    }));


    if (cityName) {
      const cityTweets = currentData.filter((tweet: TweetData) => {

        if (tweet.location && typeof tweet.location === 'object' && tweet.location.city) {
          return tweet.location.city.toLowerCase().includes(cityName.toLowerCase());
        }
        return false;
      });

      console.log(`Found ${cityTweets.length} tweets for ${cityName}`);

      if (cityTweets.length > 0) {

        currentHoveredNodeIdRef.current = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
        setHoverInfo({
          coordinate: [longitude, latitude],
          tweets: cityTweets.map((tweet: TweetData) => ({
            text: tweet.text || 'No text available',
            author: tweet.author || 'Unknown',
            topic: tweet.topic || 'No topic',
            location: tweet.location
          }))
        });
      } else {

        currentHoveredNodeIdRef.current = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
        setHoverInfo({
          coordinate: [longitude, latitude],
          tweets: [{
            text: `No tweets found for ${cityName}`,
            author: 'System',
            topic: 'Search Result',
            location: undefined
          }]
        });
      }
    }
  }, [currentData]);


  const handleViewStateChange = useCallback((params: { viewState: ViewState }) => {
    setViewState(params.viewState);
  }, []);


  const handleHover = useCallback((info: HoverInfo) => {



    if (info && info.object && info.coordinate) {

      const nodeId = info.object.id;


      if (nodeId && nodeId === currentHoveredNodeIdRef.current) {
        return;
      }

      let tweets: Array<{text: string; author: string; topic: string; location?: {
        city?: string;
        state?: string;
        country?: string;
        coordinates?: [number, number];
      }}> = [];

      if (info.object.points && Array.isArray(info.object.points)) {

        tweets = info.object.points.map((point: any) => ({
          text: point.text || 'No text available',
          author: point.author || 'Unknown',
          topic: point.topic || 'No topic',
          location: point.location
        }));
      } else if (info.object.text) {

        tweets = [{
          text: info.object.text || 'No text available',
          author: info.object.author || 'Unknown',
          topic: info.object.topic || 'No topic',
          location: info.object.location
        }];
      }


      if (tweets.length > 0 && info.coordinate && info.coordinate.length >= 2) {
        currentHoveredNodeIdRef.current = nodeId;
        setHoverInfo({
          coordinate: [info.coordinate[0], info.coordinate[1]],
          tweets
        });
      }
    } else {


      currentHoveredNodeIdRef.current = null;
    }

  }, []);

  const handleClick = useCallback((info: HoverInfo) => {

    if (info && info.object && info.coordinate && info.coordinate.length >= 2) {
      const [longitude, latitude] = info.coordinate;

      setViewState(prevState => ({
        ...prevState,
        longitude,
        latitude,
        zoom: 6.5,
        transitionDuration: 3200,
        transitionInterpolator: new FlyToInterpolator({
          speed: 0.9,
          curve: 1.7
        }),
        transitionEasing: (t: number) => {

          if (t === 1) return 1;
          const c4 = (2 * Math.PI) / 4.5;
          return t === 0 ? 0 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        }
      }));


      let tweets: Array<{text: string; author: string; topic: string; location?: {
        city?: string;
        state?: string;
        country?: string;
        coordinates?: [number, number];
      }}> = [];

      if (info.object.points && Array.isArray(info.object.points)) {
        tweets = info.object.points.map((point: any) => ({
          text: point.text || 'No text available',
          author: point.author || 'Unknown',
          topic: point.topic || 'No topic',
          location: point.location
        }));
      } else if (info.object.text) {
        tweets = [{
          text: info.object.text || 'No text available',
          author: info.object.author || 'Unknown',
          topic: info.object.topic || 'No topic',
          location: info.object.location
        }];
      }

      if (tweets.length > 0) {

        currentHoveredNodeIdRef.current = info.object.id || null;
        setHoverInfo({
          coordinate: [longitude, latitude],
          tweets
        });
      }
    }
  }, []);

const handleTopicSelect = useCallback((topic: string | null) => {
  console.log('Explorer: Topic selection changed to:', topic);
  setSelectedTopic(topic);

  setHoverInfo(null);
  currentHoveredNodeIdRef.current = null;


  setViewState({
    longitude: -95,
    latitude: 40,
    zoom: 4,
    pitch: 45,
    bearing: 0,
    transitionDuration: 3000,
    transitionInterpolator: new FlyToInterpolator({
      speed: 0.85,
      curve: 1.6
    }),
    transitionEasing: (t: number) => {

      return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;
    }
  });

  fetchData(topic, true);
}, [fetchData]);


  useEffect(() => {
    fetchData(null, false);
  }, [fetchData]);


  useEffect(() => {

    if (initialCity && currentData.length > 0 && !hasInitializedCity) {

      const cityTweet = currentData.find(
        (tweet) => tweet.location && tweet.location.city &&
        tweet.location.city.toLowerCase() === initialCity.toLowerCase()
      );

      if (cityTweet && cityTweet.location && cityTweet.location.coordinates) {
        const [lon, lat] = cityTweet.location.coordinates;

        setTimeout(() => {
          handleLocationSelect(lon, lat, cityTweet.location?.city);
          setHasInitializedCity(true);
        }, 800);
      }
    }
  }, [initialCity, currentData, handleLocationSelect, hasInitializedCity]);


  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Auto-refreshing data every 5 seconds for topic:', selectedTopic || 'all topics');
      fetchData(selectedTopic, false);
    }, 5000);

  return () => {
    clearInterval(intervalId);
  };


}, [selectedTopic, fetchData]);


  // Handle fade-in when map is loaded and data is ready
  useEffect(() => {
    if (isMapLoaded && currentData.length > 0 && !showContent) {
      // Small delay to ensure everything is rendered
      setTimeout(() => {
        setShowContent(true);
      }, 300);
    }
  }, [isMapLoaded, currentData, showContent]);

  // Handler for when map finishes loading
  const handleMapLoad = useCallback(() => {
    console.log('Map has finished loading');
    setIsMapLoaded(true);
  }, []);


  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-black via-[#1a0010] to-black" style={{ fontFamily: 'Inter, sans-serif' }}>
        {}
        {isLoading && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-[#E20074]/20 backdrop-blur-lg text-white px-6 py-3 rounded-xl border border-[#E20074]/40 shadow-lg shadow-[#E20074]/20 font-light tracking-wide">
            Loading {selectedTopic ? `"${selectedTopic}"` : 'all'} data...
          </div>
        )}

      {}
      <div
        className="absolute inset-0 z-0 transition-opacity duration-500 ease-in-out"
        style={{ opacity: mapOpacity }}
      >
        <SimpleMap
          data={currentData}
          opacity={0.8}
          cellSize={12}
          colorDomain={[0, 20]}
          aggregation="SUM"
          pickable={true}
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          onHover={handleHover}
          onClick={handleClick}
          onLoad={handleMapLoad}
          refreshKey={layerRefreshKey}
        />
      </div>

      {}
      {isTransitioning && (
        <div className="absolute inset-0 z-5 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-[#E20074]/5 via-[#FF00A0]/5 to-[#FF1493]/5 animate-pulse" />
          <div className="absolute inset-0 backdrop-blur-[2px]" />
        </div>
      )}

      {}
      <div className="relative z-10 flex h-full w-full pointer-events-none">
        <div className="pointer-events-auto">
          <Sidebar
            className="rounded-xl h-[80vh] m-4 p-4 bg-black/40 backdrop-blur-lg border border-[#E20074]/30 shadow-lg shadow-[#E20074]/10"
            onTopicSelect={handleTopicSelect}
          />
        </div>

        {}
        <div className="flex-1"></div>

        {}
        <div className="pointer-events-auto mr-4 mt-4 flex flex-col gap-4">
          <HoverInfoPanel className="w-64" hoverInfo={hoverInfo} />
          <InsightsPanel
            className="w-64"
            topic={selectedTopic}
            currentData={currentData}
            hoveredTweets={hoverInfo?.tweets}
          />
        </div>
      </div>

      {}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 w-1/3">
        <SearchBar onLocationSelect={handleLocationSelect} />
      </div>

      {}
      <div
        className="absolute inset-0 transition-opacity duration-1000 ease-out pointer-events-none bg-black"
        style={{
          opacity: showContent ? 0 : 1,
          zIndex: 25
        }}
      >
        {}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="title" style={{ fontSize: '3rem', textTransform: 'lowercase' }}>
            scraping tweets
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explorer;