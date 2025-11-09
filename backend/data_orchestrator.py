
import os
import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv


from twitter_generator import TwitterScraper, scrape_topics_from_list
from downdetector_scraper import get_downdetector_data

load_dotenv()


CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)


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

    def __init__(self):
        self.cache_dir = CACHE_DIR
        self.twitter_scraper = None
        print("[DataOrchestrator] Initialized")

    def check_cache_exists(self) -> bool:
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

    def _get_twitter_scraper(self) -> TwitterScraper:
        if self.twitter_scraper is None:
            self.twitter_scraper = TwitterScraper()
        return self.twitter_scraper

    def scrape_trends_from_web(self, use_tmobile_topics: bool = True) -> List[str]:

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
        cache_file = self.cache_dir / "trends_us.json"
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(trends, f, indent=2, ensure_ascii=False)
            print(f"[DataOrchestrator] Saved {len(trends)} trends to cache")
        except Exception as e:
            print(f"[DataOrchestrator] Error saving trends cache: {e}")

    def load_trends_cache(self) -> Optional[List[str]]:
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

    def get_trends(
        self,
        force_refresh: bool = False,
        use_tmobile_topics: bool = True
    ) -> List[str]:

        if not force_refresh:
            cached_trends = self.load_trends_cache()
            if cached_trends:
                return cached_trends


        trends = self.scrape_trends_from_web(use_tmobile_topics=use_tmobile_topics)


        if trends:
            self.save_trends_cache(trends)

        return trends

    def scrape_downdetector(self, force_refresh: bool = False) -> Optional[Dict]:
        print("[DataOrchestrator] Fetching DownDetector data...")
        return get_downdetector_data(force_refresh=force_refresh)

    def scrape_tweets_for_topics(
        self,
        topics: List[str],
        max_items_per_topic: int = 50,
        force_refresh: bool = False
    ) -> Dict[str, List[Dict]]:
        print(f"[DataOrchestrator] Scraping tweets for {len(topics)} topics...")

        scraper = self._get_twitter_scraper()
        results = {}

        for i, topic in enumerate(topics, 1):
            try:
                print(f"\n[{i}/{len(topics)}] Scraping: {topic}")

                tweets = scraper.scrape_and_cache_topic(
                    topic,
                    max_items=max_items_per_topic,
                    force_refresh=force_refresh
                )

                results[topic] = tweets
                print(f"  � Got {len(tweets)} tweets")


                if i < len(topics):
                    time.sleep(3)

            except Exception as e:
                print(f"[DataOrchestrator] Error scraping topic '{topic}': {e}")
                results[topic] = []

        total_tweets = sum(len(tweets) for tweets in results.values())
        print(f"\n[DataOrchestrator] Total tweets scraped: {total_tweets}")

        return results

    def generate_sentiment_cache(
        self,
        trends: List[str],
        tweets_data: Dict[str, List[Dict]]
    ) -> Dict[str, Any]:
        print("[DataOrchestrator] Generating sentiment data structure...")

        clusters = []
        articles = []
        article_id = 1

        for cluster_id, topic in enumerate(trends, start=1):

            clusters.append({
                "cluster_id": cluster_id,
                "cluster_title": topic,
                "cluster_summary": f"Customer feedback and discussions about {topic}"
            })


            topic_tweets = tweets_data.get(topic, [])


            for tweet in topic_tweets:
                author_name = tweet.get("author", {}).get("name", "Unknown")
                text = tweet.get("text", "")
                location = tweet.get("location", {})

                city = location.get("city", "Unknown")
                state = location.get("state", "")
                source = f"{city}, {state}".strip(", ") if city != "Unknown" else "Unknown"

                articles.append({
                    "article_id": article_id,
                    "title": f"{author_name} - {topic}",
                    "text": text,
                    "article_summary": text[:100] + "..." if len(text) > 100 else text,
                    "source": source,
                    "cluster_id": cluster_id
                })

                article_id += 1

        sentiment_data = {
            "clusters": clusters,
            "articles": articles
        }

        print(f"[DataOrchestrator] Generated {len(clusters)} clusters, {len(articles)} articles")


        cache_file = self.cache_dir / "tmobile_sentiment_data.json"
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(sentiment_data, f, indent=2, ensure_ascii=False)
            print(f"[DataOrchestrator] Saved sentiment data to {cache_file}")
        except Exception as e:
            print(f"[DataOrchestrator] Error saving sentiment data: {e}")

        return sentiment_data

    def orchestrate_full_data_collection(
        self,
        force_refresh: bool = False,
        use_tmobile_topics: bool = True,
        max_tweets_per_topic: int = 50
    ) -> Dict[str, Any]:
        print("\n" + "=" * 70)
        print("DATA ORCHESTRATION STARTED")
        print("=" * 70)

        start_time = time.time()
        summary = {}


        print("\n[1/4] Getting trending topics...")
        trends = self.get_trends(
            force_refresh=force_refresh,
            use_tmobile_topics=use_tmobile_topics
        )
        summary["trends_count"] = len(trends)
        summary["trends"] = trends


        print("\n[2/4] Scraping DownDetector...")
        downdetector_data = self.scrape_downdetector(force_refresh=force_refresh)
        summary["downdetector_success"] = downdetector_data is not None


        print(f"\n[3/4] Scraping tweets for {len(trends)} topics...")
        tweets_data = self.scrape_tweets_for_topics(
            trends,
            max_items_per_topic=max_tweets_per_topic,
            force_refresh=force_refresh
        )
        summary["topics_scraped"] = len(tweets_data)
        summary["total_tweets"] = sum(len(tweets) for tweets in tweets_data.values())


        print("\n[4/4] Generating sentiment data...")
        sentiment_data = self.generate_sentiment_cache(trends, tweets_data)
        summary["sentiment_clusters"] = len(sentiment_data.get("clusters", []))
        summary["sentiment_articles"] = len(sentiment_data.get("articles", []))


        elapsed = time.time() - start_time
        summary["elapsed_seconds"] = round(elapsed, 2)

        print("\n" + "=" * 70)
        print("DATA ORCHESTRATION COMPLETED")
        print("=" * 70)
        print(f"Trends: {summary['trends_count']}")
        print(f"Topics scraped: {summary['topics_scraped']}")
        print(f"Total tweets: {summary['total_tweets']}")
        print(f"Sentiment clusters: {summary['sentiment_clusters']}")
        print(f"Sentiment articles: {summary['sentiment_articles']}")
        print(f"DownDetector: {'Success' if summary['downdetector_success'] else 'Failed'}")
        print(f"Time elapsed: {summary['elapsed_seconds']}s")
        print("=" * 70 + "\n")

        return summary


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Data Orchestrator - Collect all T-Mobile social data")
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force refresh all data (ignore cache)"
    )
    parser.add_argument(
        "--real-trends",
        action="store_true",
        help="Use real trending topics from Trends24 instead of T-Mobile topics"
    )
    parser.add_argument(
        "--max-tweets",
        type=int,
        default=50,
        help="Maximum tweets per topic (default: 50)"
    )

    args = parser.parse_args()


    orchestrator = DataOrchestrator()


    cache_exists = orchestrator.check_cache_exists()

    if cache_exists and not args.force_refresh:
        print("\n" + "=" * 70)
        print("CACHE ALREADY EXISTS")
        print("=" * 70)
        print("Cache is valid and contains sufficient data.")
        print("No scraping needed - backend will use cached data.")
        print("")
        print("To refresh data anyway, run with --force-refresh:")
        print("  python data_orchestrator.py --force-refresh")
        print("=" * 70 + "\n")
        return {"status": "cache_exists", "message": "Using existing cache"}


    if args.force_refresh:
        print("\n[DataOrchestrator] Force refresh requested - scraping fresh data...\n")
    else:
        print("\n[DataOrchestrator] Cache not found or invalid - scraping fresh data...\n")


    summary = orchestrator.orchestrate_full_data_collection(
        force_refresh=args.force_refresh,
        use_tmobile_topics=not args.real_trends,
        max_tweets_per_topic=args.max_tweets
    )

    print("\nData collection complete! Cache is ready for use.")
    return summary


if __name__ == "__main__":
    main()
