import { FileManager } from './file-manager';
import type { ScreenshotResult } from './types';

export class ScreenshotManager extends FileManager<'.png'> {
  constructor(screenshotsDir: string) {
    super(screenshotsDir, '.png');
  }

  /**
   * Generate a unique screenshot name based on timestamp.
   */
  generateName(): string {
    return `screenshot-${Date.now()}`;
  }

  /**
   * Get result compatible with ScreenshotResult type.
   * The base FileResult<'.png'> is assignable to ScreenshotResult.
   */
  override getResult(name: string): ScreenshotResult {
    return super.getResult(name);
  }
}
