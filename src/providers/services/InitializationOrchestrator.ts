import { provider as log } from '../../utils/logger';
import { TerminalInitializationCoordinator } from '../TerminalInitializationCoordinator';
import { WebViewLifecycleManager } from './WebViewLifecycleManager';
import { MessageRoutingFacade } from './MessageRoutingFacade';

/**
 * Initialization phase tracking
 */
export enum InitializationPhase {
  NOT_STARTED = 'not_started',
  WEBVIEW_SETUP = 'webview_setup',
  MESSAGE_HANDLERS = 'message_handlers',
  TERMINAL_SETUP = 'terminal_setup',
  SERVICES_READY = 'services_ready',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Initialization result
 */
interface InitializationResult {
  success: boolean;
  phase: InitializationPhase;
  error?: Error;
  durationMs?: number;
}

/**
 * InitializationOrchestrator
 *
 * Orchestrates the complete initialization sequence for the SecondaryTerminalProvider.
 * This service coordinates multiple initialization phases including WebView setup,
 * message handler registration, terminal initialization, and service configuration.
 *
 * Responsibilities:
 * - Coordinate initialization phases
 * - Track initialization state and progress
 * - Handle initialization errors gracefully
 * - Provide initialization metrics
 * - Ensure proper initialization order
 * - Prevent duplicate initialization
 *
 * Part of Issue #214 refactoring to apply Facade pattern
 */
export class InitializationOrchestrator {
  private _currentPhase: InitializationPhase = InitializationPhase.NOT_STARTED;
  private _isInitialized = false;
  private _initializationStartTime = 0;
  private _phaseTimings = new Map<InitializationPhase, number>();

  constructor(
    private readonly _terminalCoordinator: TerminalInitializationCoordinator,
    private readonly _lifecycleManager?: WebViewLifecycleManager,
    private readonly _messageRouter?: MessageRoutingFacade
  ) {}

  /**
   * Get current initialization phase
   */
  public getCurrentPhase(): InitializationPhase {
    return this._currentPhase;
  }

  /**
   * Check if initialization is complete
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get initialization phase timings
   */
  public getPhaseTimings(): Map<InitializationPhase, number> {
    return new Map(this._phaseTimings);
  }

  /**
   * Get total initialization duration
   */
  public getTotalDuration(): number {
    if (this._initializationStartTime === 0) {
      return 0;
    }
    return Date.now() - this._initializationStartTime;
  }

  /**
   * Execute the complete initialization sequence
   *
   * This method orchestrates all initialization phases:
   * 1. WebView setup (if lifecycle manager provided)
   * 2. Message handler initialization (if message router provided)
   * 3. Terminal initialization
   * 4. Services ready notification
   *
   * @returns Promise<InitializationResult> Result of initialization
   */
  public async initialize(): Promise<InitializationResult> {
    if (this._isInitialized) {
      log('⚠️ [INIT] Already initialized, skipping duplicate initialization');
      return {
        success: true,
        phase: InitializationPhase.COMPLETED,
      };
    }

    this._initializationStartTime = Date.now();
    log('🚀 [INIT] === Starting Initialization Orchestration ===');

    try {
      // Phase 1: WebView Setup
      await this._executePhase(InitializationPhase.WEBVIEW_SETUP, async () => {
        if (this._lifecycleManager) {
          log('🔧 [INIT] Phase 1: WebView setup');
          // WebView setup is handled by lifecycle manager
          // No additional work needed here
        }
      });

      // Phase 2: Message Handlers
      await this._executePhase(InitializationPhase.MESSAGE_HANDLERS, async () => {
        if (this._messageRouter) {
          log('🔧 [INIT] Phase 2: Message handlers initialization');
          this._messageRouter.setInitialized(true);
          this._messageRouter.logRegisteredHandlers();
        }
      });

      // Phase 3: Terminal Setup
      await this._executePhase(InitializationPhase.TERMINAL_SETUP, async () => {
        log('🔧 [INIT] Phase 3: Terminal initialization');
        await this._terminalCoordinator.initialize();
      });

      // Phase 4: Services Ready
      await this._executePhase(InitializationPhase.SERVICES_READY, async () => {
        log('🔧 [INIT] Phase 4: Services ready');
        // All services are now ready
      });

      // Mark as completed
      this._currentPhase = InitializationPhase.COMPLETED;
      this._isInitialized = true;

      const totalDuration = this.getTotalDuration();
      log(`✅ [INIT] === Initialization Completed (${totalDuration}ms) ===`);
      this._logPhaseTimings();

      return {
        success: true,
        phase: InitializationPhase.COMPLETED,
        durationMs: totalDuration,
      };
    } catch (error) {
      this._currentPhase = InitializationPhase.FAILED;
      const totalDuration = this.getTotalDuration();

      log(`❌ [INIT] === Initialization Failed (${totalDuration}ms) ===`);
      log('❌ [INIT] Error:', error);
      this._logPhaseTimings();

      return {
        success: false,
        phase: this._currentPhase,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: totalDuration,
      };
    }
  }

  /**
   * Initialize terminals only (lightweight initialization)
   *
   * This method can be called independently to initialize just the terminal
   * coordination without going through the full initialization sequence
   */
  public async initializeTerminals(): Promise<void> {
    log('🔧 [INIT] Initializing terminals only...');
    await this._terminalCoordinator.initialize();
    log('✅ [INIT] Terminal initialization completed');
  }

  /**
   * Reset initialization state
   *
   * This method clears initialization state and allows re-initialization.
   * Use with caution - typically only needed during testing or recovery.
   */
  public reset(): void {
    log('🔄 [INIT] Resetting initialization state');
    this._currentPhase = InitializationPhase.NOT_STARTED;
    this._isInitialized = false;
    this._initializationStartTime = 0;
    this._phaseTimings.clear();
    log('✅ [INIT] Initialization state reset');
  }

  /**
   * Execute a single initialization phase with timing
   */
  private async _executePhase(
    phase: InitializationPhase,
    executor: () => Promise<void>
  ): Promise<void> {
    this._currentPhase = phase;
    const phaseStart = Date.now();

    try {
      await executor();
      const phaseDuration = Date.now() - phaseStart;
      this._phaseTimings.set(phase, phaseDuration);
      log(`✅ [INIT] ${phase} completed (${phaseDuration}ms)`);
    } catch (error) {
      const phaseDuration = Date.now() - phaseStart;
      this._phaseTimings.set(phase, phaseDuration);
      log(`❌ [INIT] ${phase} failed (${phaseDuration}ms):`, error);
      throw error;
    }
  }

  /**
   * Log timing information for all phases
   */
  private _logPhaseTimings(): void {
    log('📊 [INIT] === Phase Timings ===');
    for (const [phase, duration] of this._phaseTimings) {
      log(`📊 [INIT] ${phase}: ${duration}ms`);
    }
    log(`📊 [INIT] Total: ${this.getTotalDuration()}ms`);
  }
}
