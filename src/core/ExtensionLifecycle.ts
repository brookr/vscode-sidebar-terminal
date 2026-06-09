import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../terminals/TerminalManager';
import { ExtensionPersistenceService } from '../services/persistence/ExtensionPersistenceService';
import { extension as log, logger, LogLevel } from '../utils/logger';
import { FileReferenceCommand, TerminalCommand } from '../commands';
import { CopilotIntegrationCommand } from '../commands/CopilotIntegrationCommand';
import { EnhancedShellIntegrationService } from '../services/EnhancedShellIntegrationService';
import { KeyboardShortcutService } from '../services/KeyboardShortcutService';
import { TelemetryService } from '../services/TelemetryService';
import { CommandRegistrar } from './CommandRegistrar';
import { SessionLifecycleManager } from './SessionLifecycleManager';
import { FocusProtectionService } from '../services/FocusProtectionService';
import type { AgentType } from '../types/shared';

/** Status-change event emitted by the CLI agent detection service. */
interface CliAgentStatusEvent {
  terminalId: string;
  status: 'connected' | 'disconnected' | 'none';
  type: AgentType | null;
  terminalName?: string;
}

/** Minimal shape of the CLI agent detection service used for telemetry wiring. */
interface CliAgentStatusSource {
  onCliAgentStatusChange?: (listener: (event: CliAgentStatusEvent) => void) => vscode.Disposable;
}

/** Optional method exposed by the persistence service for late sidebar wiring. */
interface SidebarProviderSink {
  setSidebarProvider?: (provider: SecondaryTerminalProvider) => void;
}

/** Manages extension activation, service initialization, and cleanup. */
export class ExtensionLifecycle {
  private terminalManager: TerminalManager | undefined;
  private sidebarProvider: SecondaryTerminalProvider | undefined;
  private extensionPersistenceService: ExtensionPersistenceService | undefined;
  private fileReferenceCommand: FileReferenceCommand | undefined;
  private terminalCommand: TerminalCommand | undefined;
  private copilotIntegrationCommand: CopilotIntegrationCommand | undefined;
  private shellIntegrationService: EnhancedShellIntegrationService | undefined;
  private keyboardShortcutService: KeyboardShortcutService | undefined;
  private telemetryService: TelemetryService | undefined;
  private _extensionContext: vscode.ExtensionContext | undefined;

  private commandRegistrar: CommandRegistrar | undefined;
  private sessionLifecycleManager: SessionLifecycleManager | undefined;
  private focusProtectionService: FocusProtectionService | undefined;

