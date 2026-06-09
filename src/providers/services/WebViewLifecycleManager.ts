import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { WebViewHtmlGenerationService } from '../../services/webview/WebViewHtmlGenerationService';
import { TerminalErrorHandler } from '../../utils/feedback';

/**
 * Performance metrics for WebView lifecycle operations
 */
interface WebViewPerformanceMetrics {
  resolveWebviewViewCallCount: number;
  htmlSetOperations: number;
  listenerRegistrations: number;
  lastPanelMovementTime: number;
  totalInitializationTime: number;
}

/**
 * WebViewLifecycleManager
 *
 * Manages the complete lifecycle of the WebView including initialization,
 * configuration, HTML generation, visibility handling, and performance tracking.
 *
 * Responsibilities:
 * - Configure WebView options and permissions
 * - Generate and set WebView HTML content
 * - Track WebView visibility state
 * - Monitor performance metrics
 * - Handle errors gracefully with fallback HTML
 * - Manage view reference and state flags
 *
 * Part of Issue #214 refactoring to apply Facade pattern
 */
export class WebViewLifecycleManager implements vscode.Disposable {
  private _view?: vscode.WebviewView;
  private _htmlSet = false;
  private _bodyRendered = false;
  private _messageListenerRegistered = false;

  /**
   * Performance metrics tracking
   */
  private _performanceMetrics: WebViewPerformanceMetrics = {
    resolveWebviewViewCallCount: 0,
    htmlSetOperations: 0,
    listenerRegistrations: 0,
    lastPanelMovementTime: 0,
    totalInitializationTime: 0,
  };

