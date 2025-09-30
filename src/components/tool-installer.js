// Tool installer modal component
class ToolInstaller {
  constructor() {
    this.modalId = 'toolInstallerModal';
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    const modalHtml = `
      <div id="${this.modalId}" class="modal" style="display: none;">
        <div class="modal-content tool-installer">
          <div class="modal-header">
            <h2>Install Missing Tools</h2>
            <button class="close-btn" onclick="toolInstaller.close()">×</button>
          </div>
          
          <div class="system-info">
            <div class="info-item">
              <span class="label">System:</span>
              <span id="systemInfo" class="value">Detecting...</span>
            </div>
            <div class="info-item">
              <span class="label">Python:</span>
              <span id="pythonInfo" class="value">Checking...</span>
            </div>
            <div class="info-item">
              <span class="label">GPU:</span>
              <span id="gpuInfo" class="value">Detecting...</span>
            </div>
          </div>

          <div class="tools-section">
            <h3>Required Tools</h3>
            
            <div class="tool-item" id="ytdlpTool">
              <div class="tool-header">
                <div class="tool-info">
                  <h4>yt-dlp</h4>
                  <p>Video downloader - required for downloading YouTube videos</p>
                  <span class="tool-status" id="ytdlpStatus">Checking...</span>
                </div>
                <button class="btn btn-install" id="ytdlpInstall" style="display: none;">
                  Install
                </button>
              </div>
              <div class="install-output" id="ytdlpOutput" style="display: none;">
                <pre></pre>
              </div>
            </div>

            <div class="tool-item" id="ffmpegTool">
              <div class="tool-header">
                <div class="tool-info">
                  <h4>FFmpeg</h4>
                  <p>Media processor - required for video/audio conversion</p>
                  <span class="tool-status" id="ffmpegStatus">Checking...</span>
                </div>
                <button class="btn btn-install" id="ffmpegInstall" style="display: none;">
                  Install
                </button>
              </div>
              <div class="install-output" id="ffmpegOutput" style="display: none;">
                <pre></pre>
              </div>
            </div>

            <div class="tool-item" id="whisperTool">
              <div class="tool-header">
                <div class="tool-info">
                  <h4>OpenAI Whisper</h4>
                  <p>Speech-to-text - optional for transcribing videos</p>
                  <span class="tool-status" id="whisperStatus">Checking...</span>
                </div>
                <button class="btn btn-install" id="whisperInstall" style="display: none;">
                  Install
                </button>
              </div>
              <div class="install-output" id="whisperOutput" style="display: none;">
                <pre></pre>
              </div>
            </div>
          </div>

          <div class="install-notes">
            <h3>Installation Notes</h3>
            <div id="installInstructions"></div>
          </div>

          <div class="modal-actions">
            <button class="btn" onclick="toolInstaller.checkTools()">Refresh Status</button>
            <button class="btn btn-primary" onclick="toolInstaller.close()">Done</button>
          </div>
        </div>
      </div>
    `;

    // Add to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async checkTools() {
    try {
      const result = await window.api.tools.check();
      
      if (result.success) {
        this.updateSystemInfo(result.tools);
        this.updateToolStatus(result.tools);
        this.showInstallButtons(result.tools);
        this.updateInstructions(result.tools);
      }
    } catch (error) {
      console.error('Error checking tools:', error);
    }
  }

  updateSystemInfo(tools) {
    const platform = window.api.platform;
    let systemText = 'Unknown';
    
    if (platform.includes('darwin')) {
      systemText = 'macOS';
      if (platform.includes('arm64')) {
        systemText += ' (Apple Silicon)';
      } else {
        systemText += ' (Intel)';
      }
    } else if (platform.includes('win32')) {
      systemText = 'Windows';
    } else if (platform.includes('linux')) {
      systemText = 'Linux';
    }
    
    document.getElementById('systemInfo').textContent = systemText;
    
    // Python info
    const pythonInfo = document.getElementById('pythonInfo');
    if (tools.python?.available) {
      pythonInfo.textContent = `✓ ${tools.python.version}`;
      pythonInfo.className = 'value available';
    } else {
      pythonInfo.textContent = '✗ Not installed';
      pythonInfo.className = 'value unavailable';
    }
    
    // GPU info
    const gpuInfo = document.getElementById('gpuInfo');
    if (tools.gpu?.available) {
      gpuInfo.textContent = `✓ ${tools.gpu.type.toUpperCase()}`;
      gpuInfo.className = 'value available';
    } else {
      gpuInfo.textContent = 'CPU only';
      gpuInfo.className = 'value';
    }
  }

  updateToolStatus(tools) {
    // yt-dlp
    const ytdlpStatus = document.getElementById('ytdlpStatus');
    if (tools.ytDlp?.available) {
      ytdlpStatus.textContent = '✓ Installed';
      ytdlpStatus.className = 'tool-status installed';
    } else {
      ytdlpStatus.textContent = '✗ Not installed';
      ytdlpStatus.className = 'tool-status not-installed';
    }
    
    // ffmpeg
    const ffmpegStatus = document.getElementById('ffmpegStatus');
    if (tools.ffmpeg?.available) {
      ffmpegStatus.textContent = '✓ Installed';
      ffmpegStatus.className = 'tool-status installed';
    } else {
      ffmpegStatus.textContent = '✗ Not installed';
      ffmpegStatus.className = 'tool-status not-installed';
    }
    
    // whisper
    const whisperStatus = document.getElementById('whisperStatus');
    if (tools.whisper?.available) {
      whisperStatus.textContent = '✓ Installed';
      whisperStatus.className = 'tool-status installed';
    } else {
      whisperStatus.textContent = '✗ Not installed';
      whisperStatus.className = 'tool-status not-installed';
    }
  }

