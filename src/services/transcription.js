import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class TranscriptionService {
  constructor(options = {}) {
    this.whisperModel = options.whisperModel || 'base';
    this.device = options.device || 'auto'; // auto, cuda, cpu
    this.language = options.language || 'en';
    this.outputFormat = options.outputFormat || 'json';
  }

  /**
   * Check if Whisper is installed and CUDA is available
   */
  async checkCapabilities() {
    const capabilities = {
      whisperInstalled: false,
      cudaAvailable: false,
      metalAvailable: false,
      gpuAcceleration: false,
      availableModels: []
    };

    try {
      // Check if whisper is installed
      const whisperCheck = await this.runCommand('whisper', ['--help']);
      capabilities.whisperInstalled = whisperCheck.success;

      // Check for CUDA
      if (process.platform === 'linux' || process.platform === 'win32') {
        const cudaCheck = await this.runCommand('nvidia-smi', []);
        capabilities.cudaAvailable = cudaCheck.success;
        
        // Check PyTorch CUDA
        const pythonCheck = await this.runCommand('python', ['-c', 
          "import torch; print('CUDA' if torch.cuda.is_available() else 'CPU')"
        ]);
        capabilities.gpuAcceleration = pythonCheck.output.includes('CUDA');
      }

      // Check for Metal acceleration (macOS)
      if (process.platform === 'darwin') {
        const metalCheck = await this.runCommand('python', ['-c',
          "import torch; print('MPS' if torch.backends.mps.is_available() else 'CPU')"
        ]);
        capabilities.metalAvailable = metalCheck.output.includes('MPS');
        capabilities.gpuAcceleration = capabilities.metalAvailable;
      }

      // List available Whisper models
      const modelsPath = path.join(process.env.HOME, '.cache', 'whisper');
      try {
        const files = await fs.readdir(modelsPath);
        capabilities.availableModels = files
          .filter(f => f.endsWith('.pt'))
          .map(f => f.replace('.pt', ''));
      } catch (e) {
        // No cached models yet
      }

    } catch (error) {
      console.error('Error checking capabilities:', error);
    }

    return capabilities;
  }

  /**
   * Transcribe audio/video using Whisper
   */
  async transcribe(inputFile, options = {}) {
    const {
      model = this.whisperModel,
      language = this.language,
      device = this.device,
      task = 'transcribe', // transcribe or translate
      outputDir = path.dirname(inputFile),
      timestamps = true,
      detectLanguage = false
    } = options;

    // Determine device to use
    let deviceFlag = '--device';
    let deviceValue = 'cpu';

    if (device === 'auto') {
      const caps = await this.checkCapabilities();
      if (caps.cudaAvailable && caps.gpuAcceleration) {
        deviceValue = 'cuda';
      } else if (caps.metalAvailable) {
        deviceValue = 'mps'; // Metal Performance Shaders
      }
    } else {
      deviceValue = device;
    }

    const outputBase = path.join(outputDir, path.basename(inputFile, path.extname(inputFile)));

    const args = [
      inputFile,
      '--model', model,
      deviceFlag, deviceValue,
      '--output_dir', outputDir,
      '--task', task,
      '--output_format', 'all' // Get all formats
    ];

    if (!detectLanguage) {
      args.push('--language', language);
    }

    if (timestamps) {
      args.push('--word_timestamps', 'True');
    }

    // Add progress callback
    args.push('--verbose', 'True');

    console.log(`Transcribing with Whisper ${model} on ${deviceValue}...`);
    
    const startTime = Date.now();
    const result = await this.runWhisper(args, (progress) => {
      if (options.onProgress) {
        options.onProgress(progress);
      }
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      // Read the generated files
      const transcription = {
        text: await this.readOutput(`${outputBase}.txt`),
        segments: await this.readJSON(`${outputBase}.json`),
        srt: await this.readOutput(`${outputBase}.srt`),
        vtt: await this.readOutput(`${outputBase}.vtt`),
        metadata: {
          model,
          device: deviceValue,
          language: result.detectedLanguage || language,
          duration: duration / 1000,
          inputFile,
          timestamp: new Date().toISOString()
        }
      };

      return transcription;
    } else {
      throw new Error(`Transcription failed: ${result.error}`);
    }
  }

  /**
   * Run Whisper with progress tracking
   */
  async runWhisper(args, onProgress) {
    return new Promise((resolve) => {
      const whisper = spawn('whisper', args);
      
      let output = '';
      let error = '';
      let detectedLanguage = null;

      whisper.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        // Parse progress
        if (text.includes('%|')) {
          const match = text.match(/(\d+)%\|/);
          if (match) {
            const progress = parseInt(match[1]);
            onProgress({ percentage: progress, message: text.trim() });
          }
        }

        // Detect language
        if (text.includes('Detected language:')) {
          const langMatch = text.match(/Detected language: (\w+)/);
          if (langMatch) {
            detectedLanguage = langMatch[1];
          }
        }
      });

      whisper.stderr.on('data', (data) => {
        error += data.toString();
      });

      whisper.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error,
          detectedLanguage
        });
      });
    });
  }

  /**
   * Download and setup Whisper model
   */
  async downloadModel(modelName = 'base') {
    console.log(`Downloading Whisper model: ${modelName}`);
    
    const result = await this.runCommand('whisper', [
      '--model', modelName,
      '--download-root', path.join(process.env.HOME, '.cache', 'whisper'),
      '--help' // Just to trigger download
    ]);

    return result.success;
  }

  /**
   * Extract audio from video using ffmpeg
   */
  async extractAudio(videoFile, outputFile = null) {
    if (!outputFile) {
      outputFile = videoFile.replace(path.extname(videoFile), '.wav');
    }

    const args = [
      '-i', videoFile,
      '-vn', // No video
      '-acodec', 'pcm_s16le', // WAV format
      '-ar', '16000', // 16kHz sample rate (optimal for Whisper)
      '-ac', '1', // Mono
      outputFile,
      '-y' // Overwrite
    ];

    const result = await this.runCommand('ffmpeg', args);
    
    if (result.success) {
      return outputFile;
    } else {
      throw new Error(`Audio extraction failed: ${result.error}`);
    }
  }

  /**
   * Batch transcribe multiple files
   */
  async batchTranscribe(files, options = {}) {
    const results = [];
    const total = files.length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        console.log(`Transcribing ${i + 1}/${total}: ${path.basename(file)}`);
        
        const transcription = await this.transcribe(file, {
          ...options,
          onProgress: (progress) => {
            if (options.onProgress) {
              options.onProgress({
                fileIndex: i,
                fileName: path.basename(file),
                fileProgress: progress.percentage,
                totalProgress: ((i + progress.percentage / 100) / total) * 100
              });
            }
          }
        });
        
        results.push({
          file,
          success: true,
          transcription
        });
      } catch (error) {
        results.push({
          file,
          success: false,
          error: error.message
        });
        
        if (!options.continueOnError) {
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Helper: Run command
   */
  async runCommand(command, args) {
    return new Promise((resolve) => {
      const proc = spawn(command, args);
      
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
   * Helper: Read output file
   */
  async readOutput(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper: Read JSON file
   */
  async readJSON(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
}

// Export singleton
export default new TranscriptionService();