  /** Activates the extension and initializes all components. */
  activate(context: vscode.ExtensionContext): Promise<void> {
    const activationStartTime = Date.now();
    this._extensionContext = context;

    const logLevel = this.configureLogger(context);
    const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
    const version = (extension?.packageJSON as { version?: string })?.version || 'unknown';

    logger.lifecycle('Sidebar Terminal activation started', {
      mode: this.getExtensionModeLabel(context.extensionMode),
      version,
      logLevel: LogLevel[logLevel],
    });

    try {
      this.telemetryService = new TelemetryService(
        context,
        's-hiraoku.vscode-sidebar-terminal',
        version
      );
    } catch (error) {
      logger.warn('Telemetry service unavailable; continuing without analytics', error);
    }

    try {
      // Ensure node-pty looks for release binaries
      process.env.NODE_PTY_DEBUG = '0';

      // Initialize terminal manager
      this.terminalManager = new TerminalManager();

      // Initialize extension persistence service
      this.extensionPersistenceService = new ExtensionPersistenceService(
        context,
        this.terminalManager
      );

      // Initialize command handlers
      this.fileReferenceCommand = new FileReferenceCommand(this.terminalManager);
      this.terminalCommand = new TerminalCommand(this.terminalManager);
      this.copilotIntegrationCommand = new CopilotIntegrationCommand();

      // Initialize enhanced shell integration service
      try {
        this.shellIntegrationService = new EnhancedShellIntegrationService(
          this.terminalManager,
          context
        );
        // Set shell integration service on TerminalManager
        this.terminalManager.setShellIntegrationService(this.shellIntegrationService);
      } catch (error) {
        logger.warn('Enhanced shell integration service unavailable', error);
        // Continue without shell integration
      }

      // Register the sidebar terminal provider
      this.sidebarProvider = new SecondaryTerminalProvider(
        context,
        this.terminalManager,
        this.extensionPersistenceService,
        this.telemetryService
      );

      // Set sidebar provider for ExtensionPersistenceService
      if (this.extensionPersistenceService) {
        (this.extensionPersistenceService as unknown as SidebarProviderSink).setSidebarProvider?.(
          this.sidebarProvider
        );
      }

      // Initialize keyboard shortcut service
      this.keyboardShortcutService = new KeyboardShortcutService(this.terminalManager);

      // Connect keyboard service to webview provider
      this.keyboardShortcutService.setWebviewProvider(this.sidebarProvider);

      // Connect enhanced shell integration service to webview provider
      if (this.shellIntegrationService) {
        this.shellIntegrationService.setWebviewProvider(this.sidebarProvider);
      }

      // Initialize and wire the focus protection service
      this.setupFocusProtection();

      // Initialize SessionLifecycleManager and CommandRegistrar, then register commands
      this.initializeCommandsAndSession(context);

      // CRITICAL: Session restore is now handled by SecondaryTerminalProvider asynchronously
      // This prevents VS Code activation spinner from hanging
      // Register webview providers AFTER session restore completes
      const sidebarWebviewProvider = vscode.window.registerWebviewViewProvider(
        SecondaryTerminalProvider.viewType,
        this.sidebarProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      );
      context.subscriptions.push(sidebarWebviewProvider);

      // 自動保存設定 - delegate to SessionLifecycleManager
      this.sessionLifecycleManager?.setupSessionAutoSave(context);
      // Track successful activation
      const activationDuration = Date.now() - activationStartTime;
      this.telemetryService?.trackActivation(activationDuration);
      logger.lifecycle('Sidebar Terminal extension activated', {
        durationMs: activationDuration,
        version,
      });

      // Setup telemetry event listeners
      this.setupTelemetryEventListeners();

      // CRITICAL: Ensure activation Promise resolves immediately
      // This prevents VS Code progress spinner from hanging
      return Promise.resolve();
    } catch (error) {
      logger.error('Failed to activate Sidebar Terminal extension', error);

      // Track activation error
      if (error instanceof Error) {
        this.telemetryService?.trackError(error, 'activation');
      }

      void vscode.window.showErrorMessage(
        `Failed to activate Sidebar Terminal: ${error instanceof Error ? error.message : String(error)}`
      );

      // CRITICAL: Even on error, resolve activation Promise to prevent spinner hanging
      return Promise.resolve();
    }
  }

  /** Initializes the session lifecycle manager and command registrar, then registers commands. */
  private initializeCommandsAndSession(context: vscode.ExtensionContext): void {
    // Initialize SessionLifecycleManager first (needed by CommandRegistrar)
    this.sessionLifecycleManager = new SessionLifecycleManager({
      getTerminalManager: () => this.terminalManager,
      getSidebarProvider: () => this.sidebarProvider,
      getExtensionPersistenceService: () => this.extensionPersistenceService,
      getExtensionContext: () => this._extensionContext,
    });

    // Initialize CommandRegistrar and register all commands
    this.commandRegistrar = new CommandRegistrar(
      {
        terminalManager: this.terminalManager,
        sidebarProvider: this.sidebarProvider,
        extensionPersistenceService: this.extensionPersistenceService,
        fileReferenceCommand: this.fileReferenceCommand,
        terminalCommand: this.terminalCommand,
        copilotIntegrationCommand: this.copilotIntegrationCommand,
        shellIntegrationService: this.shellIntegrationService,
        keyboardShortcutService: this.keyboardShortcutService,
        telemetryService: this.telemetryService,
      },
      {
        handleSaveSession: () => this.sessionLifecycleManager!.handleSaveSession(),
        handleRestoreSession: () => this.sessionLifecycleManager!.handleRestoreSession(),
        handleClearSession: () => this.sessionLifecycleManager!.handleClearSession(),
        handleTestScrollback: () => this.sessionLifecycleManager!.handleTestScrollback(),
        diagnoseSessionData: () => this.sessionLifecycleManager!.diagnoseSessionData(),
      }
    );
    this.commandRegistrar.registerCommands(context);
  }

