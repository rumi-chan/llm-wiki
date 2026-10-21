<!-- llm-wiki:begin -->
## Project wikis (llm-wiki)

Repositories may contain one or both of these wikis. Each has a `SCHEMA.md` that defines how to
use it; at the start of a session, read the schema and `index.md` of whichever exists.

- `docs/wiki/` is a **team wiki**, committed with the code. Follow its schema: at the end of a
  task, update the pages affected by this branch (`wiki-update`). Only the wiki maintainer runs
  `wiki-sync` on it. Never edit its `index.md` or `.sync-state` by hand.
- `.wiki/` is the user's **personal wiki**, a separate git repo excluded from the project repo.
  Never commit it to the project repo or reference it from team-shared files. Manage it with
  `wiki-sync` and `wiki-lint`.

Project facts that help the team go in the team wiki; personal notes go in `.wiki/`.
<!-- llm-wiki:end -->
