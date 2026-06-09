/**
 * ターミナル検証サービス
 *
 * ターミナル操作の検証とリカバリロジックを専門に扱います。
 * 作成・削除・操作の妥当性チェックとエラーリカバリを担当します。
 */

import { TerminalInstance } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { OperationResult, OperationResultHandler } from '../utils/OperationResultHandler';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { getTerminalConfig } from '../utils/common';
import { TERMINAL_CONSTANTS } from '../constants/SystemConstants';

export interface ITerminalValidationService {
  /**
   * ターミナル作成の検証
   */
  validateCreation(terminals: Map<string, TerminalInstance>): OperationResult<void>;

  /**
   * ターミナル削除の検証
   */
  validateDeletion(
    terminalId: string,
    terminals: Map<string, TerminalInstance>,
    force?: boolean
  ): OperationResult<void>;

  /**
   * ターミナル操作の検証
   */
  validateOperation(
    terminalId: string,
    terminals: Map<string, TerminalInstance>,
    operation: string
  ): OperationResult<void>;

  /**
   * ターミナルIDの検証
   */
  validateTerminalId(terminalId: string): OperationResult<void>;

  /**
   * ターミナルデータの検証
   */
  validateTerminalData(terminalId: string, data: string): OperationResult<void>;

  /**
   * リサイズパラメータの検証
   */
  validateResizeParams(cols: number, rows: number): OperationResult<void>;

  /**
   * ターミナルの整合性チェック
   */
  checkTerminalIntegrity(terminal: TerminalInstance): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  };

  /**
   * ターミナルマップ全体の健全性チェック
   */
  validateTerminalMapHealth(terminals: Map<string, TerminalInstance>): {
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
  };
}

interface ValidationConfig {
  maxTerminals: number;
  minTerminals: number;
  maxDataSize: number;
  maxDimensions: { cols: number; rows: number };
  minDimensions: { cols: number; rows: number };
  allowForceDelete: boolean;
}

/**
 * ターミナル検証サービス実装
 */
export class TerminalValidationService implements ITerminalValidationService {
  private readonly _terminalNumberManager: TerminalNumberManager;
  private readonly config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    const terminalConfig = getTerminalConfig();

    this.config = {
      maxTerminals: terminalConfig.maxTerminals || TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT,
      minTerminals: 1,
      maxDataSize: 10 * 1024 * 1024, // 10MB
      maxDimensions: { cols: 500, rows: 200 },
      minDimensions: { cols: 1, rows: 1 },
      allowForceDelete: true,
      ...config,
    };

    this._terminalNumberManager = new TerminalNumberManager(this.config.maxTerminals);

