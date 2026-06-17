#!/usr/bin/env python3
"""Combine 4 batch lore JSON files into the final character-lore-300.json"""
import json
import sys
import os

def load_batch(path):
    """Load a batch file, handling potential JSON issues"""
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    # Try to parse as-is
    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'characters' in data:
            return data['characters']
    except json.JSONDecodeError:
        # Try to find the JSON array in the content
        start = content.find('[')
        end = content.rfind(']') + 1
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError as e:
                print(f"ERROR parsing {path}: {e}")
                sys.exit(1)
    print(f"ERROR: Could not parse {path}")
    sys.exit(1)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Load all batches
    all_chars = []
    for i in range(1, 5):
        batch_path = os.path.join(script_dir, f'lore-batch-{i}.json')
        if not os.path.exists(batch_path):
            print(f"Missing {batch_path}")
            sys.exit(1)
        batch = load_batch(batch_path)
        print(f"Batch {i}: {len(batch)} characters")
        all_chars.extend(batch)

    print(f"\nTotal characters: {len(all_chars)}")

    # Validate all have required fields
    for i, c in enumerate(all_chars):
        if 'id' not in c or 'name' not in c or 'lore' not in c:
            print(f"ERROR: Character {i} missing fields: {c}")
            sys.exit(1)

    # Check for duplicates
    ids = [c['id'] for c in all_chars]
    dupes = set([x for x in ids if ids.count(x) > 1])
    if dupes:
        print(f"WARNING: Duplicate IDs: {dupes}")

    # Verify against source
    source_path = os.path.join(script_dir, 'portrait-prompts-300.json')
    with open(source_path, 'r', encoding='utf-8') as f:
        source = json.load(f)

    source_ids = set(c['id'] for c in source['characters'])
    lore_ids = set(c['id'] for c in all_chars)

    missing = source_ids - lore_ids
    extra = lore_ids - source_ids

    if missing:
        print(f"MISSING IDs (in source but not in lore): {missing}")
    if extra:
        print(f"EXTRA IDs (in lore but not in source): {extra}")

    # Build final output maintaining source order
    id_to_lore = {c['id']: c for c in all_chars}
    ordered_chars = []
    for src_char in source['characters']:
        cid = src_char['id']
        if cid in id_to_lore:
            lore_char = id_to_lore[cid]
            ordered_chars.append({
                "id": cid,
                "name": lore_char['name'],
                "lore": lore_char['lore']
            })
        else:
            print(f"WARNING: No lore for {cid} ({src_char['name']})")

    output = {
        "meta": {
            "project": "헌혈의 집 — Red Ledger",
            "purpose": "캐릭터 카드 개인 서사",
            "total": len(ordered_chars)
        },
        "characters": ordered_chars
    }

    output_path = os.path.join(script_dir, 'character-lore-300.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(ordered_chars)} characters to {output_path}")

    # Final validation
    with open(output_path, 'r', encoding='utf-8') as f:
        final = json.load(f)
    print(f"Validation: {len(final['characters'])} characters in output file")
    print(f"Meta total: {final['meta']['total']}")

if __name__ == '__main__':
    main()
