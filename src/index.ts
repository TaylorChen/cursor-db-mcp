#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Command } from 'commander';
import { CursorDatabase } from './database.js';
import { chatHistoryTools } from './tools/chat-history.js';
import { workspaceTools } from './tools/workspace-tools.js';
import { diagnosticsTools } from './tools/diagnostics.js';

const program = new Command();

program
  .name('cursor-db-mcp')
  .description('MCP Server for Cursor IDE database access (new workspaceStorage format)')
  .version('2.0.0')
  .option('--workspace-path <path>', 'Custom path to Cursor workspaceStorage directory')
  .option('--port <port>', 'Port to run the server on (for HTTP transport)')
  .parse();

const options = program.opts();

class CursorMCPServer {
  private server: Server;
  private database: CursorDatabase;

  constructor(workspacePath?: string) {
    this.server = new Server(
      {
        name: 'cursor-db-mcp',
        version: '2.0.0'
  },
  {
    capabilities: {
          tools: {}
        }
      }
    );

    this.database = new CursorDatabase(workspacePath);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: [...chatHistoryTools, ...workspaceTools, ...diagnosticsTools] };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params as any;

      try {
        switch (name) {
          case 'list_workspaces': {
            const { recent_days } = args as any;
            let result;
            if (recent_days) {
              result = await this.database.getRecentWorkspaces(recent_days);
            } else {
              result = await this.database.getAllWorkspaces();
            }
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_workspace_conversations': {
            const { workspace_hash } = args as any;
            if (!workspace_hash) throw new Error('workspace_hash is required');
            const result = await this.database.getWorkspaceConversations(workspace_hash);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'get_all_conversations': {
            const { limit = 50 } = args as any;
            const result = await this.database.getAllConversations();
            if (result.success && Array.isArray(result.data)) {
              const limitedData = result.data.slice(0, limit);
              return { content: [{ type: 'text', text: JSON.stringify({ ...result, data: limitedData }, null, 2) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'search_conversations': {
            const { query, limit = 20 } = args as any;
            if (!query) throw new Error('query is required');
            const result = await this.database.searchConversations(query, limit);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'analyze_conversation': {
            const { conversation_id } = args as any;
            if (!conversation_id) throw new Error('conversation_id is required');
            const result = await this.database.analyzeConversation(conversation_id);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'export_conversations': {
            const { format = 'json', conversation_id, conversation_ids } = args as any;
            const result = await this.database.exportConversations(format, { conversation_id, conversation_ids });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'analyze_code_statistics': {
            const { days = 30, group_by = 'day' } = args as any;
            const result = await this.analyzeCodeStatistics(days, group_by);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'diagnose_storage': {
            const { limit = 30 } = args as any;
            const result = await this.diagnoseStorage(limit);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        } as any;
      }
    });
  }

  private async analyzeCodeStatistics(days: number, groupBy: string) {
    try {
      const conversationsResult = await this.database.getAllConversations();
      if (!conversationsResult.success) return conversationsResult;

      const conversations = conversationsResult.data as any[];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentConversations = conversations.filter((conv: any) => new Date(conv.updatedAt) >= cutoffDate);

      const statistics = {
        totalConversations: recentConversations.length,
        totalMessages: 0,
        totalCodeBlocks: 0,
        totalLinesAdded: 0,
        totalLinesModified: 0,
        totalLinesDeleted: 0,
        languageStats: {} as Record<string, any>,
        workspaceStats: {} as Record<string, any>,
        dailyStats: {} as Record<string, any>,
        fileChanges: [] as any[]
      };

      for (const conversation of recentConversations) {
        statistics.totalMessages += conversation.messages.length;
        const analysisResult = await this.database.analyzeConversation(conversation.id);
        if (analysisResult.success && analysisResult.data) {
          const analysis = (analysisResult.data as any).analysis;
          statistics.totalCodeBlocks += analysis.codeBlocks;
          statistics.totalLinesAdded += analysis.totalLinesAdded;
          statistics.totalLinesModified += analysis.totalLinesModified;
          statistics.totalLinesDeleted += analysis.totalLinesDeleted;

          const workspace = conversation.workspaceFolder || 'Unknown';
          if (!statistics.workspaceStats[workspace]) {
            statistics.workspaceStats[workspace] = { conversations: 0, linesAdded: 0, linesModified: 0, linesDeleted: 0 };
          }
          statistics.workspaceStats[workspace].conversations++;
          statistics.workspaceStats[workspace].linesAdded += analysis.totalLinesAdded;
          statistics.workspaceStats[workspace].linesModified += analysis.totalLinesModified;
          statistics.workspaceStats[workspace].linesDeleted += analysis.totalLinesDeleted;

          if (analysis.fileChanges) {
            analysis.fileChanges.forEach((change: any) => {
              const extension = change.file.split('.').pop() || 'unknown';
              if (!statistics.languageStats[extension]) {
                statistics.languageStats[extension] = { files: 0, linesAdded: 0, linesModified: 0, linesDeleted: 0 };
              }
              statistics.languageStats[extension].files++;
              statistics.languageStats[extension].linesAdded += change.additions;
              statistics.languageStats[extension].linesDeleted += change.deletions;
            });
            statistics.fileChanges.push(...analysis.fileChanges);
          }

          const day = conversation.updatedAt.split('T')[0];
          if (!statistics.dailyStats[day]) {
            statistics.dailyStats[day] = { conversations: 0, messages: 0, linesAdded: 0, linesModified: 0, linesDeleted: 0 };
          }
          statistics.dailyStats[day].conversations++;
          statistics.dailyStats[day].messages += conversation.messages.length;
          statistics.dailyStats[day].linesAdded += analysis.totalLinesAdded;
          statistics.dailyStats[day].linesModified += analysis.totalLinesModified;
          statistics.dailyStats[day].linesDeleted += analysis.totalLinesDeleted;
        }
      }

      return { success: true, data: { period: `${days} days`, groupBy, statistics, generatedAt: new Date().toISOString() } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async diagnoseStorage(limit: number) {
    try {
      const conversationsResult = await this.database.getAllWorkspaces();
      if (!conversationsResult.success) return conversationsResult;
      const workspaces = (conversationsResult.data as any[]) || [];

      const sqlite3 = (await import('sqlite3')).default;
      const path = (await import('path')).default;

      const summary: any[] = [];
      for (const ws of workspaces) {
        const dbPath = path.join(ws.path, 'state.vscdb');
        const db = new sqlite3.Database(dbPath);
        const rows: any = await new Promise((resolve) => {
          const q = `SELECT [key], length(value) AS len FROM ItemTable ORDER BY len DESC LIMIT ?`;
          db.all(q, [limit], (err, result) => {
            db.close(() => resolve(err ? [] : result));
          });
        });
        summary.push({ workspace: ws.hash, projectPath: ws.projectPath || null, topKeys: rows });
      }

      return { success: true, data: summary };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async start() {
    try {
      await this.database.initialize();
      console.error('Initialized Cursor workspace scanner');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Cursor MCP Server (v2.0) running on stdio');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
  }
}

async function main() {
  const server = new CursorMCPServer(options.workspacePath);
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
  await server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CursorMCPServer };
