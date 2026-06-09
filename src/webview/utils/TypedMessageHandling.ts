/**
 * 型安全なメッセージハンドリングシステム
 * - 'any'型を排除し、完全な型安全性を実現
 * - 一貫した命名規則とエラーハンドリング
 */

import { webview as log } from '../../utils/logger';

// =============================================================================
// 型定義 - 明確で一貫した命名規則
// =============================================================================

export interface LoggerFunction {
  (message: string, ...args: unknown[]): void;
}

interface ValidatedData<T = Record<string, unknown>> {
  readonly data: T;
  readonly isValid: boolean;
  readonly errors: string[];
}

interface MessageProcessingResult {
  readonly success: boolean;
  readonly command: string;
  readonly processingTimeMs: number;
  readonly error?: Error;
}

export interface TerminalMessageData {
  readonly terminalId: string;
  readonly action?: string;
  readonly payload?: Record<string, unknown>;
}

export interface SessionMessageData {
  readonly sessionId: string;
  readonly terminalStates: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface ConfigurationMessageData {
  readonly configSection: string;
  readonly settings: Record<string, unknown>;
  readonly applyImmediately: boolean;
}

export interface StatusMessageData {
  readonly statusType: 'info' | 'warning' | 'error' | 'success';
  readonly message: string;
  readonly duration?: number;
  readonly persistent?: boolean;
}

export type MessagePayload =
  | TerminalMessageData
  | SessionMessageData
  | ConfigurationMessageData
  | StatusMessageData
  | Record<string, unknown>;

export type TypedMessageHandler<T extends MessagePayload = MessagePayload> = (
  data: T
) => Promise<void> | void;

export interface TypedMessageRegistration<T extends MessagePayload = MessagePayload> {
  readonly command: string;
  readonly handler: TypedMessageHandler<T>;
  readonly description?: string;
  readonly validator?: MessageDataValidator<T>;
}

// =============================================================================
// ValidationHelper - 型安全な検証クラス
// =============================================================================

export class MessageDataValidator<T extends MessagePayload = MessagePayload> {
  constructor(
    private readonly requiredFields: ReadonlyArray<keyof T>,
    private readonly logger: LoggerFunction
  ) {}

  public validate(data: unknown): ValidatedData<T> {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be a valid object');
      return { data: {} as T, isValid: false, errors };
    }

    const typedData = data as Record<string, unknown>;

    // 必須フィールドの検証
    for (const field of this.requiredFields) {
      const fieldName = String(field);
      if (!(fieldName in typedData)) {
        errors.push(`Missing required field: ${fieldName}`);
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger('Validation failed:', errors);
    }

    return {
      data: typedData as T,
      isValid,
      errors,
    };
  }

  public static createTerminalValidator(
    logger: LoggerFunction
  ): MessageDataValidator<TerminalMessageData> {
    return new MessageDataValidator(['terminalId'], logger);
  }

  public static createSessionValidator(
    logger: LoggerFunction
  ): MessageDataValidator<SessionMessageData> {
    return new MessageDataValidator(['sessionId', 'terminalStates'], logger);
  }
}

// =============================================================================
// TypedMessageRouter - 改善されたメッセージルーター
// =============================================================================

export class TypedMessageRouter {
  private readonly handlers = new Map<string, TypedMessageHandler>();
  private readonly validators = new Map<string, MessageDataValidator>();
  private readonly logger: LoggerFunction;
  private readonly componentName: string;

  constructor(componentName: string, customLogger?: LoggerFunction) {
    this.componentName = componentName;
    this.logger = customLogger ?? this.createDefaultLogger();
  }

  public registerHandler<T extends MessagePayload>(
    registration: TypedMessageRegistration<T>
  ): void {
    this.handlers.set(
      registration.command,
      registration.handler as TypedMessageHandler<MessagePayload>
    );

    if (registration.validator) {
      this.validators.set(
        registration.command,
        registration.validator as MessageDataValidator<MessagePayload>
      );
    }

    this.logger(`✅ Registered handler for command: "${registration.command}"`);
  }

  public registerMultipleHandlers(registrations: ReadonlyArray<TypedMessageRegistration>): void {
    registrations.forEach((registration) => this.registerHandler(registration));
    this.logger(`✅ Registered ${registrations.length} handlers`);
  }

  public async processMessage(command: string, rawData: unknown): Promise<MessageProcessingResult> {
    const startTime = performance.now();

    try {
      const handler = this.handlers.get(command);
      if (!handler) {
        const error = new Error(`No handler registered for command: ${command}`);
        this.logger(`❌ ${error.message}`);
        return this.createFailureResult(command, startTime, error);
      }

      // データ検証
      const validator = this.validators.get(command);
      if (validator) {
        const validationResult = validator.validate(rawData);
        if (!validationResult.isValid) {
          const error = new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
          return this.createFailureResult(command, startTime, error);
        }
        rawData = validationResult.data;
      }

      this.logger(`📨 Processing command: ${command}`);
      await handler(rawData as MessagePayload);

      return this.createSuccessResult(command, startTime);
    } catch (error) {
      const processedError = error instanceof Error ? error : new Error(String(error));
      this.logger(`❌ Handler failed for command ${command}:`, processedError);
      return this.createFailureResult(command, startTime, processedError);
    }
  }

  public getRegisteredCommands(): ReadonlyArray<string> {
    return Array.from(this.handlers.keys());
  }

