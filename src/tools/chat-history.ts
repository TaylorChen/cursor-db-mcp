import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const chatHistoryTools: Tool[] = [
  {
    name: 'get_all_conversations',
    description: 'Get all conversations from all workspaces',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of conversations to return',
          default: 50
        }
      }
    }
  },
  {
    name: 'search_conversations',
    description: 'Search conversations across all workspaces',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to look for in conversation titles and messages'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'analyze_conversation',
    description: 'Analyze a specific conversation for code changes and statistics',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'The ID of the conversation to analyze'
        }
      },
      required: ['conversation_id']
    }
  },
  {
    name: 'export_conversations',
    description: 'Export all conversations in specified format',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'csv', 'markdown'],
          description: 'Export format',
          default: 'json'
        },
        conversation_id: {
          type: 'string',
          description: 'Export only the specified conversation id'
        },
        conversation_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Export only the specified conversation ids'
        }
      }
    }
  },
  {
    name: 'analyze_code_statistics',
    description: 'Analyze code statistics across all conversations',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Analyze conversations from the last N days',
          default: 30
        },
        group_by: {
          type: 'string',
          enum: ['day', 'week', 'month', 'language', 'workspace'],
          description: 'Group statistics by time period, language, or workspace',
          default: 'day'
        }
      }
    }
  }
];


