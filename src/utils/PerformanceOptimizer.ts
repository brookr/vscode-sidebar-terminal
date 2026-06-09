/**
 * Performance Optimization Utilities
 * Phase 3: System performance improvements
 */

import { log } from './logger';

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private static readonly MAX_METRICS_SIZE = 1000;
  private metrics: Map<string, { start: number; duration?: number }> = new Map();

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public startTimer(name: string): void {
    if (!this.metrics.has(name) && this.metrics.size >= PerformanceMonitor.MAX_METRICS_SIZE) {
      const firstKey = this.metrics.keys().next().value;
      if (firstKey !== undefined) {
        this.metrics.delete(firstKey);
      }
    }
    this.metrics.set(name, { start: performance.now() });
  }

  public endTimer(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Timer "${name}" was not started`);
      return null;
    }

    const duration = performance.now() - metric.start;
    metric.duration = duration;

    log(`⏱️ [PERFORMANCE] ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  public getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((metric, name) => {
      if (metric.duration !== undefined) {
        result[name] = metric.duration;
      }
    });
    return result;
  }

  public clearMetrics(): void {
    this.metrics.clear();
  }
}
