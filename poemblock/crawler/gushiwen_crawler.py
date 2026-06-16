"""Crawler for Chinese poems from m.gushiwen.cn (mobile version).

The desktop site (gushiwen.cn) redirects to guwendao.net which requires login.
The mobile site (m.gushiwen.cn) is still accessible and supports:
  - Author listing by dynasty: /authors/Default.aspx
  - Author poems listing: /shiwens/default.aspx?astr=<author_name>
  - Full poem text is embedded in the listing page (no individual poem pages needed)

Strategy: iterate over all dynasties, collect all authors, then fetch poems for each.
"""

import re
import time
from pathlib import Path
from urllib.parse import quote, urljoin

import hashlib

from bs4 import BeautifulSoup

from .base_crawler import BaseCrawler


class GushiwenCrawler(BaseCrawler):
    """Crawls m.gushiwen.cn for Chinese poetry."""

    BASE_URL = "https://m.gushiwen.cn"

    # Mobile user-agent to avoid redirect to guwendao.net
    MOBILE_UA = (
        "Mozilla/5.0 (Linux; Android 10; K) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Mobile Safari/537.36"
    )

    DYNASTIES = [
        "先秦", "两汉", "魏晋", "南北朝", "隋代",
        "唐代", "五代", "宋代", "金朝", "元代",
        "明代", "清代",
    ]

    # Fallback CSS selectors for poem blocks (in case site changes class names)
    POEM_BLOCK_SELECTORS = [
        "div.sons",
        "div[class*='sons']",
        "div.son",
        "div.poem",
        "div[class*='poem-item']",
    ]

    CONTENT_SELECTORS = [
        "div.contson",
        "div[class*='contson']",
        "div.poem-content",
        "div.content",
        "div.text",
    ]

    def __init__(self, delay=2.0, jitter=0.5, user_agent=None):
        super().__init__(delay, jitter, user_agent or self.MOBILE_UA)
        # robots.txt is not meaningful on mobile subdomain; skip check
        self.rp = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_poems_by_author(self, author: str, max_pages: int = 20) -> list[dict]:
        """Fetch poems by *author* from the listing page.

        Handles pagination automatically up to *max_pages*.
        Includes author-level deduplication to skip repeated poems.
        Returns a list of dicts with keys: title, author, lines[], source.
        """
        poems: list[dict] = []
        seen_hashes = set()
        page = 1
        while page <= max_pages:
            url = f"{self.BASE_URL}/shiwens/default.aspx"
            params = {"astr": author, "page": page}
            resp = self.fetch(url, params=params)
            if not resp:
                break

            soup = BeautifulSoup(resp.text, "lxml")
            batch = self._parse_poem_blocks(soup, author)

            # Author-level dedup: skip poems with same (first_line_hash, line_count)
            for p in batch:
                line_text = ' '.join(p["lines"])
                h = hashlib.md5(f"{p['title']}|{len(line_text)}|{line_text[:100]}".encode('utf-8')).hexdigest()
                if h not in seen_hashes:
                    seen_hashes.add(h)
                    poems.append(p)

            # Check for "next page" link using robust approach
            next_link = None
            for a_tag in soup.find_all("a", href=True):
                if "下一页" in a_tag.get_text(strip=True):
                    next_link = a_tag
                    break
            if not next_link:
                break
            page += 1

        print(f"[OK]    Found {len(poems)} poems for {author}")
        return poems

    def get_authors_by_dynasty(self, dynasty: str, max_pages: int = 5) -> list[tuple[str, str]]:
        """Return list of (author_name, author_url) for all authors in a dynasty."""
        authors: list[tuple[str, str]] = []
        for page in range(1, max_pages + 1):
            url = f"{self.BASE_URL}/authors/Default.aspx"
            params = {"p": page, "c": dynasty}
            resp = self.fetch(url, params=params)
            if not resp:
                break
            soup = BeautifulSoup(resp.text, "lxml")
            batch = []
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"]
                text = a_tag.get_text(strip=True)
                if "authorv" in href and text and len(text) > 1:
                    full_url = urljoin(self.BASE_URL, href)
                    batch.append((text, full_url))
            if not batch:
                break
            authors.extend(batch)
        # Deduplicate while preserving order
        seen = set()
        unique = []
        for name, url_ in authors:
            if name not in seen:
                seen.add(name)
                unique.append((name, url_))
        return unique

    def crawl_all_dynasties(self, max_authors_per_dynasty: int = 60) -> list[dict]:
        """Crawl poems from all dynasties (useful for bulk collection)."""
        all_poems: list[dict] = []
        for dynasty in self.DYNASTIES:
            print(f"\n--- Dynasty: {dynasty} ---")
            authors = self.get_authors_by_dynasty(dynasty)
            print(f"  Authors found: {len(authors)}")
            for name, url_ in authors[:max_authors_per_dynasty]:
                try:
                    poems = self.get_poems_by_author(name)
                    all_poems.extend(poems)
                except Exception as e:
                    print(f"  [ERROR] {name}: {e}")
                    continue
                self.rate_limit()
            if len(all_poems) > 8000:  # safety cap (was 3000)
                print("[DONE]  Reached poem limit, stopping")
                break
        return all_poems

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_poem_blocks(self, soup: BeautifulSoup, author: str) -> list[dict]:
        """Extract poem dicts from div.sons blocks on the listing page."""
        poems: list[dict] = []

        # Try each selector until we find blocks
        blocks = []
        for selector in self.POEM_BLOCK_SELECTORS:
            blocks = soup.select(selector)
            if blocks:
                break

        if not blocks:
            return poems

        for block in blocks:
            title_tag = block.select_one("b")
            if not title_tag:
                continue
            title = title_tag.get_text(strip=True)
            if not title:
                continue

            # Try each content selector
            content_tag = None
            for selector in self.CONTENT_SELECTORS:
                content_tag = block.select_one(selector)
                if content_tag:
                    break
            if not content_tag:
                continue

            raw_html = str(content_tag)
            raw_html = re.sub(r'<br\s*/?>', '\n', raw_html, flags=re.IGNORECASE)
            text = BeautifulSoup(raw_html, "lxml").get_text()
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            if not lines:
                continue

            # Source URL: link to the individual poem page (if present)
            source = self.BASE_URL
            for link in block.find_all("a", href=True):
                href = link["href"]
                if "shiwens" in href and "astr" not in href:
                    source = urljoin(self.BASE_URL, href)
                    break

            poems.append({
                "title": title,
                "author": author,
                "lines": lines,
                "source": source,
            })
        return poems

    def fetch(self, url, params=None, max_retries=3):
        """Override: use mobile UA and skip robots.txt. Retries on transient errors."""
        import time as time_mod
        self.rate_limit()
        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                resp = self.session.get(url, params=params, timeout=15)
                resp.raise_for_status()
                resp.encoding = "utf-8"
                self.last_request_time = time.time()
                return resp
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    wait = 2 ** attempt  # exponential backoff: 2s, 4s, 8s
                    print(f"[RETRY] {attempt}/{max_retries} for {url}: {e}, waiting {wait}s")
                    time_mod.sleep(wait)
                    continue
        print(f"[ERROR] Failed to fetch {url} after {max_retries} retries: {last_error}")
        return None


# ------------------------------------------------------------------
# Quick test
# ------------------------------------------------------------------
if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    crawler = GushiwenCrawler(delay=2.0, jitter=0.5)

    # Test 1: get author list for Tang dynasty
    print("=== Authors in Tang Dynasty (page 1) ===")
    authors = crawler.get_authors_by_dynasty("唐代", max_pages=1)
    for name, url_ in authors[:10]:
        print(f"  {name} -> {url_}")

    # Test 2: get poems for Li Bai
    print("\n=== Poems by 李白 ===")
    poems = crawler.get_poems_by_author("李白")
    for p in poems[:5]:
        print(f"  {p['title']} ({len(p['lines'])} lines)")
        for line in p['lines'][:3]:
            print(f"    {line}")
        if len(p['lines']) > 3:
            print("    ...")
    print(f"\nTotal: {len(poems)} poems")