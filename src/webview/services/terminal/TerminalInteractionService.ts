import { Terminal } from '@xterm/xterm';
import { IConfigManager } from '../../interfaces/ManagerInterfaces';
import { LifecycleController } from '../../controllers/LifecycleController';
import { TerminalEventManager } from '../../managers/TerminalEventManager';
import { EventHandlerRegistry } from '../../utils/EventHandlerRegistry';
import { terminalLogger } from '../../utils/ManagerLogger';
import { isMacPlatform } from '../../utils/PlatformUtils';
import { TerminalFocusService } from './TerminalFocusService';

interface ICoordinatorDependencies {
  postMessageToExtension(message: unknown): void;
  shellIntegrationManager?: {
    decorateTerminalOutput(terminal: Terminal, terminalId: string): void;
  };
}

interface IDependencies {
  coordinator: ICoordinatorDependencies;
  eventRegistry: EventHandlerRegistry;
  lifecycleController: LifecycleController;
  eventManager: TerminalEventManager;
  focusService: TerminalFocusService;
}

type TerminalConfigManager = Pick<IConfigManager, 'getCurrentFontSettings' | 'getCurrentSettings'>;

export class TerminalInteractionService {
  constructor(private readonly dependencies: IDependencies) {}

  public setupTerminalInteraction(params: {
    terminalId: string;
    terminal: Terminal;
    container: HTMLElement;
    terminalContent: HTMLElement;
    currentSettings: unknown;
    currentFontSettings: unknown;
    configManager: TerminalConfigManager | undefined;
    uiManager: unknown;
    applyPostOpenSettings: (params: {
      terminalId: string;
      terminal: Terminal;
      container: HTMLElement;
      terminalContent: HTMLElement;
      currentSettings: unknown;
      currentFontSettings: unknown;
      configManager: TerminalConfigManager | undefined;
      uiManager: unknown;
    }) => void;
  }): void {
    const {
      terminalId,
      terminal,
      container,
      terminalContent,
      currentSettings,
      currentFontSettings,
      configManager,
      uiManager,
      applyPostOpenSettings,
    } = params;

    terminal.open(terminalContent);
    terminalLogger.info(`✅ Terminal opened in container: ${terminalId}`);

    this.setupPasteHandling(terminalId, terminal, terminalContent);
    applyPostOpenSettings({
      terminalId,
      terminal,
      container,
      terminalContent,
      currentSettings,
      currentFontSettings,
      configManager,
      uiManager,
    });

    this.dependencies.lifecycleController.attachTerminal(terminalId, terminal);
    this.dependencies.eventManager.setupTerminalEvents(terminal, terminalId, container);
    this.dependencies.focusService.ensureTerminalFocus(terminal, terminalId, terminalContent);
    this.dependencies.focusService.setupContainerFocusHandler(
      terminal,
      terminalId,
      container,
      terminalContent
    );
    this.setupShellIntegration(terminal, terminalId);
  }

  private setupPasteHandling(
    terminalId: string,
    terminal: Terminal,
    terminalContent: HTMLElement
  ): void {
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) =>
      this.shouldXtermHandleKeyEvent(event)
    );

    const pasteHandler = (event: ClipboardEvent): void => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        terminalLogger.warn('📋 Paste event has no clipboardData');
        return;
      }

      const hasImage = Array.from(clipboardData.items).some((item) =>
        item.type.startsWith('image/')
      );

      if (hasImage) {
        terminalLogger.info('🖼️ Image in paste event - sending Ctrl+V escape for Claude Code');
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dependencies.coordinator.postMessageToExtension({
          command: 'input',
          terminalId,
          data: '\x16',
        });
        return;
      }

      const text = clipboardData.getData('text/plain');
      if (text) {
        terminalLogger.info(`📋 Text paste (${text.length} chars) - sending to extension`);
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dependencies.coordinator.postMessageToExtension({
          command: 'pasteText',
          terminalId,
          text,
        });
        return;
      }

      terminalLogger.warn('📋 Paste event has no text or image content');
    };

    this.dependencies.eventRegistry.register(
      `terminal-${terminalId}-paste`,
      terminalContent,
      'paste',
      pasteHandler as EventListener,
      true
    );
  }

  /**
   * Custom key event handler for xterm.js. Returns false to let our own
   * handlers (paste / panel-navigation) process the key instead of xterm.js,
   * or true to let xterm.js handle it normally.
   */
  private shouldXtermHandleKeyEvent(event: KeyboardEvent): boolean {
    const mac = isMacPlatform();

    if (
      (mac && event.metaKey && event.key === 'v') ||
      (event.ctrlKey && event.key === 'v' && !event.shiftKey)
    ) {
      terminalLogger.info('📋 Paste keydown - bypassing xterm.js key handler');
      return false;
    }

    if (this.isPanelNavigationToggleKey(event) || this.isPanelNavigationModeKey(event)) {
      return false;
    }

    return true;
  }

  /** Ctrl+P toggles panel navigation when the enabling class is present. */
  private isPanelNavigationToggleKey(event: KeyboardEvent): boolean {
    return (
      document.body.classList.contains('panel-navigation-enabled') &&
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      event.key.toLowerCase() === 'p'
    );
  }

  /** Keys reserved for panel-navigation mode while it is active. */
  private isPanelNavigationModeKey(event: KeyboardEvent): boolean {
    if (!document.body.classList.contains('panel-navigation-mode')) {
      return false;
    }
    const panelNavigationKeys = [
      'h',
      'j',
      'k',
      'l',
      'arrowleft',
      'arrowright',
      'arrowup',
      'arrowdown',
      'escape',
      'r',
      'd',
      'x',
    ];
    return panelNavigationKeys.includes(event.key.toLowerCase());
  }

  private setupShellIntegration(terminal: Terminal, terminalId: string): void {
    try {
      this.dependencies.coordinator.shellIntegrationManager?.decorateTerminalOutput(
        terminal,
        terminalId
      );
      terminalLogger.info(`Shell integration decorations added for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.warn(`Failed to setup shell integration for terminal ${terminalId}:`, error);
    }
  }
}
