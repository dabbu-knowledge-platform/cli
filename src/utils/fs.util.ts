// Utility functions related to path parsing

// Import all methods from config and utils
import * as Config from '../utils/config.util'
// Import the logger
import Logger from '../utils/logger.util'

// Parse the given path for the drive name and the folder path
export function parseFolderPath(
	rawPath: string | undefined,
): { drive: string; folderPath: string } {
	// The name of the drive
	let drive = ''
	// If there is no path, let the path be '.', or the current folder
	let folderPath = rawPath || '.'

	// Check if the path contains a drive
	// If the path is 'c:/Dabbu/some-folder-with:a:colon', the split path will be
	// ['c', '/Dabbu/some-folder-with', 'a', 'colon']
	const splitPath = folderPath.split(':')
	if (splitPath.length > 1) {
		// The drive is the first element, i.e., 'c'
		drive = splitPath[0]
		// The rest of the array is the folder path, ignore colons in there, i.e.,
		// '/Dabbu/some-folder-with:a:colon'
		folderPath = splitPath.slice(1).join(':')
	} else {
		// If there is no drive, set the drive to the current drive. Also, the
		// array will have only one element, which is the path
		drive = Config.get('currentDrive') as string
		folderPath = splitPath[0]
	}

	// Next, resolve relative paths like '..' and '.'
	folderPath = resolvePath(
		folderPath,
		(Config.get(`drives.${drive}.path`) as string) || '',
	)

	// Lastly, check if the drive exists
	if (!Config.get(`drives.${drive}.provider`)) {
		throw new Error(`Drive ${drive} does not exist`)
	}

	// Return the drive name and the folder path
	return { drive: drive, folderPath: folderPath }
}

// Parse the given path for the drive name, the folder path and the file name
export function parseFilePath(
	rawPath: string | undefined,
): { drive: string; folderPath: string; fileName: string } {
	// The name of the drive
	let drive = ''
	// If there is no path, let the path be '.', or the current folder
	let folderPath = rawPath || '.'
	// The name of the file
	let fileName = ''

	// Check if the path contains a drive
	// If the path is 'c:/Dabbu/some-folder-with:a:colon', the split path will be
	// ['c', '/Dabbu/some-folder-with', 'a', 'colon']
	let splitPath = folderPath.split(':')
	if (splitPath.length > 1) {
		// The drive is the first element, i.e., 'c'
		drive = splitPath[0]
		// The rest of the array is the folder path, ignore colons in there, i.e.,
		// '/Dabbu/some-folder-with:a:colon'
		folderPath = splitPath.slice(1).join(':')
	} else {
		// If there is no drive, set the drive to the current drive. Also, the
		// array will have only one element, which is the path
		drive = Config.get('currentDrive') as string
		folderPath = splitPath[0]
	}

	// Next, resolve relative paths like '..' and '.'
	folderPath = resolvePath(
		folderPath,
		(Config.get(`drives.${drive}.path`) as string) || '',
	)

	// Check if the drive exists
	if (!Config.get(`drives.${drive}.provider`)) {
		throw new Error(`Drive ${drive} does not exist`)
	}

	// Now split out the file name
	// This should result in ['', 'Dabbu', 'fileName']
	splitPath = folderPath.split('/')
	// The last element is the folder path
	fileName = splitPath[splitPath.length - 1]
	if (splitPath.length === 2) {
		// The file is in the root folder
		folderPath = '/'
	} else {
		// The file is in a subfolder
		folderPath = splitPath.slice(0, splitPath.length - 1).join('/')
	}

	// Return the drive name, the folder path and the file name
	return { drive, folderPath, fileName }
}

// Return an absolute path based on the current path in
// the drive and the given path
export function resolvePath(
	rawPath: string | undefined,
	currentPath: string,
): string {
	// If there is no path given, or the path is /, return /
	if (!rawPath || rawPath === '/') {
		return '/'
	}

	// Split the path by / and get an array of folders
	const folders = rawPath.split('/')
	// The final path should begin with the current path
	// only if the user hasn't mentioned an absolute path
	const finalPath =
		rawPath.startsWith('/') || !currentPath
			? ['/']
			: currentPath.split('/')

	// Loop through the input path
	for (let i = 0, length = folders.length; i < length; i++) {
		// Get the folder
		const folder = folders[i]
		if (folder === '.' || !folder) {
			// Do nothing if the folder is . (meaning current directory) or if the
			// folder is an empty string
			continue
		} else if (folder === '..') {
			// Go back one folder if the path is ..
			finalPath.pop()
		} else {
			// Else add the folder to the path
			finalPath.push(folder)
		}
	}

	// Return the path, joined by /s and replace any duplicate slash
	return finalPath.join('/').replace(/\/+/g, '/')
}

export function makeSizeReadable(sizeInBytes: number): string {
	const thresh = 1024

	if (Math.abs(sizeInBytes) < thresh) {
		return sizeInBytes + ' B'
	}

	const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
	let unitIndex = -1
	const decimalsToKeep = 2

	do {
		sizeInBytes /= thresh
		++unitIndex
	} while (
		Math.round(Math.abs(sizeInBytes) * 10 ** decimalsToKeep) /
			10 ** decimalsToKeep >=
			thresh &&
		unitIndex < units.length - 1
	)

	return sizeInBytes.toFixed(decimalsToKeep) + ' ' + units[unitIndex]
}
