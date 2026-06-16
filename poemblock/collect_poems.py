#!/usr/bin/env python3
"""Unified poetry collector for PoemBlock.

Collects poems from multiple sources:
  - poetrydb.org (English classic poets, free API, no auth)
  - jinrishici.com (Chinese random poems, free API)
  - PoetryFoundation crawler (modern English poets not in poetrydb)
  - Built-in fallback poems

Output: src/data/poems.json
"""

import difflib
import json
import re
import sys
import time
from pathlib import Path

import requests

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from crawler.config import CHINESE_POETS, POETRYFOUNDATION_POETS, POETRYDB_POETS
from crawler.poetryfoundation_crawler import PoetryFoundationCrawler
from crawler.gushiwen_crawler import GushiwenCrawler
from crawler.jinrishici_collector import JinrishiciCollector
from crawler.base_crawler import BaseCrawler


def collect_from_poetrydb() -> list[dict]:
    """Collect English poems from poetrydb.org API."""
    poems: list[dict] = []
    base = BaseCrawler(delay=0.3, jitter=0.1)

    for i, author in enumerate(POETRYDB_POETS, 1):
        url = f"https://poetrydb.org/author/{author}/lines"
        print(f"[{i}/{len(POETRYDB_POETS)}] poetrydb: {author}")

        # Use raw requests instead of BaseCrawler since poetrydb has no robots.txt
        base.rate_limit()
        try:
            resp = base.session.get(url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  [SKIP] {author}: {e}")
            continue

        if not isinstance(data, list):
            print(f"  [SKIP] {author}: unexpected response format")
            continue

        for entry in data:
            title = entry.get("title", "").strip()
            lines = [l.strip() for l in entry.get("lines", []) if l.strip()]
            if not title or not lines:
                continue
            poems.append({
                "title": title,
                "author": author,
                "lines": lines,
                "source": "https://poetrydb.org/",
            })

        print(f"  [OK] {len(data)} poems")
        if i % 20 == 0:
            print(f"  ... {len(poems)} total so far")

    return poems


def collect_from_pf() -> list[dict]:
    """Collect modern English poems from PoetryFoundation."""
    poems: list[dict] = []
    crawler = PoetryFoundationCrawler(delay=3.5, jitter=1.0)

    for i, entry in enumerate(POETRYFOUNDATION_POETS, 1):
        name = entry["name"]
        slug = entry["slug"]
        print(f"\n[{i}/{len(POETRYFOUNDATION_POETS)}] PF: {name}")
        try:
            result = crawler.get_poems_by_poet(name, slug)
            poems.extend(result)
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")
            continue
        if i < len(POETRYFOUNDATION_POETS):
            crawler.rate_limit()

    return poems


def collect_chinese_jinrishici(target: int = 300) -> list[dict]:
    """Collect Chinese poems from jinrishici.com."""
    collector = JinrishiciCollector(delay=0.5, jitter=0.2)
    return collector.collect(target=target, max_attempts=500)


# Maximum poems per source (safety limit to prevent runaway crawling)
MAX_POEMS_PER_SOURCE = 5000


def normalize_text(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation, normalize whitespace."""
    text = text.lower()
    text = re.sub(r'[^\w\s一-鿿]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def text_similarity(text1: str, text2: str) -> float:
    """Compute similarity ratio between two texts using SequenceMatcher."""
    return difflib.SequenceMatcher(None,
                                   normalize_text(text1),
                                   normalize_text(text2)).ratio()


def content_deduplicate(poems: list[dict],
                        title_sim_threshold: float = 0.75,
                        content_sim_threshold: float = 0.80) -> list[dict]:
    """Deduplicate poems in two layers.

    Layer 1 (fast): exact (title, author) match — keep existing logic.
    Layer 2 (content-based): for poems with similar titles (Levenshtein <= 3)
    or similar content, compare normalized text via SequenceMatcher.
    """
    # Layer 1: exact (title, author) dedup
    seen_exact = set()
    layer1 = []
    for p in poems:
        key = (p["title"], p["author"])
        if key not in seen_exact:
            seen_exact.add(key)
            layer1.append(p)

    # Layer 2: content-based dedup for similar titles
    # Group by rough title similarity to avoid O(n²) on all pairs
    unique = []
    for p in layer1:
        is_dup = False
        norm_text = None
        for existing in unique:
            # Check title similarity (short Levenshtein approximation)
            title_dist = abs(len(p["title"]) - len(existing["title"]))
            if title_dist <= 3:
                # Only compare when title lengths are close
                if existing.get("_text") is None:
                    existing["_text"] = normalize_text(' '.join(existing["lines"]))
                if norm_text is None:
                    norm_text = normalize_text(' '.join(p["lines"]))
                sim = text_similarity(' '.join(p["lines"]), ' '.join(existing["lines"]))
                if sim >= content_sim_threshold:
                    is_dup = True
                    break
        if not is_dup:
            unique.append(p)

    # Remove internal _text key before returning
    for p in unique:
        p.pop("_text", None)
    return unique


def classify_language(poem: dict) -> str:
    """Return 'chinese' or 'english' based on content analysis of whole poem.

    Uses CJK character ratio instead of single-character heuristic.
    """
    all_text = ' '.join(poem.get("lines", []))
    if not all_text:
        return 'chinese'  # default
    cjk_count = sum(1 for c in all_text if '一' <= c <= '鿿')
    latin_count = sum(1 for c in all_text if c.isascii() and c.isalpha())
    total = cjk_count + latin_count
    if total == 0:
        return 'chinese'
    return 'chinese' if (cjk_count / total) > 0.3 else 'english'


def main():
    start = time.time()
    all_poems = []

    # 1. English from poetrydb.org
    print("=" * 60)
    print("PHASE 1: English poems from poetrydb.org")
    print("=" * 60)
    english_db = collect_from_poetrydb()
    print(f"\n>>> poetrydb: {len(english_db)} poems")
    all_poems.extend(english_db)

    # 2. Chinese from jinrishici.com
    print("\n" + "=" * 60)
    print("PHASE 2: Chinese poems from jinrishici.com")
    print("=" * 60)
    chinese = collect_chinese_jinrishici(target=300)
    print(f"\n>>> jinrishici: {len(chinese)} poems")
    all_poems.extend(chinese)

    # 2b. Chinese from gushiwen.cn (by poet)
    print("\n" + "=" * 60)
    print("PHASE 2b: Chinese poems from gushiwen.cn")
    print("=" * 60)
    from crawler.gushiwen_crawler import GushiwenCrawler as GWCrawler
    gw_crawler = GWCrawler(delay=3.0, jitter=1.0)
    chinese_gw = []
    for i, poet in enumerate(CHINESE_POETS, 1):
        print(f"\n[{i}/{len(CHINESE_POETS)}] gushiwen: {poet}")
        try:
            poems = gw_crawler.get_poems_by_author(poet)
            chinese_gw.extend(poems)
        except Exception as e:
            print(f"  [ERROR] {poet}: {e}")
            continue
        if i < len(CHINESE_POETS):
            gw_crawler.rate_limit()
    print(f"\n>>> gushiwen: {len(chinese_gw)} poems")
    all_poems.extend(chinese_gw)

    # 3. Modern English from PoetryFoundation
    print("\n" + "=" * 60)
    print("PHASE 3: Modern English poems from PoetryFoundation")
    print("=" * 60)
    english_pf = collect_from_pf()
    print(f"\n>>> PF: {len(english_pf)} poems")
    all_poems.extend(english_pf)

    # 4. Modern Chinese from shiku.org
    print("\n" + "=" * 60)
    print("PHASE 4: Modern Chinese poems from shiku.org")
    print("=" * 60)
    from crawler.shiku_crawler import ShikuCrawler
    shiku = ShikuCrawler(delay=3.0, jitter=1.0)
    chinese_shiku = shiku.crawl_all_poets(max_poets=50)
    print(f"\n>>> shiku.org: {len(chinese_shiku)} poems")
    all_poems.extend(chinese_shiku)

    # Deduplicate (two-layer: exact + content-based)
    print(f"\n>>> Before dedup: {len(all_poems)} poems")
    all_poems = content_deduplicate(all_poems)
    print(f">>> After dedup: {len(all_poems)} poems")

    # Write output — split into Chinese and English files by content analysis
    output_dir = PROJECT_ROOT / "src" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    chinese_poems = [p for p in all_poems if classify_language(p) == 'chinese']
    english_poems = [p for p in all_poems if classify_language(p) == 'english']

    chinese_path = output_dir / "poems_chinese.json"
    english_path = output_dir / "poems_english.json"

    with open(chinese_path, "w", encoding="utf-8") as f:
        json.dump(chinese_poems, f, ensure_ascii=False, indent=2)
    with open(english_path, "w", encoding="utf-8") as f:
        json.dump(english_poems, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print(f"COMPLETE: {len(chinese_poems)} Chinese poems → {chinese_path}")
    print(f"          {len(english_poems)} English poems → {english_path}")
    print(f"          {len(all_poems)} total (deduped)")
    print(f"Time: {elapsed:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()