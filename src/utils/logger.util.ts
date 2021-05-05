// Use winston for logging
import Winston from 'winston'
// Use the env paths library to get the local config path
import EnvPaths from 'env-paths'
const logsPath = EnvPaths('Dabbu CLI', { suffix: '' }).config

// The severity levels a log can have
const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
}

// Set the level based on the NODE_ENV environment variable
const level = () => {
	const env = (process.env.NODE_ENV || 'development').toLowerCase()
	const isDevelopment = env === 'development' || env === 'dev'
	return isDevelopment ? 'debug' : 'http'
}

// Define different colors for each level
const colors = {
	error: 'red',
	warn: 'yellow',
	info: 'green',
	debug: 'white',
}

// Tell winston that we want to link the colors
// defined above to the severity levels
Winston.addColors(colors)

// Define which transports the logger must use to print out messages
const transports = [
	// Save the logs in a file as well, in the same format as the console
	new Winston.transports.File({
		filename: `${logsPath}/logs/dabbu-cli.log`,
		format: Winston.format.combine(
			// Add the message timestamp with the preferred format
			Winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
			// Define the format of the message showing the timestamp, the level and
			// the message
			Winston.format.printf(
				(info: Record<string, any>) =>
					`${info.timestamp} ${info.level}: ${info.message}`,
			),
		),
	}),
	// Save the logs in a JSON format
	new Winston.transports.File({
		filename: `${logsPath}/logs/dabbu-cli.json.log`,
		format: Winston.format.combine(
			// Add the message timestamp with the preferred format
			Winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
		),
	}),
]

// Create the logger instance that has to be exported
// and used to log messages.
const Logger = Winston.createLogger({
	level: level(),
	levels,
	transports,
})

// Export the logger by default as we will be using it most
export default Logger
