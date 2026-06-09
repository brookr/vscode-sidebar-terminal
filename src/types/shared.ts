// ===== Base Terminal Configuration =====

/**
 * Active border display mode for terminals
 * - 'none': Never show active border
 * - 'always': Always show active border
 * - 'multipleOnly': Only show when 2+ terminals exist
 */
export type ActiveBorderMode = 'none' | 'always' | 'multipleOnly';

/**
 * Base terminal configuration interface
 * Foundation type for all terminal configurations
 */
interface BaseTerminalConfig {}

/**
 * Display-related configuration
 */
interface DisplayConfig extends BaseTerminalConfig {
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly theme?: string;
  readonly cursorBlink: boolean;
}

/**
 * Shell-related configuration
 */
interface ShellConfig {
  readonly shell?: string;
  readonly shellArgs?: string[];
  readonly cwd?: string;
  readonly defaultDirectory?: string;
}

/**
 * Terminal limits configuration
 */
interface TerminalLimitsConfig {
  readonly maxTerminals: number;
  readonly minTerminalCount?: number;
  readonly protectLastTerminal?: boolean;
}

/**
 * Interaction-related configuration
 */
interface InteractionConfig {
  readonly confirmBeforeKill?: boolean;
  readonly altClickMovesCursor?: boolean;
  readonly multiCursorModifier?: string;
  readonly activeBorderMode?: ActiveBorderMode;
}

// ===== Unified Type Definitions =====

/**
 * Terminal configuration used in Extension Host
 * Replacement for the legacy TerminalConfig
 */
export interface ExtensionTerminalConfig
  extends BaseTerminalConfig, DisplayConfig, ShellConfig, TerminalLimitsConfig {
  readonly shell: string; // Extension では必須
  readonly shellArgs: string[]; // Extension では必須
  readonly cursor?: {
    style?: 'block' | 'underline' | 'bar';
    blink?: boolean;
  };
  readonly enableCliAgentIntegration?: boolean;
  readonly enableTerminalHeaderEnhancements?: boolean;
  readonly activeBorderMode?: ActiveBorderMode;
  // Addon configuration for WebView terminal rendering
  readonly enableGpuAcceleration?: boolean;
  readonly enableSearchAddon?: boolean;
  readonly enableUnicode11?: boolean;
  // Font settings sent from Extension to WebView
  readonly fontSettings?: WebViewFontSettings;
}

/**
 * Partial terminal settings
 * Used for settings updates from WebView to Extension
 * Font settings are excluded as they are obtained directly from VS Code settings
 */
export interface PartialTerminalSettings {
  fontSize?: number;
  fontFamily?: string;
  theme?: string;
  cursorBlink?: boolean;
  scrollback?: number;
  bellSound?: boolean;
  altClickMovesCursor?: boolean;
  multiCursorModifier?: string;
  enableCliAgentIntegration?: boolean;
  enableTerminalHeaderEnhancements?: boolean;
  activeBorderMode?: ActiveBorderMode;
  // VS Code keybinding system settings
  sendKeybindingsToShell?: boolean;
  commandsToSkipShell?: string[];
  allowChords?: boolean;
  allowMnemonics?: boolean;
  shell?: string;
  shellArgs?: string[];
  cwd?: string;
  defaultDirectory?: string;
  maxTerminals?: number;
  cursor?: {
    style?: 'block' | 'underline' | 'bar';
    blink?: boolean;
  };
  // 🆕 Issue #148: Dynamic split direction settings
  dynamicSplitDirection?: boolean;
  panelLocation?: 'auto' | 'sidebar' | 'panel';
}

/**
 * Font settings values for WebView
 * Interface for receiving current values, not for settings changes
 */
export interface WebViewFontSettings {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontWeightBold?: string;
  lineHeight?: number;
  letterSpacing?: number;
  // Cursor settings
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorWidth?: number;
  // Display settings
  drawBoldTextInBrightColors?: boolean;
  minimumContrastRatio?: number;
}

/**
 * Unified settings for WebView
 * PartialTerminalSettings + font settings values
 */
export interface WebViewTerminalSettings extends PartialTerminalSettings {
  fontSize: number;
  fontFamily: string;
}

