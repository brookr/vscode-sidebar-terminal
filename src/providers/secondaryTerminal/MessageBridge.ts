import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { WebviewMessage } from '../../types/common';

type WebviewMessageValidator = (message: unknown) => message is WebviewMessage;
type WebviewMessageHandler = (message: WebviewMessage) => Promise<void>;

/**
 * MessageBridge ensures we always register WebView listeners before injecting HTML.
 * It centralizes validation, logging, and error isolation so the provider no longer
 * contains the onDidReceiveMessage boilerplate.
 */
export class MessageBridge {
  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly logger: typeof log = log
  ) {}

  public register(
    webviewView: vscode.WebviewView,
    validator: WebviewMessageValidator,
    handler: WebviewMessageHandler
  ): void {
    this.logger('🔧 [BRIDGE] Registering webview message listener');

    const disposable = webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      this.logger('📨 [BRIDGE] Message received from WebView');

      if (!validator(message)) {
        this.logger('⚠️ [BRIDGE] Invalid WebView message received, ignoring');
        return;
      }

      try {
        await handler(message);
      } catch (error) {
        this.logger('❌ [BRIDGE] Error while handling WebView message:', error);
      }
    });

    this.extensionContext.subscriptions.push(disposable);
    this.logger('✅ [BRIDGE] Message listener registered');
  }
}
