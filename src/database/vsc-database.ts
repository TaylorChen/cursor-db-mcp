import sqlite3 from 'sqlite3';
import path from 'path';
import { WorkspaceStorage, DatabaseResult } from '../types/cursor-data.js';

export class VSCDatabase {
  private db: sqlite3.Database | null = null;
  private workspace: WorkspaceStorage;

  constructor(workspace: WorkspaceStorage) {
    this.workspace = workspace;
  }

  async connect(): Promise<void> {
    const dbPath = path.join(this.workspace.path, 'state.vscdb');

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`Failed to connect to workspace database: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async getChatData(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not connected' };
    }

    // Try known legacy key first; fall back to heuristic search
    return new Promise((resolve) => {
      const tryLegacy = `SELECT value FROM ItemTable WHERE [key] = 'workbench.panel.aichat.view.aichat.chatdata'`;
      this.db!.get(tryLegacy, [], (legacyErr, legacyRow: any) => {
        if (!legacyErr && legacyRow) {
          try {
            const chatData = JSON.parse(legacyRow.value);
            return resolve({ success: true, data: chatData });
          } catch (parseErr) {
            return resolve({ success: false, error: `Failed to parse chat data: ${parseErr}` });
          }
        }

        // Heuristic: find any row whose JSON contains conversations/messages
        const searchQuery = `
          SELECT [key], value, length(value) AS len
          FROM ItemTable
          WHERE value LIKE '%"conversations"%'
             OR value LIKE '%"messages"%'
             OR value LIKE '%"assistant"%'
             OR value LIKE '%"role":"assistant"%'
          ORDER BY len DESC
          LIMIT 1
        `;
        this.db!.get(searchQuery, [], (err, row: any) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else if (!row) {
            resolve({ success: true, data: null });
          } else {
            try {
              const parsed = JSON.parse(row.value);
              resolve({ success: true, data: parsed });
            } catch (parseErr) {
              resolve({ success: false, error: `Failed to parse chat-like data from key ${row.key}: ${parseErr}` });
            }
          }
        });
      });
    });
  }

  async getComposerData(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not connected' };
    }

    return new Promise((resolve) => {
      const query = `
        SELECT value 
        FROM ItemTable 
        WHERE [key] = 'aiService.prompts'
      `;

      this.db!.get(query, [], (err, row: any) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else if (!row) {
          resolve({ success: true, data: null });
        } else {
          try {
            const composerData = JSON.parse(row.value);
            resolve({ success: true, data: composerData });
          } catch (parseErr) {
            resolve({ success: false, error: `Failed to parse composer data: ${parseErr}` });
          }
        }
      });
    });
  }

  async getAIGenerations(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not connected' };
    }

    return new Promise((resolve) => {
      const query = `
        SELECT value 
        FROM ItemTable 
        WHERE [key] = 'aiService.generations'
      `;

      this.db!.get(query, [], (err, row: any) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else if (!row) {
          resolve({ success: true, data: null });
        } else {
          try {
            const gens = JSON.parse(row.value);
            resolve({ success: true, data: gens });
          } catch (parseErr) {
            resolve({ success: false, error: `Failed to parse aiService.generations: ${parseErr}` });
          }
        }
      });
    });
  }

  async getAIPrompts(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not connected' };
    }

    return new Promise((resolve) => {
      const query = `
        SELECT value 
        FROM ItemTable 
        WHERE [key] = 'aiService.prompts'
      `;

      this.db!.get(query, [], (err, row: any) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else if (!row) {
          resolve({ success: true, data: null });
        } else {
          try {
            const prompts = JSON.parse(row.value);
            resolve({ success: true, data: prompts });
          } catch (parseErr) {
            resolve({ success: false, error: `Failed to parse aiService.prompts: ${parseErr}` });
          }
        }
      });
    });
  }

  async getAllStorageData(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not connected' };
    }

    return new Promise((resolve) => {
      const query = `
        SELECT [key], value 
        FROM ItemTable 
        ORDER BY [key]
      `;

      this.db!.all(query, [], (err, rows: any[]) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          const data: Record<string, any> = {};
          rows.forEach(row => {
            try {
              data[row.key] = JSON.parse(row.value);
            } catch {
              data[row.key] = row.value;
            }
          });
          resolve({ success: true, data });
        }
      });
    });
  }

  async searchInData(searchTerm: string): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not connected' };
    }

    return new Promise((resolve) => {
      const query = `
        SELECT [key], value 
        FROM ItemTable 
        WHERE value LIKE ?
        ORDER BY [key]
      `;

      const searchPattern = `%${searchTerm}%`;
      this.db!.all(query, [searchPattern], (err, rows: any[]) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          const results = rows.map(row => ({
            key: row.key,
            value: row.value
          }));
          resolve({ success: true, data: results });
        }
      });
    });
  }
}