/**
 * WebView settings payload sent via 'settingsResponse' command
 * Used by TerminalEventCoordinator for configuration change notifications
 * 🔧 FIX: Added for type safety - replaces Record<string, unknown>
 */
export interface WebViewSettingsPayload {
  readonly cursorBlink: boolean;
  readonly theme: string;
  readonly altClickMovesCursor: boolean;
  readonly multiCursorModifier: string;
  readonly enableCliAgentIntegration: boolean;
  readonly enableTerminalHeaderEnhancements: boolean;
  readonly activeBorderMode: ActiveBorderMode;
  readonly dynamicSplitDirection: boolean;
  readonly panelLocation: 'auto' | 'sidebar' | 'panel';
}

/**
 * Complete terminal settings
 * Unified type containing all configuration items
 */
export interface CompleteTerminalSettings
  extends BaseTerminalConfig, DisplayConfig, ShellConfig, TerminalLimitsConfig, InteractionConfig {}

// ===== WebView-Specific Configuration =====

/**
 * WebView display settings
 */
interface WebViewDisplayConfig extends DisplayConfig {
  readonly minTerminalHeight: number;
  readonly autoHideStatus: boolean;
  readonly statusDisplayDuration: number;
  readonly showWebViewHeader: boolean;
  readonly webViewTitle: string;
  readonly showSampleIcons: boolean;
  readonly sampleIconOpacity: number;
  readonly headerFontSize: number;
  readonly headerIconSize: number;
  readonly sampleIconSize: number;
}

/**
 * Complete extension configuration
 * Replacement for the legacy ExtensionConfig
 */
export interface CompleteExtensionConfig extends WebViewDisplayConfig, TerminalLimitsConfig {}

// ===== Type Aliases =====
/**
 * Canonical CLI agent type shared across extension and webview.
 */
export type AgentType = 'claude' | 'gemini' | 'codex' | 'copilot' | 'opencode' | 'antigravity';

// ===== Backward Compatibility Aliases =====

/**
 * Type alias for backward compatibility
 * Used during gradual migration
 */
export type TerminalConfig = ExtensionTerminalConfig;

// ===== Configuration Key Constants =====

/**
 * Key constants for configuration access
 */
export const CONFIG_SECTIONS = {
  SIDEBAR_TERMINAL: 'secondaryTerminal',
  EDITOR: 'editor',
  TERMINAL_INTEGRATED: 'terminal.integrated',
} as const;

export const CONFIG_KEYS = {
  // secondaryTerminal section
  THEME: 'theme',
  CURSOR_BLINK: 'cursorBlink',
  MAX_TERMINALS: 'maxTerminals',
  MIN_TERMINAL_COUNT: 'minTerminalCount',
  SHELL: 'shell',
  SHELL_ARGS: 'shellArgs',
  DEFAULT_DIRECTORY: 'defaultDirectory',
  CONFIRM_BEFORE_KILL: 'confirmBeforeKill',
  PROTECT_LAST_TERMINAL: 'protectLastTerminal',

  // editor section
  MULTI_CURSOR_MODIFIER: 'multiCursorModifier',

  // terminal.integrated section
  ALT_CLICK_MOVES_CURSOR: 'altClickMovesCursor',
  SHELL_WINDOWS: 'shell.windows',
  SHELL_OSX: 'shell.osx',
  SHELL_LINUX: 'shell.linux',

  ACTIVE_BORDER_MODE: 'activeBorderMode',
} as const;

// ===== Terminal Management Types =====

/**
 * Terminal information
 */
export interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
  indicatorColor?: string;
}

/**
 * Terminal state management
 */
/**
 * Terminal process states based on VS Code's implementation
 * Improves process lifecycle tracking and error handling
 */
export enum ProcessState {
  /** Process has not yet been initialized */
  Uninitialized = 0,
  /** Process is currently starting up */
  Launching = 1,
  /** Process is executing normally */
  Running = 2,
  /** Process terminated prematurely during launch */
  KilledDuringLaunch = 3,
  /** Process was explicitly terminated by the user */
  KilledByUser = 4,
  /** Process terminated on its own */
  KilledByProcess = 5,
}

/**
 * Terminal interaction state for persistent processes
 */
export enum InteractionState {
  /** No interaction */
  None = 0,
  /** Replay only mode */
  ReplayOnly = 1,
  /** Session interaction mode */
  Session = 2,
}

export interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  maxTerminals: number;
  availableSlots: number[];
}

/**
 * Terminal deletion result
 */
export interface DeleteResult {
  success: boolean;
  reason?: string;
  newState?: TerminalState;
}

/**
 * Terminal instance
 */
export interface TerminalInstance {
  id: string;
  pty?: import('node-pty').IPty; // Properly typed node-pty interface
  ptyProcess?: import('node-pty').IPty; // New pty reference name (for session restoration)
  process?: NodeJS.Process; // For lifecycle service compatibility
  name: string;
  indicatorColor?: string;
  number?: number; // Terminal number (1-5)
  cwd?: string; // Current working directory
  shell?: string; // Shell path
  shellArgs?: string[]; // Shell arguments
  pid?: number; // Process ID
  isActive: boolean;
  createdAt?: Date; // Creation timestamp
  creationDisplayModeOverride?: 'normal' | 'fullscreen' | 'split';

  // Process state management (VS Code compliant)
  processState?: ProcessState; // Current process state
  interactionState?: InteractionState; // Interaction state
  persistentProcessId?: string; // Persistent process ID
  shouldPersist?: boolean; // Whether to persist the process

  // Session restoration related properties
  isSessionRestored?: boolean; // Whether the terminal was created through session restoration
  sessionRestoreMessage?: string; // Restoration message
  sessionScrollback?: string[]; // History data for restoration
}

/**
 * Terminal event
 */
export interface TerminalEvent {
  terminalId: string;
  data?: string;
  exitCode?: number;
  timestamp?: number;
  terminalName?: string;
  wasManuallyKilled?: boolean; // Indicates if the terminal was killed manually vs naturally exited
}

/**
 * Alt+Click state
 */
export interface AltClickState {
  isVSCodeAltClickEnabled: boolean;
  isAltKeyPressed: boolean;
}

/**
 * Terminal interaction event
 */
export interface TerminalInteractionEvent {
  type:
    | 'alt-click'
    | 'alt-click-blocked'
    | 'output-detected'
    | 'focus'
    | 'switch-next'
    | 'switch-previous'
    | 'webview-ready'
    | 'terminal-removed'
    | 'font-settings-update'
    | 'settings-update'
    | 'new-terminal'
    | 'create-terminal'
    | 'split-terminal'
    | 'kill-terminal'
    | 'clear-terminal'
    | 'toggle-terminal'
    | 'resize'
    | 'kill'
    | 'interrupt'
    | 'paste'
    | 'send-key';
  terminalId: string;
  timestamp: number;
  data?: unknown;
}

// ===== Message Communication Types =====

/**
 * Message from WebView to Extension Host
 */