  showInstallButtons(tools) {
    // Show install buttons for missing tools
    document.getElementById('ytdlpInstall').style.display = 
      tools.ytDlp?.available ? 'none' : 'inline-block';
    
    document.getElementById('ffmpegInstall').style.display = 
      tools.ffmpeg?.available ? 'none' : 'inline-block';
    
    document.getElementById('whisperInstall').style.display = 
      tools.whisper?.available ? 'none' : 'inline-block';
    
    // Hide whisper if no Python
    if (!tools.python?.available) {
      document.getElementById('whisperInstall').style.display = 'none';
    }
  }

  updateInstructions(tools) {
    const instructions = document.getElementById('installInstructions');
    const platform = window.api.platform;
    let html = '';
    
    // Show pipx status for macOS
    if (platform.includes('darwin')) {
      if (tools.pipx?.available) {
        html += `
          <div class="install-note success">
            <strong>pipx:</strong> ✓ Installed - Python tools will be isolated automatically
          </div>
        `;
      } else {
        html += `
          <div class="install-note info">
            <strong>pipx:</strong> Will be installed automatically when you install Python tools
          </div>
        `;
      }
    }
    
    if (!tools.python?.available) {
      html += `
        <div class="install-note warning">
          <strong>Python Required:</strong> Install Python 3.8+ first
          <ul>
            <li>macOS: <code>brew install python3</code></li>
            <li>Windows: Download from <a href="https://python.org" target="_blank">python.org</a></li>
            <li>Linux: <code>sudo apt install python3 python3-pip</code></li>
          </ul>
        </div>
      `;
    }
    
    if (!tools.ffmpeg?.available && platform.includes('darwin')) {
      html += `
        <div class="install-note">
          <strong>FFmpeg on macOS:</strong> 
          <code>brew install ffmpeg</code>
        </div>
      `;
    }
    
    if (tools.gpu?.available && tools.gpu.type === 'cuda') {
      html += `
        <div class="install-note success">
          <strong>NVIDIA GPU Detected:</strong> Whisper will use CUDA acceleration
        </div>
      `;
    } else if (tools.gpu?.available && tools.gpu.type === 'metal') {
      html += `
        <div class="install-note success">
          <strong>Apple Silicon Detected:</strong> Whisper will use Metal acceleration
        </div>
      `;
    }
    
    instructions.innerHTML = html;
  }

  async installTool(toolName) {
    const outputEl = document.getElementById(`${toolName}Output`);
    const preEl = outputEl.querySelector('pre');
    const installBtn = document.getElementById(`${toolName}Install`);
    
    // Show output area
    outputEl.style.display = 'block';
    installBtn.disabled = true;
    installBtn.textContent = 'Installing...';
    
    try {
      // Show initial status
      preEl.textContent = 'Starting installation...\n';
      
      // Special message for Python tools on macOS
      if ((toolName === 'ytdlp' || toolName === 'whisper') && window.api.platform.includes('darwin')) {
        preEl.textContent += 'Installing via pipx (Python package manager)...\n';
        preEl.textContent += 'This will create an isolated environment for the tool...\n\n';
      }
      
      const result = await window.api.tools.install(toolName);
      
      if (result.success) {
        preEl.textContent += result.output;
        installBtn.textContent = 'Installed!';
        installBtn.className = 'btn btn-success';
        
        // Recheck tools immediately
        this.checkTools();
        
        // Also refresh the main app's tool check
        if (typeof checkToolsAvailability === 'function') {
          checkToolsAvailability();
        }
      } else {
        preEl.textContent += '\nError: ' + (result.error || 'Installation failed');
        installBtn.textContent = 'Retry';
        installBtn.disabled = false;
      }
    } catch (error) {
      preEl.textContent += `\nError: ${error.message}`;
      installBtn.textContent = 'Retry';
      installBtn.disabled = false;
    }
  }

  bindEvents() {
    // Install button clicks
    document.getElementById('ytdlpInstall').addEventListener('click', () => {
      this.installTool('ytdlp');
    });
    
    document.getElementById('ffmpegInstall').addEventListener('click', () => {
      this.installTool('ffmpeg');
    });
    
    document.getElementById('whisperInstall').addEventListener('click', () => {
      this.installTool('whisper');
    });
  }

  show() {
    document.getElementById(this.modalId).style.display = 'flex';
    this.checkTools();
  }

  close() {
    document.getElementById(this.modalId).style.display = 'none';
    
    // Refresh tool availability on close
    if (typeof checkToolsAvailability === 'function') {
      checkToolsAvailability();
    }
  }
}

// Initialize tool installer
const toolInstaller = new ToolInstaller();