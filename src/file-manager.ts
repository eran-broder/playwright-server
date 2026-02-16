import * as fs from 'fs';
import * as path from 'path';

/**
 * Supported file extensions for managed files.
 */
export type ManagedExtension = '.ts' | '.png' | '.js' | '.json';

/**
 * A filename guaranteed to end with the specified extension.
 * Example: Filename<'.png'> = `screenshot-123.png`
 */
export type Filename<TExt extends ManagedExtension> = `${string}${TExt}`;

/**
 * Result of a file operation with properly typed filename.
 */
export interface FileResult<TExt extends ManagedExtension> {
  filename: Filename<TExt>;
  path: string;
}

/**
 * Generic file manager for a specific extension type.
 * Provides type-safe file operations with extension enforcement.
 */
export abstract class FileManager<TExt extends ManagedExtension> {
  protected readonly directory: string;
  protected readonly extension: TExt;

  constructor(directory: string, extension: TExt) {
    this.directory = directory;
    this.extension = extension;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  /**
   * Normalizes filename to include extension.
   * Idempotent: if already has extension, returns as-is.
   */
  protected normalizeFilename(name: string): Filename<TExt> {
    if (name.endsWith(this.extension)) {
      return name as Filename<TExt>;
    }
    return `${name}${this.extension}` as Filename<TExt>;
  }

  /**
   * Full filesystem path for a file.
   */
  getFilepath(name: string): string {
    return path.join(this.directory, this.normalizeFilename(name));
  }

  /**
   * Check if file exists.
   */
  exists(name: string): boolean {
    return fs.existsSync(this.getFilepath(name));
  }

  /**
   * List all files with this extension.
   * Returns typed filenames.
   */
  list(): Filename<TExt>[] {
    if (!fs.existsSync(this.directory)) {
      return [];
    }
    return fs.readdirSync(this.directory)
      .filter((f): f is Filename<TExt> => f.endsWith(this.extension));
  }

  /**
   * Delete a file. Returns true if deleted, false if not found.
   */
  delete(name: string): boolean {
    const filepath = this.getFilepath(name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  /**
   * Get result object with typed filename and path.
   */
  getResult(name: string): FileResult<TExt> {
    const filename = this.normalizeFilename(name);
    return {
      filename,
      path: path.join(this.directory, filename),
    };
  }

  /**
   * Get the managed directory path.
   */
  getDirectory(): string {
    return this.directory;
  }
}
