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


def scrape_downdetector() -> Optional[Dict]:
    """Scrape T-Mobile status from DownDetector"""
    print(f"[DownDetector] Scraping {DOWNDETECTOR_URL}")
    
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }
    
    try:
        response = requests.get(DOWNDETECTOR_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract logo
        logo = None
        logo_img = soup.select_one(".img-fluid")
        if logo_img and logo_img.get("src"):
            logo = logo_img["src"]
            if logo.startswith("//"):
                logo = "https:" + logo
        
        # Extract URL
        url = None
        company_link = soup.select_one("#company-status a")
        if company_link and company_link.get("href"):
            url = company_link["href"]
        
        # Extract problem percentages
        problems = {"app": "0", "website": "0", "server": "0"}
        problem_elements = soup.select(".indicatorChart_percentage")
        if len(problem_elements) >= 3:
            problems["app"] = problem_elements[0].get_text(strip=True).replace("%", "")
            problems["website"] = problem_elements[1].get_text(strip=True).replace("%", "")
            problems["server"] = problem_elements[2].get_text(strip=True).replace("%", "")
        
        # Extract comments
        comments = {}
        comment_divs = soup.select("#comments-card div[style*='margin-left:65px']")
        for index, elem in enumerate(comment_divs):
            try:
                user_elem = elem.select_one("strong")
                date_elem = elem.select_one(".updated")
                comment_elem = elem.select_one("p")
                
                if user_elem and date_elem and comment_elem:
                    user = user_elem.get_text(strip=True)
                    date = date_elem.get_text(strip=True)
                    comment_text = comment_elem.get_text(strip=True)
                    
                    # Remove username from comment if it starts with it
                    if comment_text.startswith(user):
                        comment_text = comment_text[len(user):].strip()
                    
                    comments[str(index)] = {
                        "user": user,
                        "date": date,
                        "comment": comment_text
                    }
            except Exception as e:
                print(f"[DownDetector] Error parsing comment {index}: {e}")
                continue
        
        # Build result
        result = {
            "logo": logo,
            "url": url,
            "problems": problems,
            "comments": comments,
            "chart": {"data": None, "baseline": None},
            "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        print(f"[DownDetector] Successfully scraped data: {len(comments)} comments, problems: {problems}")
        return result
        
    except requests.exceptions.RequestException as e:
        print(f"[DownDetector] Request error: {e}")
        return None
    except Exception as e:
        print(f"[DownDetector] Scraping error: {e}")
        return None


if __name__ == "__main__":
    print("DownDetector Scraper Module")
    print(f"Target URL: {DOWNDETECTOR_URL}")
    print(f"Cache directory: {CACHE_DIR}")
