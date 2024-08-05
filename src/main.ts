import * as path from 'node:path'
import { Notice, Plugin, TFile } from 'obsidian'
import simpleGit, { grepQueryBuilder } from 'simple-git'
import type { SimpleGit } from 'simple-git/dist/typings/simple-git'
import { TodoExtractorSettingTab, type TodoExtractorSettings } from './settings'

// create style text for console log
const colorMap = {
	bgGreen: '\x1b[42m',
	green: '\x1b[32m',
	bgRed: '\x1b[41m',
	bgBlue: '\x1b[44m',
}

type TodoResult = { text: string; file: string; line: number }

const TODO_REGEX_MD = /- \[[ xX]\] (TODO: .*?) \[.*\]\((.*)\)/

const DEFAULT_SETTINGS = {
	repoPath: '',
	branchName: 'main',
	todoNote: 'Code TODOs',
	noteTag: '',
	autoPullInterval: 0,
	fileExtensions: ['ts', 'js', 'tsx', 'jsx', 'py'],
	editorPrefix: 'vscode',
	// double escape
	todoCommentPattern: '//\\s*TODO:',
} satisfies TodoExtractorSettings

export const styleText = (style: keyof typeof colorMap, text: string) => {
	const color = colorMap[style as keyof typeof colorMap] || ''
	const reset = '\x1b[0m'
	// add black foreground color to the text
	return `${color}\x1b[30m${text}${reset}`
}
/**
 * TODO: Extract TODOs from codebase and write to a note
 */
export default class TodoExtractorPlugin extends Plugin {
	public settings: TodoExtractorSettings
	public normalizedFolderPath: string

	private git: SimpleGit

	async onload() {
		await this.loadSettings()

		this.addSettingTab(new TodoExtractorSettingTab(this.app, this))

		console.log(styleText('bgBlue', 'Loaded Todo Extractor'), this.settings)

		if (!this.settings.repoPath) {
			new Notice('Please set the repository path in the plugin settings')
		} else {
			this.git = simpleGit({ baseDir: this.settings.repoPath })
		}

		this.addCommand({
			id: 'extract-todos',
			name: 'Extract TODOs',
			callback: () => this.extractTodos(),
		})
	}

	async checkoutBranch(branchName: string) {
		await this.git.checkoutLocalBranch(branchName, (err) => {
			if (err) {
				console.error('Error checking out branch:', err)
				new Notice(`Error checking out branch: ${err.message}`)
			} else {
				new Notice(`Checked out branch: ${branchName}`)
			}
		})
	}

	async extractTodos() {
		try {
			const todos = await this.grepTodos()
			console.log(`Found ${todos.length} TODOs`)
			if (todos.length > 0) {
				await this.writeTodosToNote(todos)
			} else {
				new Notice('No TODOs found in the repository')
			}
		} catch (error) {
			console.error(error)
			new Notice(`Error extracting TODOs: ${error.message}`)
		}
	}

	/**
	 * Use git grep to search for TODOs in the Repository
	 */
	public async grepTodos() {
		// gets the todos for ts, js, tsx, jsx files
		const query = grepQueryBuilder(this.settings.todoCommentPattern).param(
			'#\\s*TODO:',
		)
		console.log('Grep query:', query)
		const matches = await this.git.grep(query)

		const results: TodoResult[] = []
		for (const _path of matches.paths) {
			console.log(styleText('bgGreen', 'file'), _path)
			console.log(matches.results[_path])
			const grepMatch = matches.results[_path]
			for (const result of grepMatch) {
				results.push({
					line: result.line,
					text: result.preview.trim(),
					file: result.path,
				})
			}
		}
		return results
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	private async loadExistingTodos(): Promise<Set<string>> {
		const noteName = `${this.settings.todoNote || 'Code TODOs'}.md`
		const todoNote = this.app.vault.getFileByPath(noteName)
		const existingTodos = new Set<string>()

		if (!(todoNote instanceof TFile)) {
			console.log('Note does not exist, creating new note')
			return existingTodos
		}

		const content = await this.app.vault.cachedRead(todoNote)
		const lines = content.split('\n')
		for (const line of lines) {
			// only store the TODO text not the checkbox
			const matched = line.trim().match(TODO_REGEX_MD)
			if (matched) {
				existingTodos.add(matched[1].trim())
			}
		}

		console.log('loadExistingTodos', [...existingTodos])

		return existingTodos
	}

	async writeTodosToNote(todos: TodoResult[]) {
		const existingTodos = await this.loadExistingTodos()
		const noteName = `${this.settings.todoNote || 'Code TODOs'}.md`
		console.log(`Attempting to write TODOs to note: ${noteName}`)

		try {
			let todoNote = this.app.vault.getAbstractFileByPath(noteName)
			console.log('Existing note:', todoNote)

			if (!(todoNote instanceof TFile)) {
				console.log('Note does not exist, creating new note')
				todoNote = await this.app.vault.create(
					noteName,
					`# ${this.settings.todoNote}\n\n`,
				)
				console.log('New note created:', todoNote)
			}

			const existingContent = await this.app.vault.read(todoNote as TFile)

			const newTodos = todos
				.map((todo) => {
					const absolutePath = path.resolve(this.settings.repoPath, todo.file)
					const editorLink = `${this.settings.editorPrefix}://file/${absolutePath}:${todo.line}`
					const matcher = todo.text
						.replace(/\/\/|\/\*|\*\/|\{|\}|\#/g, '')
						.trim()

					console.log('matcher:', matcher)
					return {
						matcher,
						line: `- [ ] ${matcher} [${todo.file}:${todo.line}](${editorLink})`,
					}
				})
				.filter((todoLine) => !existingTodos.has(todoLine.matcher))
				.map((todoLine) => todoLine.line)
				.join('\n')

			if (newTodos.length === 0) {
				new Notice('No new TODOs found')
				return
			}

			const tagLine = this.settings.noteTag
				? `\n\n#${this.settings.noteTag}`
				: ''
			const newContent = `${existingContent}\n${newTodos}${tagLine}`

			console.log('New content length:', newContent.length)
			await this.app.vault.modify(todoNote as TFile, newContent)
			console.log(
				`Updated ${newTodos.split('\n').length} new TODOs in ${noteName}`,
			)

			new Notice(
				`Added ${newTodos.split('\n').length} new TODOs to ${this.settings.todoNote}`,
			)
		} catch (error) {
			console.error('Error in writeTodosToNote:', error)
			new Notice(`Error writing TODOs to note: ${error.message}`)
		}
	}
}
