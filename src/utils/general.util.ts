// Utility functions for the CLI

// Alias for console.log - just a personal preference
export const print = console.log

// Alias for JSON.stringify with two spaces indents
export const json = (value: any) => {
	// Convert the value to json using the toJSON method on it if it is circular
	let jsonificableValue = value
	if (value.toJSON) {
		jsonificableValue = value.toJSON()
	}

	// Return the formatted json
	return JSON.stringify(jsonificableValue, null, 2)
}
