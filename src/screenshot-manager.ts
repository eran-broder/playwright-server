import * as fs from 'fs';
import * as path from 'path';
import type { ScreenshotResult } from './types';

export class ScreenshotManager {
  private screenshotsDir: string;

  constructor(screenshotsDir: string) {
    this.screenshotsDir = screenshotsDir;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  private normalizeFilename(name: string): string {
    return name.endsWith('.png') ? name : `${name}.png`;
  }

  getFilepath(name: string): string {
    return path.join(this.screenshotsDir, this.normalizeFilename(name));
  }

  generateName(): string {
    return `screenshot-${Date.now()}`;
  }

  getResult(name: string): ScreenshotResult {
    const filename = this.normalizeFilename(name);
    return {
      filename,
      path: path.join(this.screenshotsDir, filename),
    };
  }

  exists(name: string): boolean {
    return fs.existsSync(this.getFilepath(name));
  }

  list(): string[] {
    return fs.readdirSync(this.screenshotsDir).filter((f) => f.endsWith('.png'));
  }

  delete(name: string): boolean {
    const filepath = this.getFilepath(name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  getDirectory(): string {
    return this.screenshotsDir;
  }
}
