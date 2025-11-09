

interface GeocodingResult {
  city: string;
  state: string;
}

const locationDataCache = new Map<string, { city: string; state: string; timestamp: number }>();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

const createDelayPromise = (milliseconds: number) => new Promise(res => setTimeout(res, milliseconds));


export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult> {

  const coordKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;


  const cachedEntry = locationDataCache.get(coordKey);
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_EXPIRY_MS) {
    return { city: cachedEntry.city, state: cachedEntry.state };
  }

  try {

    const apiEndpoint = `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=10`;

    const apiResponse = await fetch(apiEndpoint, {
      headers: {
        'User-Agent': 'DailyIndigest/1.0'
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`Geocoding API returned ${apiResponse.status}`);
    }

    const responseData = await apiResponse.json();


    const addressComponents = responseData.address || {};
    const cityName = addressComponents.city || addressComponents.town || addressComponents.village || addressComponents.county || 'Unknown';
    const stateName = addressComponents.state || addressComponents.region || 'Unknown';


    locationDataCache.set(coordKey, {
      city: cityName,
      state: stateName,
      timestamp: Date.now()
    });

    return { city: cityName, state: stateName };
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    return { city: 'Unknown', state: 'Unknown' };
  }
}


export async function batchReverseGeocode(
  coordinateList: Array<{ lat: number; lon: number }>
): Promise<Map<string, GeocodingResult>> {
  const geocodingResults = new Map<string, GeocodingResult>();

  for (const coordinate of coordinateList) {
    const locationKey = `${coordinate.lat.toFixed(2)},${coordinate.lon.toFixed(2)}`;


    const existingCacheEntry = locationDataCache.get(locationKey);
    if (existingCacheEntry && Date.now() - existingCacheEntry.timestamp < CACHE_EXPIRY_MS) {
      geocodingResults.set(locationKey, { city: existingCacheEntry.city, state: existingCacheEntry.state });
      continue;
    }


    const geocodedLocation = await reverseGeocode(coordinate.lat, coordinate.lon);
    geocodingResults.set(locationKey, geocodedLocation);


    await createDelayPromise(1000);
  }

  return geocodingResults;
}


export function getCachedLocation(latitude: number, longitude: number): GeocodingResult | null {
  const lookupKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const storedLocation = locationDataCache.get(lookupKey);

  if (storedLocation && Date.now() - storedLocation.timestamp < CACHE_EXPIRY_MS) {
    return { city: storedLocation.city, state: storedLocation.state };
  }

  return null;
}
