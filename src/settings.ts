import {
	type App,
	Notice,
	PluginSettingTab,
	Setting,
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
}

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
						let repoPath = this.plugin.settings.repoPath
						if (!repoPath) {
							return new Notice('Please enter a folder path.')
						}
						if (repoPath.includes('https://') || repoPath.includes('http://')) {
							return new Notice('URLs are not supported.')
						}

						repoPath = normalizePath(repoPath)

						simpleGit(repoPath).checkIsRepo(
							CheckRepoActions.IS_REPO_ROOT,
							(err, isRepo) => {
								if (err) {
									return new Notice(`Error checking repository: ${err.message}`)
								}
								if (isRepo) {
									return new Notice('Repository path is valid.')
								}
								new Notice(
									'Must be the root of the repo. Please check your settings.',
								)
							},
						)
						this.plugin.settings.repoPath = repoPath
						console.log('repo path', repoPath)
						await this.plugin.saveSettings()
					})
			})

		// add setting for branch Name
		new Setting(containerEl)
			.setName('Branch Name')
			.setDesc('Enter the branch name to checkout')
			.addText((text) =>
				text
					.setPlaceholder('main')
					.setValue(this.plugin.settings.branchName)
					.onChange(async (value) => {
						this.plugin.checkoutBranch(value)
						this.plugin.settings.branchName = value
						await this.plugin.saveSettings()
					}),
			)

		new Setting(containerEl)
			.setName('Default Note Name')
			.setDesc('The name of the note where TODOs will be appended')
			.addText((text) =>
				text
					.setPlaceholder('Code TODOs')
					.setValue(this.plugin.settings.todoNote)
					.onChange(async (value) => {
						this.plugin.settings.todoNote = value
						await this.plugin.saveSettings()
					}),
			)

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
			.setDesc('pattern to match TODOs in code')
			.addText((text) =>
				text
					.setPlaceholder('//\\s*TODO:')
					.setValue(this.plugin.settings.todoCommentPattern)
					.onChange(async (value) => {
						this.plugin.settings.todoCommentPattern = value
						await this.plugin.saveSettings()
					}),
			)
	}
}