    log(`🛡️ [VALIDATION] Terminal validation service initialized`);
  }

  /**
   * ターミナル作成の検証
   */
  validateCreation(terminals: Map<string, TerminalInstance>): OperationResult<void> {
    // 最大数チェック
    if (terminals.size >= this.config.maxTerminals) {
      const message = `Cannot create terminal: maximum limit reached (${this.config.maxTerminals})`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    // 利用可能な番号があるか確認
    const canCreate = this._terminalNumberManager.canCreate(terminals);
    if (!canCreate) {
      const message = 'No available terminal slots';
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    log(`✅ [VALIDATION] Terminal creation validated`);
    return OperationResultHandler.success();
  }

  /**
   * ターミナル削除の検証
   */
  validateDeletion(
    terminalId: string,
    terminals: Map<string, TerminalInstance>,
    force: boolean = false
  ): OperationResult<void> {
    // ターミナルIDの検証
    const idValidation = this.validateTerminalId(terminalId);
    if (!idValidation.success) {
      return idValidation;
    }

    // ターミナルの存在確認
    if (!terminals.has(terminalId)) {
      const message = `Terminal not found: ${terminalId}`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    // forceオプションがない場合は最小数チェック
    if (!force && terminals.size <= this.config.minTerminals) {
      const message = `Must keep at least ${this.config.minTerminals} terminal(s) open`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    log(`✅ [VALIDATION] Terminal deletion validated for: ${terminalId}`);
    return OperationResultHandler.success();
  }

  /**
   * ターミナル操作の検証
   */
  validateOperation(
    terminalId: string,
    terminals: Map<string, TerminalInstance>,
    operation: string
  ): OperationResult<void> {
    // ターミナルIDの検証
    const idValidation = this.validateTerminalId(terminalId);
    if (!idValidation.success) {
      return idValidation;
    }

    // ターミナルの存在確認
    if (!terminals.has(terminalId)) {
      const message = `Terminal not found for operation '${operation}': ${terminalId}`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    // ターミナルの整合性チェック
    const terminal = terminals.get(terminalId);
    if (terminal) {
      const integrity = this.checkTerminalIntegrity(terminal);
      if (!integrity.isValid) {
        const message = `Terminal integrity check failed for operation '${operation}': ${integrity.issues.join(', ')}`;
        log(`⚠️ [VALIDATION] ${message}`);
        return OperationResultHandler.failure(message);
      }
    }

    log(`✅ [VALIDATION] Operation '${operation}' validated for terminal: ${terminalId}`);
    return OperationResultHandler.success();
  }

  /**
   * ターミナルIDの検証
   */
  validateTerminalId(terminalId: string): OperationResult<void> {
    if (!terminalId || typeof terminalId !== 'string') {
      const message = 'Invalid terminal ID: must be a non-empty string';
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    if (terminalId.trim() === '') {
      const message = 'Invalid terminal ID: cannot be empty';
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    return OperationResultHandler.success();
  }

  /**
   * ターミナルデータの検証
   */
  validateTerminalData(terminalId: string, data: string): OperationResult<void> {
    // データサイズチェック
    if (data.length > this.config.maxDataSize) {
      const message = `Data size exceeds maximum allowed (${this.config.maxDataSize} bytes)`;
      log(`⚠️ [VALIDATION] ${message} for terminal: ${terminalId}`);
      return OperationResultHandler.failure(message);
    }

    // データ型チェック
    if (typeof data !== 'string') {
      const message = 'Invalid data type: must be a string';
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    return OperationResultHandler.success();
  }

  /**
   * リサイズパラメータの検証
   */
  validateResizeParams(cols: number, rows: number): OperationResult<void> {
    // 最小寸法チェック
    if (cols < this.config.minDimensions.cols || rows < this.config.minDimensions.rows) {
      const message = `Dimensions too small: ${cols}x${rows} (min: ${this.config.minDimensions.cols}x${this.config.minDimensions.rows})`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    // 最大寸法チェック
    if (cols > this.config.maxDimensions.cols || rows > this.config.maxDimensions.rows) {
      const message = `Dimensions too large: ${cols}x${rows} (max: ${this.config.maxDimensions.cols}x${this.config.maxDimensions.rows})`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    // 数値チェック
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
      const message = `Dimensions must be integers: ${cols}x${rows}`;
      log(`⚠️ [VALIDATION] ${message}`);
      return OperationResultHandler.failure(message);
    }

    return OperationResultHandler.success();
  }

  /**
   * ターミナルの整合性チェック
   */
  checkTerminalIntegrity(terminal: TerminalInstance): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // 必須フィールドの確認
    if (!terminal.id) {
      issues.push('Missing terminal ID');
    }

    if (!terminal.name) {
      issues.push('Missing terminal name');
    }

    if (terminal.number === undefined || terminal.number === null) {
      issues.push('Missing terminal number');
    }

    // PTYインスタンスの確認
    if (!terminal.pty && !terminal.ptyProcess) {
      issues.push('No PTY instance available');
    }

    // PTYの型確認
    if (terminal.pty && typeof terminal.pty !== 'object') {
      issues.push('Invalid PTY instance type');
    }

    if (terminal.ptyProcess && typeof terminal.ptyProcess !== 'object') {
      issues.push('Invalid PTY process instance type');
    }

    // 警告レベルのチェック
    if (!terminal.createdAt) {
      warnings.push('Missing creation timestamp');
    }

    if (terminal.isActive === undefined) {
      warnings.push('Missing isActive flag');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * ターミナルマップ全体の健全性チェック
   */
  validateTerminalMapHealth(terminals: Map<string, TerminalInstance>): {
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // ターミナル数チェック
    if (terminals.size > this.config.maxTerminals) {
      issues.push(`Too many terminals: ${terminals.size}/${this.config.maxTerminals}`);
    }

    // 重複IDチェック
    const ids = new Set<string>();
    const duplicateIds: string[] = [];
    terminals.forEach((_, id) => {
      if (ids.has(id)) {
        duplicateIds.push(id);
      }
      ids.add(id);
    });
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate terminal IDs: ${duplicateIds.join(', ')}`);
    }

    // 重複番号チェック
    const numbers = new Map<number, string[]>();
    terminals.forEach((terminal, id) => {
      if (terminal.number !== undefined && terminal.number !== null) {
        const existing = numbers.get(terminal.number) || [];
        existing.push(id);
        numbers.set(terminal.number, existing);
      }
    });
    numbers.forEach((terminalIds, number) => {
      if (terminalIds.length > 1) {
        warnings.push(`Duplicate terminal number ${number}: ${terminalIds.join(', ')}`);
      }
    });

    // 各ターミナルの整合性チェック
    terminals.forEach((terminal, id) => {
      const integrity = this.checkTerminalIntegrity(terminal);
      if (!integrity.isValid) {
        issues.push(`Terminal ${id} integrity issues: ${integrity.issues.join(', ')}`);
      }
      if (integrity.warnings.length > 0) {
        warnings.push(`Terminal ${id} warnings: ${integrity.warnings.join(', ')}`);
      }
    });

    // 健全性の判定
    const isHealthy = issues.length === 0;

    if (!isHealthy) {
      log(`⚠️ [VALIDATION] Terminal map health check failed: ${issues.length} issues`);
    } else if (warnings.length > 0) {
      log(`⚠️ [VALIDATION] Terminal map has ${warnings.length} warnings`);
    } else {
      log(`✅ [VALIDATION] Terminal map health check passed`);
    }

    return {
      isHealthy,
      issues,
      warnings,
    };
  }
}