  /** Creates the focus protection service and wires terminal focus/input events to it. */
  private setupFocusProtection(): void {
    this.focusProtectionService = new FocusProtectionService({
      isTerminalFocused: () => this.terminalManager?.isTerminalFocused() ?? false,
      isWebViewVisible: () => this.sidebarProvider?.isWebViewVisible() ?? false,
      sendWebviewFocus: (terminalId?: string) => {
        const targetId = terminalId ?? this.terminalManager?.getActiveTerminalId();
        if (this.sidebarProvider && targetId) {
          void this.sidebarProvider.sendMessageToWebview({
            command: 'focusTerminal',
            terminalId: targetId,
          });
        }
      },
    });

    // Wire terminal focus changes to focus protection service
    if (this.terminalManager && this.focusProtectionService) {
      const focusProtection = this.focusProtectionService;
      const originalSetFocused = this.terminalManager.setTerminalFocused.bind(this.terminalManager);
      this.terminalManager.setTerminalFocused = (focused: boolean) => {
        originalSetFocused(focused);
        focusProtection.notifyFocusChanged(focused);
      };

      // Wire terminal input (keystrokes) to refresh the focus window so that
      // long typing sessions (e.g. typing into Claude Code) don't let the
      // recent-focus guard expire and defeat focus protection.
      const originalSendInput = this.terminalManager.sendInput.bind(this.terminalManager);
      this.terminalManager.sendInput = (data: string, terminalId?: string) => {
        // Pass the terminal ID so focus protection knows which terminal to
        // restore when focus is stolen — important when multiple sidebar
        // terminals exist.
        const targetId = terminalId ?? this.terminalManager?.getActiveTerminalId();
        focusProtection.notifyInteraction(targetId);
        originalSendInput(data, terminalId);
      };
    }
  }

  private configureLogger(context: vscode.ExtensionContext): LogLevel {
    // Priority: env var override (debugging) > explicit user setting > extension-mode default.
    const envOverride = this.parseLogLevel(process.env.SECONDARY_TERMINAL_LOG_LEVEL);
    if (envOverride !== undefined) {
      logger.setLevel(envOverride);
      return envOverride;
    }

    let configured: LogLevel | undefined;
    try {
      const inspected = vscode.workspace
        ?.getConfiguration('secondaryTerminal')
        ?.inspect<string>('logging.level');
      const explicit =
        inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
      configured = this.parseLogLevel(explicit);
    } catch {
      configured = undefined;
    }
    if (configured !== undefined) {
      logger.setLevel(configured);
      return configured;
    }

    const fallback =
      context.extensionMode === vscode.ExtensionMode.Production ? LogLevel.WARN : LogLevel.INFO;
    logger.setLevel(fallback);
    return fallback;
  }

  private parseLogLevel(raw: string | undefined): LogLevel | undefined {
    switch (raw?.toLowerCase()) {
      case 'trace':
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'none':
      case 'off':
        return LogLevel.NONE;
      default:
        return undefined;
    }
  }

  private getExtensionModeLabel(mode: vscode.ExtensionMode): string {
    switch (mode) {
      case vscode.ExtensionMode.Development:
        return 'Development';
      case vscode.ExtensionMode.Test:
        return 'Test';
      default:
        return 'Production';
    }
  }

  /** Deactivates the extension and performs cleanup. */
  async deactivate(): Promise<void> {
    logger.lifecycle('Sidebar Terminal deactivation started');

    // Track deactivation
    this.telemetryService?.trackDeactivation();
    logger.lifecycle('Sidebar Terminal deactivation tracked');

    // シンプルセッション保存処理 - delegate to SessionLifecycleManager
    if (this.sessionLifecycleManager) {
      await this.sessionLifecycleManager.saveSimpleSessionOnExit();
    }

    // Dispose standard session manager (cleanup auto-save timers)
    if (this.extensionPersistenceService) {
      log('🔧 [EXTENSION] Disposing standard session manager...');
      this.extensionPersistenceService.dispose(); // Cleanup auto-save timers
      this.extensionPersistenceService = undefined;
    }

    // Dispose focus protection service
    if (this.focusProtectionService) {
      this.focusProtectionService.dispose();
      this.focusProtectionService = undefined;
    }

    // Dispose keyboard shortcut service
    if (this.keyboardShortcutService) {
      log('🔧 [EXTENSION] Disposing keyboard shortcut service...');
      this.keyboardShortcutService.dispose();
      this.keyboardShortcutService = undefined;
    }

    // Dispose terminal manager
    if (this.terminalManager) {
      log('🔧 [EXTENSION] Disposing terminal manager...');
      this.terminalManager.dispose();
      this.terminalManager = undefined;
    }

    // Dispose sidebar provider
    if (this.sidebarProvider) {
      log('🔧 [EXTENSION] Disposing sidebar provider...');
      this.sidebarProvider.dispose();
      this.sidebarProvider = undefined;
    }

    // Clear command handlers
    this.fileReferenceCommand = undefined;
    this.terminalCommand = undefined;
    this.copilotIntegrationCommand = undefined;

    // Dispose shell integration service
    if (this.shellIntegrationService) {
      this.shellIntegrationService.dispose();
      this.shellIntegrationService = undefined;
    }

    // Dispose telemetry service (this should be last to track all events)
    if (this.telemetryService) {
      log('📊 [TELEMETRY] Disposing telemetry service...');
      this.telemetryService.dispose();
      this.telemetryService = undefined;
    }

    logger.lifecycle('Sidebar Terminal deactivation complete');
  }

