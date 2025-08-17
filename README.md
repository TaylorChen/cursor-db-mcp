# cursor-db-mcp (MCP Server)

An MCP server for querying, exporting, and analyzing Cursor IDE conversation history from the new `workspaceStorage` (SQLite) layout.

### Highlights
- Query conversations across all workspaces (SQLite `state.vscdb` under `workspaceStorage`)
- Search and analyze messages, code blocks, and estimated code changes
- Export data in `json`, `csv`, or `markdown`
- Workspace utilities to list/filter recent workspaces
- Diagnostics tool to discover actual storage keys in your environment

### Data sources and fallbacks
- Primary: legacy chat key (if present): `workbench.panel.aichat.view.aichat.chatdata`
- Heuristics: if the legacy key is missing, the server scans values for structures containing `conversations/messages/assistant/role`.
- Last resort: synthesizes conversations from `aiService.generations` (user-side prompts). Optionally, it heuristically pairs items from `aiService.prompts` as assistant replies to improve completeness.

Note: Depending on your Cursor version, assistant replies may not be locally persisted under known keys. The diagnostics tool can help you discover new keys. If you can share a confirmed key/path containing assistant messages, this server can be adapted quickly.

## Installation

```bash
npm install
npm run build
```

Run MCP Inspector for local testing:

```bash
npm run inspector
```

The Inspector prints a local URL for interactive testing in your browser.

## Configure in Cursor

Basic configuration:

```json
{
  "mcp.servers": {
    "cursor-db": {
      "command": "cursor-db-mcp",
      "args": []
    }
  }
}
```

Custom `workspaceStorage` path:

```json
{
  "mcp.servers": {
    "cursor-db": {
      "command": "cursor-db-mcp",
      "args": ["--workspace-path", "/custom/path/to/workspaceStorage"]
    }
  }
}
```

## Available Tools

- list_workspaces
  - Input: `{ recent_days?: number }`
  - Returns workspace list with hash, path, projectPath, lastModified

- get_workspace_conversations
  - Input: `{ workspace_hash: string }`
  - Use `list_workspaces` to obtain `workspace_hash`
  - Returns conversations for that workspace

- get_all_conversations
  - Input: `{ limit?: number }`
  - Returns cross-workspace conversations (sorted by updated time)

- search_conversations
  - Input: `{ query: string, limit?: number }`
  - Full-text search in titles and messages

- analyze_conversation
  - Input: `{ conversation_id: string }`
  - Returns stats (message counts, code blocks, estimated code changes)

- export_conversations
  - Input: `{ format?: 'json'|'csv'|'markdown', conversation_id?: string, conversation_ids?: string[] }`
  - Export all or a subset filtered by `conversation_id`/`conversation_ids`

- analyze_code_statistics
  - Input: `{ days?: number, group_by?: 'day'|'week'|'month'|'language'|'workspace' }`
  - Aggregated metrics across the selected period

- diagnose_storage
  - Input: `{ limit?: number }`
  - Lists the largest `ItemTable` keys per workspace to help locate actual chat storage

## Ensuring assistant replies in results

- If your environment has a key containing full conversations (including assistant messages), the server will parse it directly.
- If not, the server falls back to `aiService.generations` (user-only prompts) and tries to pair them with `aiService.prompts` as assistant replies heuristically. This improves completeness but may not perfectly reflect the original assistant responses.
- To achieve exact assistant outputs, provide the confirmed storage key or path where Cursor persists assistant replies in your version.

## Export formats

- JSON: raw conversations array
- CSV: one line per conversation with high-level metadata
- Markdown: per-conversation sections with messages and code blocks

## Development

```bash
npm install
npm run build
npm run watch   # optional: incremental builds
npm run inspector
```

### Notes
- SQLite access uses `sqlite3`. On some systems you may need build tools (e.g., Xcode CLT on macOS) installed.
- Default workspace storage paths:
  - macOS: `~/Library/Application Support/Cursor/User/workspaceStorage`
  - Windows: `%APPDATA%/Cursor/User/workspaceStorage`
  - Linux: `~/.config/Cursor/User/workspaceStorage`

## Troubleshooting

- No conversations returned:
  - Use `diagnose_storage` to inspect keys. If no conversation-like key exists, your Cursor version may not store assistant replies locally.
  - The server will still return synthesized conversations from `aiService.generations` (user prompts). Provide the real chat key to enable full parsing.

- Permission/locking errors:
  - Ensure Cursor is not locking the database when scanning. Try closing heavy operations in Cursor.

## License

MIT — see `LICENSE`.


