import requests
from bs4 import BeautifulSoup
import json
from pathlib import Path
from typing import Dict, Optional
import time

# Configuration
CACHE_DIR = Path("cache")
CACHE_FILE = CACHE_DIR / "downdetector.json"
DOWNDETECTOR_URL = "https://downdetector.com/status/t-mobile"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


if __name__ == "__main__":
    print("DownDetector Scraper Module")
    print(f"Target URL: {DOWNDETECTOR_URL}")
    print(f"Cache directory: {CACHE_DIR}")
