import { spawn } from 'child_process';
import path from 'path';

export class ToolDetector {
  constructor() {
    this.capabilities = {
      ytDlp: { available: false, version: null, path: null },
      youtubeDl: { available: false, version: null, path: null },
      ffmpeg: { available: false, version: null, path: null },
      whisper: { available: false, version: null, path: null },
      python: { available: false, version: null, path: null },
      gpu: { 
        available: false, 
        type: 'none', // none, cuda, metal, cpu
        device: null,
        memory: null 
      }
    };
  }

  /**
   * Check all tools and capabilities
   */
  async detectAll() {
    console.log('🔍 Detecting available tools...\n');
    
    // Check downloaders
    await this.checkYtDlp();
    await this.checkYoutubeDl();
    
    // Check media tools
    await this.checkFFmpeg();
    
    // Check Python and AI tools
    await this.checkPython();
    if (this.capabilities.python.available) {
      await this.checkWhisper();
      await this.checkGPU();
    }
    
    return this.getReport();
  }

  /**
   * Check yt-dlp
   */
  async checkYtDlp() {
    try {
      const result = await this.runCommand('yt-dlp', ['--version']);
      if (result.success) {
        this.capabilities.ytDlp = {
          available: true,
          version: result.output.trim(),
          path: await this.which('yt-dlp')
        };
        console.log('✅ yt-dlp:', this.capabilities.ytDlp.version);
      }
    } catch (e) {
      console.log('❌ yt-dlp: Not installed');
    }
  }

  /**
   * Check youtube-dl
   */
  async checkYoutubeDl() {
    if (this.capabilities.ytDlp.available) return; // Skip if yt-dlp available
    
    try {
      const result = await this.runCommand('youtube-dl', ['--version']);
      if (result.success) {
        this.capabilities.youtubeDl = {
          available: true,
          version: result.output.trim(),
          path: await this.which('youtube-dl')
        };
        console.log('✅ youtube-dl:', this.capabilities.youtubeDl.version);
      }
    } catch (e) {
      console.log('❌ youtube-dl: Not installed');
    }
  }

  /**
   * Check FFmpeg
   */
  async checkFFmpeg() {
    try {
      const result = await this.runCommand('ffmpeg', ['-version']);
      if (result.success) {
        const versionMatch = result.output.match(/ffmpeg version ([^\s]+)/);
        this.capabilities.ffmpeg = {
          available: true,
          version: versionMatch ? versionMatch[1] : 'unknown',
          path: await this.which('ffmpeg')
        };
        console.log('✅ ffmpeg:', this.capabilities.ffmpeg.version);
      }
    } catch (e) {
      console.log('❌ ffmpeg: Not installed');
    }
  }

  /**
   * Check Python
   */
  async checkPython() {
    try {
      const result = await this.runCommand('python3', ['-V']);
      if (result.success) {
        this.capabilities.python = {
          available: true,
          version: result.output.trim(),
          path: await this.which('python3')
        };
        console.log('✅ Python:', this.capabilities.python.version);
      }
    } catch (e) {
      try {
        const result = await this.runCommand('python', ['-V']);
        if (result.success) {
          this.capabilities.python = {
            available: true,
            version: result.output.trim(),
            path: await this.which('python')
          };
          console.log('✅ Python:', this.capabilities.python.version);
        }
      } catch (e2) {
        console.log('❌ Python: Not installed');
      }
    }
  }

  /**
   * Check Whisper
   */
  async checkWhisper() {
    try {
      const result = await this.runCommand('whisper', ['--help']);
      if (result.success) {
        this.capabilities.whisper = {
          available: true,
          version: 'installed',
          path: await this.which('whisper'),
          models: []
        };
        
        // Check cached models
        await this.checkWhisperModels();
        
        console.log('✅ Whisper: Installed');
        if (this.capabilities.whisper.models.length > 0) {
          console.log('   Models:', this.capabilities.whisper.models.join(', '));
        }
      }
    } catch (e) {
      console.log('❌ Whisper: Not installed');
      console.log('   Install with: pip install openai-whisper');
    }
  }

