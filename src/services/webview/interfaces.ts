import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { TerminalManager } from '../../terminals/TerminalManager';

/**
 * Session Manager interface for message handlers
 */
export interface ISessionManager {
  getSessionInfo(): { hasValidSession: boolean; sessionData?: any };
  restoreSession(
    force: boolean
  ): Promise<{ success: boolean; message?: string; terminals?: any[] }>;
  saveSession(terminals: any[]): Promise<void>;
}

/**
 * Context interface for message handlers
 */
export interface IMessageHandlerContext {
  extensionContext: vscode.ExtensionContext;
  terminalManager: TerminalManager;
  webview: vscode.Webview | undefined;
  standardSessionManager?: ISessionManager;
  sendMessage: (message: WebviewMessage) => Promise<void>;
  terminalIdMapping?: Map<string, string>;
}

/**
 * Base interface for all message handlers
 */
export interface IMessageHandler {
  canHandle(message: WebviewMessage): boolean;
  handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;
}

/**
 * CLI Agent service interface
 */
export interface ICliAgentWebViewService {
  sendStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null,
    context: IMessageHandlerContext
  ): void;
  sendFullStateSync(context: IMessageHandlerContext): void;
  setupListeners(context: IMessageHandlerContext): vscode.Disposable[];
}
