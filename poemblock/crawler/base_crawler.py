import json
import time
import random
from pathlib import Path
from urllib.robotparser import RobotFileParser

import requests


class BaseCrawler:
    """Shared crawling infrastructure for all poetry site crawlers.

    Provides rate limiting, robots.txt compliance, HTTP session management,
    and JSON output utilities.
    """

    def __init__(self, delay=3.0, jitter=1.0, user_agent=None):
        """
        Args:
            delay: Base seconds between requests.
            jitter: Random ± seconds added to delay (min effective delay 0.5s).
            user_agent: Custom User-Agent string. Defaults to a Chrome UA.
        """
        self.delay = delay
        self.jitter = jitter
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        )
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.user_agent})
        self.last_request_time = 0.0
        self.robots_url = None
        self.rp = None

    def _check_robots(self):
        """Load and parse robots.txt for the crawler's base domain.

        Uses the same session/UA as fetch() for consistency, so the robots.txt
        we see is the one the bot is allowed to see.
        """
        if not self.robots_url:
            return
        self.rp = RobotFileParser()
        try:
            resp = self.session.get(self.robots_url, timeout=10)
            resp.raise_for_status()
            self.rp.parse(resp.text.splitlines())
        except Exception:
            self.rp = None  # proceed cautiously if robots.txt is unreachable

    def can_fetch(self, url):
        """Check robots.txt before fetching a URL."""
        if self.rp is None:
            return True
        return self.rp.can_fetch(self.user_agent, url)

    def rate_limit(self):
        """Sleep for delay + jitter seconds since last request."""
        elapsed = time.time() - self.last_request_time
        wait = self.delay + random.uniform(-self.jitter, self.jitter)
        wait = max(wait, 0.5)  # minimum 0.5s
        if elapsed < wait:
            time.sleep(wait - elapsed)

    def fetch(self, url, params=None):
        """Fetch a URL with rate limiting and robots.txt checking.

        Returns:
            requests.Response on success, None if disallowed or on error.
        """
        if not self.can_fetch(url):
            print(f"[SKIP] robots.txt disallows: {url}")
            return None
        self.rate_limit()
        try:
            resp = self.session.get(url, params=params, timeout=15)
            resp.raise_for_status()
            self.last_request_time = time.time()
            return resp
        except requests.RequestException as e:
            print(f"[ERROR] Failed to fetch {url}: {e}")
            return None

    def save_poems(self, poems, output_path):
        """Save a list of poem dicts to a JSON file.

        Each poem dict must have: title, author, lines[], source.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(poems, f, ensure_ascii=False, indent=2)
        print(f"[SAVED] {len(poems)} poems to {output_path}")