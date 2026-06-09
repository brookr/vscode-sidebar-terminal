/**
 * VSCodeCommandDispatcher - Dispatches VS Code commands and intercepts keys
 *
 * Extracted from InputManager to reduce method size and improve testability.
 * Contains:
 * - handleVSCodeCommand: Routes VS Code commands resolved from keybindings (~159 LOC)
 * - shouldInterceptKeyForVSCode: Determines if a key should be intercepted for VS Code (~109 LOC)
 */

import { Terminal } from '@xterm/xterm';
import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { TerminalInteractionEvent } from '../../../../types/common';
import { TerminalOperationsService, ScrollDirection } from '../services/TerminalOperationsService';
import { isMacPlatform } from '../../../utils/PlatformUtils';

/**
 * Dependencies required by the dispatcher from InputManager
 */
export interface IVSCodeCommandDispatcherDeps {
  /** Logger function */
  logger: (message: string, ...args: unknown[]) => void;
  /** Emit a terminal interaction event */
  emitTerminalInteractionEvent: (
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    manager: IManagerCoordinator
  ) => void;
  /** Terminal operations service for scroll/clear/word/line operations */
  terminalOperationsService: TerminalOperationsService;
  /** Handle terminal copy */
  handleTerminalCopy: (manager: IManagerCoordinator) => void;
  /** Handle terminal paste */
  handleTerminalPaste: (manager: IManagerCoordinator) => void;
  /** Handle terminal select all */
  handleTerminalSelectAll: (manager: IManagerCoordinator) => void;
  /** Handle terminal find */
  handleTerminalFind: (manager: IManagerCoordinator) => void;
  /** Handle terminal find next */
  handleTerminalFindNext: (manager: IManagerCoordinator) => void;
  /** Handle terminal find previous */
  handleTerminalFindPrevious: (manager: IManagerCoordinator) => void;
  /** Handle terminal hide find */
  handleTerminalHideFind: (manager: IManagerCoordinator) => void;
  /** Handle terminal clear */
  handleTerminalClear: (manager: IManagerCoordinator) => void;
}

/**
 * VSCodeCommandDispatcher - Routes VS Code commands and determines key interception
 */
export class VSCodeCommandDispatcher {
  constructor(private readonly deps: IVSCodeCommandDispatcherDeps) {}

  /**
   * Handle VS Code commands resolved from keybindings.
   * Routes the command string to the appropriate handler.
   */
  public handleVSCodeCommand(command: string, manager: IManagerCoordinator): void {
    this.deps.logger(`Handling VS Code command: ${command}`);

    // Each dispatcher handles a disjoint group of commands and returns true once
    // it has handled the command. Order is irrelevant because the groups do not
    // overlap, but they are checked sequentially with early exit.
    const handled =
      this.dispatchTerminalManagementCommand(command, manager) ||
      this.dispatchNavigationCommand(command, manager) ||
      this.dispatchScrollingCommand(command, manager) ||
      this.dispatchCopyPasteCommand(command, manager) ||
      this.dispatchFindCommand(command, manager) ||
      this.dispatchWordLineCommand(command, manager) ||
      this.dispatchUnsupportedCommand(command);

    if (!handled) {
      this.deps.logger(`Unhandled VS Code command: ${command}`);
    }
  }

