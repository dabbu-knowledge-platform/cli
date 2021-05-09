// Anything that is related to the configuration kept by the CLI

// Use the `conf` module to manage configuration
import Conf from 'conf'

// Import utility functions
import { json } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// Create a new config (we create only one instance of config for the entire
// lifetime of the CLI)
const config = new Conf({
	// The directory in which the config is stored
	projectName: 'Dabbu CLI',
	// No need for any suffix like '-nodejs'
	projectSuffix: '',
	// Allows accessing nested objects using dot notation
	accessPropertiesByDotNotation: true,
	// Automatically deletes invalid values
	clearInvalidConfig: true,
	// The schema
	schema: {
		serverUrl: {
			type: 'string',
			format: 'uri',
		},
		currentDrive: {
			type: 'string',
		},
		drives: {
			type: 'object',
		},
		history: {
			type: 'array',
		},
		creds: {
			type: 'object',
		},
	},
})

// Export the Conf class's methods

// Get the value of a key
export const get = (path: string): any => {
	const value = config.get(path)

	Logger.debug(
		`util.config.get: retrieving path ${path}, returned value: ${json(
			value,
		)}`,
	)

	return value
}

// Set the value of a key; create it if not found
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const set = (path: string, value: any): void => {
	Logger.debug(
		`util.config.set: setting value ${json(value)} at path ${path}`,
	)

	return config.set(path, value)
}
