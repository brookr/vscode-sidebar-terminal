/**
 * Panel Location Service
 *
 * Manages panel location detection and split direction determination
 * Extracted from SecondaryTerminalProvider for better separation of concerns
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';

/**
 * Panel location type for WebView placement
 * - 'sidebar': WebView is displayed in the sidebar (narrow and tall)
 * - 'panel': WebView is displayed in the bottom panel (wide and short)
 */
export type PanelLocation = 'sidebar' | 'panel';

/**
 * Split direction type for terminal layout
 * - 'horizontal': Terminals are arranged side by side (left/right)
 * - 'vertical': Terminals are stacked vertically (top/bottom)
 */
export type SplitDirection = 'horizontal' | 'vertical';

/**
 * Type guard to check if a value is a valid PanelLocation
 */
export function isPanelLocation(value: unknown): value is PanelLocation {
  return value === 'sidebar' || value === 'panel';
}

/**
 * Panel Location Service
 *
 * Responsibilities:
 * - Panel location detection and caching
 * - Split direction determination based on layout
 * - Context key management for VS Code when clauses
 * - Panel location change notifications
 */
export class PanelLocationService implements vscode.Disposable {
  /**
   * Configuration keys for panel location settings
   */
  private static readonly CONFIG_KEYS = {
    DYNAMIC_SPLIT_DIRECTION: 'dynamicSplitDirection',
    PANEL_LOCATION: 'panelLocation',
  } as const;

  /**
   * VS Code context key for panel location
   */
  private static readonly CONTEXT_KEY = 'secondaryTerminal.panelLocation';

  /**
   * Debounce delay for panel location detection requests (ms)
   */
  private static readonly DEBOUNCE_DELAY = 300;

  private readonly _disposables: vscode.Disposable[] = [];

  /**
   * Cached panel location reported by WebView
   */
  private _cachedPanelLocation: PanelLocation = 'sidebar';

  /**
   * Callback for sending messages to WebView
   */
  private readonly _sendMessage: (message: unknown) => Promise<void>;

  /**
   * Debounce timer for panel location detection requests
   */
  private _detectionDebounceTimer: NodeJS.Timeout | null = null;

  constructor(sendMessage: (message: unknown) => Promise<void>) {
    this._sendMessage = sendMessage;
  }

  /**
   * Initialize panel location detection
   *
   * 🎯 OPTIMIZATION: Defers initial detection to WebView DOM ready
   * This prevents premature detection that causes layout issues
   *
   * 🎯 VS Code Pattern: Visibility listener consolidated in SecondaryTerminalProvider
   * No longer registers duplicate visibility listener here
   */
  public async initialize(_webviewView?: vscode.WebviewView): Promise<void> {
    // Set up configuration change listener
    this._setupConfigurationListener();

    // 🎯 REMOVED: Visibility listener consolidated in SecondaryTerminalProvider
    // Following VS Code ViewPane pattern for single visibility handler
    // if (webviewView) {
    //   this._setupVisibilityListener(webviewView);
    // }

    // 🎯 REMOVED: Don't request detection immediately
    // Let WebView detect autonomously when DOM is ready
    // await this.requestPanelLocationDetection();
    log('📍 [PANEL-DETECTION] Panel location service initialized (detection deferred to WebView)');
  }

