/**
 * Communication Layer - Persistence Port Interface
 *
 * Defines the interface for persistence operations.
 * This interface will be implemented separately for Extension and WebView layers.
 *
 * @see Issue #223 - Phase 2: Persistence Layer Separation
 */

import {
  SaveSessionRequestDTO,
  SaveSessionResponseDTO,
  RestoreSessionRequestDTO,
  RestoreSessionResponseDTO,
  ClearSessionRequestDTO,
  ClearSessionResponseDTO,
  SessionDataDTO,
} from '../dto/SessionDTO';

/**
 * Base Persistence Port Interface
 * Common interface for both Extension and WebView persistence
 */
interface IPersistencePort {
  /**
   * Save the current session
   * @param request Save session request
   * @returns Promise with save result
   */
  saveSession(request: SaveSessionRequestDTO): Promise<SaveSessionResponseDTO>;

  /**
   * Restore a session
   * @param request Restore session request
   * @returns Promise with restore result
   */
  restoreSession(request: RestoreSessionRequestDTO): Promise<RestoreSessionResponseDTO>;

  /**
   * Clear stored session data
   * @param request Clear session request
   * @returns Promise with clear result
   */
  clearSession(request: ClearSessionRequestDTO): Promise<ClearSessionResponseDTO>;

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): Promise<void>;

  /**
   * Dispose of the persistence port
   */
  dispose(): void;
}

/**
 * WebView Persistence Port Interface
 * Handles persistence on the WebView side (localStorage, sessionStorage)
 */
export interface IWebViewPersistencePort extends IPersistencePort {
  /**
   * Get local session data
   * @returns Promise with local session data
   */
  getLocalSessionData(): Promise<SessionDataDTO | null>;

  /**
   * Store local session data
   * @param data Session data to store
   * @returns Promise with success status
   */
  storeLocalSessionData(data: SessionDataDTO): Promise<boolean>;

  /**
   * Clear local storage
   * @returns Promise with success status
   */
  clearLocalStorage(): Promise<boolean>;

  /**
   * Get local storage size
   * @returns Promise with size in bytes
   */
  getLocalStorageSize(): Promise<number>;
}
