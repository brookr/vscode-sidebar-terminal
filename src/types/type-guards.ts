/**
 * Type Guards and Type Safety Utilities
 *
 * This module provides type guards and utility functions to replace `any` types
 * with proper type checking throughout the codebase.
 */

import { WebviewMessage, PartialTerminalSettings } from './shared';

// ===== Type Guard Functions =====

/**
 * Type guard for WebviewMessage
 */
export function isWebviewMessage(value: unknown): value is WebviewMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WebviewMessage).command === 'string'
  );
}

/**
 * Type guard for WebviewMessage with terminalId
 */
export function hasTerminalId(msg: WebviewMessage): msg is WebviewMessage & { terminalId: string } {
  return typeof msg.terminalId === 'string' && msg.terminalId.length > 0;
}

/**
 * Type guard for WebviewMessage with resize parameters
 */
export function hasResizeParams(
  msg: WebviewMessage
): msg is WebviewMessage & { cols: number; rows: number } {
  return (
    typeof msg.cols === 'number' && typeof msg.rows === 'number' && msg.cols > 0 && msg.rows > 0
  );
}

/**
 * Type guard for WebviewMessage with settings
 */
export function hasSettings(
  msg: WebviewMessage
): msg is WebviewMessage & { settings: PartialTerminalSettings } {
  return msg.settings !== undefined && typeof msg.settings === 'object' && msg.settings !== null;
}

/**
 * Type guard for WebviewMessage with input data
 */
export function hasInputData(msg: WebviewMessage): msg is WebviewMessage & { data: string } {
  return typeof msg.data === 'string' && msg.data.length > 0;
}

// ===== Utility Types =====
/**
 * Message handler function type
 */
export type MessageHandler<T extends WebviewMessage = WebviewMessage> = (
  message: T
) => Promise<void> | void;
// ===== Runtime Type Checkers =====

/**
 * Checks if value is a non-null object
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks if value has a specific property with type
 */
export function hasProperty<K extends string, V>(
  obj: unknown,
  key: K,
  typeCheck: (value: unknown) => value is V
): obj is Record<K, V> {
  return isNonNullObject(obj) && key in obj && typeCheck((obj as Record<K, unknown>)[key]);
}

/**
 * Type guard for split direction
 */
function isSplitDirection(value: unknown): value is 'horizontal' | 'vertical' {
  return value === 'horizontal' || value === 'vertical';
}

/**
 * Type guard for WebviewMessage with direction
 */
export function hasDirection(
  msg: WebviewMessage
): msg is WebviewMessage & { direction: 'horizontal' | 'vertical' } {
  return hasProperty(msg, 'direction', isSplitDirection);
}

// ===== Manager Interface Extensions =====

/**
 * Shell Integration Manager interface
 */
export interface IShellIntegrationManager {
  updateShellStatus(terminalId: string, status: string): void;
  updateCwd(terminalId: string, cwd: string): void;
  showCommandHistory(
    terminalId: string,
    history: Array<{ command: string; exitCode?: number; duration?: number }>
  ): void;
}

/**
 * Enhanced Terminal interface with search addon
 */
export interface ITerminalWithAddons {
  _addonManager?: {
    _addons?: Array<{
      addon?: {
        findNext?: () => void;
        clearDecorations?: () => void;
      };
    }>;
  };
  _terminal?: any; // xterm.js Terminal instance
}

// ===== Terminal Manager Interfaces =====
// ===== Error Types =====
