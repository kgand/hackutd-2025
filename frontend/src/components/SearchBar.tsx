import React, { useState, useEffect } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface AutocompleteSuggestion {
  placeId: string;
  name: string;
  city: string;
  state: string;
  country: string;
  geometry: {
    coordinates: [number, number];
  };
}

interface SearchBarProps {
  onLocationSelect?: (longitude: number, latitude: number, cityName?: string) => void;
  className?: string;
}


async function fetchCachedCities(query: string): Promise<AutocompleteSuggestion[]> {
  if (query.length < 1) {
    return [];
  }

  try {

    const response = await fetch('http://localhost:3000/api/flattened');
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const tweets = await response.json();


    const cityMap = new Map<string, AutocompleteSuggestion>();

    tweets.forEach((tweet: any) => {

      if (tweet.location && tweet.location.city && tweet.location.coordinates) {
        const city = tweet.location.city;
        const state = tweet.location.state || 'Unknown';
        const country = tweet.location.country || 'USA';
        const [lon, lat] = tweet.location.coordinates;


        const key = `${city}, ${state}`;


        if (!cityMap.has(key)) {
          cityMap.set(key, {
            placeId: `city-${cityMap.size}`,
            name: city,
            city: city,
            state: state,
            country: country,
            geometry: {
              coordinates: [lon, lat]
            }
          });
        }
      }
    });


    const queryLower = query.toLowerCase();
    const filtered = Array.from(cityMap.values())
      .filter(loc => loc.city.toLowerCase().includes(queryLower))
      .sort((a, b) => a.city.localeCompare(b.city))
      .slice(0, 10);

    return filtered;
  } catch (error) {
    console.error('Error fetching cached cities:', error);
    return [];
  }
}

const SearchBar: React.FC<SearchBarProps> = ({ onLocationSelect, className }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);


  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const results = await fetchCachedCities(query);
        setSuggestions(results);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch location suggestions');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };


    const timeoutId = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {

    setQuery(`${suggestion.city}, ${suggestion.state}`);
    setOpen(false);
    setSuggestions([]);


    const [longitude, latitude] = suggestion.geometry.coordinates;

    if (onLocationSelect) {
      onLocationSelect(longitude, latitude, suggestion.city);
    }

    console.log(`Selected location: ${suggestion.city}, ${suggestion.state} at [${longitude}, ${latitude}]`);
  };

  return (
    <div className={`relative ${className || ''}`}>
      <Command
        className="rounded-xl border border-[#E20074]/30 shadow-lg shadow-[#E20074]/10 bg-black/30 backdrop-blur-lg"
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search for a city..."
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setOpen(value.length > 0);
          }}
          onFocus={() => {
            if (query.length > 0) {
              setOpen(true);
            }
          }}
          onBlur={() => {

            setTimeout(() => setOpen(false), 300);
          }}
          onKeyDown={(e) => {

            if (e.key === 'Enter' && suggestions.length > 0 && !isLoading) {
              e.preventDefault();
              handleSelectSuggestion(suggestions[0]);
            }
          }}
        />
        {open && (
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading cities...
                </div>
              </div>
            )}
            {!isLoading && error && (
              <div className="py-6 px-4">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}
            {!isLoading && !error && suggestions.length === 0 && query.length > 0 && (
              <CommandEmpty>No cities found.</CommandEmpty>
            )}
            {!isLoading && !error && suggestions.length > 0 && (
              <CommandGroup heading="Cities">
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.placeId}
                    value={`${suggestion.city}-${suggestion.state}`}
                    onSelect={() => handleSelectSuggestion(suggestion)}
                    onMouseDown={(e) => {

                      e.preventDefault();
                      handleSelectSuggestion(suggestion);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <img src="/assets/img/tmobile.png" alt="T-Mobile" className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-semibold">{suggestion.city}</span>
                      <span className="text-xs text-gray-400">
                        {suggestion.state}, {suggestion.country}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
};

export default SearchBar;