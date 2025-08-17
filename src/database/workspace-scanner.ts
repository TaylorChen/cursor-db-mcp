import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceStorage } from '../types/cursor-data.js';

export class WorkspaceScanner {
  private workspaceStoragePath: string;

  constructor(customPath?: string) {
    this.workspaceStoragePath = customPath || this.getDefaultWorkspaceStoragePath();
  }

  private getDefaultWorkspaceStoragePath(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'darwin':
        return path.join(homeDir, 'Library/Application Support/Cursor/User/workspaceStorage');
      case 'win32':
        return path.join(homeDir, 'AppData/Roaming/Cursor/User/workspaceStorage');
      case 'linux':
        return path.join(homeDir, '.config/Cursor/User/workspaceStorage');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async scanWorkspaces(): Promise<WorkspaceStorage[]> {
    try {
      const entries = await fs.readdir(this.workspaceStoragePath);
      const workspaces: WorkspaceStorage[] = [];

      for (const entry of entries) {
        const fullPath = path.join(this.workspaceStoragePath, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory() && this.isValidMD5(entry)) {
          const dbPath = path.join(fullPath, 'state.vscdb');

          try {
            await fs.access(dbPath);
            const dbStat = await fs.stat(dbPath);

            workspaces.push({
              path: fullPath,
              hash: entry,
              lastModified: dbStat.mtime,
              projectPath: await this.extractProjectPath(fullPath)
            });
          } catch {
          }
        }
      }

      return workspaces.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      throw new Error(`Failed to scan workspaces: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isValidMD5(str: string): boolean {
    return /^[a-f0-9]{32}$/i.test(str);
  }

  private async extractProjectPath(workspacePath: string): Promise<string | undefined> {
    // Try workspace.json (observed in Cursor workspaceStorage)
    const workspaceJsonPath = path.join(workspacePath, 'workspace.json');
    try {
      const content = await fs.readFile(workspaceJsonPath, 'utf-8');
      const ws = JSON.parse(content);
      return ws.folder || ws.workspace?.folder || ws.workspaceFolder;
    } catch {}

    // Fallback to storage.json (older docs)
    const storageJsonPath = path.join(workspacePath, 'storage.json');
    try {
      const storageContent = await fs.readFile(storageJsonPath, 'utf-8');
      const storage = JSON.parse(storageContent);
      return storage.folder || storage.workspace?.folder;
    } catch {}

    return undefined;
  }

  async getLatestWorkspace(): Promise<WorkspaceStorage | null> {
    const workspaces = await this.scanWorkspaces();
    return workspaces.length > 0 ? workspaces[0] : null;
  }

  async getWorkspacesByAge(days = 30): Promise<WorkspaceStorage[]> {
    const workspaces = await this.scanWorkspaces();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return workspaces.filter(ws => ws.lastModified >= cutoffDate);
  }

  async findWorkspacesByProjectPath(projectPath: string): Promise<WorkspaceStorage[]> {
    const workspaces = await this.scanWorkspaces();
    return workspaces.filter(ws => ws.projectPath && ws.projectPath.includes(path.basename(projectPath)));
  }
}


