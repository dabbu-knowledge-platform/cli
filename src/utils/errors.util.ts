// Utility functions for error handling

// Import utility functions
import { json } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// Extract an error message from the given object. The error may be a string or
// an object that contains a message field
export const getErrorMessage = (
	error: string | Record<string, any>,
): string => {
	Logger.debug(`util.error.getErrorMessage: received error: ${error}`)

	// Print out the error as is if the PRINT_ERRORS environment variable
	// is non null
	if (process.env.PRINT_ERRORS) {
		console.error(error)
	}

	// If the error is a string, return it as is
	if (typeof error === 'string') {
		Logger.debug(
			`util.error.getErrorMessage: error type string, returning as is`,
		)

		return error
	}

	// If it is an axios error, parse the request body and return the error
	// message. Else return whatever is in the message field
	if (typeof error === 'object') {
		Logger.debug(`util.error.getErrorMessage: error type object`)

		if (error.isAxiosError && error.response) {
			// If it's an axios error, return the status code and the error
			const errorMessage =
				error.response.data &&
				error.response.data.error &&
				error.response.data.error.message
					? error.response.data.error.message
					: 'Unknown error'

			Logger.debug(
				`util.error.getErrorMessage: axios error detected; message: ${errorMessage}; response data: ${json(
					error.response.data,
				)}`,
			)

			return errorMessage
		} else {
			// Else return the message field of the object
			Logger.debug(
				`util.error.getErrorMessage: could not detect type; returning message field: ${error.message}`,
			)

			return error.message
		}
	}

	// Else return 'unknown error'. Ideally this should not happen, as all cases
	// have been handled above
	Logger.warn(`util.error.getErrorMessage: unknown error`)

	return 'unknown error'
}
