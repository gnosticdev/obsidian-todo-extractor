import { Notice } from 'obsidian'

export class TDNotice extends Notice {
	constructor(message: string, duration = 3000) {
		super(`TODO Extractor: ${message}`, duration)
	}
}
