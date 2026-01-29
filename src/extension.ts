import * as vscode from 'vscode';
import * as child_process from 'child_process';

// Track decorations to clear previous ones
let activeDecorations: vscode.TextEditorDecorationType[] = [];
// Track timeout IDs for clearing decorations
let activeTimeouts: NodeJS.Timeout[] = [];

interface GitBlameInlineConfig {
    displayDuration: number; // Duration in milliseconds, 0 for permanent display
    autoShowOnSelect: boolean;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('[Git Blame Inline] Congratulations, your extension "git-blame-inline" is now active!');

    // Register the manual command
    let disposable = vscode.commands.registerCommand('git-blame-inline.showBlame', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }

        showBlameForLine(editor, editor.selection.active.line);
    });

    // Register event for cursor position change
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            const config = getConfig();
            if (!config.autoShowOnSelect) {
                return;
            }

            const editor = event.textEditor;
            if (editor && event.selections.length > 0) {
                const currentSelection = event.selections[0];

                // Check if the movement is vertical (up/down)
                if (isVerticalMovement(event)) {
                    // Clear previous decorations
                    clearDecorations();

                    // Show blame for the current line
                    showBlameForLine(editor, currentSelection.active.line);
                }
            }
        })
    );

    // Helper function to detect vertical cursor movement
    let previousLine: number | undefined;
    function isVerticalMovement(event: vscode.TextEditorSelectionChangeEvent): boolean {
        const currentLine = event.selections[0].active.line;

        if (previousLine === undefined) {
            previousLine = currentLine;
            return false;
        }

        const moved = currentLine !== previousLine;
        if (moved) {
            console.log(`[Git Blame Inline] Cursor moved ${currentLine > previousLine ? 'down' : 'up'}`);
            previousLine = currentLine;
            return true;
        }

        console.log('[Git Blame Inline] Cursor moved horizontally');
        previousLine = currentLine;
        return false;
    }

    // Register configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('gitBlameInline')) {
                // Clear existing decorations when configuration changes
                clearDecorations();
            }
        })
    );

    context.subscriptions.push(disposable);
}

function getConfig(): GitBlameInlineConfig {
    const config = vscode.workspace.getConfiguration('gitBlameInline');
    return {
        displayDuration: config.get<number>('displayDuration', 5000),
        autoShowOnSelect: config.get<boolean>('autoShowOnSelect', true)
    };
}

async function showBlameForLine(editor: vscode.TextEditor, line: number) {
    const filePath = editor.document.fileName;
    const lineNumber = line + 1; // git blame uses 1-based index

    try {
        const blame = await getGitBlame(filePath, lineNumber);
        if (blame) {
            displayBlame(editor, line, blame);
        }
    } catch (error) {
        console.error('[Git Blame Inline] Error running git blame:', JSON.stringify(error));
        displayBlame(editor, line, 'No commit found');
    }
}

function clearDecorations() {
    // Clear all active decorations
    activeDecorations.forEach(decoration => {
        decoration.dispose();
    });
    activeDecorations = [];

    // Clear all active timeouts
    activeTimeouts.forEach(timeout => {
        clearTimeout(timeout);
    });
    activeTimeouts = [];
}

async function getGitBlame(filePath: string, lineNumber: number): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const cwd = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath;

        if (!cwd) {
            reject('File is not part of an open workspace.');
            return;
        }

        console.log(
            `[Git Blame Inline] Running git blame --line-porcelain -L ${lineNumber},${lineNumber} "${filePath}"`
        );

        child_process.execFile(
            'git',
            ['blame', '--line-porcelain', '-L', `${lineNumber},${lineNumber}`, filePath],
            { cwd },
            (error, stdout, stderr) => {
                if (error) {
                    reject(stderr || error.message);
                    return;
                }

                console.log('[Git Blame Inline] STDOUT:', JSON.stringify(stdout));
                console.log('[Git Blame Inline] STDERR:', JSON.stringify(stderr));

                /*
                  Example --line-porcelain output:
                  <commit-hash>
                  author Rival Arya
                  author-time 1769649906
                  author-tz +0700
                */

                const commitMatch = stdout.match(/^([a-f0-9]{7,40})/m);
                const authorMatch = stdout.match(/^author (.+)$/m);
                const timeMatch = stdout.match(/^author-time (\d+)$/m);

                const commitHash = commitMatch?.[1].slice(0, 8);
                const author = authorMatch?.[1];
                const authorTime = timeMatch ? Number(timeMatch[1]) * 1000 : null;

                const isUncommitted =
                    !commitHash ||
                    commitHash.startsWith('00000000') ||
                    !authorTime ||
                    authorTime === 0;

                if (isUncommitted) {
                    resolve('Not Committed Yet');
                    return;
                }

                const timeAgo = formatTimeAgo(new Date(authorTime));
                resolve(`${author}, ${timeAgo} - ${commitHash}`);
            }
        );
    });
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) {
        return `${diffSec} seconds ago`;
    } else if (diffMin < 60) {
        return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    } else if (diffHour < 24) {
        return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    } else if (diffDay < 7) {
        return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    } else if (diffWeek < 4) {
        return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
    } else if (diffMonth < 12) {
        return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
    } else {
        return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`;
    }
}

function displayBlame(editor: vscode.TextEditor, line: number, blame: string) {
    // Create a new decoration type
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` // ${blame}`,
            color: '#888888',
            margin: '0 0 0 1em',
        }
    });

    // Store it for cleanup
    activeDecorations.push(decorationType);

    // Display at the end of the line
    const range = new vscode.Range(
        line,
        editor.document.lineAt(line).range.end.character,
        line,
        editor.document.lineAt(line).range.end.character
    );

    editor.setDecorations(decorationType, [range]);

    // Get display duration from configuration
    const config = getConfig();
    if (config.displayDuration > 0) {
        // Only set timeout if duration is greater than 0
        const timeout = setTimeout(() => {
            const index = activeDecorations.indexOf(decorationType);
            if (index > -1) {
                decorationType.dispose();
                activeDecorations.splice(index, 1);

                // Also remove from active timeouts
                const timeoutIndex = activeTimeouts.indexOf(timeout);
                if (timeoutIndex > -1) {
                    activeTimeouts.splice(timeoutIndex, 1);
                }
            }
        }, config.displayDuration);

        // Store the timeout ID for cleanup
        activeTimeouts.push(timeout);
    }
}

export function deactivate() {
    // Clean up when deactivated
    clearDecorations();
}
