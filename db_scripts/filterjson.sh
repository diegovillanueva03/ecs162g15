#!/bin/bash

set -e

# Input files
COORD_FILE="coords.json"
REVIEW_FILE="reviews.json"

# Temp files
DEDUP_COORDS="coords_deduped.json"
CLEAN_COORDS="coords_cleaned.json"
CLEAN_REVIEWS="reviews_cleaned.json"

# Step 1: Deduplicate based on lat/lng (retain first)
jq 'unique_by([.lat, .lng])' "$COORD_FILE" > "$DEDUP_COORDS"

# Step 2: Extract IDs from both
COORD_IDS=$(jq -r '.[]._id' "$DEDUP_COORDS" | sort)
REVIEW_IDS=$(jq -r '.[]._id' "$REVIEW_FILE" | sort)

# Step 3: Compute matching _ids
MATCHED_IDS=$(comm -12 <(echo "$COORD_IDS") <(echo "$REVIEW_IDS"))

# Step 4: Filter both files to only those _ids that appear in both
jq --argjson ids "$(echo "$MATCHED_IDS" | jq -R -s -c 'split("\n") | map(select(. != ""))')" \
	'[.[] | select(.["_id"] as $id | $ids | index($id))]' "$DEDUP_COORDS" > "$CLEAN_COORDS"

jq --argjson ids "$(echo "$MATCHED_IDS" | jq -R -s -c 'split("\n") | map(select(. != ""))')" \
	'[.[] | select(.["_id"] as $id | $ids | index($id))]' "$REVIEW_FILE" > "$CLEAN_REVIEWS"

echo "✅ Cleaned coordinate data written to: $CLEAN_COORDS"
echo "✅ Cleaned review data written to:    $CLEAN_REVIEWS"

