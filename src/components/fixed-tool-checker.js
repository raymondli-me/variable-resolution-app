// Fixed tool checker with better path handling
async function checkToolsAvailability() {
  try {
    const result = await window.api.tools.check();
    
    if (!result.success) {
      console.error('Tool check failed:', result.error);
      return null;
    }
    
    const tools = result.tools;
    console.log('Tool check results:', tools);
    
    // Update UI with tool status
    updateToolStatus(tools);
    
    return tools;
  } catch (error) {
    console.error('Error checking tools:', error);
    return null;
  }
}

function updateToolStatus(tools) {
  // Update header tool status if using modern UI
  const toolsStatusBar = document.getElementById('toolsStatusBar');
  if (toolsStatusBar) {
    toolsStatusBar.innerHTML = `
      <div class="tool-indicator ${tools.ytDlp?.available || tools.youtubeDl?.available ? 'available' : 'unavailable'}">
        ${tools.ytDlp?.available || tools.youtubeDl?.available ? '✓' : '✗'} yt-dlp
      </div>
      <div class="tool-indicator ${tools.ffmpeg?.available ? 'available' : 'unavailable'}">
        ${tools.ffmpeg?.available ? '✓' : '✗'} FFmpeg
      </div>
      <div class="tool-indicator ${tools.whisper?.available ? 'available' : 'unavailable'}">
        ${tools.whisper?.available ? '✓' : '✗'} Whisper
      </div>
    `;
  }
  
  // Update transcription status elements
  const transcriptionStatuses = [
    document.getElementById('transcriptionStatus'),
    document.getElementById('modernTranscriptionStatus'),
    document.getElementById('sp-transcriptionStatus')
  ];
  
  transcriptionStatuses.forEach(status => {
    if (status) {
      if (tools.whisper?.available) {
        status.textContent = '✓ Available';
        status.style.color = '#4ade80';
      } else {
        status.textContent = '✗ Not installed';
        status.style.color = '#f87171';
      }
    }
  });
  
  // Update GPU status if element exists
  const gpuStatus = document.getElementById('gpuStatus');
  if (gpuStatus && tools.whisper?.available) {
    if (tools.gpu?.available) {
      gpuStatus.innerHTML = `
        <span class="status-icon">🚀</span>
        <span class="status-text">GPU Ready: ${tools.gpu.type.toUpperCase()} acceleration available</span>
      `;
      gpuStatus.className = 'gpu-status gpu-available';
    } else {
      gpuStatus.innerHTML = `
        <span class="status-icon">🖥️</span>
        <span class="status-text">CPU Mode: Transcription will be slower</span>
      `;
      gpuStatus.className = 'gpu-status cpu-only';
    }
  }
  
  // Check if any tools are missing
  const missingTools = [];
  if (!tools.ytDlp?.available && !tools.youtubeDl?.available) {
    missingTools.push('yt-dlp');
  }
  if (!tools.ffmpeg?.available) {
    missingTools.push('FFmpeg');
  }
  if (!tools.whisper?.available) {
    missingTools.push('Whisper');
  }
  
  // Show install button if tools are missing
  if (missingTools.length > 0) {
    // Add install tools button to header if not present
    const header = document.querySelector('.header-actions') || document.querySelector('.tools-status');
    if (header && !document.getElementById('installToolsBtn')) {
      const installBtn = document.createElement('button');
      installBtn.id = 'installToolsBtn';
      installBtn.className = 'btn btn-warning btn-sm';
      installBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          <path d="M12 8v4m0 4h.01"/>
        </svg>
        Install Missing Tools (${missingTools.length})
      `;
      installBtn.style.marginLeft = '16px';
      installBtn.onclick = () => {
        if (typeof toolInstaller !== 'undefined' && toolInstaller.show) {
          toolInstaller.show();
        }
      };
      header.appendChild(installBtn);
    }
  }
  
  return tools;
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkToolsAvailability);
} else {
  checkToolsAvailability();
}

// Export for use in other modules
window.checkToolsAvailability = checkToolsAvailability;