  getTerminalManager(): TerminalManager | undefined {
    return this.terminalManager;
  }
  getSidebarProvider(): SecondaryTerminalProvider | undefined {
    return this.sidebarProvider;
  }
  getExtensionPersistenceService(): ExtensionPersistenceService | undefined {
    return this.extensionPersistenceService;
  }

  private setupTelemetryEventListeners(): void {
    if (!this.telemetryService) {
      logger.warn('Telemetry service not available, skipping telemetry event listener setup');
      return;
    }

    log('📊 [TELEMETRY] Setting up telemetry event listeners...');

    // Track terminal creation
    if (this.terminalManager) {
      const terminalCreatedDisposable = this.terminalManager.onTerminalCreated((terminal) => {
        this.telemetryService?.trackTerminalCreated(terminal.id);
        log(`📊 [TELEMETRY] Terminal created: ${terminal.id}`);
      });

      // Track terminal deletion
      const terminalRemovedDisposable = this.terminalManager.onTerminalRemoved((terminalId) => {
        this.telemetryService?.trackTerminalDeleted(terminalId);
        log(`📊 [TELEMETRY] Terminal deleted: ${terminalId}`);
      });

      // Track terminal focus
      const terminalFocusedDisposable = this.terminalManager.onTerminalFocus((terminalId) => {
        this.telemetryService?.trackTerminalFocused(terminalId);
      });

      if (this._extensionContext) {
        this._extensionContext.subscriptions.push(
          terminalCreatedDisposable,
          terminalRemovedDisposable,
          terminalFocusedDisposable
        );
      }
    }

    // Track CLI Agent detection events
    if (this.shellIntegrationService) {
      const cliAgentService = (
        this.shellIntegrationService as unknown as {
          cliAgentDetectionService?: CliAgentStatusSource;
        }
      ).cliAgentDetectionService;

      if (cliAgentService?.onCliAgentStatusChange) {
        const cliAgentStatusDisposable = cliAgentService.onCliAgentStatusChange((event) => {
          if (event.status === 'connected') {
            this.telemetryService?.trackCliAgentDetected(event.type || 'unknown');
            log(`📊 [TELEMETRY] CLI Agent detected: ${event.type}`);
            // Enable aggressive focus protection while a CLI agent is connected,
            // because the agent's VS Code extension may call terminal.show()
            // repeatedly during MCP tool operations.
            this.focusProtectionService?.notifyCliAgentConnected(true);
          } else if (event.status === 'disconnected') {
            // Track disconnection with session duration (if available)
            this.telemetryService?.trackCliAgentDisconnected(event.type || 'unknown', 0);
            log(`📊 [TELEMETRY] CLI Agent disconnected: ${event.type}`);
            this.focusProtectionService?.notifyCliAgentConnected(false);
          }
        });

        if (this._extensionContext) {
          this._extensionContext.subscriptions.push(cliAgentStatusDisposable);
        }
      }
    }

    // Track session save/restore
    if (this.extensionPersistenceService) {
      // Note: ExtensionPersistenceService may not expose events
      // If it does, we can add tracking here
      log('📊 [TELEMETRY] Session manager event tracking (to be implemented if events available)');
    }

    log('✅ [TELEMETRY] Telemetry event listeners setup complete');
  }
}
