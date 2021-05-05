// Command to move into a folder

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
// Import the logger
import Logger from '../utils/logger.util'

// The cd command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.cd.run: cd called with args: ${args}`)

	// Parse the drive and folder path from the args. If there are no args
	// specified, go to the root folder
	const { drive, folderPath } = FsUtils.parsePath(args[0] || '/')

	Logger.debug(`command.cd.run: drive: ${drive}`)
	Logger.debug(`command.cd.run: folderPath: ${folderPath}`)

	Logger.debug(`command.cd.run: setting folderPath for drive`)
	// Store it in config
	Config.set(`drives.${drive}.path`, folderPath)

	// If the drive is different from the current drive, switch to it
	if (Config.get('currentDrive') !== drive) {
		Logger.debug(
			`command.cd.run: switching from ${Config.get(
				'currentDrive',
			)} to ${drive}`,
		)
		Config.set('currentDrive', drive)
	}
}
