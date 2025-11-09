import os
import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Import our modules
from twitter_generator import TwitterScraper, scrape_topics_from_list
from downdetector_scraper import get_downdetector_data

load_dotenv()

# Configuration
CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

# T-Mobile core topics to track
TMOBILE_CORE_TOPICS = [
    "T-Mobile 5G",
    "T-Mobile Customer Service",
    "T-Mobile Network",
    "T-Mobile Deals",
    "Magenta Monday",
    "T-Mobile Home Internet",
    "T-Mobile Tuesdays",
    "T-Mobile Trade-In",
    "T-Mobile Upgrade",
    "T-Mobile Coverage",
    "T-Mobile Billing",
    "T-Mobile Store",
    "T-Mobile Plans",
    "T-Mobile Prepaid",
    "T-Mobile Business",
    "T-Mobile Roaming",
    "T-Mobile App",
    "T-Mobile Support",
    "T-Mobile Promotions",
    "T-Mobile Family Plan"
]


class DataOrchestrator:
    """Orchestrates all data scraping operations"""

    def __init__(self):
        self.cache_dir = CACHE_DIR
        self.twitter_scraper = None
        print("[DataOrchestrator] Initialized")

    def check_cache_exists(self) -> bool:
        """Check if cache data already exists"""
        if not self.cache_dir.exists():
            print("[DataOrchestrator] Cache directory does not exist")
            return False

        trends_file = self.cache_dir / "trends_us.json"
        downdetector_file = self.cache_dir / "downdetector.json"

        if not trends_file.exists():
            print("[DataOrchestrator] trends_us.json not found in cache")
            return False

        try:
            with open(trends_file, "r", encoding="utf-8") as f:
                trends = json.load(f)

            if not trends or len(trends) == 0:
                print("[DataOrchestrator] trends_us.json is empty")
                return False

            tweet_files = list(self.cache_dir.glob("tweets_*.json"))
            if len(tweet_files) < 3:
                print(f"[DataOrchestrator] Only {len(tweet_files)} tweet cache files found, need at least 3")
                return False

            print(f"[DataOrchestrator] Cache exists with {len(trends)} trends and {len(tweet_files)} tweet files")
            return True

        except Exception as e:
            print(f"[DataOrchestrator] Error checking cache: {e}")
            return False

    def scrape_trends_from_web(self, use_tmobile_topics: bool = True) -> List[str]:
        """Scrape trending topics or use T-Mobile curated list"""
        if use_tmobile_topics:
            print("[DataOrchestrator] Using T-Mobile curated topics")
            return TMOBILE_CORE_TOPICS.copy()

        print("[DataOrchestrator] Scraping trends from Trends24...")

        try:
            url = "https://trends24.in/united-states/"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }

            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            trend_elements = soup.select("span.trend-name a.trend-link")

            trends = [elem.get_text(strip=True) for elem in trend_elements]
            trends = trends[:50]

            print(f"[DataOrchestrator] Scraped {len(trends)} trends from web")
            return trends

        except Exception as e:
            print(f"[DataOrchestrator] Error scraping trends: {e}")
            print("[DataOrchestrator] Falling back to T-Mobile topics")
            return TMOBILE_CORE_TOPICS.copy()

    def save_trends_cache(self, trends: List[str]) -> None:
        """Save trends to cache"""
        cache_file = self.cache_dir / "trends_us.json"
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(trends, f, indent=2, ensure_ascii=False)
            print(f"[DataOrchestrator] Saved {len(trends)} trends to cache")
        except Exception as e:
            print(f"[DataOrchestrator] Error saving trends cache: {e}")

    def load_trends_cache(self) -> Optional[List[str]]:
        """Load trends from cache"""
        cache_file = self.cache_dir / "trends_us.json"
        try:
            if not cache_file.exists():
                return None

            with open(cache_file, "r", encoding="utf-8") as f:
                trends = json.load(f)

            print(f"[DataOrchestrator] Loaded {len(trends)} trends from cache")
            return trends

        except Exception as e:
            print(f"[DataOrchestrator] Error loading trends cache: {e}")
            return None

    def run(
        self,
        force_refresh: bool = False,
        max_tweets_per_topic: int = 50,
        use_real_trends: bool = False
    ) -> None:
        """Run the complete data orchestration pipeline"""
        print("\n" + "="*70)
        print("T-MOBILE SENTIMENT DATA ORCHESTRATOR")
        print("="*70)

        # Check if we already have cached data
        if not force_refresh and self.check_cache_exists():
            print("\n✓ Cache data already exists!")
            print("  Use --force-refresh to scrape fresh data")
            return

        # Step 1: Get trending topics
        print("\n[1/3] Getting trending topics...")
        trends = self.scrape_trends_from_web(use_tmobile_topics=not use_real_trends)
        self.save_trends_cache(trends)

        # Step 2: Scrape tweets for each trend
        print(f"\n[2/3] Scraping tweets for {len(trends)} topics...")
        print(f"  Max tweets per topic: {max_tweets_per_topic}")

        results = scrape_topics_from_list(
            topics=trends,
            max_items_per_topic=max_tweets_per_topic,
            force_refresh=True
        )

        total_tweets = sum(len(tweets) for tweets in results.values())
        print(f"\n  Total tweets scraped: {total_tweets}")

        # Step 3: Scrape DownDetector data
        print("\n[3/3] Scraping DownDetector data...")
        downdetector_data = get_downdetector_data(force_refresh=True)

        if downdetector_data:
            print("  ✓ DownDetector data scraped successfully")
        else:
            print("  ✗ Failed to scrape DownDetector data")

        print("\n" + "="*70)
        print("DATA ORCHESTRATION COMPLETE!")
        print("="*70)
        print(f"\nSummary:")
        print(f"  Topics tracked: {len(trends)}")
        print(f"  Tweets collected: {total_tweets}")
        print(f"  DownDetector data: {'Yes' if downdetector_data else 'No'}")
        print(f"\nCache directory: {self.cache_dir.absolute()}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="T-Mobile Sentiment Data Orchestrator")
    parser.add_argument("--force-refresh", action="store_true", help="Force refresh all data")
    parser.add_argument("--max-tweets", type=int, default=50, help="Max tweets per topic")
    parser.add_argument("--real-trends", action="store_true", help="Use real trends instead of T-Mobile topics")

    args = parser.parse_args()

    orchestrator = DataOrchestrator()
    orchestrator.run(
        force_refresh=args.force_refresh,
        max_tweets_per_topic=args.max_tweets,
        use_real_trends=args.real_trends
    )

    print("Data Orchestrator Module")
    print(f"Tracking {len(TMOBILE_CORE_TOPICS)} T-Mobile topics")
