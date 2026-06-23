import json, random

with open('pet_schedule_v2.json', 'r', encoding='utf-8') as f:
    v2 = json.load(f)

with open('pet_schedule_final.json', 'r', encoding='utf-8') as f:
    old = json.load(f)

# Collect all unique phrases
seen = set()
all_phrases = []
for d in old['schedule']:
    for p in d['phrases']:
        key = p['phrase'].strip().lower()
        if key not in seen:
            seen.add(key)
            all_phrases.append({
                'phrase': p['phrase'],
                'meaning': p.get('meaning', ''),
                'source': p.get('source', 'book'),
                'associated_word': p.get('associated_word', ''),
            })

print(f'总短语数: {len(all_phrases)}')
random.shuffle(all_phrases)

# Distribute phrases across days
num_days = len(v2['schedule'])
# ~3-4 phrases per day, spread evenly
phrases_per_day = max(1, len(all_phrases) // num_days)
extra = len(all_phrases) - phrases_per_day * num_days

idx = 0
for i, day in enumerate(v2['schedule']):
    count = phrases_per_day + (1 if i < extra else 0)
    day['phrases'] = all_phrases[idx:idx+count]
    idx += count

# Save
with open('pet_schedule_v2.json', 'w', encoding='utf-8') as f:
    json.dump(v2, f, ensure_ascii=False, indent=2)

print(f'✅ 已分配 {idx} 个短语到 {num_days} 天')
print(f'   每天 {phrases_per_day}-{phrases_per_day+1} 个短语')
