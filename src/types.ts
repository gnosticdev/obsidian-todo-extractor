import type { TodoExtractorSettings } from '@/settings'
import type { Plugin, TFile } from 'obsidian'

export interface ITodoExtractorPlugin extends Plugin {
	settings: TodoExtractorSettings
	loadCurrentTodoNote: () => TFile | null
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	extractTodos: (...args: any[]) => Promise<void>
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	selectTodoNote: (...args: any[]) => Promise<void>
}
