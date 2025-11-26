import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ExecuteScriptResult } from './types';

const execAsync = promisify(exec);

export class ScriptManager {
  private scriptsDir: string;
  private projectRoot: string;

  constructor(scriptsDir: string) {
    this.scriptsDir = scriptsDir;
    this.projectRoot = path.join(scriptsDir, '..');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.scriptsDir)) {
      fs.mkdirSync(this.scriptsDir, { recursive: true });
    }
  }

  private normalizeFilename(name: string): string {
    return name.endsWith('.ts') ? name : `${name}.ts`;
  }

  private getFilepath(name: string): string {
    return path.join(this.scriptsDir, this.normalizeFilename(name));
  }

  save(name: string, code: string): { filename: string; path: string } {
    const filename = this.normalizeFilename(name);
    const filepath = this.getFilepath(name);
    fs.writeFileSync(filepath, code);
    return { filename, path: filepath };
  }

  exists(name: string): boolean {
    return fs.existsSync(this.getFilepath(name));
  }

  async execute(name: string, timeoutMs = 60000): Promise<ExecuteScriptResult> {
    const filepath = this.getFilepath(name);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Script not found: ${name}`);
    }

    const { stdout, stderr } = await execAsync(`npx ts-node "${filepath}"`, {
      cwd: this.projectRoot,
      timeout: timeoutMs,
    });

    return { stdout, stderr };
  }

  list(): string[] {
    return fs.readdirSync(this.scriptsDir).filter((f) => f.endsWith('.ts'));
  }

  delete(name: string): boolean {
    const filepath = this.getFilepath(name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  read(name: string): string {
    const filepath = this.getFilepath(name);
    if (!fs.existsSync(filepath)) {
      throw new Error(`Script not found: ${name}`);
    }
    return fs.readFileSync(filepath, 'utf-8');
  }
}
