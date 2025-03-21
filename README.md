# Git Blame Inline

A lightweight VS Code extension that shows git blame information inline in your code editor without cluttering your interface.

## Features

- Shows git blame information (author, time, and commit hash) directly inline at the end of the current line
- Supports both automatic display when selecting lines and manual triggering via command
- Configurable display duration (temporary or permanent)
- Non-intrusive UI that doesn't interfere with your coding workflow

![Git Blame Inline Demo](https://raw.githubusercontent.com/rivalarya/git-blame-inline/main/images/git-blame-inline-demo.gif)

## Installation

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Git Blame Inline"
4. Click Install

## Usage

### Automatic Mode

By default, the extension will automatically show git blame information whenever you select a line in your editor.

### Manual Mode

You can also manually trigger git blame for the current line:
- Via Command Palette (Ctrl+Shift+P / Cmd+Shift+P): `Show Git Blame Inline`
- Default keyboard shortcut: None (you can assign your own in keyboard shortcuts settings)

## Configuration

This extension provides the following settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `gitBlameInline.displayDuration` | How long to display the blame information in milliseconds (0 for permanent display) | 5000 |
| `gitBlameInline.autoShowOnSelect` | Automatically show blame information when selecting a line | true |

You can modify these settings in your VS Code settings.json file:

```json
{
  "gitBlameInline.displayDuration": 10000,  // 10 seconds
  "gitBlameInline.autoShowOnSelect": false  // Disable automatic display
}
```

## Requirements

- Git must be installed and available in your PATH
- The file must be part of a Git repository

## Known Issues

- May not work correctly with uncommitted changes
- Performance may be affected in large repositories with complex history

## Release Notes

### 0.0.1

- Initial release of Git Blame Inline
- Basic functionality with automatic and manual modes
- Configurable display duration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.