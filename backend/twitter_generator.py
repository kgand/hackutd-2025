import os
import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()

# Configuration
CACHE_DIR = Path("cache")
APIFY_TOKEN = os.getenv("apify_token")
APIFY_ACTOR = os.getenv("apify_actor", "apify/twitter-scraper")

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


if __name__ == "__main__":
    print("Twitter Scraper Module")
    print("Initialization complete")