  /**
   * Check GPU acceleration
   */
  async checkGPU() {
    const pythonCmd = this.capabilities.python.path || 'python3';
    
    // Check for GPU availability
    const gpuCheckScript = `
import sys
try:
    import torch
    if torch.cuda.is_available():
        print(f"cuda|{torch.cuda.get_device_name(0)}|{torch.cuda.get_device_properties(0).total_memory // 1024**3}GB")
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        print("metal|Apple Silicon|Shared")
    else:
        print("cpu|CPU Only|N/A")
except:
    print("cpu|No PyTorch|N/A")
`;

    try {
      const result = await this.runCommand(pythonCmd, ['-c', gpuCheckScript]);
      if (result.success) {
        const [type, device, memory] = result.output.trim().split('|');
        this.capabilities.gpu = {
          available: type !== 'cpu',
          type,
          device,
          memory
        };
        
        if (type === 'cuda') {
          console.log(`✅ GPU: NVIDIA ${device} (${memory})`);
        } else if (type === 'metal') {
          console.log('✅ GPU: Apple Silicon (Metal)');
        } else {
          console.log('⚠️  GPU: Not available, will use CPU');
        }
      }
    } catch (e) {
      console.log('⚠️  GPU: Detection failed, will use CPU');
    }
  }

  /**
   * Check Whisper models
   */
  async checkWhisperModels() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const modelsPath = path.join(homeDir, '.cache', 'whisper');
    
    try {
      const fs = require('fs');
      const files = fs.readdirSync(modelsPath);
      const models = files
        .filter(f => f.endsWith('.pt'))
        .map(f => f.replace('.pt', ''));
      
      if (models.length > 0) {
        this.capabilities.whisper.models = models;
      }
    } catch (e) {
      // No models cached yet
    }
  }

  /**
   * Get which path
   */
  async which(command) {
    try {
      const result = await this.runCommand('which', [command]);
      if (result.success) {
        return result.output.trim();
      }
    } catch (e) {
      // Try where on Windows
      try {
        const result = await this.runCommand('where', [command]);
        if (result.success) {
          return result.output.split('\n')[0].trim();
        }
      } catch (e2) {
        return null;
      }
    }
    return null;
  }

  /**
   * Run command helper
   */
  async runCommand(command, args = []) {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { shell: true });
      
      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          output,
          error: err.message
        });
      });
    });
  }

  /**
   * Get capabilities report
   */
  getReport() {
    const report = {
      ready: false,
      downloadCapable: false,
      transcriptionCapable: false,
      gpuAccelerated: false,
      recommendations: [],
      capabilities: this.capabilities
    };

    // Check download capability
    if (this.capabilities.ytDlp.available || this.capabilities.youtubeDl.available) {
      report.downloadCapable = true;
    } else {
      report.recommendations.push('Install yt-dlp for better video downloading: pip install yt-dlp');
    }

    // Check transcription capability
    if (this.capabilities.whisper.available) {
      report.transcriptionCapable = true;
      if (this.capabilities.gpu.available) {
        report.gpuAccelerated = true;
      } else {
        report.recommendations.push('GPU not detected - transcription will be slower');
      }
    } else {
      report.recommendations.push('Install Whisper for transcription: pip install openai-whisper');
    }

    // Check FFmpeg
    if (!this.capabilities.ffmpeg.available) {
      report.recommendations.push('Install FFmpeg for media processing: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)');
    }

    report.ready = report.downloadCapable;

    console.log('\n📊 Summary:');
    console.log(`Download capable: ${report.downloadCapable ? '✅' : '❌'}`);
    console.log(`Transcription capable: ${report.transcriptionCapable ? '✅' : '❌'}`);
    console.log(`GPU accelerated: ${report.gpuAccelerated ? '✅' : '❌'}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    return report;
  }
}

// Export singleton
export default new ToolDetector();