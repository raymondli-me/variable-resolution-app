# Handoff: Implement Variable Management System for Qualitative Coding (v2)

**Date:** October 7, 2025
**Author:** Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Implementation Agent

---

## Part I: Strategic Context

**The Vision:** Transform the qualitative coding workflow into a full-featured research tool with **user-defined rating variables**. Researchers should be able to create custom variables with different scale types, AI-assisted definitions, and flexible reasoning depth options.

**The Mission:** Implement a comprehensive variable management system that allows users to:
1. Define custom rating variables within collections
2. Use AI to suggest variable definitions and scale anchors
3. Select variables when rating PDF excerpts
4. Provide varying depths of reasoning
5. Use speech-to-text for efficient note-taking

---

## Part II: Detailed Requirements

### Feature 1: Variable Creation Interface

**Location:** Collections Hub view (when viewing a collection)

**UI Requirements:**
- Add a "Create Rating Variable" button prominently displayed in the collection view
- Modal/form should include:
  - **Variable Label** (text input): The name of the construct (e.g., "Stigma Level", "Emotional Valence")
  - **Scale Type** (dropdown): Binary, 3-point, 4-point, 5-point, 7-point, 10-point, 100-point
  - **Variable Definition** (textarea): What this variable measures
  - **Scale Anchors** (dynamic fields): Define what each point means
    - For binary: 0 and 1
    - For 3-point: 1, 2, 3 (Low/Medium/High)
    - For 5-point: 1, 2, 3, 4, 5
    - For 7-point: 1, 2, 3, 4, 5, 6, 7
    - For 10-point: 1-10
    - For 100-point: 0-100 (endpoints only)
  - **AI Assist Button**: "Ask AI to Suggest Definition & Anchors"

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS rating_variables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  definition TEXT,
  scale_type TEXT NOT NULL, -- 'binary', '3point', '4point', '5point', '7point', '10point', '100point'
  anchors TEXT, -- JSON: {"1": "Not at all stigmatizing", "5": "Extremely stigmatizing"}
  reasoning_depth TEXT DEFAULT 'brief', -- 'brief', 'moderate', 'lengthy'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);