export interface WebviewMessage {
  command:
    | 'init'
    | 'input'
    | 'resize'
    | 'output'
    | 'startOutput'
    | 'clear'
    | 'exit'
    | 'split'
    | 'terminalCreated'
    | 'newTerminal'
    | 'terminalRemoved'
    | 'settingsResponse'
    | 'fontSettingsUpdate'
    | 'openSettings'
    | 'openTerminalLink'
    | 'reorderTerminals'
    | 'renameTerminal'
    | 'updateTerminalHeader'
    | 'stateUpdate'
    | 'claudeStatusUpdate'
    | 'cliAgentStatusUpdate'
    | 'cliAgentFullStateSync'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'getSettings'
    | 'altClickSettings'
    | 'focusTerminal'
    | 'panelNavigationMode'
    | 'switchAiAgent'
    | 'test'
    | 'timeoutTest'
    | 'sessionRestore'
    | 'sessionRestoreStarted'
    | 'sessionRestoreProgress'
    | 'sessionRestoreCompleted'
    | 'sessionRestoreError'
    | 'sessionRestoreSkipped'
    | 'sessionSaved'
    | 'sessionSaveError'
    | 'sessionCleared'
    | 'terminalRestoreError'
    | 'getScrollback'
    | 'restoreScrollback'
    | 'scrollbackExtracted'
    | 'scrollbackRestored'
    | 'scrollbackProgress'
    | 'saveAllTerminalSessions'
    | 'extractScrollbackData'
    | 'pushScrollbackData'
    | 'performScrollbackRestore'
    | 'scrollbackDataCollected'
    | 'panelLocationUpdate'
    | 'requestPanelLocationDetection'
    | 'reportPanelLocation'
    | 'sessionRestorationData'
    | 'requestInitialTerminal'
    | 'requestState'
    | 'updateShellStatus'
    | 'updateCwd'
    | 'commandHistory'
    | 'relayoutTerminals' // Terminal relayout command
    | 'deleteTerminalResponse' // 🎯 FIX: 削除処理統一化で追加
    | 'copyToClipboard' // 📋 Clipboard: Copy text to system clipboard
    | 'requestClipboardContent' // 📋 Clipboard: Request clipboard content for paste
    | 'pasteText' // 📋 Clipboard: Paste text from WebView clipboard read
    | 'pasteImage' // 📋 Clipboard: Paste image for Claude Code
    | 'switchAiAgentResponse' // AIエージェント切り替えレスポンス
    | 'htmlScriptTest' // HTML script test message
    | 'webviewReady' // WebView ready notification
    | 'ready' // General ready notification
    | 'createTerminal' // Create terminal request
    | 'splitTerminal' // Split terminal request
    | 'updateSettings' // Update settings request
    | 'terminalClosed' // Terminal closed notification
    | 'customEvent' // Custom event for extensibility
    | 'error'
    | 'find' // Terminal search functionality
    | 'requestTerminalSerialization' // Request terminal serialization
    | 'terminalSerializationResponse' // Terminal serialization response
    | 'restoreTerminalSerialization' // Restore terminal serialization
    | 'terminalSerializationRestoreResponse' // Terminal serialization restore response
    // New optimized persistence commands
    | 'persistenceSaveSession' // Save current session
    | 'persistenceSaveSessionResponse' // Save session response
    | 'persistenceRestoreSession' // Restore last session
    | 'persistenceRestoreSessionResponse' // Restore session response
    | 'persistenceClearSession' // Clear stored session
    | 'persistenceClearSessionResponse' // Clear session response
    | 'sessionRestored' // Session restored notification
    | 'sessionAutoSave' // Auto-save trigger
    | 'sessionAutoSaveResponse' // Auto-save response
    | 'errorResponse' // Error response
    | 'terminalSerializationRequest' // Terminal serialization request
    | 'terminalSerializationRestoreRequest' // Terminal serialization restore request
    | 'terminalRestoreInfo' // Terminal restore info
    | 'resizeResponse' // Resize operation response
    | 'terminalRestoreInfoResponse' // Terminal restore info response
    | 'initResponse' // Init operation response
    | 'initializationComplete' // Initialization complete notification
    | 'setActiveTerminal' // Set active terminal command
    | 'versionInfo' // Version information from Extension to WebView
    | 'inputResponse' // Input operation response
    | 'outputResponse' // Output operation response
    | 'clearResponse' // Clear operation response
    | 'splitResponse' // Split operation response
    | 'killTerminalResponse' // Kill terminal response
    | 'focusTerminalResponse' // Focus terminal response
    | 'switchAiAgentResponseResponse' // Switch AI agent response (double response for backwards compatibility)
    | 'deleteTerminalResponseResponse' // Delete terminal response (double response for backwards compatibility)
    | 'sessionAutoSaveResponseResponse' // Session auto save response (double response for backwards compatibility)
    | 'terminalRestoreInfoResponseResponse' // Terminal restore info response (double response for backwards compatibility)
    | 'exitResponse' // Exit operation response
    | 'terminalCreatedResponse' // Terminal created response
    | 'terminalRemovedResponse' // Terminal removed response
    | 'stateUpdateResponse' // State update response
    | 'getScrollbackResponse' // Get scrollback response
    | 'restoreScrollbackResponse' // Restore scrollback response
    | 'scrollbackExtractedResponse' // Scrollback extracted response
    | 'scrollbackRestoredResponse' // Scrollback restored response
    | 'scrollbackProgressResponse' // Scrollback progress response
    | 'saveAllTerminalSessionsResponse' // Save all terminal sessions response
    | 'extractScrollbackDataResponse' // Extract scrollback data response
    | 'performScrollbackRestoreResponse' // Perform scrollback restore response
    | 'scrollbackDataCollectedResponse' // Scrollback data collected response
    | 'panelLocationUpdateResponse' // Panel location update response
    | 'requestPanelLocationDetectionResponse' // Request panel location detection response
    | 'reportPanelLocationResponse' // Report panel location response
    | 'sessionRestorationDataResponse' // Session restoration data response
    | 'requestInitialTerminalResponse' // Request initial terminal response
    | 'requestStateResponse' // Request state response
    | 'updateShellStatusResponse' // Update shell status response
    | 'updateCwdResponse' // Update CWD response
    | 'commandHistoryResponse' // Command history response
    // Additional commands for WebView initialization
    | 'webviewInitialized' // WebView initialization complete
    | 'terminalInitializationComplete' // Terminal initialization complete
    | 'terminalReady' // Terminal ready for use
    // Focus tracking messages (WebView → Extension)
    | 'terminalFocused' // Terminal gained DOM focus
    | 'terminalBlurred' // Terminal lost DOM focus
    // Panel navigation configuration (Extension → WebView)
    | 'panelNavigationEnabledChanged'; // Panel navigation enabled setting changed
  config?: Partial<TerminalConfig>; // Allow partial config with fontSettings only
  data?: string | any[]; // Support both string and array data
  exitCode?: number;
  terminalId?: string;
  terminalName?: string;
  newName?: string;
  indicatorColor?: string;
  terminalNumber?: number; // Terminal number (1-5) - For Extension to WebView communication