  /**
   * Handle panel location report from WebView
   *
   * 🎯 OPTIMIZATION: Removed redundant panelLocationUpdate message
   * WebView now applies changes autonomously without Extension confirmation
   */
  public async handlePanelLocationReport(
    location: unknown,
    onLocationChange?: (oldLocation: PanelLocation, newLocation: PanelLocation) => Promise<void>
  ): Promise<void> {
    log('📍 [DEBUG] ==================== PANEL LOCATION REPORT ====================');
    log('📍 [DEBUG] Panel location reported from WebView:', location);
    log('📍 [DEBUG] Previous cached location:', this._cachedPanelLocation);

    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>(
      PanelLocationService.CONFIG_KEYS.PANEL_LOCATION,
      'auto'
    );

    // Manual mode: always use configured location, never WebView-reported location.
    // This prevents layout oscillation and maximize cancellation when WebView dimensions
    // are interpreted differently from the user's explicit setting.
    const effectiveLocation: PanelLocation =
      manualPanelLocation !== 'auto'
        ? manualPanelLocation
        : isPanelLocation(location)
          ? location
          : (() => {
              log('⚠️ [DEBUG] Invalid or missing panel location:', location);
              return this._cachedPanelLocation;
            })();

    if (manualPanelLocation !== 'auto' && location !== effectiveLocation) {
      log(
        `📍 [DEBUG] Manual panelLocation=${manualPanelLocation}; ignoring reported location=${String(location)}`
      );
    }

    if (manualPanelLocation === 'auto' && !isPanelLocation(location)) {
      return;
    }

    // Store previous location for change detection
    const previousLocation = this._cachedPanelLocation;

    // Cache the panel location for split direction determination
    this._cachedPanelLocation = effectiveLocation;
    log('📍 [DEBUG] ✅ Cached panel location UPDATED:', effectiveLocation);

    // Only call setContext when location actually changes and panel location is manually controlled.
    // In auto mode, setContext can trigger VS Code layout recalculation and cancel maximized secondary sidebar.
    if (previousLocation !== effectiveLocation) {
      const shouldUpdateContext = manualPanelLocation !== 'auto';

      if (shouldUpdateContext) {
        await vscode.commands.executeCommand(
          'setContext',
          PanelLocationService.CONTEXT_KEY,
          effectiveLocation
        );
        log('📍 [DEBUG] Context key updated with NEW panel location:', effectiveLocation);
      } else {
        log('📍 [DEBUG] Auto mode detected, skipping setContext update');
      }

      // Notify caller if location changed
      if (onLocationChange) {
        log(`🔄 [RELAYOUT] Location changed: ${previousLocation} → ${effectiveLocation}`);
        await onLocationChange(previousLocation, effectiveLocation);
      }
    } else {
      log('📍 [DEBUG] ⏭️ Panel location unchanged, skipping setContext');
    }

    log('📍 [DEBUG] ===============================================================');
  }

  /**
   * Request panel location detection from WebView (with debouncing)
   *
   * 🎯 OPTIMIZATION: Debounced to prevent multiple rapid requests
   */
  public async requestPanelLocationDetection(): Promise<void> {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>(
      PanelLocationService.CONFIG_KEYS.PANEL_LOCATION,
      'auto'
    );

    // Clear existing timer
    if (this._detectionDebounceTimer) {
      clearTimeout(this._detectionDebounceTimer);
      this._detectionDebounceTimer = null;
    }

    if (manualPanelLocation !== 'auto') {
      log(
        `📍 [PANEL-DETECTION] Manual panelLocation=${manualPanelLocation}; skipping WebView detection request`
      );
      return;
    }

    // Schedule new detection request
    this._detectionDebounceTimer = setTimeout(async () => {
      try {
        log('📍 [PANEL-DETECTION] Requesting panel location detection from WebView (debounced)');

        await this._sendMessage({
          command: 'requestPanelLocationDetection',
        });
      } catch (error) {
        log('⚠️ [PANEL-DETECTION] Error requesting panel location detection:', error);

        // On detection failure, do NOT call setContext as a fallback.
        // - auto mode: setContext triggers layout recalculation → cancels maximize
        // - manual mode: user's explicit setting is used by getCurrentPanelLocation(),
        //   so overriding context key would contradict their preference
        // The cached value remains valid; detection will retry on next visibility cycle.
      }
    }, PanelLocationService.DEBOUNCE_DELAY);
  }

  /**
   * Determine split direction based on current panel location
   *
   * @returns Optimal split direction for current layout
   */
  public determineSplitDirection(): SplitDirection {
    log('🔀 [SPLIT] ==================== DETERMINE SPLIT DIRECTION ====================');
    log(`🔀 [SPLIT] _cachedPanelLocation value: ${this._cachedPanelLocation}`);

    const panelLocation = this.getCurrentPanelLocation();
    log(`🔀 [SPLIT] getCurrentPanelLocation() returned: ${panelLocation}`);

    // Map panel location to split direction
    // Sidebar (tall/narrow) → vertical split → column layout (terminals stacked)
    // Panel (wide/short) → horizontal split → row layout (terminals side by side)
    const splitDirection: SplitDirection = panelLocation === 'panel' ? 'horizontal' : 'vertical';

    log(`🔀 [SPLIT] Mapping logic: ${panelLocation} === 'panel' ? 'horizontal' : 'vertical'`);
    log(`🔀 [SPLIT] ✅ Result: ${splitDirection}`);
    log(
      `🔀 [SPLIT] Expected behavior: ${panelLocation === 'panel' ? '横並び (side by side)' : '縦並び (stacked)'}`
    );
    log('🔀 [SPLIT] ====================================================================');

    return splitDirection;
  }

