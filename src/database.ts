import { WorkspaceScanner } from './database/workspace-scanner.js';
import { VSCDatabase } from './database/vsc-database.js';
import { ChatParser } from './database/chat-parser.js';
import { WorkspaceStorage, ChatConversation, DatabaseResult } from './types/cursor-data.js';

export class CursorDatabase {
  private scanner: WorkspaceScanner;
  private workspaces: WorkspaceStorage[] = [];

  constructor(customPath?: string) {
    this.scanner = new WorkspaceScanner(customPath);
  }

  async initialize(): Promise<void> {
    this.workspaces = await this.scanner.scanWorkspaces();
  }

  async getAllWorkspaces(): Promise<DatabaseResult> {
    try {
      await this.initialize();
      return {
        success: true,
        data: this.workspaces,
        totalWorkspaces: this.workspaces.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getRecentWorkspaces(days = 7): Promise<DatabaseResult> {
    try {
      const recentWorkspaces = await this.scanner.getWorkspacesByAge(days);
      return {
        success: true,
        data: recentWorkspaces,
        totalWorkspaces: recentWorkspaces.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getAllConversations(): Promise<DatabaseResult> {
    try {
      await this.initialize();
      const allConversations: ChatConversation[] = [];

      for (const workspace of this.workspaces) {
        const db = new VSCDatabase(workspace);
        try {
          await db.connect();
          const chatResult = await db.getChatData();

          if (chatResult.success && chatResult.data) {
            const conversations = ChatParser.parseConversations(chatResult.data);
            conversations.forEach(conv => { conv.workspaceFolder = workspace.projectPath; });
            allConversations.push(...conversations);
          } else {
            // Fallback: try to synthesize conversations from aiService.generations (timeline of prompts)
            const gensResult = await db.getAIGenerations();
            const promptsResult = await db.getAIPrompts();
            if (gensResult.success && Array.isArray(gensResult.data) && gensResult.data.length > 0) {
              const gens = gensResult.data as any[];
              const prompts = Array.isArray(promptsResult.data) ? (promptsResult.data as any[]) : [];

              // Heuristic pairing: for each generation prompt, pair a nearest prompt text as assistant reply (if exists)
              const pairedMessages = [] as any[];
              for (let i = 0; i < gens.length; i++) {
                const g = gens[i];
                pairedMessages.push({
                  id: g.generationUUID || `gen-${i}`,
                  type: 'user',
                  text: g.textDescription || JSON.stringify(g),
                  createdAt: new Date((g.unixMs) || Date.now()).toISOString()
                });

                // try to pick a prompt as assistant reply if available
                const maybe = prompts[i];
                if (maybe && typeof maybe.text === 'string') {
                  pairedMessages.push({
                    id: `assistant-${g.generationUUID || i}`,
                    type: 'assistant',
                    text: maybe.text,
                    createdAt: new Date(((g.unixMs || 0) + 1)).toISOString()
                  });
                }
              }

              const synthetic = {
                conversations: [
                  {
                    id: `gens-${workspace.hash}`,
                    title: `AI Generations (${workspace.hash.slice(0,6)})`,
                    createdAt: new Date(Math.min(...gens.map((g: any)=>g.unixMs||Date.now()))).toISOString(),
                    updatedAt: new Date(Math.max(...gens.map((g: any)=>g.unixMs||Date.now()))).toISOString(),
                    messages: pairedMessages
                  }
                ]
              };
              const conversations = ChatParser.parseConversations(synthetic);
              conversations.forEach(conv => { conv.workspaceFolder = workspace.projectPath; });
              allConversations.push(...conversations);
            }
          }
        } catch (error) {
          console.error(`Error processing workspace ${workspace.hash}:`, error);
        } finally {
          await db.disconnect();
        }
      }

      allConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return {
        success: true,
        data: allConversations,
        totalWorkspaces: this.workspaces.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getWorkspaceConversations(workspaceHash: string): Promise<DatabaseResult> {
    try {
      await this.initialize();
      const workspace = this.workspaces.find(w => w.hash === workspaceHash);
      if (!workspace) {
        return { success: false, error: `Workspace not found: ${workspaceHash}` };
      }

      const db = new VSCDatabase(workspace);
      const conversations: ChatConversation[] = [];
      try {
        await db.connect();
        const chatResult = await db.getChatData();
        if (chatResult.success && chatResult.data) {
          const parsed = ChatParser.parseConversations(chatResult.data);
          parsed.forEach(conv => { conv.workspaceFolder = workspace.projectPath; });
          conversations.push(...parsed);
        } else {
          const gensResult = await db.getAIGenerations();
          if (gensResult.success && Array.isArray(gensResult.data) && gensResult.data.length > 0) {
            const synthetic = {
              conversations: [
                {
                  id: `gens-${workspace.hash}`,
                  title: `AI Generations (${workspace.hash.slice(0,6)})`,
                  createdAt: new Date(Math.min(...gensResult.data.map((g: any)=>g.unixMs||Date.now()))).toISOString(),
                  updatedAt: new Date(Math.max(...gensResult.data.map((g: any)=>g.unixMs||Date.now()))).toISOString(),
                  messages: gensResult.data.map((g: any, idx: number)=>({
                    id: g.generationUUID || `gen-${idx}`,
                    type: 'user',
                    text: g.textDescription || JSON.stringify(g),
                    createdAt: new Date((g.unixMs)||Date.now()).toISOString()
                  }))
                }
              ]
            };
            const parsed = ChatParser.parseConversations(synthetic);
            parsed.forEach(conv => { conv.workspaceFolder = workspace.projectPath; });
            conversations.push(...parsed);
          }
        }
      } finally {
        await db.disconnect();
      }

      conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return { success: true, data: conversations, totalWorkspaces: 1 };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async searchConversations(searchTerm: string, limit = 20): Promise<DatabaseResult> {
    try {
      const allConversationsResult = await this.getAllConversations();
      if (!allConversationsResult.success) {
        return allConversationsResult;
      }

      const conversations = allConversationsResult.data as ChatConversation[];
      const filtered = conversations.filter(conv =>
        conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.messages.some(msg => msg.text.toLowerCase().includes(searchTerm.toLowerCase()))
      ).slice(0, limit);

      return {
        success: true,
        data: filtered,
        totalWorkspaces: this.workspaces.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async analyzeConversation(conversationId: string): Promise<DatabaseResult> {
    try {
      const allConversationsResult = await this.getAllConversations();
      if (!allConversationsResult.success) {
        return allConversationsResult;
      }

      const conversations = allConversationsResult.data as ChatConversation[];
      const conversation = conversations.find(c => c.id === conversationId);

      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      const codeAnalysis = ChatParser.analyzeCodeChanges(conversation.messages);

      return {
        success: true,
        data: {
          conversation,
          analysis: {
            messageCount: conversation.messages.length,
            userMessages: conversation.messages.filter(m => m.type === 'user').length,
            assistantMessages: conversation.messages.filter(m => m.type === 'assistant').length,
            codeBlocks: conversation.messages.reduce((acc, msg) => acc + (msg.codeBlocks?.length || 0), 0),
            ...codeAnalysis
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async exportConversations(
    format: 'json' | 'csv' | 'markdown' = 'json',
    opts?: { conversation_id?: string; conversation_ids?: string[] }
  ): Promise<DatabaseResult> {
    try {
      const conversationsResult = await this.getAllConversations();
      if (!conversationsResult.success) {
        return conversationsResult;
      }

      let conversations = conversationsResult.data as ChatConversation[];
      if (opts?.conversation_id) {
        conversations = conversations.filter(c => c.id === opts.conversation_id);
      }
      if (opts?.conversation_ids && opts.conversation_ids.length) {
        const set = new Set(opts.conversation_ids);
        conversations = conversations.filter(c => set.has(c.id));
      }
      let exportData: string;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(conversations, null, 2);
          break;
        case 'csv':
          exportData = this.convertToCSV(conversations);
          break;
        case 'markdown':
          exportData = this.convertToMarkdown(conversations);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return {
        success: true,
        data: {
          format,
          content: exportData,
          conversationCount: conversations.length,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private convertToCSV(conversations: ChatConversation[]): string {
    const headers = ['ID', 'Title', 'Created', 'Updated', 'Messages', 'Workspace'];
    const rows = conversations.map(conv => [
      conv.id,
      `"${conv.title.replace(/"/g, '""')}"`,
      conv.createdAt,
      conv.updatedAt,
      conv.messages.length.toString(),
      conv.workspaceFolder || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToMarkdown(conversations: ChatConversation[]): string {
    let markdown = '# Cursor Chat History Export\n\n';
    markdown += `Exported: ${new Date().toISOString()}\n`;
    markdown += `Total Conversations: ${conversations.length}\n\n`;

    conversations.forEach(conv => {
      markdown += `## ${conv.title}\n\n`;
      markdown += `- **ID**: ${conv.id}\n`;
      markdown += `- **Created**: ${conv.createdAt}\n`;
      markdown += `- **Updated**: ${conv.updatedAt}\n`;
      markdown += `- **Workspace**: ${conv.workspaceFolder || 'Unknown'}\n`;
      markdown += `- **Messages**: ${conv.messages.length}\n\n`;

      conv.messages.forEach((msg, idx) => {
        markdown += `### Message ${idx + 1} (${msg.type})\n\n`;
        markdown += `${msg.text}\n\n`;

        if (msg.codeBlocks && msg.codeBlocks.length > 0) {
          msg.codeBlocks.forEach(block => {
            markdown += `\`\`\`${block.language}\n${block.code}\n\`\`\`\n\n`;
          });
        }
      });

      markdown += '---\n\n';
    });

    return markdown;
  }
}


