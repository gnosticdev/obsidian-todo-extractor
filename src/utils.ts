export const isDev = process.env.NODE_ENV === 'development'

export const styleText = (
	style: 'bgGreen' | 'green' | 'bgRed' | 'bgBlue',
	text: string,
) => {
	// create style text for console log
	const colorMap = {
		bgGreen: '\x1b[42m',
		green: '\x1b[32m',
		bgRed: '\x1b[41m',
		bgBlue: '\x1b[44m',
	}
	const color = colorMap[style as keyof typeof colorMap] || ''
	return `${color}${text}\x1b[0m`
}

export function createSuccessResponse<const T>(data: T) {
	return { data, error: null }
}

export function createErrorResponse<T extends string>(errorMessage: T) {
	return { data: null, error: errorMessage }
}
