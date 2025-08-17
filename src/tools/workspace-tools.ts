import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workspaceTools: Tool[] = [
  {
    name: 'list_workspaces',
    description: 'List all Cursor workspaces with their metadata',
    inputSchema: {
      type: 'object',
      properties: {
        recent_days: {
          type: 'number',
          description: 'Only show workspaces modified in the last N days (optional)'
        }
      }
    }
  },
  {
    name: 'get_workspace_conversations',
    description: 'Get all conversations from a specific workspace',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_hash: {
          type: 'string',
          description: 'The MD5 hash of the workspace folder'
        }
      },
      required: ['workspace_hash']
    }
  }
];


