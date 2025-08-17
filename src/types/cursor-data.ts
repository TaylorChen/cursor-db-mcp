export interface WorkspaceStorage {
  path: string;
  hash: string;
  lastModified: Date;
  projectPath?: string;
}

export interface CursorChatData {
  id: string;
  conversations: ChatConversation[];
  version?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  workspaceFolder?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  createdAt: string;
  bubbleId?: string;
  contextFiles?: ContextFile[];
  codeBlocks?: CodeBlock[];
}

export interface ComposerData {
  sessions: ComposerSession[];
  prompts: ComposerPrompt[];
}

export interface ComposerSession {
  id: string;
  title: string;
  messages: ComposerMessage[];
  createdAt: string;
  files: string[];
}

export interface ComposerMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  changes?: FileChange[];
}

export interface ComposerPrompt {
  id?: string;
  title?: string;
  content?: string;
}

export interface FileChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  additions: number;
  deletions: number;
  content?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  startLine?: number;
  endLine?: number;
}

export interface ContextFile {
  path: string;
  content: string;
  language: string;
}

export interface DatabaseResult {
  success: boolean;
  data?: any;
  error?: string;
  workspaces?: WorkspaceStorage[];
  totalWorkspaces?: number;
}


