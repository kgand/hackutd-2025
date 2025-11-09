
import os
import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from apify_client import ApifyClient
import requests
from dotenv import load_dotenv

load_dotenv()


CACHE_DIR = Path("cache")
APIFY_TOKEN = os.getenv("apify_token")
APIFY_ACTOR = os.getenv("apify_actor", "apify/twitter-scraper")
PYTHON_API_URL = "http://localhost:5000/extract-location"


CACHE_DIR.mkdir(exist_ok=True)


class TwitterScraper:

    def __init__(self, apify_token: str = None, actor_id: str = None):
        self.token = apify_token or APIFY_TOKEN
        self.actor_id = actor_id or APIFY_ACTOR

        if not self.token:
            raise ValueError("Apify token not provided. Set apify_token in .env or pass to constructor.")

        self.client = ApifyClient(self.token)
        print(f"[TwitterScraper] Initialized with actor: {self.actor_id}")

    def scrape_tweets(
        self,
        search_terms: List[str],
        max_items: int = 100,
        since_hours: int = 24
    ) -> List[Dict[str, Any]]:
        print(f"[TwitterScraper] Scraping tweets for: {search_terms}")
        print(f"[TwitterScraper] Max items: {max_items}, Since: {since_hours}h ago")


        since_time = datetime.utcnow() - timedelta(hours=since_hours)
        since_timestamp = int(since_time.timestamp() * 1000)


        run_input = {
            "searchTerms": search_terms,
            "maxItems": max_items,
            "sort": "Latest",
            "tweetLanguage": "en",
            "onlyVerifiedUsers": False,
            "onlyTwitterBlue": False,
        }


        if since_hours < 168:
            run_input["since_time"] = since_timestamp

        try:

            print(f"[TwitterScraper] Starting Apify actor run...")
            run = self.client.actor(self.actor_id).call(run_input=run_input)

            print(f"[TwitterScraper] Actor run completed: {run['id']}")
            print(f"[TwitterScraper] Status: {run['status']}")


            dataset_id = run["defaultDatasetId"]
            items = []

            print(f"[TwitterScraper] Fetching results from dataset: {dataset_id}")


            for item in self.client.dataset(dataset_id).iterate_items():
                items.append(item)

            print(f"[TwitterScraper] Retrieved {len(items)} tweets from Apify")
            return items

        except Exception as e:
            print(f"[TwitterScraper] Error during scraping: {e}")
            raise

    def extract_tweet_text(self, tweet: Dict[str, Any]) -> str:

        return tweet.get("text") or tweet.get("full_text") or tweet.get("content") or ""

    def find_location_fields(self, obj: Any, path: str = "") -> List[tuple]:
        location_keywords = {
            'location', 'place', 'city', 'state', 'country', 'address',
            'geo', 'coordinates', 'lat', 'lon', 'latitude', 'longitude',
            'zip', 'zipcode', 'postalcode', 'countrycode', 'region'
        }

        results = []

        if isinstance(obj, dict):
            for key, value in obj.items():
                new_path = f"{path}.{key}" if path else key


                if key.lower() in location_keywords and value:
                    results.append((new_path, value))


                results.extend(self.find_location_fields(value, new_path))

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                new_path = f"{path}[{i}]"
                results.extend(self.find_location_fields(item, new_path))

        return results

    def extract_location_via_api(
        self,
        tweet_text: str,
        location_fields: List[tuple]
    ) -> Optional[Dict[str, Any]]:

        location_values = [str(value) for path, value in location_fields if value]
        location_context = ", ".join(location_values) if location_values else ""

        payload = {
            "tweet_text": tweet_text,
            "location_context": location_context
        }

        try:
            response = requests.post(
                PYTHON_API_URL,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"[TwitterScraper] Location extraction API error: {e}")
            return None

    def process_tweets(
        self,
        tweets: List[Dict[str, Any]],
        extract_locations: bool = True
    ) -> List[Dict[str, Any]]:
        processed = []

        for i, tweet in enumerate(tweets):
            try:

                tweet_id = tweet.get("id") or tweet.get("id_str") or f"tweet_{i}"
                text = self.extract_tweet_text(tweet)
                created_at = tweet.get("createdAt") or tweet.get("created_at")


                author = tweet.get("author") or tweet.get("user") or {}
                author_name = author.get("name") or author.get("userName") or "Unknown"
                author_username = author.get("userName") or author.get("screen_name") or "unknown"


                processed_tweet = {
                    "id": str(tweet_id),
                    "text": text,
                    "createdAt": created_at or datetime.utcnow().isoformat(),
                    "author": {
                        "userName": author_username,
                        "name": author_name
                    }
                }


                if extract_locations and text:
                    location_fields = self.find_location_fields(tweet)

                    if location_fields or text:

                        location_result = self.extract_location_via_api(text, location_fields)

                        if location_result and location_result.get("coordinates"):
                            coords = location_result["coordinates"]
                            extracted_loc = location_result.get("extracted_location", "Unknown")


                            if coords and len(coords) == 2:
                                lat, lon = coords


                                location_parts = extracted_loc.split(",")
                                city = location_parts[0].strip() if len(location_parts) > 0 else "Unknown"
                                state = location_parts[1].strip() if len(location_parts) > 1 else ""
                                country = location_parts[-1].strip() if len(location_parts) > 0 else "USA"

                                processed_tweet["location"] = {
                                    "city": city,
                                    "state": state,
                                    "country": country,
                                    "coordinates": [lon, lat]
                                }

                processed.append(processed_tweet)


                if (i + 1) % 10 == 0:
                    print(f"[TwitterScraper] Processed {i + 1}/{len(tweets)} tweets")

            except Exception as e:
                print(f"[TwitterScraper] Error processing tweet {i}: {e}")
                continue

        print(f"[TwitterScraper] Successfully processed {len(processed)}/{len(tweets)} tweets")
        return processed

    def save_to_cache(self, cache_key: str, data: Any) -> None:
        try:
            cache_file = CACHE_DIR / f"{cache_key}.json"
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"[TwitterScraper] Saved {len(data) if isinstance(data, list) else 'data'} to {cache_file}")
        except Exception as e:
            print(f"[TwitterScraper] Error saving cache: {e}")

    def load_from_cache(self, cache_key: str) -> Optional[Any]:
        try:
            cache_file = CACHE_DIR / f"{cache_key}.json"
            if not cache_file.exists():
                return None

            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"[TwitterScraper] Loaded from cache: {cache_key}")
            return data
        except Exception as e:
            print(f"[TwitterScraper] Error loading cache: {e}")
            return None

    def scrape_and_cache_topic(
        self,
        topic: str,
        max_items: int = 100,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        cache_key = f"tweets_{topic.replace(' ', '_')}"


        if not force_refresh:
            cached = self.load_from_cache(cache_key)
            if cached:
                return cached


        print(f"\n{'='*60}")
        print(f"Scraping topic: {topic}")
        print(f"{'='*60}")

        raw_tweets = self.scrape_tweets(
            search_terms=[topic],
            max_items=max_items,
            since_hours=24
        )

        if not raw_tweets:
            print(f"[TwitterScraper] No tweets found for topic: {topic}")
            return []


        processed = self.process_tweets(raw_tweets, extract_locations=True)


        self.save_to_cache(cache_key, processed)

        return processed


def scrape_topics_from_list(
    topics: List[str],
    max_items_per_topic: int = 50,
    force_refresh: bool = False
) -> Dict[str, List[Dict[str, Any]]]:
    scraper = TwitterScraper()
    results = {}

    for topic in topics:
        try:
            tweets = scraper.scrape_and_cache_topic(
                topic,
                max_items=max_items_per_topic,
                force_refresh=force_refresh
            )
            results[topic] = tweets


            time.sleep(2)

        except Exception as e:
            print(f"[Error] Failed to scrape topic '{topic}': {e}")
            results[topic] = []

    return results


if __name__ == "__main__":
    import sys

    print("Twitter Scraper Test")
    print("=" * 60)


    test_topic = "T-Mobile 5G"
    cache_key = f"tweets_{test_topic.replace(' ', '_')}"
    cache_file = CACHE_DIR / f"{cache_key}.json"


    if cache_file.exists() and "--force" not in sys.argv:
        print(f"\nCache exists for '{test_topic}'")
        print(f"Cache file: {cache_file}")

        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_tweets = json.load(f)
            print(f"Cached tweets: {len(cached_tweets)}")
            print("\nTo scrape fresh data, run: python twitter_generator.py --force")
        except Exception as e:
            print(f"Error reading cache: {e}")

        sys.exit(0)

    print(f"\nScraping fresh data for '{test_topic}'...")
    print("(This requires Apify token and location API running)")

    try:
        scraper = TwitterScraper()
        tweets = scraper.scrape_and_cache_topic(
            test_topic,
            max_items=20,
            force_refresh=True
        )

        print(f"\n{'='*60}")
        print(f"Results for '{test_topic}':")
        print(f"Total tweets: {len(tweets)}")

        if tweets:
            print(f"\nSample tweet:")
            sample = tweets[0]
            print(f"  ID: {sample.get('id')}")
            print(f"  Text: {sample.get('text', '')[:100]}...")
            print(f"  Author: {sample.get('author', {}).get('name')}")
            if 'location' in sample:
                loc = sample['location']
                print(f"  Location: {loc.get('city')}, {loc.get('state')} ({loc.get('coordinates')})")

    except Exception as e:
        print(f"\nError during test: {e}")
