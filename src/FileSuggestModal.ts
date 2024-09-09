import { isDev } from '@/utils'
import { type FuzzyMatch, FuzzySuggestModal, type TFile } from 'obsidian'
import type TodoExtractorPlugin from 'src/main'

export class FileSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(
		private plugin: TodoExtractorPlugin,
		public onChooseItem: (file: TFile) => void,
		title: string,
	) {
		super(plugin.app)
		this.setTitle(title)
		this.setPlaceholder('Select a file')
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select' },
			{ command: 'esc', purpose: 'to dismiss' },
		])
	}

	getItems(): TFile[] {
		return this.plugin.app.vault.getMarkdownFiles()
	}

	getItemText(file: TFile): string {
		return file.path
	}

	onChooseSuggestion(
		item: FuzzyMatch<TFile>,
		evt: MouseEvent | KeyboardEvent,
	): void {
		isDev && console.log('onChooseSuggestion', item)
		const fileSuggestInput = document.getElementById(
			'file-suggest-input',
		) as HTMLInputElement
		if (fileSuggestInput) {
			fileSuggestInput.value = item.item.path
		}
		this.plugin.settings.todoNote = item.item.path
		this.onChooseItem(item.item)
		this.close()
	}
}