  // Shell Integration properties
  status?: string;
  cwd?: string;
  history?: Array<{ command: string; exitCode?: number; duration?: number }>;

  // Phase 8: Advanced Terminal Features
  capabilities?: {
    decorations?: boolean;
    links?: boolean;
    navigation?: boolean;
    accessibility?: boolean;
  };

  // Terminal information (for restoration)
  terminalInfo?: {
    originalId: string;
    name: string;
    number: number;
    cwd: string;
    isActive: boolean;
  };
  // Session management properties
  terminalCount?: number;
  restored?: number;
  total?: number;
  restoredCount?: number;
  skippedCount?: number;
  error?: string;
  partialSuccess?: boolean;
  reason?: string;
  terminals?: TerminalInfo[];
  activeTerminalId?: string;
  settings?: PartialTerminalSettings; // Modified to receive partial settings
  fontSettings?: WebViewFontSettings; // Receive font settings
  state?: TerminalState; // State update for new architecture
  claudeStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  }; // CLI Agent connection status information
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
    terminalId?: string; // 🛠️ FIX: Add terminalId for reliable status updates
  }; // CLI Agent connection status information (new name)

  forceReconnect?: boolean; // Force reconnect flag for CLI Agent switching

  // 🔧 NEW: Full CLI Agent State Sync
  terminalStates?: Record<
    string,
    {
      status: 'connected' | 'disconnected' | 'none';
      agentType: string | null;
      terminalName: string;
    }
  >;
  connectedAgentId?: string | null;
  connectedAgentType?: string | null;
  disconnectedCount?: number;

  cols?: number; // For resize
  rows?: number; // For resize
  linkType?: 'file' | 'url';
  url?: string;
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  order?: string[];
  requestSource?: 'header' | 'panel'; // Source of deletion request
  timestamp?: number; // For error reporting
  type?: string; // For test messages and error reporting
  message?: string; // For error reporting
  context?: string; // For error reporting
  stack?: string; // For error reporting

  // Panel location for dynamic split direction (Issue #148)
  location?: 'sidebar' | 'panel'; // Panel location information
  direction?: 'horizontal' | 'vertical'; // Split direction for terminal splitting

  // Session restoration related
  sessionRestoreMessage?: string; // Restoration message
  sessionScrollback?: string[]; // History data to restore
  scrollbackLines?: number; // Number of history lines to retrieve
  scrollbackData?: string[]; // Retrieved history data
  errorType?: string; // Error type (file, corruption, permission, network, unknown)
  recoveryAction?: string; // Description of recovery action
  requestId?: string; // Request ID (for response waiting)

  // Scrollback restoration related
  scrollbackContent?:
    | Array<{
        content: string;
        type?: 'output' | 'input' | 'error';
        timestamp?: number;
      }>
    | string[]; // Scrollback content to restore

  // WebView command name extension (duplicate removed)
  scrollbackProgress?: {
    terminalId: string;
    progress: number;
    currentLines: number;
    totalLines: number;
    stage: 'loading' | 'decompressing' | 'restoring';
  }; // Scrollback restoration progress
  maxLines?: number; // Maximum number of lines to retrieve
  useCompression?: boolean; // Whether to use compression
  cursorPosition?: {
    x: number;
    y: number;
  }; // Cursor position

  // Session-related additional properties
  sessionData?: unknown; // Session data

  // Persistence-related properties
  terminalIds?: string[]; // Array of terminal IDs
  terminalData?: any; // Terminal data for persistence

  // 🎯 FIX: Added for unified deletion processing
  success?: boolean; // Deletion operation success/failure

  // Additional WebView message properties
  terminal?: any; // Terminal object for responses
  scrollback?: any; // Scrollback data for terminal restore
  totalCount?: number; // Total count for terminal operations

  // Custom event properties
  eventType?: string; // Custom event type for extensibility
  eventData?: unknown; // Custom event data
  // reason?: string; // Failure reason - commented out due to duplication (use reason above)

  // Message ID for response tracking
  messageId?: string; // Unique message identifier for request-response correlation

  // AI agent switching related properties
  action?: string; // Action for switchAiAgent command
  newStatus?: 'connected' | 'disconnected' | 'none'; // New AI agent status
  agentType?: string | null; // Agent type

  // 📋 Clipboard operation properties
  text?: string; // Text content for clipboard operations

  version?: string; // Extension version information
}

