/**
 * Base interface for all input handlers
 */
export interface IInputHandler {
  /**
   * Initialize the handler
   */
  initialize(): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * IME composition handler interface
 */
export interface IIMEHandler extends IInputHandler {
  /**
   * Setup IME composition handling
   */
  setupIMEHandling(): void;

  /**
   * Check if IME is currently composing
   */
  isIMEComposing(): boolean;

  /**
   * Clear any pending input events that might conflict with IME
   */
  clearPendingInputEvents(): void;
}
