# Security Policy

## Supported Versions
We aim to follow SemVer. Security fixes are backported to the latest minor when feasible.

## Reporting a Vulnerability
- Do not disclose publicly.
- Open a security issue marked as private (if available) or email the maintainers.
- Include steps to reproduce, impact, and environment details.

## Data & Privacy Notes
- This project reads local Cursor `workspaceStorage` databases in read-only mode.
- Data stays on your machine; the server does not upload data unless you explicitly export or share it.
- Avoid running against sensitive profiles or share outputs that contain private data.

## Responsible Disclosure
We will assess, fix, and release patches as soon as possible. Credit will be given to reporters if desired.
