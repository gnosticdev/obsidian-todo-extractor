import type { TodoExtractorSettings } from '@/settings'
import type { ITodoExtractorPlugin } from '@/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import type {
	App,
	FileManager,
	FileStats,
	Keymap,
	MetadataCache,
	Scope,
	TFile,
	TFolder,
	UserEvent,
	Vault,
	Workspace,
} from 'obsidian'
import type { SimpleGit } from 'simple-git'

class MockTFile implements TFile {
	path: string
	name: string
	extension: string
	vault: Vault
	basename: string
	parent: TFolder | null
	stat: FileStats
}

// @ts-ignore-next-line
class MockPlugin implements ITodoExtractorPlugin {
	settings: TodoExtractorSettings
	normalizedFolderPath: string
	currentTodoNote: TFile | null
	git: SimpleGit

	onunload(): void {
		return
	}
	async runExtractTodosCommand(): Promise<void> {
		const file = await Bun.file(
			path.join(process.cwd(), 'test-repo/test-ts-file.ts'),
		).text()
		console.log(file)
	}
}

class MockApp implements App {
	vault: Vault
	fileManager: FileManager
	workspace: Workspace
	metadataCache: MetadataCache
	keymap: Keymap
	scope: Scope
	lastEvent: UserEvent | null

	constructor() {
		this.vault = {
			getFileByPath: (path: string) => new MockTFile(),
			read: async () => '',
			create: async (path: string, data: string) => new MockTFile(),
			modify: async (file: TFile, data: string) => {},
		} as unknown as Vault
	}
}

describe('TodoExtractorPlugin', () => {
	let plugin: MockPlugin
	let mockApp: MockApp

	beforeEach(() => {
		mockApp = new MockApp()
		plugin = new MockPlugin()
		plugin.settings = {
			...plugin.settings,
			repoPath: path.join(__dirname, 'test-repo'),
			todoNote: 'Code TODOs',
		}
	})

	afterEach(() => {
		plugin.onunload()
	})

	test('should extract TODOs from TypeScript files', async () => {
		await plugin.runExtractTodosCommand()

		const todoNote = mockApp.vault.getFileByPath('Code TODOs.md') as TFile
		const content = await mockApp.vault.read(todoNote)

		expect(content).toContain('- [ ] ts test single line [test.ts:1]')
		expect(content).toContain('- [ ] ts test multiline [test.ts:4]')
	})

	test('should extract TODOs from TSX files', async () => {
		await plugin.runExtractTodosCommand()

		const todoNote = mockApp.vault.getFileByPath('Code TODOs.md') as TFile
		const content = await mockApp.vault.read(todoNote)

		expect(content).toContain('- [ ] testing jsx [test.tsx:6]')
	})

	test('should extract TODOs from Python files', async () => {
		await plugin.runExtractTodosCommand()

		const todoNote = mockApp.vault.getFileByPath('Code TODOs.md') as TFile
		const content = await mockApp.vault.read(todoNote)

		expect(content).toContain('- [ ] this is a test python file [test.py:1]')
	})
})