  /**
   * Callbacks for visibility changes
   */
  private _onVisibleCallback?: () => void;
  private _onHiddenCallback?: () => void;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _htmlGenerationService: WebViewHtmlGenerationService
  ) {}

  /**
   * Get the current WebView instance
   */
  public getView(): vscode.WebviewView | undefined {
    return this._view;
  }

  /**
   * Set the WebView instance
   */
  public setView(view: vscode.WebviewView): void {
    this._view = view;
  }

  /**
   * Check if body has been rendered (VS Code ViewPane pattern)
   */
  public isBodyRendered(): boolean {
    return this._bodyRendered;
  }

  /**
   * Set body rendered flag
   */
  public setBodyRendered(rendered: boolean): void {
    this._bodyRendered = rendered;
  }

  /**
   * Check if WebView is available
   */
  public isWebviewAvailable(): boolean {
    return !!(this._view && this._view.webview);
  }

  /**
   * Check if message listener is registered
   */
  public isMessageListenerRegistered(): boolean {
    return this._messageListenerRegistered;
  }

  /**
   * Mark message listener as registered
   */
  public setMessageListenerRegistered(registered: boolean): void {
    this._messageListenerRegistered = registered;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): WebViewPerformanceMetrics {
    return { ...this._performanceMetrics };
  }

  /**
   * Increment resolve call count and return start time for performance tracking
   */
  public trackResolveStart(): number {
    this._performanceMetrics.resolveWebviewViewCallCount++;
    return Date.now();
  }

  /**
   * Track panel movement time
   */
  public trackPanelMovement(startTime: number): void {
    this._performanceMetrics.lastPanelMovementTime = Date.now() - startTime;
    log(
      `📊 [METRICS] Panel movement time: ${this._performanceMetrics.lastPanelMovementTime}ms (target: <200ms)`
    );
  }

  /**
   * Track total initialization time
   */
  public trackInitializationComplete(startTime: number): void {
    this._performanceMetrics.totalInitializationTime = Date.now() - startTime;
    log(
      `📊 [METRICS] Total initialization time: ${this._performanceMetrics.totalInitializationTime}ms (target: <100ms)`
    );
  }

  /**
   * Increment listener registration count
   */
  public trackListenerRegistration(): void {
    this._performanceMetrics.listenerRegistrations++;
    log(
      `📊 [METRICS] Listener registration #${this._performanceMetrics.listenerRegistrations} (target: 1)`
    );
  }

  /**
   * Configure WebView options (enable scripts, set resource roots)
   */
  public configureWebview(webviewView: vscode.WebviewView): void {
    try {
      log('🔧 [LIFECYCLE] Configuring WebView options...');

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionContext.extensionUri],
      };

      log('✅ [LIFECYCLE] WebView options configured successfully');
    } catch (error) {
      log('❌ [LIFECYCLE] Failed to configure WebView options:', error);
      throw error;
    }
  }

  /**
   * Set WebView HTML content
   *
   * @param webviewView The WebView to set HTML for
   * @param htmlContent The HTML content to set
   * @param isPanelMove Whether this is a panel movement operation
   */
  public setWebviewHtml(
    webviewView: vscode.WebviewView,
    htmlContent: string,
    isPanelMove: boolean = false
  ): void {
    try {
      log('🎆 [LIFECYCLE] Setting WebView HTML...');
      log('🎆 [LIFECYCLE] isPanelMove:', isPanelMove);
      log('🎆 [LIFECYCLE] HTML length:', htmlContent.length);

      if (!htmlContent || htmlContent.length === 0) {
        throw new Error('Generated HTML is empty');
      }

      // Use actual HTML content
      webviewView.webview.html = htmlContent;
      this._htmlSet = true;
      this._performanceMetrics.htmlSetOperations++;

      log('✅ [LIFECYCLE] HTML set successfully');
      log('🎆 [LIFECYCLE] WebView HTML length after setting:', webviewView.webview.html.length);
    } catch (error) {
      log('❌ [LIFECYCLE] Failed to set WebView HTML:', error);

      // Set fallback HTML to prevent complete failure
      const fallbackHtml = this.generateFallbackHtml();
      webviewView.webview.html = fallbackHtml;

      log('🔄 [LIFECYCLE] Fallback HTML set');
      throw error;
    }
  }

  /**
   * Register visibility listener for WebView
   *
   * @param webviewView The WebView to monitor
   * @param onVisible Callback when WebView becomes visible
   * @param onHidden Callback when WebView becomes hidden
   */
  public registerVisibilityListener(
    webviewView: vscode.WebviewView,
    onVisible?: () => void,
    onHidden?: () => void
  ): vscode.Disposable {
    log('🔧 [LIFECYCLE] Setting up visibility listener...');

    this._onVisibleCallback = onVisible;
    this._onHiddenCallback = onHidden;

    const disposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        log('👁️ [LIFECYCLE] WebView became visible');
        this._onVisibleCallback?.();
      } else {
        log('🙈 [LIFECYCLE] WebView became hidden');
        this._onHiddenCallback?.();
      }
    });

    log('✅ [LIFECYCLE] Visibility listener registered');
    return disposable;
  }

  /**
   * Handle WebView setup error gracefully
   */
  public handleSetupError(webviewView: vscode.WebviewView, error: unknown): void {
    try {
      log('🚨 [LIFECYCLE] Handling WebView setup error...');

      // Ensure we have some HTML set, even if it's just an error message
      const errorHtml = this.generateErrorHtml(error);
      webviewView.webview.html = errorHtml;

      // Report error through standard channels
      TerminalErrorHandler.handleWebviewError(error);

      log('🔄 [LIFECYCLE] Error HTML set as fallback');
    } catch (fallbackError) {
      log('💥 [LIFECYCLE] Failed to handle WebView setup error:', fallbackError);

      // Last resort: set minimal HTML
      webviewView.webview.html =
        '<html><body><h3>Terminal initialization failed</h3></body></html>';
    }
  }

  /**
   * Generate fallback HTML when main HTML generation fails
   */
  public generateFallbackHtml(): string {
    return this._htmlGenerationService.generateFallbackHtml({
      title: 'Terminal Loading...',
      message: 'Please wait while the terminal initializes.',
      isLoading: true,
    });
  }

  /**
   * Generate error HTML when setup fails
   */
  public generateErrorHtml(error: unknown): string {
    return this._htmlGenerationService.generateErrorHtml({
      error,
      allowRetry: true,
      customMessage:
        'Terminal initialization failed. Please try reloading the terminal view or restarting VS Code.',
    });
  }

  /**
   * Reset state for new view (panel movement or recreation)
   */
  public resetForNewView(): void {
    this._htmlSet = false;
    // Note: _bodyRendered and _messageListenerRegistered are intentionally NOT reset
    // to prevent duplicate initialization during panel movements
  }

  /**
   * Log performance metrics
   */
  public logPerformanceMetrics(): void {
    log('📊 [METRICS] === WebView Lifecycle Performance Metrics ===');
    log(
      `📊 [METRICS] resolveWebviewView calls: ${this._performanceMetrics.resolveWebviewViewCallCount}`
    );
    log(
      `📊 [METRICS] HTML set operations: ${this._performanceMetrics.htmlSetOperations} (target: 1)`
    );
    log(
      `📊 [METRICS] Listener registrations: ${this._performanceMetrics.listenerRegistrations} (target: 1)`
    );
    log(
      `📊 [METRICS] Last panel movement time: ${this._performanceMetrics.lastPanelMovementTime}ms (target: <200ms)`
    );
    log(
      `📊 [METRICS] Total initialization time: ${this._performanceMetrics.totalInitializationTime}ms (target: <100ms)`
    );

    // Check if targets are met
    const meetsHtmlSetTarget = this._performanceMetrics.htmlSetOperations === 1;
    const meetsListenerTarget = this._performanceMetrics.listenerRegistrations === 1;
    const meetsPanelMovementTarget = this._performanceMetrics.lastPanelMovementTime < 200;
    const meetsInitializationTarget = this._performanceMetrics.totalInitializationTime < 100;

    log(`📊 [METRICS] HTML set target met: ${meetsHtmlSetTarget ? '✅' : '❌'}`);
    log(`📊 [METRICS] Listener target met: ${meetsListenerTarget ? '✅' : '❌'}`);
    log(`📊 [METRICS] Panel movement target met: ${meetsPanelMovementTarget ? '✅' : '❌'}`);
    log(`📊 [METRICS] Initialization target met: ${meetsInitializationTarget ? '✅' : '❌'}`);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    log('🔧 [LIFECYCLE] WebViewLifecycleManager disposing...');

    // Clear callbacks
    this._onVisibleCallback = undefined;
    this._onHiddenCallback = undefined;

    // Clear view reference
    this._view = undefined;

    // Reset flags
    this._htmlSet = false;
    this._bodyRendered = false;
    this._messageListenerRegistered = false;

    log('✅ [LIFECYCLE] WebViewLifecycleManager disposed');
  }
}
