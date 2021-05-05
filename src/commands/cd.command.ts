// Command to move into a folder

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
// Import the logger
import Logger from '../utils/logger.util'

// The cd command
export const run = async (args: string[]): Promise<void> => {
	// Parse the drive and folder path from the args. If there are no args
	// specified, go to the root folder
	const { drive, folderPath } = FsUtils.parsePath(args[0] || '/')
	// Store it in config
	Config.set(`drives.${drive}.path`, folderPath)
	// If the drive is different from the current drive, switch to it
	if (Config.get('currentDrive') !== drive) {
		Config.set('currentDrive', drive)
	}
}
