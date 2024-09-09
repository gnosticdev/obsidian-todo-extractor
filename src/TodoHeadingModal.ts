import {
	type FuzzyMatch,
	FuzzySuggestModal,
	type HeadingCache,
	Notice,
} from 'obsidian'
import type TodoExtractorPlugin from 'src/main'
import { isDev } from 'src/utils'

export class TodoHeadingModal extends FuzzySuggestModal<string> {
	private headingsCache: HeadingCache[]

	constructor(
		private plugin: TodoExtractorPlugin,
		public onChooseItem: (
			item: string,
			evt: MouseEvent | KeyboardEvent,
		) => void,
	) {
		super(plugin.app)
		this.setPlaceholder('Select a heading')
		this.setTitle('Select a heading')
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select' },
			{ command: 'esc', purpose: 'to dismiss' },
		])

		const todoNote = this.plugin.loadCurrentTodoNote()
		if (!todoNote) {
			new Notice('TODO note not found, please select a note')
			this.headingsCache = []
			return
		}
		this.headingsCache =
			this.app.metadataCache.getFileCache(todoNote)?.headings ?? []
	}

	getItemText(item: string): string {
		return item
	}

	getItems(): string[] {
		isDev && console.log('headings', this.headingsCache)
		return this.headingsCache.map((cache) => cache.heading)
	}

	onChooseSuggestion(
		item: FuzzyMatch<string>,
		evt: MouseEvent | KeyboardEvent,
	): void {
		isDev && console.log('onChooseSuggestion', item)
		const todoHeadingInput = document.getElementById(
			'todo-heading-input',
		) as HTMLInputElement
		if (todoHeadingInput) {
			todoHeadingInput.value = item.item
		}
		this.onChooseItem(item.item, evt)
		this.close()
	}
}
