import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileManager, type FileResult } from './file-manager';
import type { ExecuteScriptResult } from './types';

const execAsync = promisify(exec);

export class ScriptManager extends FileManager<'.ts'> {
  private readonly projectRoot: string;

  constructor(scriptsDir: string) {
    super(scriptsDir, '.ts');
    this.projectRoot = path.join(scriptsDir, '..');
  }

  /**
   * Save a script to the scripts directory.
   */
  save(name: string, code: string): FileResult<'.ts'> {
    const filepath = this.getFilepath(name);
    fs.writeFileSync(filepath, code);
    return this.getResult(name);
  }

  /**
   * Execute a saved script using ts-node.
   */
  async execute(name: string, timeoutMs = 60000): Promise<ExecuteScriptResult> {
    if (!this.exists(name)) {
      throw new Error(`Script not found: ${name}`);
    }

    const filepath = this.getFilepath(name);
    const { stdout, stderr } = await execAsync(`npx ts-node "${filepath}"`, {
      cwd: this.projectRoot,
      timeout: timeoutMs,
    });

    return { stdout, stderr };
  }

  /**
   * Read script contents.
   */
  read(name: string): string {
    if (!this.exists(name)) {
      throw new Error(`Script not found: ${name}`);
    }
    return fs.readFileSync(this.getFilepath(name), 'utf-8');
  }
}
