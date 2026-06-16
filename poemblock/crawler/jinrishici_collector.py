#!/usr/bin/env python3
"""Collect Chinese poems from jinrishici.com (free public API)."""

import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup


class JinrishiciCollector:
    """Collects Chinese poems from the free jinrishici.com API.

    The API returns one random Chinese poem per request. We collect many
    and deduplicate to build a diverse set.
    """

    API_URL = "https://v1.jinrishici.com/all.json"

    def __init__(self, delay=0.5, jitter=0.2):
        self.delay = delay
        self.jitter = jitter
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        })
        self.last_request_time = 0.0

    def rate_limit(self):
        elapsed = time.time() - self.last_request_time
        import random
        wait = self.delay + random.uniform(-self.jitter, self.jitter)
        wait = max(wait, 0.3)
        if elapsed < wait:
            time.sleep(wait - elapsed)

    def _split_lines(self, content: str) -> list[str]:
        """Split poem content into lines, preferring newlines over punctuation.

        Strategy:
        1. Try newline split first (API sometimes returns HTML with <br> tags)
        2. If that gives few lines, try Chinese punctuation split
        3. Filter out lines shorter than 2 characters
        """
        # First try: strip HTML and split by <br> or newline
        cleaned = re.sub(r'<br\s*/?>', '\n', content, flags=re.IGNORECASE)
        lines = [l.strip() for l in cleaned.split('\n') if l.strip()]

        # If newline split gave few lines, the content might be continuous text
        if len(lines) <= 1:
            # Split by Chinese sentence-ending punctuation, keep individual segments
            raw_lines = re.split(r'[。！？；\n]+', content)
            lines = [l.strip() for l in raw_lines if l.strip() and len(l.strip()) >= 2]

        # If still nothing useful, try splitting by any punctuation
        if len(lines) == 0:
            raw_lines = re.split(r'[。，！？、；：\n]+', content)
            lines = [l.strip() for l in raw_lines if l.strip() and len(l.strip()) >= 2]

        # Skip lines that are too short
        lines = [l for l in lines if len(l) >= 2]

        return lines if lines else [content]  # fallback: keep raw content as single line

    def fetch_one(self) -> dict | None:
        """Fetch a single random Chinese poem from jinrishici.com."""
        self.rate_limit()
        try:
            resp = self.session.get(self.API_URL, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            title = data.get("origin", "").strip()
            author = data.get("author", "").strip()
            content = data.get("content", "").strip()
            if not title or not author or not content:
                return None
            lines = self._split_lines(content)
            if len(lines) < 1:
                return None
            return {
                "title": title,
                "author": author,
                "lines": lines,
                "source": "https://www.jinrishici.com/",
            }
        except Exception as e:
            return None

    def collect(self, target: int = 300, max_attempts: int = 500) -> list[dict]:
        """Collect *target* unique Chinese poems (up to *max_attempts* requests)."""
        poems = []
        seen = set()
        attempts = 0

        while len(poems) < target and attempts < max_attempts:
            attempts += 1
            poem = self.fetch_one()
            if not poem:
                continue
            key = (poem["title"], poem["author"])
            if key not in seen:
                seen.add(key)
                poems.append(poem)
                if len(poems) % 50 == 0 or len(poems) == target:
                    print(f"  ... {len(poems)}/{target} Chinese poems collected")
            if attempts % 10 == 0:
                print(f"  (attempt {attempts}/{max_attempts}, {len(poems)} unique so far)")

        print(f"  Finished: {len(poems)} unique Chinese poems in {attempts} attempts")
        return poems


if __name__ == "__main__":
    sys.stdout = sys.__stdout__
    collector = JinrishiciCollector(delay=0.5, jitter=0.2)
    poems = collector.collect(target=300, max_attempts=500)
    output = Path("src/data/poems_chinese.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(poems, f, ensure_ascii=False, indent=2)
    print(f"\nSaved {len(poems)} Chinese poems to {output}")