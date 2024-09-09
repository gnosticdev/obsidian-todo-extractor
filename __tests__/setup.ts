import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type TodoExtractorSettings } from '../src/settings'

if (process.env.NODE_ENV === 'test') {
	setupTestRepo()
}
/**
 * Add the test repo to the data.json file in the plugin for testing
 */
export async function setupTestRepo() {
	if (!process.env.LOCAL_PLUGIN_PATH) {
		throw new Error('LOCAL_PLUGIN_PATH is not set')
	}
	const dataJsonPath = join(process.env.LOCAL_PLUGIN_PATH, 'data.json')
	// store the current data.json file, so we can restore it later
	await Bun.$`cp ${dataJsonPath} ${dataJsonPath}.bak`

	const data: TodoExtractorSettings = {
		...DEFAULT_SETTINGS,
		repoPath: join(process.cwd(), '__tests__/test-repo'),
	}

	writeFileSync(dataJsonPath, JSON.stringify(data, null, 2))
}

export async function teardownTestRepo() {
	if (!process.env.LOCAL_PLUGIN_PATH) {
		throw new Error('LOCAL_PLUGIN_PATH is not set')
	}
	const dataJsonPath = join(process.env.LOCAL_PLUGIN_PATH, 'data.json')

	await Bun.$`cp ${dataJsonPath}.bak ${dataJsonPath}`
}
