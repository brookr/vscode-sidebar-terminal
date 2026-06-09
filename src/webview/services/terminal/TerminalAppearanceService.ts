import { ITerminalOptions, Terminal } from '@xterm/xterm';
import {
  PartialTerminalSettings,
  TerminalConfig,
  WebViewFontSettings,
} from '../../../types/shared';
import { IConfigManager } from '../../interfaces/ManagerInterfaces';
import { terminalLogger } from '../../utils/ManagerLogger';
import { getWebviewTheme } from '../../utils/WebviewThemeUtils';
import { TerminalConfigService, WebViewTerminalConfig } from './TerminalConfigService';

interface ICoordinatorDependencies {
  currentSettings?: PartialTerminalSettings;
}

interface IDependencies {
  coordinator: ICoordinatorDependencies;
}

type TerminalConfigManager = Pick<IConfigManager, 'getCurrentFontSettings' | 'getCurrentSettings'>;

const FontDefaults = {
  FONT_WEIGHT: 'normal',
  FONT_WEIGHT_BOLD: 'bold',
  LINE_HEIGHT: 1,
  LETTER_SPACING: 0,
} as const;

const CssClasses = {
  XTERM: 'xterm',
  XTERM_VIEWPORT: 'xterm-viewport',
} as const;

const POST_RENDERER_SETUP_DELAY_MS = 200;

/**
 * Return the first truthy value, falling back to the final (required) value.
 * Mirrors a chain of `||` operators while keeping callers flat.
 */
function firstTruthy<T>(...values: [...(T | undefined | null)[], T]): T {
  for (const value of values) {
    if (value) {
      return value as T;
    }
  }
  return values[values.length - 1] as T;
}

/**
 * Return the first non-null/undefined value, falling back to the final (required) value.
 * Mirrors a chain of `??` operators while keeping callers flat.
 */
function firstNonNullish<T>(...values: [...(T | undefined | null)[], T]): T {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }
  return values[values.length - 1] as T;
}

export class TerminalAppearanceService {
  constructor(private readonly dependencies: IDependencies) {}

  public prepareTerminalConfig(
    config: TerminalConfig | undefined,
    configManager: TerminalConfigManager | undefined
  ): {
    terminalConfig: WebViewTerminalConfig;
    currentSettings: PartialTerminalSettings | undefined;
    currentFontSettings: WebViewFontSettings | undefined;
    linkModifier: 'alt' | 'ctrlCmd';
  } {
    const { fontSettings: currentFontSettings, fontOverrides } = this.prepareFontSettings(
      config,
      configManager
    );
    const currentSettings = this.resolveCurrentSettings(configManager);
    const resolvedTheme = getWebviewTheme(currentSettings);
    terminalLogger.info(
      `🎨 [THEME] Creating terminal with theme: ${currentSettings?.theme} -> bg=${resolvedTheme.background}`
    );

    const configWithFonts = {
      ...(config as Parameters<typeof TerminalConfigService.mergeConfig>[0]),
      ...fontOverrides,
      theme: resolvedTheme,
    };
    const terminalConfig = TerminalConfigService.mergeConfig(configWithFonts);

    const multiCursorModifier = currentSettings?.multiCursorModifier ?? 'alt';
    const linkModifier: 'alt' | 'ctrlCmd' = multiCursorModifier === 'alt' ? 'alt' : 'ctrlCmd';

    return { terminalConfig, currentSettings, currentFontSettings, linkModifier };
  }

  public applyPostOpenSettings(params: {
    terminalId: string;
    terminal: Terminal;
    container: HTMLElement;
    terminalContent: HTMLElement;
    currentSettings: unknown;
    currentFontSettings: unknown;
    configManager: TerminalConfigManager | undefined;
    uiManager:
      | {
          applyAllVisualSettings?: (terminal: Terminal, settings: unknown) => void;
          applyFontSettings?: (terminal: Terminal, settings: unknown) => void;
        }
      | null
      | undefined;
  }): void {
    const {
      terminalId,
      terminal,
      container,
      terminalContent,
      currentSettings,
      currentFontSettings,
      configManager,
      uiManager,
    } = params;

    try {
      if (!uiManager) {
        return;
      }

      const settingsForVisuals = currentSettings ?? configManager?.getCurrentSettings?.();
      const fontSettingsForApply = currentFontSettings ?? configManager?.getCurrentFontSettings?.();

      terminalLogger.info(
        `🎨 [DEBUG] Immediate settings check - theme: ${(settingsForVisuals as { theme?: string } | undefined)?.theme}`
      );

      if (settingsForVisuals) {
        uiManager.applyAllVisualSettings?.(terminal, settingsForVisuals);
        terminalLogger.info(`✅ Visual settings applied to terminal: ${terminalId}`);
        this.updateContainerBackgrounds(
          terminalId,
          container,
          terminalContent,
          settingsForVisuals as { theme?: string } | null | undefined
        );
      }

      if (fontSettingsForApply) {
        uiManager.applyFontSettings?.(terminal, fontSettingsForApply);
        const fontSettings = fontSettingsForApply as Partial<WebViewFontSettings>;
        terminalLogger.info(
          `✅ Font settings applied to terminal: ${terminalId} (${fontSettings.fontFamily}, ${fontSettings.fontSize}px)`
        );
      }
    } catch (error) {
      terminalLogger.warn(
        '⚠️ Terminal settings application failed; continuing with defaults',
        error
      );
    }
  }

