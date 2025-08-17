import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const diagnosticsTools: Tool[] = [
  {
    name: 'diagnose_storage',
    description: 'Diagnose storage keys in each workspace to help locate chat data',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max keys to return per workspace',
          default: 30
        }
      }
    }
  }
];


