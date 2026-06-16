"""Crawler for English poems from poetryfoundation.org.

Scrapes poems by poet slug: builds the poet's page URL from the slug,
then extracts poem titles and content from the DOM (updated for 2026 site layout).
"""

import re
from pathlib import Path

from bs4 import BeautifulSoup

from .base_crawler import BaseCrawler


class PoetryFoundationCrawler(BaseCrawler):
    """Crawls poetryfoundation.org for English poetry."""

    BASE_URL = "https://www.poetryfoundation.org"

    def __init__(self, delay=3.5, jitter=1.0, user_agent=None):
        super().__init__(delay, jitter, user_agent)
        self.robots_url = f"{self.BASE_URL}/robots.txt"
        self._check_robots()

    def get_poems_by_poet(self, name: str, slug: str) -> list[dict]:
        """Fetch poems by the poet identified by *slug*.

        Returns a list of dicts with keys: title, author, lines[], source.
        """
        page_url = f"{self.BASE_URL}/poets/{slug}"
        print(f"\n=== Fetching poet page: {page_url} ===")
        resp = self.fetch(page_url)
        if not resp:
            print(f"[WARN]  Could not fetch poet page: {page_url}")
            return []

        poems = self._poems_from_poet_page(resp.text, name)
        print(f"[OK]    Found {len(poems)} poems for {name}")
        return poems

    def _poems_from_poet_page(self, html: str, author: str) -> list[dict]:
        """Parse the poet's page to extract poem links, then fetch each poem.

        On poetryfoundation.org (2026), the poet page lists poems as links,
        typically in the main content region. We follow each link to fetch the full text.
        """
        soup = BeautifulSoup(html, "lxml")
        poems: list[dict] = []

        poem_links = set()

        # Non-poem paths to exclude
        EXCLUDE_PATHS = {"/poems/browse", "/poems/guides", "/poems/poem-of-the-day"}

        # Strategy 1: any <a href="/poems/..."> with 3 path segments: /poems/<id>/<slug>
        for a_tag in soup.select("a[href^='/poems/']"):
            href = a_tag["href"]
            parts = href.strip("/").split("/")
            if len(parts) == 3 and parts[0] == "poems" and href not in EXCLUDE_PATHS:
                poem_links.add(self.BASE_URL + href)

        # Strategy 2: <a> containing the poem title within the page body
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            parts = href.strip("/").split("/")
            if len(parts) == 3 and parts[0] == "poems" and href not in EXCLUDE_PATHS:
                text = a_tag.get_text(strip=True)
                if text and len(text) > 2:  # has visible text (likely a poem title link)
                    poem_links.add(self.BASE_URL + href)

        # Strategy 3: look within <div class="max-w-full"> or poet content area for better precision
        content_area = soup.select_one("div.max-w-full, div[class*='grid']")
        if content_area:
            for a_tag in content_area.find_all("a", href=True):
                href = a_tag["href"]
                parts = href.strip("/").split("/")
                if len(parts) == 3 and parts[0] == "poems" and href not in EXCLUDE_PATHS:
                    poem_links.add(self.BASE_URL + href)

        if not poem_links:
            print(f"[WARN]  No poem links found on poet page for {author}")
            return []

        poem_links = sorted(poem_links)  # deterministic order
        print(f"  Found {len(poem_links)} poem URLs, fetching each …")
        for i, url in enumerate(poem_links, 1):
            poem = self._fetch_single_poem(url, author)
            if poem:
                poems.append(poem)
            if i < len(poem_links):
                # be gentle between individual poem fetches
                self.rate_limit()

        return poems

    def _fetch_single_poem(self, url: str, author: str) -> dict | None:
        """Fetch and parse a single poem page.

        On the 2026 Poetry Foundation site, the poem content is typically in
        <div class="poem-body"> or <div class="rich-text copy-large">.
        Lines are separated by <br/> tags within the container.
        """
        resp = self.fetch(url)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, "lxml")

        # Try common containers for poem text in the 2026 site layout
        content_div = (
            soup.select_one("div.poem-body")
            or soup.select_one("div.rich-text.copy-large")
            or soup.select_one("div.relative[class*='annotations']")
            or soup.select_one("div.relative")  # last resort: the annotations container
        )
        if not content_div:
            print(f"  [SKIP] Could not find poem content container: {url}")
            return None

        # Extract lines: text split on <br/> tags
        raw_html = str(content_div)
        br_re = re.compile(r"<br\s*/?>", re.IGNORECASE)
        text_with_breaks = br_re.sub("\n", raw_html)

        # Strip all other HTML tags
        clean_text = BeautifulSoup(text_with_breaks, "lxml").get_text()
        lines = [
            line.strip().strip("\"").strip()
            for line in clean_text.split("\n")
            if line.strip()
        ]

        if not lines:
            print(f"  [SKIP] Empty poem content: {url}")
            return None

        # Extract title from <h1> or <title> or meta
        title_tag = soup.select_one("h1")
        if not title_tag:
            title_tag = soup.select_one("title")
        if not title_tag:
            # fallback: last segment of URL
            title = url.rstrip("/").split("/")[-1].replace("-", " ").title()
        else:
            title = title_tag.get_text(strip=True)
            # Remove " by " suffix if present on poetryfoundation pages
            if " by " in title:
                title = title.split(" by ")[0].strip()

        return {
            "title": title,
            "author": author,
            "lines": lines,
            "source": url,
        }


if __name__ == "__main__":
    # quick test
    crawler = PoetryFoundationCrawler(delay=2.0, jitter=0.5)
    poems = crawler.get_poems_by_poet("Elizabeth Bishop", "elizabeth-bishop")
    for p in poems[:5]:
        print(f"  {p['title']} ({len(p['lines'])} lines)")
        for line in p['lines'][:8]:
            print(f"    {line}")