  public schedulePostRendererRefresh(params: {
    terminalId: string;
    terminal: Terminal;
    container: HTMLElement;
    terminalContent: HTMLElement;
    configManager: Pick<IConfigManager, 'getCurrentSettings'> | undefined;
    uiManager:
      | {
          applyTerminalTheme?: (terminal: Terminal, settings: unknown) => void;
        }
      | null
      | undefined;
  }): void {
    const { terminalId, terminal, container, terminalContent, configManager, uiManager } = params;

    setTimeout(() => {
      try {
        const finalSettings = configManager?.getCurrentSettings?.();
        terminalLogger.info(
          `🎨 [DEBUG] Final theme check - currentSettings.theme: ${finalSettings?.theme}`
        );

        if (uiManager && finalSettings) {
          uiManager.applyTerminalTheme?.(terminal, finalSettings);
          terminalLogger.info(`🎨 Final theme re-application for terminal: ${terminalId}`);
          this.updateContainerBackgrounds(terminalId, container, terminalContent, finalSettings);
        }

        terminal.refresh(0, terminal.rows - 1);
        terminalLogger.info(`🔄 Final terminal refresh completed: ${terminalId}`);
      } catch (error) {
        terminalLogger.warn(`⚠️ Final refresh failed for terminal ${terminalId}:`, error);
      }
    }, POST_RENDERER_SETUP_DELAY_MS);
  }

  private resolveCurrentSettings(
    configManager: Pick<IConfigManager, 'getCurrentSettings'> | undefined
  ): PartialTerminalSettings | undefined {
    let currentSettings = configManager?.getCurrentSettings?.();

    if (!currentSettings?.theme || currentSettings.theme === 'auto') {
      const coordinatorSettings = this.dependencies.coordinator.currentSettings;
      if (coordinatorSettings?.theme && coordinatorSettings.theme !== 'auto') {
        currentSettings = { ...currentSettings, ...coordinatorSettings };
        terminalLogger.info(
          `🎨 [THEME] Using coordinator settings (theme: ${coordinatorSettings.theme})`
        );
      }
    }

    return currentSettings;
  }

  private prepareFontSettings(
    config: TerminalConfig | undefined,
    configManager: Pick<IConfigManager, 'getCurrentFontSettings'> | undefined
  ): { fontSettings: WebViewFontSettings | undefined; fontOverrides: Partial<ITerminalOptions> } {
    const currentFontSettings = this.resolveFontSettings(config, configManager);
    const fontOverrides = this.buildFontOverrides(currentFontSettings);
    return { fontSettings: currentFontSettings, fontOverrides };
  }

  /**
   * Resolve the effective font settings from direct config fields, embedded
   * fontSettings, and the config manager fallback (in that precedence order).
   */
  private resolveFontSettings(
    config: TerminalConfig | undefined,
    configManager: Pick<IConfigManager, 'getCurrentFontSettings'> | undefined
  ): WebViewFontSettings | undefined {
    const configFontSettings = (config as { fontSettings?: WebViewFontSettings } | undefined)
      ?.fontSettings;
    const directFontFamily = (config as { fontFamily?: string } | undefined)?.fontFamily;
    const directFontSize = (config as { fontSize?: number } | undefined)?.fontSize;

    if (!directFontFamily && !directFontSize) {
      return configFontSettings ?? configManager?.getCurrentFontSettings?.();
    }

    const fallbackFontSettings = configManager?.getCurrentFontSettings?.();
    return this.buildExplicitFontSettings(
      config,
      configFontSettings,
      fallbackFontSettings,
      directFontFamily,
      directFontSize
    );
  }

