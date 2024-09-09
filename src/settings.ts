import { BranchSuggestModal } from '@/BranchSuggestModal'
import { TDNotice } from '@/notice'
import { type App, PluginSettingTab, Setting } from 'obsidian'
import type TodoExtractorPlugin from './main'

export interface TodoExtractorSettings {
	repoPath?: string
	branchName?: string
	todoNote: string
	noteTag?: string
	autoPullInterval: number // in minutes, 0 means disabled
	fileExtensions: string[]
	editorPrefix: string
	todoCommentPattern: string
	todoHeading: string
}

export const DEFAULT_SETTINGS = {
	repoPath: '',
	branchName: '',
	todoNote: 'Code TODOs',
	noteTag: '',
	autoPullInterval: 0,
	fileExtensions: ['ts', 'js', 'tsx', 'jsx', 'py'],
	editorPrefix: 'vscode',
	todoCommentPattern: '//\\s*TODO:,#\\s*TODO:,{/\\*\\s*TODO:',
	todoHeading: 'Extracted TODOs',
} satisfies TodoExtractorSettings

export class TodoExtractorSettingTab extends PluginSettingTab {
	plugin: TodoExtractorPlugin

	constructor(app: App, plugin: TodoExtractorPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		containerEl.createEl('h2', { text: 'Todo Extractor Settings' })

		new Setting(containerEl)
			.setName('Repository Path')
			.setDesc('Enter the path to your code repository')
			.addText((textElement) => {
				const inputEl = textElement.inputEl
				inputEl.id = 'repo-path-input'

				textElement
					.setPlaceholder('/path/to/your/repo')
					.setValue(this.plugin.settings.repoPath || '')
					.onChange(async (value) => {
						this.plugin.settings.repoPath = value
						await this.plugin.saveSettings()
					})
			})
			.addButton((button) => {
				button.buttonEl.id = 'validate-repo-path-button'
				button
					.setButtonText('Validate')
					.setTooltip('Checks if the folder path is valid')
					.onClick(async () => {
						const { data, error } = await this.plugin.validateRepoPath()
						if (error) {
							button.setWarning()
							button.setButtonText('Invalid')
							button.buttonEl.classList.remove('mod-success')
							button.buttonEl.classList.add('mod-warning')
							new TDNotice(error)
							return
						}
						button.setIcon('check')
						button.setTooltip('Repo path is valid')
						button.buttonEl.classList.remove('mod-warning')
						button.buttonEl.classList.add('mod-success')
						new TDNotice('Repo path is valid')
						await this.plugin.saveSettings()
					})
			})

		// add setting for branch Name
		new Setting(containerEl)
			.setName('Branch Name')
			.setDesc('Enter the branch name to checkout')
			.addText((textElement) => {
				const inputEl = textElement.inputEl
				inputEl.id = 'branch-name-input'
				textElement
					.setPlaceholder(DEFAULT_SETTINGS.branchName || '')
					.setValue(this.plugin.settings.branchName || '')
					.onChange(async (value) => {
						this.plugin.settings.branchName = value
						await this.plugin.saveSettings()
					})
			})
			// add button to checkout branch
			.addButton((button) => {
				button.buttonEl.id = 'checkout-branch-button'
				button.setButtonText('Checkout')
				button.setTooltip('Checkout the branch')
				button.onClick(async () => {
					const modal = new BranchSuggestModal(this.plugin)
					modal.open()
					await this.plugin.saveSettings()
				})
			})

		new Setting(containerEl)
			.setName('Note to Append')
			.setDesc('The note where TODOs will be appended')
			.addText((text) => {
				text.inputEl.id = 'todo-note-input'
				text
					.setPlaceholder(DEFAULT_SETTINGS.todoNote)
					.setValue(this.plugin.settings.todoNote)
					.setDisabled(true)
			})
			.addButton((button) =>
				button
					.setButtonText('Select')
					.setTooltip('Select the note where TODOs will be appended')
					.onClick(async () => {
						await this.plugin.selectTodoNote()
					}),
			)

		new Setting(containerEl)
			.setName('TODO Heading')
			.setDesc('Heading under which extracted TODOs will be appended')
			.addText((textElement) => {
				const inputEl = textElement.inputEl
				inputEl.id = 'todo-heading-input'
				textElement
					.setPlaceholder(DEFAULT_SETTINGS.todoHeading)
					.setValue(this.plugin.settings.todoHeading)
					.onChange(async (value) => {
						this.plugin.settings.todoHeading = value
						await this.plugin.saveSettings()
					})
			})
			.addButton((button) => {
				button.setButtonText('Select')
				button.setTooltip('Select the heading from the TODO note')
				button.onClick(async () => {
					await this.plugin.selectTodoHeading()
					await this.plugin.saveSettings()
				})
			})

		new Setting(containerEl)
			.setName('Default Note Tag')
			.setDesc('Optional tag to add to the TODO note (without #)')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.noteTag || '')
					.setValue(this.plugin.settings.noteTag || '')
					.onChange(async (value) => {
						this.plugin.settings.noteTag = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Auto-pull Interval')
			.setDesc(
				'Interval (in minutes) to automatically extract TODOs (0 to disable)',
			)
			.addText((text) =>
				text
					.setPlaceholder('0')
					.setValue(this.plugin.settings.autoPullInterval.toString())
					.onChange(async (value) => {
						const numValue = Number(value)
						this.plugin.settings.autoPullInterval = Number.isNaN(numValue)
							? 0
							: numValue
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('File Extensions')
			.setDesc('Comma-separated list of file extensions to scan for TODOs')
			.addText((textElement) =>
				textElement
					.setPlaceholder('ts,js,tsx,jsx')
					.setValue(this.plugin.settings.fileExtensions.join(','))
					.onChange(async (value) => {
						this.plugin.settings.fileExtensions = value
							.split(',')
							.map((ext) => ext.trim())
						await this.plugin.saveSettings()
					}),
			)

		// setting for editor prefix for opening notes
		new Setting(containerEl)
			.setName('Editor Prefix')
			.setDesc(
				'Prefix for opening notes in the editor (e.g. vscode://<note_path>)',
			)
			.addText((text) =>
				text
					.setPlaceholder('vscode')
					.setValue(this.plugin.settings.editorPrefix)
					.onChange(async (value) => {
						if (!value) {
							this.plugin.settings.editorPrefix = DEFAULT_SETTINGS.editorPrefix
						}
						this.plugin.settings.editorPrefix = value
						await this.plugin.saveSettings()
						await this.plugin.loadSettings()
					}),
			)

		new Setting(containerEl)
			.setName('TODO pattern')
			.setDesc(
				'Pattern to match TODOs in code. NOTE: common regex only, need to double escape, and separate with a comma for multiple patterns. default: //\\s*TODO:,#\\s*TODO:,{/\\*\\s*TODO:',
			)
			.addText((text) =>
				text
					.setPlaceholder('//\\s*TODO:,#\\s*TODO:,{/\\*\\s*TODO:')
					.setValue(this.plugin.settings.todoCommentPattern)
					.onChange(async (value) => {
						this.plugin.settings.todoCommentPattern =
							value || DEFAULT_SETTINGS.todoCommentPattern
						await this.plugin.saveSettings()
					}),
			)
	}
}