```

### Feature 2: AI-Assisted Variable Definition

**Trigger:** User clicks "Ask AI to Suggest Definition & Anchors" button

**Workflow:**
1. Take user's variable label + selected scale type as input
2. Call Gemini API with prompt:
   ```
   You are a research methods expert helping define a qualitative coding variable.

   Variable Label: [user's label]
   Scale Type: [selected scale]

   Please provide:
   1. A clear, academic definition of this variable (2-3 sentences)
   2. Anchor definitions for each scale point that operationalize the construct

   Format your response as JSON:
   {
     "definition": "...",
     "anchors": {
       "1": "...",
       "2": "...",
       ...
     }
   }
   ```
3. Pre-fill the definition and anchor fields with AI suggestions
4. User can edit before saving

**IPC Handler:**
- `ai:suggestVariableDefinition` → takes `{ label, scaleType }`
- Returns `{ success: true, definition: "...", anchors: {...} }`

### Feature 3: Variable Selection in PDF Excerpt Viewer

**UI Changes:**
- Replace hardcoded "Relevance" variable with a **dropdown selector**
- Dropdown shows all variables defined for the current collection
- When variable is selected:
  - Display variable definition (read-only)
  - Display appropriate input control:
    - Binary to 10-point: **Clickable buttons** (as currently implemented)
    - 100-point: **Slider** with numeric input
  - Show anchor definitions as tooltips on hover (or below input)

**Dynamic Rendering:**
- JavaScript should dynamically generate buttons/slider based on selected variable's scale type
- Example: If user selects a 7-point variable, render 7 buttons (1-7)

### Feature 4: Reasoning Depth Selector

**Location:** Next to the reasoning textarea in PDF Excerpt Viewer

**UI Requirements:**
- Add a small toggle/radio buttons: **Brief | Moderate | Lengthy**
- Show helper text:
  - Brief: "1-2 sentences"
  - Moderate: "3-5 sentences"
  - Lengthy: "6+ sentences (for scale development)"
- This is a preference setting that guides the user (not enforced)
- Store the selected depth with each rating for analysis purposes

**Database Update:**
```sql
-- Add to excerpt_ratings table
ALTER TABLE excerpt_ratings ADD COLUMN reasoning_depth TEXT DEFAULT 'brief';
```

### Feature 5: Speech-to-Text for Reasoning

**Location:** Reasoning textarea in PDF Excerpt Viewer

**UI Requirements:**
- Add a **microphone icon button** next to the textarea label
- When clicked:
  - Button changes to "recording" state (red icon + animation)
  - Browser's Web Speech API starts listening
  - Transcribed text appears in real-time in the textarea
  - Click again to stop recording

**Implementation:**
- Use browser's native `webkitSpeechRecognition` or `SpeechRecognition` API
- Handle permissions gracefully
- Show error if not supported or permission denied

**Code Snippet:**
```javascript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;

recognition.onresult = (event) => {
  const transcript = Array.from(event.results)
    .map(result => result[0].transcript)
    .join('');
  textareaElement.value = transcript;
};
```

### Feature 6: Auto-Save Ratings

**Behavior:**
- When user selects a score button or moves slider, immediately save to database
- When user types in reasoning field, debounce and auto-save after 1 second of inactivity
- Show subtle "Saved" indicator (checkmark icon, brief toast)

**Implementation:**
- Use `debounce` for textarea input
- Immediate save for score selection
- No "Submit" button required (but keep it for explicit final submission)

---

## Part III: Implementation Steps

### Step 1: Database Schema Updates
- Create `rating_variables` table
- Add `reasoning_depth` column to `excerpt_ratings` table
- Add `variable_id` foreign key to `excerpt_ratings` table

### Step 2: Variable Management UI (Collections Hub)
- Add "Create Rating Variable" button to collection view
- Build variable creation modal with all fields
- Implement dynamic anchor fields based on scale type selection
- Add save functionality to store variables in database

### Step 3: AI Variable Definition Suggester
- Create IPC handler `ai:suggestVariableDefinition`
- Build Gemini prompt for variable definition
- Wire up "Ask AI" button to call handler and populate fields

### Step 4: Variable Selector in PDF Excerpt Viewer
- Add dropdown to select rating variable
- Load all variables for current collection
- Display selected variable's definition
- Dynamically render input controls (buttons/slider) based on scale type
- Show anchor definitions

### Step 5: Reasoning Depth Selector
- Add Brief/Moderate/Lengthy toggle
- Store preference with each rating

### Step 6: Speech-to-Text
- Add microphone button
- Implement Web Speech API integration
- Handle permissions and browser compatibility

### Step 7: Auto-Save
- Implement debounced auto-save for textarea
- Implement immediate save for score selection
- Add visual feedback for save state

---

## Part IV: Acceptance Criteria

- ✅ User can create custom rating variables with different scale types
- ✅ AI can suggest definitions and anchors for variables
- ✅ Variables appear in dropdown in PDF excerpt viewer
- ✅ Input controls dynamically adjust based on variable scale type
- ✅ User can select reasoning depth (brief/moderate/lengthy)
- ✅ User can use speech-to-text for reasoning notes
- ✅ Ratings auto-save as user interacts with the form
- ✅ All data persists correctly to database

---

## Part V: Technical Notes

**Browser Compatibility:**
- Speech Recognition: Chrome/Edge (WebKit) only - show fallback message for other browsers
- All other features should work cross-browser

**Performance:**
- Debounce textarea auto-save to avoid excessive database writes
- Lazy-load variables when PDF viewer is opened

**UX Polish:**
- Smooth transitions when switching variables
- Clear visual feedback for AI suggestions, auto-save, and recording state
- Tooltips on anchor definitions for quick reference

---

**End of Handoff**

Implementation Agent: Please proceed with implementation following the steps outlined above.
