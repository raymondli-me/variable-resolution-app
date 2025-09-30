// Check for yt-dlp and whisper availability
async function checkToolsAvailability() {
  try {
    const result = await window.api.tools.check();
    
    if (result.success) {
      const tools = result.tools;
      
      // Check if any critical tools are missing
      const missingTools = [];
      if (!tools.ytDlp?.available) missingTools.push('yt-dlp');
      if (!tools.ffmpeg?.available) missingTools.push('ffmpeg');
      if (!tools.whisper?.available) missingTools.push('whisper');
      
      // Add install button to settings if tools are missing
      if (missingTools.length > 0) {
        addInstallButton(missingTools);
      } else {
        // Remove install button if all tools are installed
        const installBtn = document.getElementById('installToolsBtn');
        if (installBtn) {
          installBtn.remove();
        }
      }
      
      // Update transcription status - check if elements exist
      const transcriptionStatus = document.getElementById('transcriptionStatus');
      const gpuStatus = document.getElementById('gpuStatus');
      
      if (transcriptionStatus && tools.whisper?.available) {
        transcriptionStatus.textContent = '✓ Whisper available';
        transcriptionStatus.className = 'transcription-status available';
        
        // Check GPU
        if (gpuStatus) {
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
      } else if (transcriptionStatus) {
        transcriptionStatus.innerHTML = '⚠️ Whisper not installed - <a href="#" onclick="toolInstaller.show(); return false;">Install Now</a>';
        transcriptionStatus.className = 'transcription-status unavailable';
        // Don't disable by default anymore since user wants it on by default
        // document.getElementById('enableTranscription').checked = false;
        // document.getElementById('transcriptionOptions').style.display = 'none';
      }
      
      // Update download method indicator
      if (tools.ytDlp?.available) {
        console.log('✅ yt-dlp available for enhanced downloads');
      } else {
        console.log('⚠️ yt-dlp not found - video downloads disabled');
        
        // Show install prompt instead of disabling
        const downloadCheckbox = document.getElementById('downloadVideo');
        if (downloadCheckbox && !tools.ytDlp?.available && !tools.youtubeDl?.available) {
          // Add warning next to download option
          const downloadLabel = downloadCheckbox.parentElement;
          if (!downloadLabel.querySelector('.install-prompt')) {
            downloadLabel.insertAdjacentHTML('afterend', 
              '<small class="install-prompt" style="color: #ff6b6b; margin-left: 25px;">Requires yt-dlp - <a href="#" onclick="toolInstaller.show(); return false;">Install Now</a></small>'
            );
          }
        }
      }
      
      // Return tools status for other functions
      return tools;
    }
  } catch (error) {
    console.error('Error checking tools:', error);
  }
}

// Add install button to header
function addInstallButton(missingTools) {
  const headerActions = document.querySelector('.header-actions');
  if (headerActions && !document.getElementById('installToolsBtn')) {
    const installBtn = document.createElement('button');
    installBtn.id = 'installToolsBtn';
    installBtn.className = 'btn btn-warning btn-sm';
    installBtn.innerHTML = `
      <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"margin-right: 5px;\">
        <path d=\"M12 2L2 7L12 12L22 7L12 2Z\"></path>
        <path d=\"M2 17L12 22L22 17\"></path>
        <path d=\"M2 12L12 17L22 12\"></path>
      </svg>
      Install Missing Tools (${missingTools.length})
    `;
    installBtn.onclick = () => toolInstaller.show();
    headerActions.insertBefore(installBtn, headerActions.firstChild);
  }
}