# Obsidian TODO Extractor

Sync your codebase TODOs with Obsidian.

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse community plugins
4. Search for "TODO Extractor" and install it
5. Enable the plugin in the Community Plugins section

## Usage

1. Set up the plugin in the settings (Obsidian Settings > TODO Extractor)
2. Specify your repository path and other settings
3. Use the command palette (Ctrl/Cmd + P) and search for "Extract TODOs"
4. Run the command to extract TODOs from your codebase into an Obsidian note

This plugin uses [simple-git](https://github.com/steveukx/git-js) to scan your local repo, then uses the `git grep` command to find all TODOs in the codebase. It then creates or updates a markdown file in Obsidian with all the TODOs.

## Features

- [x] Scan local repo for TODOs
- [x] Create markdown file in Obsidian with TODOs
- [x] Update markdown file in Obsidian with new TODOs
- [x] Deduplicate existing TODOs in Obsidian
- [ ] Remove TODOs that are no longer in the codebase
- [ ] Add support for other tags like FIXME, NOTE, etc.
- [x] Add support for custom tags
- [ ] Add support for custom file paths

## Settings

- repoPath: string (path to your local git repository)
- branchName: string (git branch to scan for TODOs)
- todoNote: string (name of the note to store TODOs)
- noteTag: string (optional tag for the TODO note)
- autoPullInterval: number (in minutes, 0 means disabled)
- fileExtensions: string[] (file types to scan for TODOs)
- editorPrefix: string (prefix for editor links, e.g., "vscode://")
- todoRegex: string (regex pattern to match TODOs)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
