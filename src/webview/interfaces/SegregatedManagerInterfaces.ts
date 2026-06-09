// Re-export core interfaces from main manager interfaces
export { TerminalInstance, IManagerCoordinator } from './ManagerInterfaces';

// Import required types for interfaces
import type { IManagerCoordinator, TerminalInstance, IManagerLifecycle } from './ManagerInterfaces';

// Additional interfaces needed by DependencyContainer and tests
export interface ManagerDependencies {
  coordinator?: IManagerCoordinator;
  terminalCoordinator?: ITerminalCoordinator;
  extensionCommunicator?: IExtensionCommunicator;
  settingsCoordinator?: ISettingsCoordinator;
  cliAgentCoordinator?: ICliAgentCoordinator;
  sessionCoordinator?: ISessionCoordinator;
  loggingCoordinator?: ILoggingCoordinator;
  managerProvider?: IManagerProvider;
  [key: string]: unknown;
}

export interface ITerminalCoordinator {
  createTerminal(id: string, name: string): Promise<void>;
  deleteTerminal(id: string): Promise<void>;
  switchToTerminal(id: string): void;
  getActiveTerminal(): TerminalInstance | null;
}

export interface IExtensionCommunicator {
  sendMessage(message: unknown): void;
  onMessage(handler: (message: unknown) => void): void;
}

export interface ISettingsCoordinator {
  getSettings(): unknown;
  saveSettings(settings: unknown): void;
  onSettingsChange(handler: (settings: unknown) => void): void;
}

export interface ICliAgentCoordinator {
  detectAgent(terminalId: string): Promise<string | null>;
  updateStatus(terminalId: string, status: string): void;
}

export interface ISessionCoordinator {
  saveSession(data: unknown): void;
  restoreSession(): unknown | null;
}

export interface ILoggingCoordinator {
  log(level: string, message: string, ...args: unknown[]): void;
  error(message: string, error?: Error): void;
}

export interface IManagerProvider {
  getManager<T>(type: string): T | null;
  getAllManagers(): Map<string, unknown>;
}

interface ManagerHealthStatus {
  isHealthy: boolean;
  errors: Error[];
  warnings: string[];
  lastCheck: Date;
  errorCount?: number;
  lastError?: Error;
}

// Alias for backward compatibility
export type IEnhancedBaseManager = IEnhancedManager;

// Additional segregated interfaces for specific use cases

// Segregated Terminal Operations Interface
// Segregated UI Operations Interface
// Segregated Message Operations Interface
// Segregated Performance Operations Interface
// Segregated Configuration Operations Interface
// Segregated Notification Operations Interface
// Combined segregated operations interface
// Manager state interfaces
interface IManagerState {
  isInitialized: boolean;
  isDisposed: boolean;
  lastError?: Error;
}

// Enhanced manager interface with state
interface IEnhancedManager extends IManagerLifecycle {
  readonly state: IManagerState;
  getState(): IManagerState;
  isReady(): boolean;
  getLastError(): Error | undefined;
  getHealthStatus?(): ManagerHealthStatus;
  isInitialized?: boolean;
}

// Factory interface for segregated managers
