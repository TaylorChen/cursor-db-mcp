import { ChatConversation, ChatMessage, CodeBlock, FileChange } from '../types/cursor-data.js';

export class ChatParser {
  static parseConversations(chatData: any): ChatConversation[] {
    if (!chatData || !Array.isArray(chatData.conversations)) {
      return [];
    }

    return chatData.conversations.map((conv: any) => ({
      id: conv.id || this.generateId(),
      title: conv.title || 'Untitled Conversation',
      messages: this.parseMessages(conv.messages || []),
      createdAt: conv.createdAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString(),
      workspaceFolder: conv.workspaceFolder
    }));
  }

  static fromRoleMessages(roleMessages: any[]): ChatConversation[] {
    if (!Array.isArray(roleMessages)) return [];
    const messages: ChatMessage[] = roleMessages
      .filter((m: any) => typeof m === 'object' && m)
      .map((m: any, idx: number) => ({
        id: m.id || `msg-${idx}`,
        type: (m.role === 'user' ? 'user' : 'assistant'),
        text: m.content || m.text || '',
        createdAt: new Date(m.unixMs || Date.now()).toISOString(),
        bubbleId: m.bubbleId,
        contextFiles: this.parseContextFiles(m.contextFiles),
        codeBlocks: this.extractCodeBlocks(m.content || m.text || '')
      }));
    const now = new Date().toISOString();
    return [{
      id: `conv-${Math.random().toString(36).slice(2)}`,
      title: 'Imported Conversation',
      createdAt: now,
      updatedAt: now,
      messages
    }];
  }

  static parseMessages(messagesData: any[]): ChatMessage[] {
    return messagesData.map((msg: any) => ({
      id: msg.id || this.generateId(),
      type: msg.type === 'user' ? 'user' : 'assistant',
      text: msg.text || '',
      createdAt: msg.createdAt || new Date().toISOString(),
      bubbleId: msg.bubbleId,
      contextFiles: this.parseContextFiles(msg.contextFiles),
      codeBlocks: this.extractCodeBlocks(msg.text || '')
    }));
  }

  static parseContextFiles(contextFiles: any[]): any[] {
    if (!Array.isArray(contextFiles)) return [];

    return contextFiles.map((file: any) => ({
      path: file.path || '',
      content: file.content || '',
      language: file.language || 'text'
    }));
  }

  static extractCodeBlocks(text: string): CodeBlock[] {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        filename: this.extractFilename(match[2])
      });
    }

    return blocks;
  }

  static extractFilename(code: string): string | undefined {
    const lines = code.split('\n');
    const firstLine = lines[0]?.trim();

    if (firstLine && /^\/\*.*\*\/$/.test(firstLine)) {
      return firstLine.replace(/^\/\*\s*|\s*\*\/$/g, '');
    }

    if (firstLine && /\.(js|ts|py|java|cpp|html|css|json)$/.test(firstLine)) {
      return firstLine;
    }

    return undefined;
  }

  static analyzeCodeChanges(messages: ChatMessage[]): {
    totalLinesAdded: number;
    totalLinesModified: number;
    totalLinesDeleted: number;
    fileChanges: FileChange[];
  } {
    let totalLinesAdded = 0;
    let totalLinesModified = 0;
    let totalLinesDeleted = 0;
    const fileChanges: FileChange[] = [];

    for (let i = 0; i < messages.length - 1; i++) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];

      if (userMsg.type === 'user' && assistantMsg.type === 'assistant') {
        const userBlocks = userMsg.codeBlocks || [];
        const assistantBlocks = assistantMsg.codeBlocks || [];

        assistantBlocks.forEach(block => {
          const lines = block.code.split('\n').length;
          const filename = block.filename || `unnamed.${block.language}`;

          const userBlock = userBlocks.find(ub => ub.language === block.language || ub.filename === block.filename);

          if (userBlock) {
            const userLines = userBlock.code.split('\n').length;
            const diff = lines - userLines;

            if (diff > 0) {
              totalLinesAdded += diff;
            } else {
              totalLinesModified += Math.abs(diff);
            }

            fileChanges.push({
              file: filename,
              type: 'modify',
              additions: Math.max(0, diff),
              deletions: Math.max(0, -diff)
            });
          } else {
            totalLinesAdded += lines;
            fileChanges.push({
              file: filename,
              type: 'create',
              additions: lines,
              deletions: 0,
              content: block.code
            });
          }
        });
      }
    }

    return {
      totalLinesAdded,
      totalLinesModified,
      totalLinesDeleted,
      fileChanges
    };
  }

  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}


