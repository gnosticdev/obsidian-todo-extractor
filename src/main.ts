import { TDNotice } from '@/notice'
import type { ITodoExtractorPlugin } from '@/types'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { FileView, normalizePath, Plugin, type TFile } from 'obsidian'
import simpleGit, { grepQueryBuilder, type SimpleGit } from 'simple-git'
import { BranchSuggestModal } from './BranchSuggestModal'
import { FileSuggestModal } from './FileSuggestModal'
import { TodoHeadingModal } from './TodoHeadingModal'
import {
	DEFAULT_SETTINGS,
	TodoExtractorSettingTab,
	type TodoExtractorSettings,
} from './settings'
import {
	createErrorResponse,
	createSuccessResponse,
	isDev,
	styleText,
} from './utils'

/**
 * Similar to the grep result, but the preview text is trimmed of whitespace characters
 */
type TodoResult = { previewText: string; filePath: string; lineNumber: number }

export default class TodoExtractorPlugin
	extends Plugin
	implements ITodoExtractorPlugin
{
	public settings: TodoExtractorSettings
	public git: SimpleGit | null

	public async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}

	async onload(): Promise<void> {
		await this.loadSettings()

		this.addSettingTab(new TodoExtractorSettingTab(this.app, this))

		isDev &&
			console.log(
				styleText('bgBlue', 'Loaded Todo Extractor: settings'),
				this.settings,
			)

		// Initialize git
		try {
			// Make sure this setting exists and is set correctly
			const repoPath = this.settings.repoPath
			if (!repoPath) {
				return
			}
			// This will throw an error if it's not a valid repo
			const git = simpleGit(repoPath)
			const isRepo = await git.checkIsRepo()
			if (isRepo) {
				this.git = git
				isDev &&
					console.log(styleText('green', `Git initialized on ${repoPath}`))
			}
		} catch (error) {
			console.error('Failed to initialize git:', error)
			new TDNotice(
				'Failed to initialize git. Please check your repository path in settings.',
			)
		}

		this.addCommand({
			id: 'extract-todos',
			// only allow the command to run if the repo path is set and valid
			callback: () =>
				this.validateRepoPath().then((isValid) => {
					if (isValid) {
						this.extractTodos()
					} else {
						new TDNotice(
							'Please set the repository path in the plugin settings',
						)
					}
				}),
			// get the repo name from the repo folder name
			name: `Extract TODOs - ${path.basename(this.settings.repoPath || '')}`,
		})

		this.addCommand({
			id: 'select-todo-note',
			name: 'Select Todo Note',
			callback: () => this.selectTodoNote(),
		})

		this.addCommand({
			id: 'select-branch',
			name: 'Select Branch',
			callback: () => {
				try {
					const git = simpleGit(this.settings.repoPath)
					if (git) {
						new BranchSuggestModal(this).open()
					} else {
						new TDNotice(
							'No git repo found. Please check your repository settings.',
						)
					}
				} catch (error) {
					console.error('Error getting branches:', error)
					new TDNotice(
						'No git repo found. Please check your repository settings.',
					)
				}
			},
		})
	}

	/*
	 * Get the current todo note from settings, and convert it to a TFile
	 *
	 * if not set, prompts user with the FileSuggestModal
	 */
	public loadCurrentTodoNote(): TFile | null {
		return this.app.vault.getFileByPath(this.settings.todoNote)
	}

	/**
	 * Open a modal to select the todo note
	 */
	public async selectTodoNote(): Promise<void> {
		const modal = new FileSuggestModal(
			this,
			async (file: TFile) => {
				// get all the active tabs
				const layout = this.app.workspace.getLayout()
				this.settings.todoNote = file.path
				isDev && console.log('layout', layout)
				// Update the settings
				await this.saveSettings()
				this.app.workspace.iterateRootLeaves(async (leaf) => {
					isDev && console.log('leaf', leaf)
					const { view } = leaf
					if (view instanceof FileView && view.file?.path === file.path) {
						isDev && console.log('opened', file.path)
						this.app.workspace.setActiveLeaf(leaf, { focus: true })
						return
					}
				})
			},
			'Select Todo Note',
		)
		modal.open()
	}

	/**
	 * Open a modal to select the todo heading
	 */
	public async selectTodoHeading(): Promise<void> {
		const modal = new TodoHeadingModal(this, async (item) => {
			this.settings.todoHeading = item
			await this.saveSettings()
		})
		modal.open()
	}

	/**
	 * Only invoke this when the user has clicked the validate button, or has selected a command that requires a valid repo path
	 */
	public async validateRepoPath() {
		if (!this.settings.repoPath) {
			return createErrorResponse('No repo path set')
		}
		if (
			this.settings.repoPath.includes('https://') ||
			this.settings.repoPath.includes('http://')
		) {
			new TDNotice('URLs are not currently supported.')
			return createErrorResponse('URLs are not currently supported.')
		}
		if (!fs.existsSync(this.settings.repoPath)) {
			return createErrorResponse('repo path does not exist.')
		}
		this.settings.repoPath = normalizePath(this.settings.repoPath)

		try {
			const git = simpleGit({ baseDir: this.settings.repoPath })
			const isRepo = await git.checkIsRepo()
			if (!isRepo) {
				return createErrorResponse('Not a git repository')
			}
			return createSuccessResponse((await git.branchLocal()).branches)
		} catch (error) {
			console.error('Error initializing git:', error)
			return createErrorResponse(`Error validating repo path: ${error.message}`)
		}
	}

	/**
	 * Extract TODOs from the codebase and write to the todo note
	 */
	public async extractTodos(): Promise<void> {
		try {
			const todos = await this.grepTodos()
			isDev && console.log(`Found ${todos.length} TODOs`)
			if (todos.length > 0) {
				await this.writeTodosToNote(todos)
			} else {
				new TDNotice('No TODOs found in the repository')
			}
		} catch (error) {
			console.error(error)
			new TDNotice(`Error extracting TODOs: ${error.message}`)
		}
	}

	/**
	 * Use git grep to scan a repo for all TODO comments
	 */
	private async grepTodos(): Promise<TodoResult[]> {
		// gets the todos for ts, js, tsx, jsx files
		if (!this.git) {
			new TDNotice('Please set the repository path in the plugin settings')
			return []
		}
		const patterns = this.settings.todoCommentPattern.split(',')
		const mainPattern = patterns.shift() ?? DEFAULT_SETTINGS.todoCommentPattern
		let query = grepQueryBuilder(mainPattern)
		// grepQueryBuilder uses the first pattern as the query and the rest as parameters
		for (const pattern of patterns) {
			query = query.param(pattern)
		}
		isDev && console.log('Grep query:', query)
		const matches = await this.git.grep(query)

		const results: TodoResult[] = []
		for (const matchPath of matches.paths) {
			const grepMatch = matches.results[matchPath]
			for (const result of grepMatch ?? []) {
				results.push({
					lineNumber: result.line,
					previewText: result.preview.trim(),
					filePath: result.path,
				})
			}
		}
		isDev && console.log('grep results', results)
		return results
	}

	/**
	 * Load existing todos from the todo note, creates the note if it doesn't exist.
	 *
	 * Only returns the todo text, not the checkbox or the link
	 */
	private async loadExistingTodos(): Promise<Set<string>> {
		/**
		 * Regex to match TODOs in Markdown files
		 */
		const TODO_REGEX_MD = /- \[[ xX]\] (TODO: .*?) \[.*\]\((.*)\)/

		const existingTodos = new Set<string>()
		const todoNote = this.loadCurrentTodoNote()
		if (!todoNote) {
			await this.selectTodoNote()
			new TDNotice('Select a note to store TODOs, then run the command again')
			return new Set<string>()
		}

		const content = await this.app.vault.read(todoNote)

		for (const line of content.split('\n')) {
			// only store the TODO text not the checkbox
			const matched = line.trim().match(TODO_REGEX_MD)
			if (matched) {
				console.log('matched', matched)
				existingTodos.add(matched[1]!.trim())
			}
		}

		const todoNoteCache = this.app.metadataCache.getFileCache(todoNote)
		for (const item of todoNoteCache?.listItems ?? []) {
			// get the text of the list item by reading the start - end of the item
			const text = content
				.slice(item.position.start.offset, item.position.end.offset)
				.replace(/^- \[[ xX]\] /, '')
			existingTodos.add(text)
		}
		console.log('todoNoteCache', [...existingTodos])

		return existingTodos
	}

	/**
	 * Write the todos to the todo note, creating it if it doesn't exist
	 */
	private async writeTodosToNote(todos: TodoResult[]) {
		let todoNote = this.loadCurrentTodoNote()
		if (!todoNote) {
			new TDNotice('Todo note does not exist')
			// if the todoNote is empty, then the todoHeading will be empty
			todoNote = await this.app.vault.create(
				DEFAULT_SETTINGS.todoNote,
				`# ${DEFAULT_SETTINGS.todoHeading}\n\n`,
			)
		}

		try {
			isDev && console.log('Existing note:', todoNote)

			const existingTodos = await this.loadExistingTodos()
			const notePath = this.settings.todoNote || 'Code TODOs.md'
			console.log(`Attempting to write TODOs to note: ${notePath}`)

			const newTodos = todos
				.map((todo) => {
					const absolutePath = path.resolve(
						this.settings.repoPath || '',
						todo.filePath,
					)
					const editorLink = `${this.settings.editorPrefix}://file/${absolutePath}:${todo.lineNumber}`

					/**
					 * Remove any comment characters from the todo text
					 * This is to prevent duplicate todos when the same TODO is found in multiple files
					 */
					const cleanedPreviewText = todo.previewText
						.replace(/\/\/|\/\*|\*\/|\{|\}|\#/gm, '')
						.trim()

					isDev && console.log('matcher:', cleanedPreviewText)
					return {
						matcher: cleanedPreviewText,
						line: `- [ ] ${cleanedPreviewText} [${todo.filePath}:${todo.lineNumber}](${editorLink})`,
					}
				})
				.filter((todoLine) => !existingTodos.has(todoLine.matcher))
				.map((todoLine) => todoLine.line)
				.join('\n')

			if (newTodos.length === 0) {
				new TDNotice('No new TODOs found')
				return
			}

			const tagLine = this.settings.noteTag
				? `\n#${this.settings.noteTag}\n`
				: ''

			// Check if the heading already exists in the note
			const fileCache = this.app.metadataCache.getFileCache(todoNote)
			const headingsCache = fileCache?.headings ?? []
			const todoHeadingIndex = headingsCache.findIndex(
				(heading) => heading.heading === this.settings.todoHeading,
			)

			let content = await this.app.vault.read(todoNote as TFile)

			// if the heading doesn't exist, append it to the note
			if (todoHeadingIndex === -1) {
				content = `${content}\n\n${this.settings.todoHeading}\n\n${newTodos}${tagLine}`
			} else {
				// append the new todos to the note after the group with this heading
				const headingEnd = headingsCache[todoHeadingIndex]!.position.end.offset
				const headingEndContent = content.slice(headingEnd)
				content = `${content.slice(0, headingEnd)}\n\n${newTodos}${tagLine}${headingEndContent}`
			}

			console.log('New content length:', content.length)
			await this.app.vault.modify(todoNote as TFile, content)
			console.log(
				`Added ${newTodos.split('\n').length} new TODOs in ${notePath}`,
			)

			new TDNotice(
				`Added ${newTodos.split('\n').length} new TODOs to ${this.settings.todoNote}`,
			)
		} catch (error) {
			console.error('Error in writeTodosToNote:', error)
			new TDNotice(`Error writing TODOs to note: ${error.message}`)
		}
	}
}
