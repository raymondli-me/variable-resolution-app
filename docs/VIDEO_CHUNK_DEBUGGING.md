# Video Chunk Rating Debugging ✅

## Problem

User reported rating process stuck at "0 / 0 (0%)" when trying to rate video chunks from the "anatolian-videos" collection.

## Investigation

### Database Check
✅ **133 video chunks** found in the database  
✅ File paths look correct (e.g., `/Users/.../video_chunks/gNec4uzpRks/chunk_0001.mp4`)

### Issues Found

1. **No Retry Logic in `rateVideoChunk`**
   - The `rateComment` method had 3 retries with exponential backoff
   - The `rateVideoChunk` method had NO retries
   - If video file couldn't be read or API failed, it would throw immediately

2. **No Logging**
   - Silent failures made it impossible to diagnose issues
   - No visibility into:
     - How many items were fetched
     - Whether files exist
     - What API errors occurred

3. **Potential File Path Issues**
   - Video chunks need to be read from disk
   - File might not exist at expected path
   - Permission issues possible

---

## Fixes Applied

### 1. Added Retry Logic to `rateVideoChunk`

**File:** `src/services/gemini-rater.js`

**Before:**
```javascript
async rateVideoChunk(chunkPath, transcriptText, researchIntent, ratingScale) {
  try {
    const videoBytes = await fs.readFile(chunkPath);
    // ... API call ...
    return this.parseResponse(result);
  } catch (error) {
    console.error('Error rating video chunk:', error);
    throw error; // ← NO RETRY!
  }
}
```

