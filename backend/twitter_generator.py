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


if __name__ == "__main__":
    print("Twitter Scraper Module")
    print("Initialization complete")
