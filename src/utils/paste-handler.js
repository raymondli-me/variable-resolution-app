// Enhanced paste handling for all forms

export function enablePasteSupport() {
  // Enable paste for all input fields
  document.addEventListener('paste', (e) => {
    const activeElement = document.activeElement;
    
    // Allow paste in all input fields and textareas
    if (activeElement && 
        (activeElement.tagName === 'INPUT' || 
         activeElement.tagName === 'TEXTAREA')) {
      // Paste is allowed by default, but we can process it
      const pastedText = e.clipboardData.getData('text');
      
      // Clean up API keys (remove extra spaces/newlines)
      if (activeElement.id && activeElement.id.includes('ApiKey')) {
        e.preventDefault();
        const cleanedKey = pastedText.trim().replace(/\s+/g, '');
        
        // Insert at cursor position
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const currentValue = activeElement.value;
        
        activeElement.value = 
          currentValue.slice(0, start) + 
          cleanedKey + 
          currentValue.slice(end);
          
        // Move cursor to end of pasted content
        const newCursorPos = start + cleanedKey.length;
        activeElement.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event for any listeners
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  // Enable context menu with paste option
  document.addEventListener('contextmenu', (e) => {
    const activeElement = document.activeElement;
    
    if (activeElement && 
        (activeElement.tagName === 'INPUT' || 
         activeElement.tagName === 'TEXTAREA')) {
      // Context menu will show with paste option
      // This is handled by Electron automatically
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd+V (Mac) or Ctrl+V (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      const activeElement = document.activeElement;
      
      if (activeElement && 
          (activeElement.tagName === 'INPUT' || 
           activeElement.tagName === 'TEXTAREA')) {
        // Allow default paste behavior
        return true;
      }
    }
    
    // Cmd+A or Ctrl+A for select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      const activeElement = document.activeElement;
      
      if (activeElement && 
          (activeElement.tagName === 'INPUT' || 
           activeElement.tagName === 'TEXTAREA')) {
        e.preventDefault();
        activeElement.select();
      }
    }
  });

  // Fix for password fields specifically
  const passwordFields = document.querySelectorAll('input[type="password"]');
  passwordFields.forEach(field => {
    // Remove any paste restrictions
    field.removeAttribute('onpaste');
    
    // Ensure paste events work
    field.addEventListener('paste', (e) => {
      // Allow paste to work normally
      return true;
    });
  });

  // API Key specific enhancements
  const apiKeyFields = document.querySelectorAll('[id*="ApiKey"], [id*="apiKey"], [id*="api-key"]');
  apiKeyFields.forEach(field => {
    // Add paste button next to API key fields
    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'paste-btn';
    pasteBtn.innerHTML = '📋';
    pasteBtn.title = 'Paste from clipboard';
    pasteBtn.type = 'button';
    
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        field.value = text.trim();
        field.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Visual feedback
        pasteBtn.innerHTML = '✓';
        setTimeout(() => {
          pasteBtn.innerHTML = '📋';
        }, 1000);
      } catch (err) {
        console.error('Failed to read clipboard:', err);
        // Try alternative method
        field.focus();
        document.execCommand('paste');
      }
    });
    
    // Insert button after the field
    if (field.parentNode.classList.contains('input-group')) {
      field.parentNode.appendChild(pasteBtn);
    } else {
      field.parentNode.insertBefore(pasteBtn, field.nextSibling);
    }
  });

  console.log('✅ Paste support enabled for all forms');
}

// Helper function to safely paste text
export async function pasteFromClipboard() {
  try {
    // Modern clipboard API
    const text = await navigator.clipboard.readText();
    return text;
  } catch (err) {
    // Fallback for older browsers or permission issues
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    
    let result = '';
    if (document.execCommand('paste')) {
      result = textarea.value;
    }
    
    document.body.removeChild(textarea);
    return result;
  }
}

// Enable right-click context menu for inputs
export function enableContextMenu() {
  const { remote } = require('electron');
  const { Menu, MenuItem } = remote;

  document.addEventListener('contextmenu', (e) => {
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    if (isInput) {
      e.preventDefault();
      
      const menu = new Menu();
      
      menu.append(new MenuItem({
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut',
        enabled: e.target.selectionStart !== e.target.selectionEnd
      }));
      
      menu.append(new MenuItem({
        label: 'Copy', 
        accelerator: 'CmdOrCtrl+C',
        role: 'copy',
        enabled: e.target.selectionStart !== e.target.selectionEnd
      }));
      
      menu.append(new MenuItem({
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
      }));
      
      menu.append(new MenuItem({ type: 'separator' }));
      
      menu.append(new MenuItem({
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        click: () => e.target.select()
      }));
      
      menu.popup({ window: remote.getCurrentWindow() });
    }
  });
}