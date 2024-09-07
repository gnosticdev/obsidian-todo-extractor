import * as fs from 'node:fs'
import {
	type App,
	FuzzySuggestModal,
	Notice,
	PluginSettingTab,
	Setting,
	TFile,
	normalizePath,
} from 'obsidian'
import simpleGit, { CheckRepoActions } from 'simple-git'
import type TodoExtractorPlugin from 'src/main'

export interface TodoExtractorSettings {
	repoPath: string
	branchName: string
	todoNote: string
	noteTag: string
	autoPullInterval: number // in minutes, 0 means disabled
	fileExtensions: string[]
	editorPrefix: string
	todoCommentPattern: string
	todoHeading: string
}

export const DEFAULT_SETTINGS = {
	repoPath: '',
	branchName: 'main',
	todoNote: 'Code TODOs',
	noteTag: '',
	autoPullInterval: 0,
	fileExtensions: ['ts', 'js', 'tsx', 'jsx', 'py'],
	editorPrefix: 'vscode',
	todoCommentPattern: '//\\s*TODO:,#\\s*TODO:,{/\\*\\s*TODO:',
	todoHeading: '## Extracted TODOs',
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
			.addText((text) =>
				text
					.setPlaceholder('/path/to/your/repo')
					.setValue(this.plugin.settings.repoPath)
					.onChange(async (value) => {
						this.plugin.settings.repoPath = value
						await this.plugin.saveSettings()
					}),
			)
			.addButton((button) => {
				button
					.setButtonText('Check')
					.setTooltip('Checks if the folder path is valid')
					.onClick(async () => {
						if (!this.plugin.settings.repoPath) {
							return new Notice('Please enter a repo folder path.')
						}
						if (
							this.plugin.settings.repoPath.includes('https://') ||
							this.plugin.settings.repoPath.includes('http://')
						) {
							return new Notice('URLs are not currently supported.')
						}
						if (!fs.existsSync(this.plugin.settings.repoPath)) {
							return new Notice('repo path does not exist.')
						}

						this.plugin.settings.repoPath = normalizePath(
							this.plugin.settings.repoPath,
						)

						simpleGit(this.plugin.settings.repoPath).checkIsRepo(
							CheckRepoActions.IS_REPO_ROOT,
							(err, isRepo) => {
								if (err) {
									return new Notice(`Error checking repository: ${err.message}`)
								}
								if (isRepo) {
									button.setIcon('check')
									return new Notice('Repository path is valid.')
								}
								new Notice(
									'Must be the root of the repo. Please check your settings.',
								)
							},
						)
						console.log('saving repo path', this.plugin.settings.repoPath)
						await this.plugin.saveSettings()
					})
			})

		// add setting for branch Name
		new Setting(containerEl)
			.setName('Branch Name')
			.setDesc('Enter the branch name to checkout')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.branchName)
					.setValue(this.plugin.settings.branchName)
					.onChange(async (value) => {
						this.plugin.checkoutBranch(value)
						this.plugin.settings.branchName = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Default Note')
			.setDesc('The note where TODOs will be appended')
			.addText((text) =>
				text
					.setPlaceholder('Code TODOs')
					.setValue(this.plugin.settings.todoNote)
					.setDisabled(true),
			)
			.addButton((button) =>
				button.setButtonText('Select').onClick(() => {
					const modal = new FileSuggestModal(this.app, (file) => {
						if (file instanceof TFile) {
							console.log('selected file', file)
							this.plugin.settings.todoNote = file.path
							this.plugin.saveSettings()
						}
					})
					modal.onChooseItem = (item) => {
						console.log('selected item', item)
						this.plugin.settings.todoNote = item.path
						modal.inputEl.value = item.path
						this.plugin.saveSettings()
					}
					modal.open()
				}),
			)

		new Setting(containerEl)
			.setName('TODO Heading')
			.setDesc(
				'Heading under which extracted TODOs will be placed. NOTE: if you use emojis/stickers, they must be present here! ex: ## :LiCalendarDays: Planned',
			)
			.addText((text) =>
				text
					.setPlaceholder('## Extracted TODOs')
					.setValue(this.plugin.settings.todoHeading)

					.onChange(async (value) => {
						this.plugin.settings.todoHeading = value
						await this.plugin.saveSettings()
					}),
			)
			.addButton((button) => {
				button.setButtonText('Check').onClick(async () => {
					console.log(
						'validating TODO heading',
						this.plugin.settings.todoHeading,
					)
					await this.plugin.validateTodoHeading(
						this.plugin.settings.todoNote || DEFAULT_SETTINGS.todoNote,
					)
					new Notice('TODO heading is valid')
				})
			})

		new Setting(containerEl)
			.setName('Default Note Tag')
			.setDesc('Optional tag to add to the TODO note (without #)')
			.addText((text) =>
				text
					.setPlaceholder('todos')
					.setValue(this.plugin.settings.noteTag)
					.onChange(async (value) => {
						this.plugin.settings.noteTag = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Auto-pull Interval')
			.setDesc(
				'Interval in minutes to automatically extract TODOs (0 to disable)',
			)
			.addText((text) =>
				text
					.setPlaceholder('0')
					.setValue(String(this.plugin.settings.autoPullInterval))
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
			.addText((text) =>
				text
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
						this.plugin.settings.editorPrefix = value
						await this.plugin.saveSettings()
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
						if (!value) {
							this.plugin.settings.todoCommentPattern =
								DEFAULT_SETTINGS.todoCommentPattern
							return new Notice('Empty pattern value, using default')
						}
						this.plugin.settings.todoCommentPattern = value
						await this.plugin.saveSettings()
					}),
			)
	}
}

class FileSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(app: App, onChooseItem: (file: TFile) => void) {
		super(app)
		this.onChooseItem = onChooseItem
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles()
	}

	getItemText(file: TFile): string {
		return file.path
	}
	onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onChooseItem(item, evt)
	}
}
