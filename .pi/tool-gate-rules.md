# Blog production approval

Production changes through CLI commands, scripts, HTTP requests, MCP tools or Git require explicit approval in the current user turn, immediately before each operation. This includes production deployment, pushing any ref that triggers production, promoting, aliasing, rollback, production environment/domain/project writes, and merging to the production branch. Approved implementation plans and earlier approvals are context, never blanket permission.

Ask for every Git push and PR merge, including preview branches: implicit refs and configured destinations cannot be inferred safely. Ask for Vercel MCP calls and Vercel env/project/domains/api command families, including reads. Never route an operation through another tool to bypass an approval requirement.

Prefer CLI preview deployments after local checks; `vercel deploy` without production flags remains allowed unless an ask applies. These instructions supplement deterministic permission rules, not replace them. String matching and classifier guidance cannot enforce arbitrary script/API semantics and are not an OS sandbox. Yolo mode explicitly bypasses ask rules; it is not a production protection mode.
