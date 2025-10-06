/**
 * Toast Notification System
 * Provides visual feedback for user actions throughout the application
 *
 * Features:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-dismiss with configurable duration
 * - Manual dismiss with close button
 * - Action buttons for interactive toasts
 * - Smooth slide-in/slide-out animations
 * - Accessible with ARIA attributes
 * - Queue management for multiple toasts
 */

class ToastNotification {
  constructor(containerId = 'toast-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Toast container with id "${containerId}" not found`);
      return;
    }

    this.toasts = new Map(); // Track active toasts by ID
    this.nextId = 1;
  }

  /**
   * Show success toast
   * @param {string} message - Toast message
   * @param {object} options - Configuration options
   * @returns {number} Toast ID
   */
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  /**
   * Show error toast (longer duration by default)
   * @param {string} message - Toast message
   * @param {object} options - Configuration options
   * @returns {number} Toast ID
   */
  error(message, options = {}) {
    return this.show(message, 'error', {
      ...options,
      duration: options.duration !== undefined ? options.duration : 5000
    });
  }

  /**
   * Show warning toast
   * @param {string} message - Toast message
   * @param {object} options - Configuration options
   * @returns {number} Toast ID
   */
  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  /**
   * Show info toast
   * @param {string} message - Toast message
   * @param {object} options - Configuration options
   * @returns {number} Toast ID
   */
  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  /**
   * Show a toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success|error|warning|info)
   * @param {object} options - Configuration options
   * @param {number} options.duration - Auto-dismiss duration in ms (0 = never)
   * @param {boolean} options.dismissible - Show close button
   * @param {object} options.action - Action button config { label, callback }
   * @returns {number} Toast ID for later reference
   */
  show(message, type = 'info', options = {}) {
    const {
      duration = 3000,
      dismissible = true,
      action = null
    } = options;

    const toastId = this.nextId++;
    const toast = this.createToastElement(toastId, message, type, dismissible, action);

    // Add to container
    this.container.appendChild(toast);
    this.toasts.set(toastId, toast);

    // Trigger slide-in animation (small delay for CSS transition)
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-dismiss if duration > 0
    if (duration > 0) {
      setTimeout(() => this.dismiss(toastId), duration);
    }

    return toastId;
  }

  /**
   * Create toast DOM element
   * @private
   */
  createToastElement(id, message, type, dismissible, action) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.dataset.toastId = id;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');

    // Icon map
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    // Build toast HTML
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      ${action ? `<button class="toast-action">${this.escapeHtml(action.label)}</button>` : ''}
      ${dismissible ? '<button class="toast-close" aria-label="Close notification">✕</button>' : ''}
    `;

    // Attach event listeners
    if (action) {
      const actionButton = toast.querySelector('.toast-action');
      actionButton.addEventListener('click', () => {
        action.callback();
        this.dismiss(id);
      });
    }

    if (dismissible) {
      const closeButton = toast.querySelector('.toast-close');
      closeButton.addEventListener('click', () => {
        this.dismiss(id);
      });
    }

    return toast;
  }

  /**
   * Dismiss a toast by ID
   * @param {number} toastId - Toast ID to dismiss
   */
  dismiss(toastId) {
    const toast = this.toasts.get(toastId);
    if (!toast) return;

    // Add dismissing class for exit animation
    toast.classList.add('dismissing');
    toast.classList.remove('show');

    // Remove from DOM after animation completes
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
      this.toasts.delete(toastId);
    }, 300); // Match animation duration in CSS
  }

  /**
   * Dismiss all active toasts
   */
  dismissAll() {
    const toastIds = Array.from(this.toasts.keys());
    toastIds.forEach(id => this.dismiss(id));
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create global instance when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.toastNotification = new ToastNotification();
  });
} else {
  window.toastNotification = new ToastNotification();
}
