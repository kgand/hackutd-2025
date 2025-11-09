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

# Configuration
CACHE_DIR = Path("cache")
APIFY_TOKEN = os.getenv("apify_token")
APIFY_ACTOR = os.getenv("apify_actor", "apify/twitter-scraper")
PYTHON_API_URL = "http://localhost:5000/extract-location"

# Ensure cache directory exists
CACHE_DIR.mkdir(exist_ok=True)


class TwitterScraper:
    """Scrapes Twitter data using Apify API"""

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
        """Scrape tweets using Apify Twitter Scraper"""
        print(f"[TwitterScraper] Scraping tweets for: {search_terms}")
        print(f"[TwitterScraper] Max items: {max_items}, Since: {since_hours}h ago")

        # Calculate since timestamp
        since_time = datetime.utcnow() - timedelta(hours=since_hours)
        since_timestamp = int(since_time.timestamp() * 1000)

        # Configure run input
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

            # Fetch results from dataset
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
        """Extract text from tweet object"""
        return tweet.get("text") or tweet.get("full_text") or tweet.get("content") or ""

    def find_location_fields(self, obj: Any, path: str = "") -> List[tuple]:
        """Recursively find location-related fields in tweet data"""
        location_keywords = {
            'location', 'place', 'city', 'state', 'country', 'address',
            'geo', 'coordinates', 'lat', 'lon', 'latitude', 'longitude',
            'zip', 'zipcode', 'postalcode', 'countrycode', 'region'
        }

        results = []

        if isinstance(obj, dict):
            for key, value in obj.items():
                new_path = f"{path}.{key}" if path else key

                # Check if this key is location-related
                if key.lower() in location_keywords and value:
                    results.append((new_path, value))

                # Recurse into nested objects
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
        """Extract location from tweet using external API"""
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
        """Process raw tweets and extract location data"""
        processed = []

        for i, tweet in enumerate(tweets):
            try:
                # Extract basic tweet info
                tweet_id = tweet.get("id") or tweet.get("id_str") or f"tweet_{i}"
                text = self.extract_tweet_text(tweet)
                created_at = tweet.get("createdAt") or tweet.get("created_at")

                # Extract author info
                author = tweet.get("author") or tweet.get("user") or {}
                author_name = author.get("name") or author.get("userName") or "Unknown"
                author_username = author.get("userName") or author.get("screen_name") or "unknown"

                # Build processed tweet
                processed_tweet = {
                    "id": str(tweet_id),
                    "text": text,
                    "createdAt": created_at or datetime.utcnow().isoformat(),
                    "author": {
                        "userName": author_username,
                        "name": author_name
                    }
                }

                # Extract location if requested
                if extract_locations and text:
                    location_fields = self.find_location_fields(tweet)

                    if location_fields or text:
                        location_result = self.extract_location_via_api(text, location_fields)

                        if location_result and location_result.get("coordinates"):
                            coords = location_result["coordinates"]
                            extracted_loc = location_result.get("extracted_location", "Unknown")

                            if coords and len(coords) == 2:
                                lat, lon = coords

                                # Parse location string
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

                # Progress logging
                if (i + 1) % 10 == 0:
                    print(f"[TwitterScraper] Processed {i + 1}/{len(tweets)} tweets")

            except Exception as e:
                print(f"[TwitterScraper] Error processing tweet {i}: {e}")
                continue

        print(f"[TwitterScraper] Successfully processed {len(processed)}/{len(tweets)} tweets")
        return processed


if __name__ == "__main__":
    print("Twitter Scraper Module")
    print("Initialization complete")
