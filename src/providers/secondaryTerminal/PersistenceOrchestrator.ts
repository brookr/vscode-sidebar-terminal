import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { ExtensionPersistenceService } from '../../services/persistence/ExtensionPersistenceService';
import { TerminalPersistencePort } from '../../services/persistence/TerminalPersistencePort';
import {
  PersistenceMessageHandler,
  PersistenceMessage,
} from '../../handlers/PersistenceMessageHandler';
import { WebviewMessage } from '../../types/common';
import { TerminalManager } from '../../terminals/TerminalManager';

type SendMessageFn = (message: WebviewMessage) => Promise<void>;

interface PersistenceOrchestratorOptions {
  extensionContext: vscode.ExtensionContext;
  terminalManager: TerminalManager;
  sendMessage: SendMessageFn;
  handlerFactory?: (service: TerminalPersistencePort) => PersistenceMessageHandler;
  serviceFactory?: (
    context: vscode.ExtensionContext,
    terminalManager: TerminalManager
  ) => TerminalPersistencePort;
  logger?: typeof log;
}

const defaultServiceFactory = (
  context: vscode.ExtensionContext,
  terminalManager: TerminalManager
): TerminalPersistencePort => new ExtensionPersistenceService(context, terminalManager);

const defaultHandlerFactory = (service: TerminalPersistencePort): PersistenceMessageHandler =>
  new PersistenceMessageHandler(service as unknown as ExtensionPersistenceService);

export class PersistenceOrchestrator implements vscode.Disposable {
  private readonly persistenceService: TerminalPersistencePort;
  private readonly handler: PersistenceMessageHandler;
  private readonly logger: typeof log;
  private readonly sendMessageImpl: SendMessageFn;

  constructor(private readonly options: PersistenceOrchestratorOptions) {
    this.logger = options.logger ?? log;
    this.persistenceService = (options.serviceFactory || defaultServiceFactory)(
      options.extensionContext,
      options.terminalManager
    );
    this.handler = (options.handlerFactory || defaultHandlerFactory)(this.persistenceService);
    this.sendMessageImpl = options.sendMessage;

    // 🔧 FIX: Set sidebar provider on ExtensionPersistenceService
    if ('setSidebarProvider' in this.persistenceService) {
      (this.persistenceService as ExtensionPersistenceService).setSidebarProvider?.({
        sendMessageToWebview: async (message: unknown) => {
          await options.sendMessage(message as WebviewMessage);
        },
      });
      this.logger('✅ [PERSISTENCE-ORCH] Sidebar provider configured for persistence service');
    }
  }

  public hasHandler(): boolean {
    return Boolean(this.handler);
  }

  public getHandler(): PersistenceMessageHandler {
    return this.handler;
  }

  public async handlePersistenceMessage(
    message: WebviewMessage,
    sendMessage?: SendMessageFn
  ): Promise<void> {
    await this.routePersistenceMessage(
      message,
      sendMessage ?? this.sendMessageImpl,
      (webviewMessage) => webviewMessage
    );
  }

  public async handleLegacyPersistenceMessage(
    message: WebviewMessage,
    sendMessage?: SendMessageFn
  ): Promise<void> {
    await this.routePersistenceMessage(message, sendMessage, (legacyMessage) => {
      let command = legacyMessage.command;
      switch (legacyMessage.command) {
        case 'terminalSerializationRequest':
          command = 'persistenceSaveSession';
          break;
        case 'terminalSerializationRestoreRequest':
          command = 'persistenceRestoreSession';
          break;
      }
      return {
        ...legacyMessage,
        command,
      };
    });
  }

  private async routePersistenceMessage(
    message: WebviewMessage,
    sendMessage: SendMessageFn | undefined,
    normalize: (message: WebviewMessage) => WebviewMessage
  ): Promise<void> {
    const normalizedMessage = normalize(message);
    const responseCommand = normalizedMessage.command.endsWith('Response')
      ? normalizedMessage.command
      : `${normalizedMessage.command}Response`;

    try {
      const persistenceCommand = normalizedMessage.command
        .replace('persistence', '')
        .toLowerCase() as PersistenceMessage['command'];

      const persistenceMessage: PersistenceMessage = {
        command: persistenceCommand,
        data: normalizedMessage.data,
        terminalId: normalizedMessage.terminalId,
      };

      const response = await this.handler.handleMessage(persistenceMessage);

      await (sendMessage ?? this.sendMessageImpl)({
        command: responseCommand as WebviewMessage['command'],
        success: response.success,
        data: response.data as string | unknown[] | undefined,
        error: response.error,
        terminalCount: response.terminalCount,
        messageId: normalizedMessage.messageId,
      });
    } catch (error) {
      this.logger('❌ [PERSISTENCE] Message handling failed:', error);
      await (sendMessage ?? this.sendMessageImpl)({
        command: responseCommand as WebviewMessage['command'],
        success: false,
        error: `Persistence operation failed: ${(error as Error).message}`,
        messageId: normalizedMessage.messageId,
      });
    }
  }

  public async saveCurrentSession(): Promise<boolean> {
    this.logger('🔥 [PERSISTENCE-DEBUG] === saveCurrentSession called ===');

    try {
      const result = await this.persistenceService.saveCurrentSession();
      if (result.success) {
        this.logger(
          `✅ [PERSISTENCE] Session saved successfully: ${result.terminalCount} terminals`
        );
      } else {
        this.logger('❌ [PERSISTENCE] Session save failed via persistence service');
      }
      return result.success;
    } catch (error) {
      this.logger(`❌ [PERSISTENCE] Auto-save failed: ${error}`);
      return false;
    }
  }

  public async restoreLastSession(): Promise<boolean> {
    this.logger('🔥 [RESTORE-DEBUG] === restoreLastSession called ===');

    try {
      const result = await this.persistenceService.restoreSession(true);

      if (result.success) {
        const restoredCount = result.restoredCount ?? 0;
        const skippedCount = result.skippedCount ?? 0;
        this.logger(
          `✅ [PERSISTENCE] Session restored successfully: ${restoredCount}/${restoredCount + skippedCount} terminals`
        );
      } else {
        const errorMessage =
          result.error instanceof Error
            ? result.error.message
            : String(result.error ?? 'unknown error');
        this.logger(`📦 [PERSISTENCE] Restore failed: ${errorMessage}`);
      }

      return result.success && (result.restoredCount ?? 0) > 0;
    } catch (error) {
      this.logger(`❌ [PERSISTENCE] Auto-restore failed: ${error}`);
      return false;
    }
  }

  public handleSerializationResponse(serializationData: Record<string, unknown>): void {
    this.logger(`📋 [PERSISTENCE-ORCH] Routing serialization response to persistence service`);

    if ('handleSerializationResponseMessage' in this.persistenceService) {
      (
        this.persistenceService as TerminalPersistencePort & {
          handleSerializationResponseMessage?: (data: Record<string, unknown>) => void;
        }
      ).handleSerializationResponseMessage?.(serializationData);
      this.logger(`✅ [PERSISTENCE-ORCH] Serialization response forwarded successfully`);
    } else {
      this.logger(
        `⚠️ [PERSISTENCE-ORCH] Persistence service does not support handleSerializationResponseMessage`
      );
    }
  }

  public dispose(): void {
    try {
      void this.persistenceService.cleanupExpiredSessions();
    } catch (error) {
      this.logger('⚠️ [PERSISTENCE] Failed to cleanup persistence service during dispose:', error);
    }
    this.persistenceService.dispose();
  }
}