  /**
   * Get current panel location
   *
   * Determines panel location by checking:
   * 1. If dynamic split direction is disabled → return 'sidebar'
   * 2. If manual location is set → return manual value
   * 3. Otherwise → return cached location from WebView detection
   */
  public getCurrentPanelLocation(): PanelLocation {
    log(
      '📍 [PANEL-DETECTION] ==================== GET CURRENT PANEL LOCATION ===================='
    );

    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const { DYNAMIC_SPLIT_DIRECTION, PANEL_LOCATION } = PanelLocationService.CONFIG_KEYS;

    // Check if dynamic split direction feature is enabled
    const isDynamicSplitEnabled = config.get<boolean>(DYNAMIC_SPLIT_DIRECTION, true);
    log(`📍 [PANEL-DETECTION] Dynamic split direction enabled: ${isDynamicSplitEnabled}`);

    if (!isDynamicSplitEnabled) {
      log('📍 [PANEL-DETECTION] ❌ Dynamic split direction is DISABLED, defaulting to sidebar');
      log(
        '📍 [PANEL-DETECTION] =========================================================================='
      );
      return 'sidebar';
    }

    // Get manual panel location setting
    const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>(PANEL_LOCATION, 'auto');
    log(`📍 [PANEL-DETECTION] Manual panel location setting: ${manualPanelLocation}`);

    if (manualPanelLocation !== 'auto') {
      log(`📍 [PANEL-DETECTION] ✅ Using MANUAL panel location: ${manualPanelLocation}`);
      log(
        '📍 [PANEL-DETECTION] =========================================================================='
      );
      return manualPanelLocation as PanelLocation;
    }

    // For auto-detection, use cached value from WebView
    log(`📍 [PANEL-DETECTION] AUTO mode - using cached value: ${this._cachedPanelLocation}`);
    log(
      '📍 [PANEL-DETECTION] =========================================================================='
    );
    return this._cachedPanelLocation;
  }

  /**
   * Get cached panel location
   */
  public getCachedPanelLocation(): PanelLocation {
    return this._cachedPanelLocation;
  }

  /**
   * Set up configuration change listener
   */
  private _setupConfigurationListener(): void {
    this._disposables.push(
      // eslint-disable-next-line no-restricted-syntax -- pushed to _disposables and released in dispose()
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('secondaryTerminal.panelLocation')) {
          log('📍 [PANEL-DETECTION] Panel location setting changed - requesting detection');
          void this.requestPanelLocationDetection();
        }

        if (event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection')) {
          log(
            '📍 [PANEL-DETECTION] Dynamic split direction setting changed - requesting detection'
          );
          void this.requestPanelLocationDetection();
        }
      })
    );
  }

  /**
   * 🎯 REMOVED: Visibility listener consolidated in SecondaryTerminalProvider
   * Following VS Code ViewPane pattern for single visibility handler
   * This duplicate listener has been replaced by SecondaryTerminalProvider._registerVisibilityListener()
   *
   * private _setupVisibilityListener(webviewView: vscode.WebviewView): void {
   *   if (webviewView.onDidChangeVisibility) {
   *     this._disposables.push(
   *       webviewView.onDidChangeVisibility(() => {
   *         setTimeout(() => {
   *           log('📍 [PANEL-DETECTION] Visibility change detected - requesting detection');
   *           void this.requestPanelLocationDetection();
   *         }, 100);
   *       })
   *     );
   *   }
   * }
   */

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Clear debounce timer
    if (this._detectionDebounceTimer) {
      clearTimeout(this._detectionDebounceTimer);
      this._detectionDebounceTimer = null;
    }

    this._disposables.forEach((d) => d.dispose());
  }
}
