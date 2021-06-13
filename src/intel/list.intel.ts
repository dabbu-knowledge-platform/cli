// Command to list files and subfolders in a drive

// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the cli table library to draw a table of files
import Table from 'cli-table3'
// Use the fs-extra library to perform disk operations
import * as Fs from 'fs-extra'
// Use the env paths library to get the local config path
import EnvPaths from 'env-paths'
const configPath = EnvPaths('Dabbu CLI', { suffix: '' }).config

// Import the actual list functions
import { run as runListForOtherDrives } from '../commands/list.command'
// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
// Import the print statement
import { print, json, path as diskPath } from '../utils/general.util'
// Import the spinner
import * as Spinner from '../ui/spinner.ui'
// Import the logger
import Logger from '../utils/logger.util'

// A function to print out the files received as a table
function printFiles(
	files: Record<string, any>[],
	tableFormat = true,
): void {
	// Create a table with the headers
	if (tableFormat) {
		const table = new Table({
			head: [Chalk.green('Name')],
			colWidths: [null],
		})
		for (let i = 0, length = files.length; i < length; i++) {
			const file = files[i]

			Logger.debug(
				`intel.list.printFiles: printing file: ${json(file)}`,
			)

			// File name - blue if folder, magenta if file
			const name = file.name
			const fileName =
				file.kind === 'folder'
					? `${Chalk.blue(name)} (topic)`
					: Chalk.magenta(name)

			table.push([fileName])
		}

		// Print out the table
		if (table.length > 0) {
			print(`${table.length} related files/topics`)
			print(table.toString())
		} else {
			Logger.debug(`intel.list.printFiles: no related files/topics`)

			print(Chalk.yellow('No related files/topics'))
		}
	} else {
		const table: string[] = []
		for (let i = 0, length = files.length; i < length; i++) {
			const file = files[i]

			Logger.debug(
				`intel.list.printFiles: printing file: ${json(file)}`,
			)

			// File name - blue if folder, magenta if file
			const name = file.name
			const fileName =
				file.kind === 'folder'
					? `${Chalk.blue(name)}`
					: Chalk.magenta(name)

			table.push(fileName)
		}

		// Print out the table
		if (table.length > 0) {
			print(`${table.length} related files/topics`)
			print(table.join('\t'))
		} else {
			Logger.debug(`intel.list.printFiles: no related files/topics`)

			print(Chalk.yellow('No related files/topics'))
		}
	}
}

// The list command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`intel.list.run: ls called with args: ${args}`)
	// Parse the drive and folder path from the args
	const { drive, folderPath } = FsUtils.parseFolderPath(args[0])

	Logger.debug(`intel.list.run: drive: ${drive}`)
	Logger.debug(`intel.list.run: folderPath: ${folderPath}`)

	// If the provider is knowledge, then list out the topics and subtopics
	if (Config.get(`drives.${drive}.provider`) === 'knowledge') {
		// Show a loading indicator
		Spinner.start(`Finding related files and topics...`)

		// Load the knowledge file
		let knowledgeJson: Record<string, any> = {}
		try {
			// In case the file is empty, make sure the topics, people and files
			// fields exist to avoid 'Cannot read property ... of undefined'.
			knowledgeJson = {
				topics: {},
				people: {},
				files: {},
				...(await Fs.readJson(`${configPath}/knowledge/${drive}.json`)),
			}

			Logger.debug(
				`intel.index-files.extractInfo: existing knowledge json: ${json(
					knowledgeJson,
				)}`,
			)
		} catch (error) {
			Logger.debug(
				`intel.index-files.extractInfo: error while opening knowledge file: ${error}`,
			)

			throw new Error(
				`Error while opening knowledge file; try recreating the knowledge drive: ${error}`,
			)
		}

		// First check the folder path
		// If it is '/', then list all the topics only
		if (folderPath === '/') {
			// All topics are folders
			const files = Object.keys(knowledgeJson.topics).map((topic) => {
				return {
					name: topic,
					kind: 'folder',
				}
			})

			// Stop loading, we are done
			Spinner.stop()
			// Print it out
			printFiles(files, false)
			// And return
			return
		}

		const topics = folderPath.split('/')
		// If there is only one topic (the first one is empty as the '/'
		// representing the root folder is split)
		if (topics.length === 2) {
			// First get all files related to that topic
			let relatedFiles: string[] = knowledgeJson.topics[topics[1]]
			if (relatedFiles) {
				// Find all topics related to these files
				let relatedTopics: string[] = []
				for (const file of relatedFiles) {
					relatedTopics = [
						...relatedTopics,
						...knowledgeJson.files[file],
					]

					for (const topic of knowledgeJson.files[file]) {
						if (knowledgeJson.topics[topic]) {
							relatedFiles = [
								...relatedFiles,
								...knowledgeJson.topics[topic],
							]
						}
					}
				}

				// Stop loading, we are done
				Spinner.stop()
				// Print it out
				printFiles([
					...Array.from(new Set(relatedTopics)).map((topic) => {
						return {
							name: topic,
							kind: 'folder',
						}
					}),
					...Array.from(new Set(relatedFiles)).map((file) => {
						return {
							name: file,
							kind: 'file',
						}
					}),
				])
				// And return
				return
			} else {
				// No related files found
				// Stop loading
				Spinner.stop()
				// Print it out
				printFiles([])
				// And return
				return
			}
		}

		// If there are two or more, then do an AND query - only files
		// which are related to those topics and topics related to that
		// subset of files
		if (topics.length > 2) {
			// First get all files related to those topics
			let relatedFiles: string[] = []
			for (const topic of topics.slice(1)) {
				relatedFiles = [...relatedFiles, ...knowledgeJson.topics[topic]]
			}

			// Then narrow it down to those that match all topics
			let matchingFiles: string[] = []

			// Get the number of times each file appears
			const occurrences: Record<string, number> = {}
			for (const file of relatedFiles) {
				occurrences[file] = ++occurrences[file] || 1
			}

			// Get the ones that appear n number of times, where
			// n is the number of topics it should match
			for (const file of Object.keys(occurrences)) {
				if (occurrences[file] === topics.slice(1).length) {
					// Those are the actual related files
					matchingFiles = [...matchingFiles, file]
				}
			}

			if (matchingFiles) {
				// Find all topics related to these files
				let relatedTopics: string[] = []
				for (const file of matchingFiles) {
					relatedTopics = [
						...relatedTopics,
						...knowledgeJson.files[file],
					]

					for (const topic of knowledgeJson.files[file]) {
						if (knowledgeJson.topics[topic]) {
							relatedFiles = [
								...relatedFiles,
								...knowledgeJson.topics[topic],
							]
						}
					}
				}

				// Stop loading, we are done
				Spinner.stop()
				// Print it out
				printFiles([
					...Array.from(new Set(relatedTopics)).map((topic) => {
						return {
							name: topic,
							kind: 'folder',
						}
					}),
					...Array.from(new Set(matchingFiles)).map((file) => {
						return {
							name: file,
							kind: 'file',
						}
					}),
				])
				// And return
				return
			} else {
				// No related files found
				// Stop loading
				Spinner.stop()
				// Print it out
				printFiles([])
				// And return
				return
			}
		}
	} else {
		// Else run the actual list function
		return runListForOtherDrives(args)
	}
}
