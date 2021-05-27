// Utility functions for the CLI

// Alias for console.log - just a personal preference
export const print = console.log

// Alias for JSON.stringify with two spaces indents
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const json = (value: any): string => {
	// Convert the value to json using the toJSON method on it if it is circular
	let jsonificableValue = value
	if (value && value.toJSON) {
		jsonificableValue = value.toJSON()
	}

	// Return the formatted json
	try {
		return JSON.stringify(jsonificableValue, null, 2)
	} catch {
		return '{circularError: true}'
	}
}

// Join folder path and file name without multiple consecutive slashes
export const path = (...paths: (string | undefined)[]): string => {
	// Return the path, joined by /s and replace any duplicate slash
	return paths.join('/').replace(/\/+/g, '/')
}
