// Command to clear the screen

// Import the logger
import Logger from '../utils/logger.util'

// The clear command
export const run = async (): Promise<void> => {
	Logger.debug(`command.clear.run: clearing the screen`)

	// Clear the screen
	// \u001B[2J\u001B[0f is the escape sequence to clear the screen and then
	// move the cursor to the start.
	process.stdout.write('\u001B[2J\u001B[0f')
}
