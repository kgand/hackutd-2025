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


if __name__ == "__main__":
    print("Data Orchestrator Module")
    print(f"Tracking {len(TMOBILE_CORE_TOPICS)} T-Mobile topics")