  /**
   * Terminal management commands (new/split/kill/clear).
   */
  private dispatchTerminalManagementCommand(
    command: string,
    manager: IManagerCoordinator
  ): boolean {
    switch (command) {
      case 'workbench.action.terminal.new':
        this.deps.emitTerminalInteractionEvent('create-terminal', '', undefined, manager);
        return true;
      case 'workbench.action.terminal.split':
        this.deps.emitTerminalInteractionEvent(
          'split-terminal',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        return true;
      case 'workbench.action.terminal.kill':
        this.deps.emitTerminalInteractionEvent(
          'kill-terminal',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        return true;
      case 'workbench.action.terminal.clear':
        this.deps.handleTerminalClear(manager);
        return true;
      default:
        return false;
    }
  }

  /**
   * Navigation commands (focus next/previous, toggle).
   */
  private dispatchNavigationCommand(command: string, manager: IManagerCoordinator): boolean {
    switch (command) {
      case 'workbench.action.terminal.focusNext':
        this.deps.emitTerminalInteractionEvent(
          'switch-next',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        return true;
      case 'workbench.action.terminal.focusPrevious':
        this.deps.emitTerminalInteractionEvent(
          'switch-previous',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
        return true;
      case 'workbench.action.terminal.toggleTerminal':
        this.deps.emitTerminalInteractionEvent('toggle-terminal', '', undefined, manager);
        return true;
      default:
        return false;
    }
  }

  /**
   * Scrolling commands.
   */
  private dispatchScrollingCommand(command: string, manager: IManagerCoordinator): boolean {
    switch (command) {
      case 'workbench.action.terminal.scrollUp':
        this.scrollTerminal('up', manager);
        return true;
      case 'workbench.action.terminal.scrollDown':
        this.scrollTerminal('down', manager);
        return true;
      case 'workbench.action.terminal.scrollToTop':
        this.scrollTerminal('top', manager);
        return true;
      case 'workbench.action.terminal.scrollToBottom':
        this.scrollTerminal('bottom', manager);
        return true;
      case 'workbench.action.terminal.scrollToPreviousCommand':
        this.scrollTerminal('previousCommand', manager);
        return true;
      case 'workbench.action.terminal.scrollToNextCommand':
        this.scrollTerminal('nextCommand', manager);
        return true;
      default:
        return false;
    }
  }

  /**
   * Copy/paste/selection commands.
   */
  private dispatchCopyPasteCommand(command: string, manager: IManagerCoordinator): boolean {
    switch (command) {
      case 'workbench.action.terminal.copySelection':
        this.deps.handleTerminalCopy(manager);
        return true;
      case 'workbench.action.terminal.paste':
        this.deps.handleTerminalPaste(manager);
        return true;
      case 'workbench.action.terminal.selectAll':
        this.deps.handleTerminalSelectAll(manager);
        return true;
      default:
        return false;
    }
  }

  /**
   * Find functionality commands.
   */
  private dispatchFindCommand(command: string, manager: IManagerCoordinator): boolean {
    switch (command) {
      case 'workbench.action.terminal.focusFind':
        this.deps.handleTerminalFind(manager);
        return true;
      case 'workbench.action.terminal.findNext':
        this.deps.handleTerminalFindNext(manager);
        return true;
      case 'workbench.action.terminal.findPrevious':
        this.deps.handleTerminalFindPrevious(manager);
        return true;
      case 'workbench.action.terminal.hideFind':
        this.deps.handleTerminalHideFind(manager);
        return true;
      default:
        return false;
    }
  }

  /**
   * Word/line editing and terminal size commands.
   */
  private dispatchWordLineCommand(command: string, manager: IManagerCoordinator): boolean {
    switch (command) {
      case 'workbench.action.terminal.deleteWordLeft':
        this.deps.terminalOperationsService.deleteWordLeft(manager);
        return true;
      case 'workbench.action.terminal.deleteWordRight':
        this.deps.terminalOperationsService.deleteWordRight(manager);
        return true;
      case 'workbench.action.terminal.moveToLineStart':
        this.deps.terminalOperationsService.moveToLineStart(manager);
        return true;
      case 'workbench.action.terminal.moveToLineEnd':
        this.deps.terminalOperationsService.moveToLineEnd(manager);
        return true;
      case 'workbench.action.terminal.sizeToContentWidth':
        this.deps.terminalOperationsService.sizeToContent(manager);
        return true;
      default:
        return false;
    }
  }

  /**
   * Commands that are not available in the webview context (logged only).
   */
  private dispatchUnsupportedCommand(command: string): boolean {
    switch (command) {
      case 'workbench.action.togglePanel':
        this.deps.logger('Panel toggle not available in webview context');
        return true;
      case 'workbench.action.closePanel':
        this.deps.logger('Panel close not available in webview context');
        return true;
      case 'workbench.action.toggleSidebarVisibility':
        this.deps.logger('Sidebar toggle not available in webview context');
        return true;
      case 'workbench.action.toggleDevTools':
        this.deps.logger('Dev Tools toggle not available in webview context');
        return true;
      case 'workbench.action.reloadWindow':
        this.deps.logger('Window reload not available in webview context');
        return true;
      case 'workbench.action.reloadWindowWithExtensionsDisabled':
        this.deps.logger('Window reload with disabled extensions not available in webview context');
        return true;
      case 'workbench.action.zoomIn':
      case 'workbench.action.zoomOut':
      case 'workbench.action.zoomReset':
        this.deps.logger(`Zoom commands (${command}) not available in webview context`);
        return true;
      case 'workbench.action.quickOpen':
        this.deps.logger('Quick Open not implemented in terminal webview');
        return true;
      case 'workbench.action.showCommands':
        this.deps.logger('Command Palette not implemented in terminal webview');
        return true;
      case 'workbench.action.terminal.openNativeConsole':
        this.deps.logger('Native console not available in webview context');
        return true;
      default:
        return false;
    }
  }

  /**
   * VS Code Standard: Determine if a key should be intercepted for VS Code handling.
   * Returns true if VS Code should handle this key (not sent to shell).
   * Returns false if key should pass through to shell.
   *
   * This implements the VS Code terminal keybinding behavior where:
   * - Most keys go to shell (arrow keys, Ctrl+C for interrupt, etc.)
   * - Only specific shortcuts are intercepted (Ctrl+Shift+C for copy, Cmd+K for clear, etc.)
   */
  public shouldInterceptKeyForVSCode(
    event: KeyboardEvent,
    terminal: Terminal,
    manager: IManagerCoordinator
  ): boolean {
    // Use userAgentData if available (modern), fallback to userAgent (deprecated navigator.platform)
    const isMac = isMacPlatform();
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

    // NEVER intercept these - they must go to shell:
    // - Arrow keys (bash history, cursor movement)
    // - Tab (completion)
    // - Regular characters
    // - Ctrl+C without selection (interrupt)
    // - Ctrl+D (EOF)
    // - Ctrl+Z (suspend)
    // - Ctrl+A, Ctrl+E (line start/end in bash)
    // - Ctrl+U, Ctrl+K (line editing in bash)
    // - Ctrl+W (delete word in bash)
    // - Ctrl+R (reverse search in bash)
    // - Ctrl+L (clear screen in bash - should go to shell, not VS Code clear)

    // Each handler returns true/false to decide interception, or undefined to
    // defer to the next handler. They are evaluated in the original order so
    // side-effects (copy/paste/clear/scroll) happen identically.
    const decision =
      this.decideArrowKey(event, manager) ??
      this.decideTabKey(event) ??
      this.decideClipboardKey(event, terminal, manager, ctrlOrCmd) ??
      this.decideShellEssentialKey(event) ??
      this.decideMacClearKey(event, manager, isMac) ??
      this.decideInsertKey(event, terminal, manager) ??
      this.decideFunctionKey(event);

    // All other keys - pass to shell
    return decision ?? false;
  }

  /** Arrow keys: pass to shell, except Ctrl+Shift+Arrow which scrolls. */
  private decideArrowKey(event: KeyboardEvent, manager: IManagerCoordinator): boolean | undefined {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return undefined;
    }
    // Exception: Ctrl+Shift+Arrow for scrolling
    if (event.ctrlKey && event.shiftKey) {
      this.handleVSCodeCommand(
        event.key === 'ArrowUp'
          ? 'workbench.action.terminal.scrollUp'
          : 'workbench.action.terminal.scrollDown',
        manager
      );
      return true;
    }
    // Pass to shell (bash history, cursor movement)
    return false;
  }

  /** Tab: always pass to shell (completion). */
  private decideTabKey(event: KeyboardEvent): boolean | undefined {
    if (event.key === 'Tab') {
      return false;
    }
    return undefined;
  }

  /** Copy/paste shortcuts (Ctrl/Cmd[+Shift]+C/V). */
  private decideClipboardKey(
    event: KeyboardEvent,
    terminal: Terminal,
    manager: IManagerCoordinator,
    ctrlOrCmd: boolean
  ): boolean | undefined {
    // Ctrl+C: Copy if selection exists, otherwise pass to shell for interrupt
    if (ctrlOrCmd && event.key === 'c' && !event.shiftKey) {
      if (terminal.hasSelection()) {
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      // No selection - pass to shell for SIGINT
      return false;
    }

    // Ctrl+V: Paste
    if (ctrlOrCmd && event.key === 'v' && !event.shiftKey) {
      this.deps.handleTerminalPaste(manager);
      return true;
    }

    // Ctrl+Shift+C: Copy (VS Code style)
    if (ctrlOrCmd && event.shiftKey && event.key === 'c') {
      if (terminal.hasSelection()) {
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      return false;
    }

    // Ctrl+Shift+V: Paste (VS Code style)
    if (ctrlOrCmd && event.shiftKey && event.key === 'v') {
      this.deps.handleTerminalPaste(manager);
      return true;
    }

    return undefined;
  }

  /** Shell-essential Ctrl keys that must reach the shell. */
  private decideShellEssentialKey(event: KeyboardEvent): boolean | undefined {
    // Pass these shell-essential keys to shell:
    // Ctrl+D (EOF), Ctrl+Z (suspend), Ctrl+A, Ctrl+E, Ctrl+U, Ctrl+K, Ctrl+W, Ctrl+R, Ctrl+L
    const shellEssentialKeys = ['d', 'z', 'a', 'e', 'u', 'k', 'w', 'r', 'l'];
    if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      if (shellEssentialKeys.includes(event.key.toLowerCase())) {
        return false; // Pass to shell
      }
    }
    return undefined;
  }

  /** macOS Cmd+K clears the terminal. */
  private decideMacClearKey(
    event: KeyboardEvent,
    manager: IManagerCoordinator,
    isMac: boolean
  ): boolean | undefined {
    if (isMac && event.metaKey && event.key === 'k' && !event.shiftKey) {
      this.deps.handleTerminalClear(manager);
      return true;
    }
    return undefined;
  }

  /** Ctrl+Insert / Shift+Insert copy/paste (Windows/Linux). */
  private decideInsertKey(
    event: KeyboardEvent,
    terminal: Terminal,
    manager: IManagerCoordinator
  ): boolean | undefined {
    if (event.ctrlKey && event.key === 'Insert') {
      if (terminal.hasSelection()) {
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      return false;
    }
    if (event.shiftKey && event.key === 'Insert') {
      this.deps.handleTerminalPaste(manager);
      return true;
    }
    return undefined;
  }

  /** F12: intercept for VS Code (dev tools), without handling here. */
  private decideFunctionKey(event: KeyboardEvent): boolean | undefined {
    if (event.key === 'F12') {
      return true; // Intercept but don't handle - let VS Code handle
    }
    return undefined;
  }

  /**
   * Handle terminal scrolling - delegates to TerminalOperationsService
   */
  private scrollTerminal(direction: ScrollDirection, manager: IManagerCoordinator): void {
    this.deps.terminalOperationsService.scrollTerminal(direction, manager);
  }
}
