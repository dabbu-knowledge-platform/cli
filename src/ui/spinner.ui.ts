// Anything related to showing a loading indicator

// Use ora to show a loading indicator
import ora from 'ora'
// Import the logger
import Logger from '../utils/logger.util'

const spinner = ora()

// Show a spinner with the specified text
export const start = (text?: string): void => {
	spinner.start(text)
}

// Stop the spinner
export const stop = (): string => {
	return spinner.stop().text
}

// Check if the spinner is running
export const isActive = (): boolean => {
	return spinner.isSpinning
}