/**
 * Message from Extension Host to WebView
 */
export interface VsCodeMessage {
  command:
    | 'ready'
    | 'webviewReady'
    | 'htmlScriptTest'
    | 'timeoutTest'
    | 'test'
    | 'input'
    | 'resize'
    | 'focusTerminal'
    | 'createTerminal'
    | 'splitTerminal'
    | 'clear'
    | 'getSettings'
    | 'updateSettings'
    | 'terminalClosed'
    | 'switchAiAgent'
    | 'terminalInteraction'
    | 'killTerminal'
    | 'deleteTerminal'
    | 'requestStateRestoration'
    | 'getScrollbackData'
    | 'extractScrollback'
    | 'restoreScrollbackData'
    | 'scrollbackExtracted'
    | 'getTerminalScrollbackData'
    | 'extractScrollbackData'
    | 'performScrollbackRestore'
    | 'restoreTerminalScrollback'
    | 'scrollbackDataCollected'
    | 'reportPanelLocation'
    | 'terminalSerializationResponse'
    | 'terminalSerializationRestoreResponse'
    | 'requestSessionRestorationData'
    | 'requestInitialTerminal'
    | 'error';
  data?: string;
  cols?: number;
  rows?: number;
  terminalId?: string;
  terminalName?: string; // Terminal name
  type?: TerminalInteractionEvent['type'];
  settings?: PartialTerminalSettings; // Modified to send partial settings
  requestSource?: 'header' | 'panel'; // Deletion request source for new architecture
  timestamp?: number; // For error reporting
  message?: string; // For error reporting
  context?: string; // For error reporting
  stack?: string; // For error reporting

  // Terminal restoration related
  terminalInfo?: {
    originalId: string;
    name: string;
    number: number;
    cwd: string;
    isActive: boolean;
  };

  // Session restoration related
  scrollbackLines?: number; // Number of history lines to retrieve
  scrollbackData?: string[]; // History data
  maxLines?: number; // Maximum number of lines to retrieve
  scrollbackContent?: Array<{
    content: string;
    type?: 'output' | 'input' | 'error';
    timestamp?: number;
  }>; // Scrollback content to restore
  requestId?: string; // Request ID (for response waiting)

  // Session-related additional properties
  serializedData?: Record<string, string>; // Serialized data
  terminalCount?: number; // Number of terminals
  sessionData?: unknown; // Session data

  // 🆕 Panel location (Issue #148)
  location?: 'sidebar' | 'panel'; // Panel location information

  // AI agent switching related properties
  action?: string; // Action for switchAiAgent command
  forceReconnect?: boolean; // Manual reset functionality
  agentType?: AgentType; // Agent type for force reconnect
  isForceReconnect?: boolean; // Alternative property name for compatibility
}

// ===== Parameter Object Pattern Interfaces (Issue #225) =====
// ===== Type Guard Functions =====
