# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-08-17
### Added
- New workspaceStorage-compatible scanner and SQLite access
- Tools: list_workspaces, get_workspace_conversations, get_all_conversations, search_conversations, analyze_conversation, export_conversations (with `conversation_id(s)`), analyze_code_statistics, diagnose_storage
- Heuristics to synthesize conversations from `aiService.generations` and pair `aiService.prompts` as assistant replies
- HTTP options scaffold (commented) and inspector script
- LICENSE (MIT), README (EN), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, PRIVACY

### Changed
- Main server upgraded to MCP SDK 0.6.0 and commander CLI

### Fixed
- Robust project path extraction via `workspace.json`
