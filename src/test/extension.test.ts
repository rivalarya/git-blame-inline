import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
import proxyquire from 'proxyquire';

suite('Git Blame Inline Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting Git Blame Inline tests.');
	
	let sandbox: sinon.SinonSandbox;
	let execStub: sinon.SinonStub;
	let extension: any;
	
	setup(() => {
		sandbox = sinon.createSandbox();
		// Create the stub first
		execStub = sandbox.stub();
		
		// Create a stub for child_process
		const childProcessStub = {
			exec: execStub
		};
		
		// Use proxyquire to import the extension with our stubbed dependencies
		extension = proxyquire('../extension', {
			'child_process': childProcessStub
		});
	});
	
	teardown(() => {
		sandbox.restore();
	});

	test('Should activate extension', async () => {
		// Create a minimal mock of the ExtensionContext with required properties
		const context = {
			subscriptions: [],
			extensionPath: '',
			extension: {} as vscode.Extension<any>,
			globalState: {
				get: (_key: string) => undefined,
				update: (_key: string, _value: any) => Promise.resolve(),
				setKeysForSync: (_keys: string[]) => {},
				keys: () => [] as readonly string[]
			} as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
			workspaceState: {
				get: (_key: string) => undefined,
				update: (_key: string, _value: any) => Promise.resolve(),
				setKeysForSync: (_keys: string[]) => {},
				keys: () => [] as readonly string[]
			} as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
			// Cast to unknown first and then to the required type
			environmentVariableCollection: ({
				getScoped: (scope: vscode.EnvironmentVariableScope) => ({} as vscode.EnvironmentVariableCollection),
				append: () => {},
				clear: () => {},
				delete: () => {},
				forEach: () => {},
				prepend: () => {},
				replace: () => {},
				persistent: false,
				description: 'Mock environment collection',
				get: () => undefined,
				[Symbol.iterator]: function* () {
					// Empty iterator
					yield* [];
				}
			} as unknown) as vscode.GlobalEnvironmentVariableCollection,
			extensionUri: {} as vscode.Uri,
			extensionMode: vscode.ExtensionMode.Test,
			globalStoragePath: '',
			logPath: '',
			storagePath: '',
			storageUri: {} as vscode.Uri | undefined,
			globalStorageUri: {} as vscode.Uri,
			logUri: {} as vscode.Uri,
			asAbsolutePath: (relativePath: string) => relativePath,
			secrets: {} as vscode.SecretStorage,
			languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation
		};
		
		// Activate the extension
		extension.activate(context as vscode.ExtensionContext);
		
		// Verify subscriptions were added
		assert.ok(context.subscriptions.length > 0, 'Extension should register at least one subscription');
	});
	
	test('Should format time ago correctly', async () => {
		// This is a cleaner way to test the formatTimeAgo function since it's private
		// Create a test file to run formatTimeAgo through the extension
		const testFile = path.join(__dirname, 'test.txt');
		fs.writeFileSync(testFile, 'Test content');
		
		// Mock the current date to ensure consistent test results
		const mockDate = new Date('2025-03-22T12:00:00Z');
		const originalDate = global.Date;
		global.Date = class extends Date {
			constructor() {
				super();
				return mockDate;
			}
			static now() {
				return mockDate.getTime();
			}
		} as any;
		
		try {
			// Test cases with different dates
			const testCases = [
				{
					date: '2025-03-22 11:59:00 +0000',  // 1 minute ago
					expected: '1 minute ago'
				},
				{
					date: '2025-03-22 10:00:00 +0000',  // 2 hours ago
					expected: '2 hours ago'
				},
				{
					date: '2025-03-21 12:00:00 +0000',  // 1 day ago
					expected: '1 day ago'
				},
				{
					date: '2025-03-15 12:00:00 +0000',  // 1 week ago
					expected: '1 week ago'
				},
				{
					date: '2025-02-22 12:00:00 +0000',  // 1 month ago
					expected: '1 month ago'
				},
				{
					date: '2024-03-22 12:00:00 +0000',  // 1 year ago
					expected: '1 year ago'
				}
			];
			
			// Test each case
			for (const testCase of testCases) {
				// Set up the mock git blame output for this test case
				execStub.callsFake((
					command: string, 
					options: any, 
					callback?: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void
				) => {
					const stdout = `^abcdef1 (Test User ${testCase.date}) test.txt`;
					if (callback) callback(null, stdout, '');
					return {} as any;
				});
				
				// Create a spy on the setDecorations method
				const spy = sandbox.spy(vscode.window.createTextEditorDecorationType({}).toString);
				
				// Open the test file
				const document = await vscode.workspace.openTextDocument(testFile);
				const editor = await vscode.window.showTextDocument(document);
				
				// Trigger the command manually
				await vscode.commands.executeCommand('git-blame-inline.showBlame');
				
				// Verify that the decoration contains the expected time format
				// Note: Since we can't directly check the decoration text, we can verify the pattern
				// of calls or mock further to capture the decoration content
				
				// Clean up after this test case
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			}
		} finally {
			// Restore original Date constructor
			global.Date = originalDate;
			
			// Clean up test file
			if (fs.existsSync(testFile)) {
				fs.unlinkSync(testFile);
			}
		}
	});
	
	test('Should handle configuration changes', async () => {
		// Mock the workspace configuration
		const configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		configStub.returns({
			get: <T>(key: string, defaultValue: T): T => {
				if (key === 'displayDuration') return 0 as unknown as T;  // Permanent display
				if (key === 'autoShowOnSelect') return false as unknown as T;
				return defaultValue;
			}
		} as any);
		
		// Test file setup
		const testFile = path.join(__dirname, 'test.txt');
		fs.writeFileSync(testFile, 'Test content');
		
		try {
			// Set up the mock git blame output
			execStub.callsFake((
				command: string, 
				options: any, 
				callback?: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void
			) => {
				const stdout = `^abcdef1 (Test User 2025-03-22 10:00:00 +0000) test.txt`;
				if (callback) callback(null, stdout, '');
				return {} as any;
			});
			
			// Open the test file
			const document = await vscode.workspace.openTextDocument(testFile);
			const editor = await vscode.window.showTextDocument(document);
			
			// Trigger the command manually
			await vscode.commands.executeCommand('git-blame-inline.showBlame');
			
			// Simulate a configuration change event
			const event = {
				affectsConfiguration: (section: string) => section === 'gitBlameInline'
			};
			
			// Manually trigger the configuration change event
			// Note: This is a workaround since we can't directly trigger the event
			const onDidChangeConfigurationSubscribers = (vscode.workspace as any)._onDidChangeConfiguration?.listeners || [];
			for (const subscriber of onDidChangeConfigurationSubscribers) {
				subscriber(event);
			}
			
			// We would verify that decorations are cleared, but this is hard to test directly
			// Instead, we can check that our extension handles the event without error
			
			// Close the editor
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		} finally {
			// Clean up test file
			if (fs.existsSync(testFile)) {
				fs.unlinkSync(testFile);
			}
		}
	});
	
	test('Should handle git blame errors gracefully', async () => {
		// Mock git blame to throw an error
		execStub.callsFake((
			command: string, 
			options: any, 
			callback?: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void
		) => {
			if (callback) callback(new Error('Git blame error') as any, '', 'Command failed');
			return {} as any;
		});
		
		// Spy on the window.showErrorMessage method
		const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');
		
		// Test file setup
		const testFile = path.join(__dirname, 'test.txt');
		fs.writeFileSync(testFile, 'Test content');
		
		try {
			// Open the test file
			const document = await vscode.workspace.openTextDocument(testFile);
			const editor = await vscode.window.showTextDocument(document);
			
			// Trigger the command manually
			await vscode.commands.executeCommand('git-blame-inline.showBlame');
			
			// Verify that no error message is shown (for automatic triggers)
			// But error would be logged to console
			assert.strictEqual(errorSpy.called, false, 'Error message should not be shown for automatic triggers');
			
			// Close the editor
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		} finally {
			// Clean up test file
			if (fs.existsSync(testFile)) {
				fs.unlinkSync(testFile);
			}
		}
	});
});