  /**
   * Build font settings from explicit config values, layering embedded
   * fontSettings and config-manager fallbacks beneath each direct field.
   */
  private buildExplicitFontSettings(
    config: TerminalConfig | undefined,
    configFontSettings: WebViewFontSettings | undefined,
    fallbackFontSettings: WebViewFontSettings | undefined,
    directFontFamily: string | undefined,
    directFontSize: number | undefined
  ): WebViewFontSettings {
    const directConfig = config as
      | {
          fontWeight?: string;
          fontWeightBold?: string;
          lineHeight?: number;
          letterSpacing?: number;
        }
      | undefined;

    return {
      fontFamily: firstTruthy(
        directFontFamily,
        configFontSettings?.fontFamily,
        fallbackFontSettings?.fontFamily,
        'monospace'
      ),
      fontSize: firstTruthy(
        directFontSize,
        configFontSettings?.fontSize,
        fallbackFontSettings?.fontSize,
        14
      ),
      fontWeight: firstTruthy(
        directConfig?.fontWeight,
        configFontSettings?.fontWeight,
        FontDefaults.FONT_WEIGHT
      ),
      fontWeightBold: firstTruthy(
        directConfig?.fontWeightBold,
        configFontSettings?.fontWeightBold,
        FontDefaults.FONT_WEIGHT_BOLD
      ),
      lineHeight: firstTruthy(
        directConfig?.lineHeight,
        configFontSettings?.lineHeight,
        FontDefaults.LINE_HEIGHT
      ),
      letterSpacing: firstNonNullish(
        directConfig?.letterSpacing,
        configFontSettings?.letterSpacing,
        FontDefaults.LETTER_SPACING
      ),
    };
  }

  /**
   * Build the xterm option overrides for the resolved font settings, applying
   * only values that pass validation.
   */
  private buildFontOverrides(
    currentFontSettings: WebViewFontSettings | undefined
  ): Partial<ITerminalOptions> {
    const fontOverrides: Partial<ITerminalOptions> = {};
    if (!currentFontSettings) {
      return fontOverrides;
    }

    this.applyTypographyOverrides(fontOverrides, currentFontSettings);
    this.applyCursorAndRenderingOverrides(fontOverrides, currentFontSettings);

    return fontOverrides;
  }

  /**
   * Apply validated typography fields (family, size, weight, spacing) to the overrides.
   */
  private applyTypographyOverrides(
    fontOverrides: Partial<ITerminalOptions>,
    currentFontSettings: WebViewFontSettings
  ): void {
    const { fontFamily, fontSize, fontWeight, fontWeightBold, lineHeight, letterSpacing } =
      currentFontSettings;

    if (typeof fontFamily === 'string' && fontFamily.trim()) {
      fontOverrides.fontFamily = fontFamily.trim();
    }
    if (typeof fontSize === 'number' && fontSize > 0) {
      fontOverrides.fontSize = fontSize;
    }
    if (typeof fontWeight === 'string' && fontWeight.trim()) {
      fontOverrides.fontWeight = fontWeight.trim() as ITerminalOptions['fontWeight'];
    }
    if (typeof fontWeightBold === 'string' && fontWeightBold.trim()) {
      fontOverrides.fontWeightBold = fontWeightBold.trim() as ITerminalOptions['fontWeightBold'];
    }
    if (typeof lineHeight === 'number' && lineHeight > 0) {
      fontOverrides.lineHeight = lineHeight;
    }
    if (typeof letterSpacing === 'number') {
      fontOverrides.letterSpacing = letterSpacing;
    }
  }

  /**
   * Apply validated cursor and rendering fields to the overrides.
   */
  private applyCursorAndRenderingOverrides(
    fontOverrides: Partial<ITerminalOptions>,
    currentFontSettings: WebViewFontSettings
  ): void {
    const { cursorStyle, cursorWidth, drawBoldTextInBrightColors, minimumContrastRatio } =
      currentFontSettings;

    if (cursorStyle) {
      fontOverrides.cursorStyle = cursorStyle;
    }
    if (typeof cursorWidth === 'number' && cursorWidth > 0) {
      fontOverrides.cursorWidth = cursorWidth;
    }
    if (typeof drawBoldTextInBrightColors === 'boolean') {
      fontOverrides.drawBoldTextInBrightColors = drawBoldTextInBrightColors;
    }
    if (typeof minimumContrastRatio === 'number') {
      fontOverrides.minimumContrastRatio = minimumContrastRatio;
    }
  }

  private updateContainerBackgrounds(
    terminalId: string,
    container: HTMLElement | null,
    terminalContent: HTMLElement | null,
    settings: { theme?: string } | null | undefined
  ): void {
    if (!settings) {
      return;
    }

    const resolvedTheme = getWebviewTheme(settings);
    const backgroundColor = resolvedTheme.background;

    if (terminalContent) {
      terminalContent.style.backgroundColor = backgroundColor;
    }
    if (container) {
      const xtermElement = container.querySelector<HTMLElement>(`.${CssClasses.XTERM}`);
      if (xtermElement) {
        xtermElement.style.backgroundColor = backgroundColor;
      }
      const viewport = container.querySelector<HTMLElement>(`.${CssClasses.XTERM_VIEWPORT}`);
      if (viewport) {
        viewport.style.backgroundColor = backgroundColor;
      }
    }
    terminalLogger.info(`🎨 Container backgrounds updated: ${terminalId} (${backgroundColor})`);
  }
}
