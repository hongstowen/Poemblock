#!/usr/bin/env python3
"""CLI entry point for the poem crawler.

Usage:
    python -m crawler.crawler              # crawl all configured poets
    python -m crawler.crawler --chinese    # only Chinese poets
    python -m crawler.crawler --english    # only English poets

Output is written to src/data/poems.json (relative to the project root).
"""

import argparse
import json
import sys
import time
from pathlib import Path

from .config import CHINESE_POETS, ENGLISH_POETS
from .jinrishici_collector import JinrishiciCollector
from .poetryfoundation_crawler import PoetryFoundationCrawler
from .gushiwen_crawler import GushiwenCrawler
from .shiku_crawler import ShikuCrawler


def get_project_root() -> Path:
    """Return the project root (two dirs up from crawler/)."""
    return Path(__file__).resolve().parent.parent


def crawl_chinese(output_path: Path) -> list[dict]:
    """Collect Chinese poems from multiple sources (jinrishici, gushiwen, shiku)."""
    all_poems: list[dict] = []

    # Source 1: jinrishici.com (random poems)
    print("\n--- Source: jinrishici.com ---")
    collector = JinrishiciCollector(delay=0.5, jitter=0.2)
    poems = collector.collect(target=300)
    all_poems.extend(poems)
    print(f"  => {len(poems)} poems from jinrishici")

    # Source 2: gushiwen.cn (by poet)
    print("\n--- Source: gushiwen.cn ---")
    gwc = GushiwenCrawler(delay=3.0, jitter=1.0)
    for i, poet in enumerate(CHINESE_POETS, 1):
        print(f"  [{i}/{len(CHINESE_POETS)}] Crawling: {poet}")
        try:
            poet_poems = gwc.get_poems_by_author(poet)
            all_poems.extend(poet_poems)
        except Exception as e:
            print(f"  [ERROR] {poet}: {e}")
            continue
        if i < len(CHINESE_POETS):
            gwc.rate_limit()

    # Source 3: shiku.org (modern Chinese poets)
    print("\n--- Source: shiku.org ---")
    sc = ShikuCrawler()
    shiku_poems = sc.crawl(max_poets=50)
    all_poems.extend(shiku_poems)
    print(f"  => {len(shiku_poems)} poems from shiku")

    # Deduplicate by (title, author)
    seen = set()
    unique: list[dict] = []
    for p in all_poems:
        key = (p["title"], p["author"])
        if key not in seen:
            seen.add(key)
            unique.append(p)

    print(f"\n=== Chinese crawl complete: {len(unique)} unique poems ===")
    return unique


def crawl_english(output_path: Path) -> list[dict]:
    """Crawl all English poets and return merged poem list."""
    all_poems: list[dict] = []
    crawler = PoetryFoundationCrawler(delay=3.0, jitter=1.0)

    for i, entry in enumerate(ENGLISH_POETS, 1):
        name = entry["name"]
        slug = entry["slug"]
        print(f"\n[{i}/{len(ENGLISH_POETS)}] Crawling English poet: {name}")
        poems = crawler.get_poems_by_poet(name, slug)
        all_poems.extend(poems)
        if i < len(ENGLISH_POETS):
            crawler.rate_limit()

    # Deduplicate by (title, author) keeping first occurrence
    seen = set()
    unique: list[dict] = []
    for p in all_poems:
        key = (p["title"], p["author"])
        if key not in seen:
            seen.add(key)
            unique.append(p)

    print(f"\n=== English crawl complete: {len(unique)} unique poems from {len(ENGLISH_POETS)} poets ===")
    return unique


def merge_outputs(chinese_poems: list[dict], english_poems: list[dict], output_path: Path):
    """Merge both lists, deduplicate across all, and write to file."""
    seen = set()
    merged: list[dict] = []
    for p in chinese_poems + english_poems:
        key = (p["title"], p["author"])
        if key not in seen:
            seen.add(key)
            merged.append(p)

    # Write separate Chinese/English files (consistent with collect_poems.py)
    chinese_path = output_path.parent / "poems_chinese.json"
    english_path = output_path.parent / "poems_english.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(chinese_path, "w", encoding="utf-8") as f:
        json.dump(chinese_poems, f, ensure_ascii=False, indent=2)
    with open(english_path, "w", encoding="utf-8") as f:
        json.dump(english_poems, f, ensure_ascii=False, indent=2)
    print(f"\n=== {len(chinese_poems)} Chinese poems written to {chinese_path} ===")
    print(f"=== {len(english_poems)} English poems written to {english_path} ===")


def main():
    parser = argparse.ArgumentParser(description="Poetry crawler for PoemBlock extension")
    parser.add_argument("--chinese", action="store_true", help="Crawl only Chinese poets")
    parser.add_argument("--english", action="store_true", help="Crawl only English poets")
    parser.add_argument("--output", type=str, help="Override output path")
    args = parser.parse_args()

    root = get_project_root()
    # Ensure output path ends with .json for the default "poems" file
    if not args.output:
        output_path = root / "src" / "data" / "poems.json"
    else:
        output_path = Path(args.output)
        if not output_path.suffix:
            output_path = output_path.with_suffix(".json")

    start = time.time()

    if args.chinese and not args.english:
        poems = crawl_chinese(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(poems, f, ensure_ascii=False, indent=2)
        print(f"\n=== {len(poems)} Chinese poems written to {output_path} ===")
    elif args.english and not args.chinese:
        poems = crawl_english(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(poems, f, ensure_ascii=False, indent=2)
        print(f"\n=== {len(poems)} English poems written to {output_path} ===")
    else:
        # default: crawl both
        chinese = crawl_chinese(output_path)
        english = crawl_english(output_path)
        merge_outputs(chinese, english, output_path)

    elapsed = time.time() - start
    print(f"\nTotal time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()