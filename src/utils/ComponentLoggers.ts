/** Component-specific loggers for debugging and monitoring. */

import { ui, input, lifecycle, error_category, warning_category, state } from './logger';

/** WebView operations logger. */
class WebViewLogger {
  constructor(private managerId: string) {}

  private fmt(action: string): string {
    return `[${this.managerId}] ${action}`;
  }

  initialized(): void {
    lifecycle(this.fmt('Initialized'));
  }
  domReady(): void {
    ui(this.fmt('DOM ready'));
  }
  render(component: string, duration?: number): void {
    ui(this.fmt(`Rendered ${component}${duration ? ` in ${duration}ms` : ''}`));
  }
  interaction(type: string, element: string): void {
    input(this.fmt(`${type} on ${element}`));
  }
  stateChange(prop: string, oldVal: unknown, newVal: unknown): void {
    state(this.fmt(`State: ${prop}`), { oldVal, newVal });
  }
  error(op: string, err: unknown): void {
    error_category(this.fmt(`Error in ${op}`), err);
  }
  warning(op: string, details: unknown): void {
    warning_category(this.fmt(`Warning in ${op}`), details);
  }
}

export const createWebViewLogger = (managerId: string): WebViewLogger =>
  new WebViewLogger(managerId);
