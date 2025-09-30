# Testing CARDS Export

## Quick Test Steps

1. **Start the app**
   ```bash
   npm start
   ```

2. **Navigate to Collections**
   - Click on "Collections" in the left sidebar
   - You should see your existing collections

3. **Export a Collection**
   - Find a collection (ideally one with videos, transcripts, and comments)
   - Click the export button (down arrow icon) on the collection card
   - Select "Export to CARDS (BWS Rating)" from the menu

4. **What to Expect**
   - You'll see notifications:
     - "Preparing CARDS export..."
     - "CARDS export completed!"
     - Statistics about items exported
   - A dialog asking if you want to open the export folder
   - The exported JSON file will be in the collection's exports folder

## Verify the Export

The exported file should have this structure:
```json
{
  "cards_version": "2.0",
  "project": {
    "id": "vr_youtube_123",
    "title": "YouTube Collection: [your search term]",
    ...
  },
  "items": [
    // Videos, chunks, and comments as items
  ],
  "assessment_config": {
    "method": "bws",
    "dimensions": [...],
    ...
  },
  "assessment_sets": [
    // Generated BWS comparison sets
  ]
}
```

## Console Debugging

Open DevTools (View → Toggle Developer Tools) to see:
- "Starting CARDS export for collection: [id]"
- Any error messages if something fails

## Common Issues

1. **"Cannot find module './src/services/cards-export'"**
   - Make sure the cards-export.js file exists in src/services/

2. **Database errors**
   - The collection might be missing required data
   - Try with a different collection

3. **No chunks found**
   - Collection might not have transcriptions
   - Try a collection where you enabled transcription

## Next Steps

Once basic export works:
1. We'll add the configuration dialog
2. Allow customizing what to export
3. Add preview functionality
4. Implement direct Supabase upload