**After:**
```javascript
async rateVideoChunk(chunkPath, transcriptText, researchIntent, ratingScale, retries = 3) {
  console.log(`[GeminiRater] Rating video chunk: ${chunkPath}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const videoBytes = await fs.readFile(chunkPath);
      console.log(`[GeminiRater] Video file read successfully, size: ${videoBytes.length} bytes`);
      
      // ... API call ...
      
      console.log(`[GeminiRater] Video chunk rated successfully on attempt ${attempt}`);
      return this.parseResponse(result, transcriptText);
      
    } catch (error) {
      console.error(`[GeminiRater] Error rating video chunk (attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) {
        throw error;
      }
      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = 1000 * Math.pow(2, attempt - 1);
      console.log(`[GeminiRater] Waiting ${backoffMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}
```

**Benefits:**
- ✅ 3 retry attempts (same as comments)
- ✅ Exponential backoff (1s → 2s → 4s)
- ✅ Detailed logging at each step
- ✅ Reports file size after successful read

---

### 2. Added Comprehensive Logging to Rating Engine

**File:** `src/services/rating-engine.js`

**Added Logs:**

#### Item Fetching
```javascript
console.log(`[RatingEngine] Fetching items for collection ${projectConfig.collectionId}...`);
console.log(`[RatingEngine] includeChunks: ${includeChunks}, includeComments: ${includeComments}`);
console.log(`[RatingEngine] Found ${items.length} items to rate`);

if (items.length > 0) {
  console.log(`[RatingEngine] First item:`, {
    type: items[0].type,
    id: items[0].id,
    has_file_path: !!items[0].file_path,
    has_text: !!items[0].text,
    has_transcript: !!items[0].transcript_text
  });
}
```

#### Batch Processing
```javascript
console.log(`[RatingEngine] Processing batch of ${items.length} items with concurrency ${concurrency}`);
console.log(`[RatingEngine] Processing chunk ${chunkNum}, items ${start} to ${end}`);
```

---

## What To Look For (Console Output)

### Successful Flow

```
[RatingEngine] Fetching items for collection 5...
[RatingEngine] includeChunks: true, includeComments: false
[RatingEngine] Found 133 items to rate
[RatingEngine] First item: {
  type: 'video_chunk',
  id: 'chunk_gNec4uzpRks_1',
  has_file_path: true,
  has_text: false,
  has_transcript: true
}
[RatingEngine] Processing batch of 50 items with concurrency 5
[RatingEngine] Processing chunk 1, items 1 to 5
[GeminiRater] Rating video chunk: /Users/.../chunk_0001.mp4
[GeminiRater] Video file read successfully, size: 1234567 bytes
[GeminiRater] Video chunk rated successfully on attempt 1
...
```

### File Not Found Error

```
[RatingEngine] Found 133 items to rate
[RatingEngine] Processing chunk 1, items 1 to 5
[GeminiRater] Rating video chunk: /Users/.../chunk_0001.mp4
[GeminiRater] Error rating video chunk (attempt 1/3): ENOENT: no such file or directory
[GeminiRater] Waiting 1000ms before retry...
[GeminiRater] Error rating video chunk (attempt 2/3): ENOENT: no such file or directory
[GeminiRater] Waiting 2000ms before retry...
[GeminiRater] Error rating video chunk (attempt 3/3): ENOENT: no such file or directory
Failed to rate item chunk_XXX after retries: ENOENT: no such file or directory
```

### API Rate Limit Error

```
[GeminiRater] Rating video chunk: /Users/.../chunk_0001.mp4
[GeminiRater] Video file read successfully, size: 1234567 bytes
[GeminiRater] Error rating video chunk (attempt 1/3): Gemini API error: 503 Service Unavailable
[GeminiRater] Waiting 1000ms before retry...
[GeminiRater] Video file read successfully, size: 1234567 bytes
[GeminiRater] Video chunk rated successfully on attempt 2
```

### No Items Found

```
[RatingEngine] Fetching items for collection 5...
[RatingEngine] includeChunks: true, includeComments: false
[RatingEngine] Found 0 items to rate
← This would cause "0 / 0" display
```

---

## Debugging Steps

### 1. Restart the App
Close and reopen the Electron app to load the new code.

### 2. Open DevTools
- macOS: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`

### 3. Start Rating
- Go to AI Analysis tab
- Select "anatolian-videos" collection
- Check "Video Chunks" only
- Click "Start Rating"

### 4. Watch Console
Look for the `[RatingEngine]` and `[GeminiRater]` logs to see:
- How many items were found
- Whether files can be read
- What errors occur

---

## Common Issues & Solutions

### Issue: "Found 0 items to rate"

**Cause:** Collection ID mismatch or wrong filter settings

**Solution:**
```sql
-- Check collection ID
SELECT id, search_term FROM collections WHERE search_term LIKE '%anatolian%';

-- Check if chunks exist for that collection
SELECT COUNT(*) FROM video_chunks WHERE collection_id = ?;
```

### Issue: "ENOENT: no such file or directory"

**Cause:** Video chunk files don't exist at expected path

**Solution:**
```bash
# Check if video chunk directory exists
ls -la "/Users/raymondli701/Library/Application Support/vr-collector/collections/"

# Check specific collection
ls -la "/Users/raymondli701/Library/Application Support/vr-collector/collections/2025-09-30T08-14-42_anatolian shepherd memes/video_chunks/"
```

### Issue: "403 Forbidden" or "400 Bad Request"

**Cause:** Gemini API doesn't support video chunks, or file too large

**Possible Solutions:**
1. Check Gemini API docs for video support
2. Ensure video chunks are < 20MB
3. Consider using transcript-only rating for videos

### Issue: "503 Service Unavailable"

**Cause:** Too many concurrent requests

**Solution:**
- Reduce concurrent requests to 2-3
- Increase retry delay to 3-5s
- Let exponential backoff handle it

---

## Fallback: Transcript-Only Rating

If video chunk rating continues to fail, we can fall back to rating based on transcript only:

```javascript
// In rating-engine.js, modify rateItem:
if (item.type === 'video_chunk') {
  // Option 1: Try video first, fall back to transcript
  try {
    const result = await this.gemini.rateVideoChunk(
      item.file_path,
      item.transcript_text,
      config.researchIntent,
      config.ratingScale
    );
    return { ...result, success: true };
  } catch (videoError) {
    console.warn(`Video rating failed, using transcript only:`, videoError.message);
    // Fall back to transcript-only rating
    const result = await this.gemini.rateComment(
      item.transcript_text,
      { title: item.video_title },
      config.researchIntent,
      config.ratingScale
    );
    return { ...result, success: true, method: 'transcript_only' };
  }
}
```

---

## Expected Outcomes

### Best Case
✅ All 133 video chunks rated successfully  
✅ Some retries due to transient API errors  
✅ 95%+ success rate  

### Good Case
✅ Most chunks rated successfully  
⚠️ Some failures due to file not found  
✅ Failed items can be reviewed and retried  
✅ 80%+ success rate  

### Needs Investigation
❌ 0 items found → Check collection ID  
❌ All items fail → Check file paths  
❌ Stuck at 0/0 → Check console for errors  

---

## Next Steps

1. **Restart app**
2. **Open DevTools console**
3. **Start rating**
4. **Share console output** if still stuck

The detailed logs will reveal exactly what's happening:
- Item fetching
- File reading
- API calls
- Retry attempts
- Success/failure status

---

*Debugging improvements completed: September 30, 2025*  
*Status: ✅ Ready for testing*  
*Files changed: 2 (gemini-rater.js, rating-engine.js)*
