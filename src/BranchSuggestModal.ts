import { TDNotice } from '@/notice'
import { isDev, styleText } from '@/utils'
import { SuggestModal } from 'obsidian'
import { type BranchSummary, simpleGit } from 'simple-git'
import type TodoExtractorPlugin from './main'

export class BranchSuggestModal extends SuggestModal<string> {
	private branches: BranchSummary['branches']

	constructor(private plugin: TodoExtractorPlugin) {
		super(plugin.app)
		this.setPlaceholder('Loading branches...')
		this.setTitle('Select a branch')
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select' },
			{ command: 'esc', purpose: 'to dismiss' },
		])
	}

	async getSuggestions(query: string): Promise<string[]> {
		isDev && console.log('getSuggestions', query)
		if (!this.plugin.settings.repoPath) {
			new TDNotice('Repo path is not set')
			return []
		}

		try {
			this.plugin.git ??= simpleGit({ baseDir: this.plugin.settings.repoPath })
			const { data, error } = await this.plugin.validateRepoPath()
			if (error) {
				new TDNotice(error)
				document.getElementById('')
				this.close()
				return []
			}
			this.branches = data
			return Object.keys(this.branches).filter((branch) =>
				branch.includes(query),
			)
		} catch (error) {
			console.log(styleText('bgRed', 'Error getting branches:'), error)
			new TDNotice(`Error getting branches: ${error}`)
			return []
		}
	}

	renderSuggestion(item: string, el: HTMLElement): void {
		isDev && console.log('renderSuggestion', item)
		el.createEl('div', { text: item, value: item })
		el.createEl('small', {
			text: this.branches[item]?.current ? 'current' : '',
			attr: { style: 'color: gray; font-style: italic;' },
		})
	}

	async onChooseSuggestion(item: string): Promise<void> {
		await this.plugin.git?.checkout(item, (err, data) => {
			if (err) {
				console.error(err)
				new TDNotice(`Error checking out branch: ${err.message}`)
				return
			}
			new TDNotice(`Checked out branch: ${item}`)
		})
		isDev &&
			console.log('onChooseSuggestion: checked out branch', item, this.inputEl)
		this.plugin.settings.branchName = item
		const branchNameInput = document.getElementById(
			'branch-name-input',
		) as HTMLInputElement
		if (branchNameInput) {
			branchNameInput.value = item
		}
		await this.plugin.saveSettings()
		this.close()
	}
}
