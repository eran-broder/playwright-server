import type { ServerConfig } from './types';
import { BrowserManager } from './browser-manager';
import { ActivityRecorder } from './activity-recorder';
import { ScriptManager } from './script-manager';
import { ScreenshotManager } from './screenshot-manager';
import type { Relay } from './relay/relay';

export interface Services {
  config: ServerConfig;
  browserManager: BrowserManager;
  activityRecorder: ActivityRecorder;
  scriptManager: ScriptManager;
  screenshotManager: ScreenshotManager;
  relay: Relay | null;
}

export const createServices = (config: ServerConfig, relay: Relay | null): Services => {
  const browserManager = new BrowserManager(relay);
  const activityRecorder = new ActivityRecorder();
  browserManager.setOnPageCreated((page) => activityRecorder.attach(page));
  return {
    config,
    browserManager,
    activityRecorder,
    scriptManager: new ScriptManager(config.scriptsDir),
    screenshotManager: new ScreenshotManager(config.screenshotsDir),
    relay,
  };
};
