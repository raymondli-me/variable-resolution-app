# VR Data Collector - Setup Guide for yt-dlp & Whisper

## Prerequisites Installation

### 1. Install yt-dlp (Enhanced YouTube Downloader)

**macOS:**
```bash
# Using Homebrew
brew install yt-dlp

# Or using pip
pip install yt-dlp

# Verify installation
yt-dlp --version
```

**Linux:**
```bash
# Using pip (recommended)
pip install yt-dlp

# Or using package manager (Ubuntu/Debian)
sudo apt update
sudo apt install yt-dlp

# Verify installation
yt-dlp --version
```

### 2. Install FFmpeg (Required for audio/video processing)

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 3. Install Whisper (OpenAI's Speech Recognition)

**Basic Installation (CPU only):**
```bash
pip install openai-whisper
```

**GPU-Accelerated Installation:**

**For NVIDIA GPUs (CUDA):**
```bash
# Install PyTorch with CUDA support first
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Then install Whisper
pip install openai-whisper

# Verify CUDA is available
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

**For macOS (Metal/MPS acceleration):**
```bash
# Install PyTorch with Metal Performance Shaders support
pip install torch torchvision torchaudio

# Install Whisper
pip install openai-whisper

# Verify Metal is available
python -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"
```

## Whisper Models

### Available Models & Performance

| Model  | Parameters | English-only | Multilingual | Required VRAM | Relative Speed |
|--------|-----------|--------------|--------------|---------------|----------------|
| tiny   | 39M       | ✓            | ✓            | ~1 GB         | ~32x           |
| base   | 74M       | ✓            | ✓            | ~1 GB         | ~16x           |
| small  | 244M      | ✓            | ✓            | ~2 GB         | ~8x            |
| medium | 769M      | ✓            | ✓            | ~5 GB         | ~4x            |
| large  | 1550M     | ✗            | ✓            | ~10 GB        | 1x             |

### Download Models
```bash
# Models are auto-downloaded on first use, or manually:
whisper --model base --language en --help

# Models are stored in ~/.cache/whisper/
```

## GPU Acceleration Status

### Check Your Setup
```bash
# Run this Python script to check GPU acceleration
python3 << 'EOF'
import torch
import subprocess
import platform

print("=== System Information ===")
print(f"Platform: {platform.system()}")
print(f"Python: {platform.python_version()}")

print("\n=== PyTorch Configuration ===")
print(f"PyTorch version: {torch.__version__}")

if platform.system() == "Darwin":  # macOS
    print(f"MPS (Metal) available: {torch.backends.mps.is_available()}")
    if torch.backends.mps.is_available():
        print("✓ GPU acceleration available via Metal Performance Shaders")
else:
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"✓ GPU acceleration available via CUDA")

print("\n=== Whisper Test ===")
try:
    import whisper
    print("✓ Whisper installed successfully")
except ImportError:
    print("✗ Whisper not installed")

print("\n=== yt-dlp Test ===")
result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True)
if result.returncode == 0:
    print(f"✓ yt-dlp version: {result.stdout.strip()}")
else:
    print("✗ yt-dlp not installed")
EOF
```

## Using GPU Acceleration in VR Collector

### In Settings
1. Open VR Collector
2. Go to Settings
3. Under "Transcription Settings":
   - **Whisper Model**: Choose based on your GPU memory
   - **Device**: 
     - `auto` - Automatically detect best option
     - `cuda` - Force NVIDIA GPU
     - `mps` - Force Metal (macOS)
     - `cpu` - Force CPU only

### Recommended Settings

**For NVIDIA GPUs:**
- RTX 3060/3070: Use "small" or "medium" model
- RTX 3080/3090: Can use "large" model
- Older GPUs: Use "tiny" or "base" model

**For macOS (M1/M2):**
- M1: Use "base" or "small" model
- M1 Pro/Max: Use "small" or "medium" model
- M2 Pro/Max: Can use "large" model

**For CPU only:**
- Use "tiny" or "base" model
- Expect slower processing times

## Enhanced Features with yt-dlp

### 1. Better Video Quality Selection
```javascript
// In extraction settings:
- "Best up to 720p" - Downloads best quality up to 720p
- "Best up to 1080p" - Downloads best quality up to 1080p
- "Best available" - Downloads highest quality
- "Audio only" - Extracts just audio
```

### 2. Additional Metadata
- Video chapters
- Sponsor segments (if available)
- All available subtitles
- Creator comments

### 3. Reliability Features
- Automatic retry on failure
- Resume interrupted downloads
- Cookie support for age-restricted content
- Proxy support for region-locked content

## Performance Benchmarks

### Transcription Speed (1 hour of audio)

**With GPU (CUDA/Metal):**
- tiny: ~2 minutes
- base: ~3 minutes
- small: ~5 minutes
- medium: ~10 minutes
- large: ~20 minutes

**CPU Only:**
- tiny: ~10 minutes
- base: ~20 minutes
- small: ~45 minutes
- medium: ~2 hours
- large: ~5 hours

## Troubleshooting

### "CUDA out of memory"
- Use a smaller Whisper model
- Close other GPU applications
- Set device to "cpu" temporarily

### "MPS backend out of memory" (macOS)
- Use a smaller model
- Restart the app
- Check Activity Monitor for memory usage

### "yt-dlp: command not found"
```bash
# Reinstall with pip
pip install --upgrade yt-dlp

# Add to PATH if needed
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Slow transcription
- Check GPU is being used (see GPU status in logs)
- Use a smaller model
- Ensure no other heavy processes running

## Advanced Configuration

### Custom yt-dlp Config
Create `~/.config/yt-dlp/config`:
```
# Prefer 720p
-f "bestvideo[height<=720]+bestaudio/best[height<=720]"

# Always extract subtitles
--write-auto-subs
--sub-langs "en,en-US"

# Rate limiting
--limit-rate 5M

# Output template
-o "%(title)s-%(id)s.%(ext)s"
```

### Batch Processing Script
```bash
#!/bin/bash
# batch_transcribe.sh

for video in *.mp4; do
    echo "Processing: $video"
    whisper "$video" --model base --device cuda --language en
done
```

## Integration with VR Collector

The VR Collector automatically:
1. Detects available tools (yt-dlp, whisper, ffmpeg)
2. Checks GPU availability
3. Uses optimal settings based on your hardware
4. Falls back gracefully if tools are missing

To enable transcription:
1. Check "Enable Transcription" in Data Extraction tab
2. Select Whisper model based on your GPU
3. Choose "Auto" for device selection
4. Start collection - transcription happens automatically!

## Resource Usage

### Disk Space
- Videos: 100-500 MB per video (720p)
- Audio: 10-50 MB per video
- Transcriptions: <1 MB per video
- Whisper models: 50 MB (tiny) to 3 GB (large)

### Memory Usage
- yt-dlp: Minimal (<100 MB)
- Whisper: 1-10 GB depending on model
- FFmpeg: <500 MB

### Network
- yt-dlp handles rate limiting automatically
- Respects YouTube's servers
- Can resume interrupted downloads