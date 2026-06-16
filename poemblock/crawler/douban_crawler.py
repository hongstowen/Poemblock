#!/usr/bin/env python3
"""Douban book quotes/reviews crawler for PoemBlock excerpt mode.

Collects famous quotes from Douban book review pages and book notes.
Output is merged into the excerpts JSON file used by the extension.

Usage:
    python -m crawler.douban_crawler
"""

import json
import time
import random
from pathlib import Path

import requests

# Douban book IDs with rich quote content (classic literature, philosophy, etc.)
# Format: {book_id: "book_title"}
DOUBAN_BOOKS = {
    # Chinese classic literature
    "1006485": "红楼梦",        # Dream of the Red Chamber
    "1007338": "西游记",        # Journey to the West
    "1013508": "三国演义",      # Romance of the Three Kingdoms
    "1006573": "水浒传",        # Water Margin
    "1007914": "围城",          # Fortress Besieged
    "1013208": "呐喊",          # Call to Arms - Lu Xun
    "1002434": "边城",          # Border Town - Shen Congwen
    "1036267": "骆驼祥子",      # Rickshaw Boy - Lao She
    "1013292": "家",            # Family - Ba Jin
    "1008673": "雷雨",          # Thunderstorm - Cao Yu
    "1026089": "平凡的世界",    # The Ordinary World - Lu Yao
    "1059479": "活着",          # To Live - Yu Hua
    "1084336": "许三观卖血记",  # Chronicle of a Blood Merchant
    "1770782": "黄金时代",      # Golden Age - Wang Xiaobo
    "1348780": "沉默的大多数",    # The Silent Majority - Wang Xiaobo
    "1886339": "我与地坛",      # Temple of Earth - Shi Tiesheng

    # Translated world literature
    "1001544": "百年孤独",      # One Hundred Years of Solitude
    "1001800": "霍乱时期的爱情", # Love in the Time of Cholera
    "1001962": "月亮和六便士",  # The Moon and Sixpence
    "1001856": "老人与海",      # The Old Man and the Sea
    "1002120": "了不起的盖茨比", # The Great Gatsby
    "1002676": "瓦尔登湖",      # Walden
    "1002661": "小王子",        # The Little Prince
    "1004629": "局外人",        # The Stranger
    "1005164": "鼠疫",          # The Plague
    "1012347": "1984",          # 1984
    "1013297": "美丽新世界",    # Brave New World
    "1013506": "了不起的盖茨比", # The Great Gatsby (other edition)
    "1022357": "追风筝的人",    # The Kite Runner
    "1034282": "不能承受的生命之轻", # The Unbearable Lightness of Being
    "1082154": "挪威的森林",    # Norwegian Wood
    "3610410": "刺杀骑士团长",  # Killing Commendatore
    "2136140": "海边的卡夫卡",  # Kafka on the Shore
    "1057465": "了不起的盖茨比", # another edition
    "1049770": "罗生门",        # Rashomon
    "3078574": "人间失格",      # No Longer Human
    "1052450": "我是猫",        # I Am a Cat
}

# Douban API endpoints
# Using the uieee.xyz proxy which doesn't require API key
API_BASE = "https://douban.uieee.xyz"
API_BOOK_NOTES = f"{API_BASE}/v2/book/{{book_id}}/annotations"
API_BOOK_REVIEWS = f"{API_BASE}/v2/book/{{book_id}}/reviews"

# Fallback: use the mobile site which is less restrictive
MOBILE_BASE = "https://m.douban.com/rexxar/api/v2"
MOBILE_NOTES = f"{MOBILE_BASE}/book/{{book_id}}/annotations"


def fetch_book_simple(book_id, title):
    """Fetch a simple book summary as a fallback quote source."""
    try:
        resp = requests.get(
            f"{API_BASE}/v2/book/{book_id}",
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                )
            },
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            summary = data.get("summary", "")
            if not summary:
                return []
            # Extract notable quotes from summary (marked by 「」 or 《》 or ——)
            import re
            quotes = re.findall(r'「([^」]+)」', summary)
            if not quotes:
                quotes = re.findall(r'《([^》]+)》', summary)
            if not quotes:
                # Use first sentence or standalone phrases
                parts = [s.strip() for s in summary.split("。") if s.strip()]
                if parts:
                    quotes = [parts[0]]
            return [
                {
                    "text": q,
                    "source": title,
                    "author": "豆瓣图书"
                }
                for q in quotes if len(q) > 5
            ]
    except Exception as e:
        print(f"  [WARN] Failed to fetch book summary for {title}: {e}")
    return []


def fetch_annotations(book_id, title):
    """Fetch book annotations/highlights from Douban."""
    results = []
    try:
        resp = requests.get(
            MOBILE_NOTES.format(book_id=book_id),
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                ),
                "Referer": f"https://book.douban.com/subject/{book_id}/",
            },
            params={"start": 0, "count": 20},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            annotations = data.get("annotations", [])
            for ann in annotations:
                text = ann.get("content", "") or ann.get("abstract", "")
                if text and len(text) > 5:
                    results.append({
                        "text": text.strip(),
                        "source": title,
                        "author": ann.get("author", {}).get("name", "豆瓣用户"),
                    })
    except Exception as e:
        print(f"  [WARN] Failed to fetch annotations for {title}: {e}")
    return results


def crawl_douban(output_path: Path) -> list[dict]:
    """Crawl Douban for book quotes and return as excerpt format."""
    all_excerpts: list[dict] = []
    seen_texts: set = set()

    for book_id, title in DOUBAN_BOOKS.items():
        print(f"  Fetching: {title} ({book_id})")

        # Try annotations first
        excerpts = fetch_annotations(book_id, title)

        # Fallback to book summary
        if not excerpts:
            excerpts = fetch_book_simple(book_id, title)

        for ex in excerpts:
            key = ex["text"][:30]
            if key not in seen_texts:
                seen_texts.add(key)
                all_excerpts.append(ex)

        # Rate limit: be gentle to Douban
        time.sleep(random.uniform(1.0, 2.5))

    # Deduplicate
    seen = set()
    unique = []
    for ex in all_excerpts:
        key = ex["text"][:30]
        if key not in seen:
            seen.add(key)
            unique.append(ex)

    print(f"\n=== Douban crawl complete: {len(unique)} excerpts from {len(DOUBAN_BOOKS)} books ===")
    return unique


def main():
    root = Path(__file__).resolve().parent.parent
    output_path = root / "src" / "data" / "excerpts.json"

    print("=== Douban Book Excerpts Crawler for PoemBlock ===")
    print(f"Books to crawl: {len(DOUBAN_BOOKS)}")

    excerpts = crawl_douban(output_path)

    # Merge with existing excerpts if file exists
    existing = []
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    seen = set()
    merged = []
    for ex in existing + excerpts:
        key = ex["text"][:30]
        if key not in seen:
            seen.add(key)
            merged.append(ex)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"\n=== Written {len(merged)} excerpts to {output_path} ===")
    print(f"   ({len(excerpts)} new from Douban, {len(existing)} previously existing)")


if __name__ == "__main__":
    main()