  public clearAllHandlers(): void {
    const count = this.handlers.size;
    this.handlers.clear();
    this.validators.clear();
    this.logger(`🧹 Cleared ${count} handlers and validators`);
  }

  private createDefaultLogger(): LoggerFunction {
    const prefix = `[${this.componentName.toUpperCase()}-ROUTER]`;
    return (message: string, ...args: unknown[]) => {
      log(prefix, message, ...args);
    };
  }

  private createSuccessResult(command: string, startTime: number): MessageProcessingResult {
    return {
      success: true,
      command,
      processingTimeMs: performance.now() - startTime,
    };
  }

  private createFailureResult(
    command: string,
    startTime: number,
    error: Error
  ): MessageProcessingResult {
    return {
      success: false,
      command,
      processingTimeMs: performance.now() - startTime,
      error,
    };
  }
}

// =============================================================================
// TypedMessageSender - 型安全なメッセージ送信クラス
// =============================================================================

interface VSCodeWebviewAPI {
  postMessage(message: unknown): void;
}

interface QueuedMessage {
  readonly command: string;
  readonly data: MessagePayload;
  readonly timestamp: number;
  readonly retryCount: number;
}

export class TypedMessageSender {
  private readonly logger: LoggerFunction;
  private readonly messageQueue: QueuedMessage[] = [];
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    private readonly vscodeApi: VSCodeWebviewAPI,
    private readonly componentName: string,
    customLogger?: LoggerFunction
  ) {
    this.logger = customLogger ?? this.createDefaultLogger();
  }

  public sendMessage<T extends MessagePayload>(command: string, data: T = {} as T): void {
    try {
      const message = { command, ...data };
      this.vscodeApi.postMessage(message);
      this.logger(`📤 Sent command: ${command}`);
    } catch (error) {
      this.logger(`❌ Failed to send command ${command}:`, error);
      this.queueForRetry(command, data);
    }
  }

  public sendMultipleMessages(
    messages: ReadonlyArray<{ command: string; data?: MessagePayload }>
  ): void {
    messages.forEach(({ command, data = {} }) => {
      this.sendMessage(command, data);
    });
  }

  public sendConditionalMessage<T extends MessagePayload>(
    condition: boolean | (() => boolean),
    command: string,
    data: T = {} as T
  ): void {
    const shouldSend = typeof condition === 'function' ? condition() : condition;
    if (shouldSend) {
      this.sendMessage(command, data);
    }
  }

  public retryQueuedMessages(): void {
    const messagesToRetry = [...this.messageQueue];
    this.messageQueue.length = 0;

    messagesToRetry.forEach((queuedMessage) => {
      if (queuedMessage.retryCount < this.maxRetries) {
        const delayMs = this.retryDelayMs * queuedMessage.retryCount;

        if (delayMs <= 0) {
          // Immediate retry when explicitly requested (matches test expectations)
          this.sendMessage(queuedMessage.command, queuedMessage.data);
        } else {
          setTimeout(() => {
            this.sendMessage(queuedMessage.command, queuedMessage.data);
          }, delayMs);
        }
      } else {
        this.logger(`❌ Max retries exceeded for command: ${queuedMessage.command}`);
      }
    });
  }

  private queueForRetry(command: string, data: MessagePayload): void {
    const queuedMessage: QueuedMessage = {
      command,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.messageQueue.push(queuedMessage);
    this.logger(`📋 Queued message for retry: ${command}`);
  }

  private createDefaultLogger(): LoggerFunction {
    const prefix = `[${this.componentName.toUpperCase()}-SENDER]`;
    return (message: string, ...args: unknown[]) => {
      log(prefix, message, ...args);
    };
  }
}

// =============================================================================
// MessageEventListener - 型安全なイベントリスナー作成
// =============================================================================

export function createTypedMessageEventListener(
  router: TypedMessageRouter,
  onUnhandledMessage?: (event: MessageEvent) => void
): (event: MessageEvent) => void {
  return async (event: MessageEvent) => {
    try {
      const { command, ...data } = event.data;

      if (!command || typeof command !== 'string') {
        console.warn('Received message without valid command:', event.data);
        onUnhandledMessage?.(event);
        return;
      }

      const result = await router.processMessage(command, data);

      if (!result.success && onUnhandledMessage) {
        onUnhandledMessage(event);
      }
    } catch (error) {
      console.error('Error processing message event:', error);
      onUnhandledMessage?.(event);
    }
  };
}

// =============================================================================
// 定数定義 - 型安全なコマンド定数
// =============================================================================

export const MESSAGE_COMMANDS = {
  // ターミナル操作
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DELETE: 'terminal:delete',
  TERMINAL_SET_ACTIVE: 'terminal:setActive',
  TERMINAL_RESIZE: 'terminal:resize',

  // 入出力
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_CLEAR: 'terminal:clear',

  // セッション管理
  SESSION_RESTORE: 'session:restore',
  SESSION_SAVE: 'session:save',
  SESSION_EXTRACT_SCROLLBACK: 'session:extractScrollback',

  // 設定・テーマ
  CONFIG_UPDATE: 'config:update',
  THEME_UPDATE: 'theme:update',

  // 状態管理
  STATE_INIT: 'state:init',
  STATE_UPDATE: 'state:update',
  STATE_RESET: 'state:reset',

  // 通知
  NOTIFICATION_SHOW: 'notification:show',
  NOTIFICATION_HIDE: 'notification:hide',
} as const;
