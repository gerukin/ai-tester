import fs from 'node:fs'
import path from 'node:path'

/**
 * Get the current directory of the file that calls this function.
 *
 * @param filePath File path or module URL (import.meta.url)
 * @returns The current directory of the file that calls this function
 */
export const getDir = (filePath: string): string => path.dirname(filePath).replace(/^file:\/\//, '')

/**
 * Ensures that a directory exists for a given file path.
 *
 * @param filePath The file path to ensure the directory exists for
 * @returns The original file path
 */
export const ensureDirectoryExists = (filePath: string) => {
	const dirname = getDir(filePath)
	if (!fs.existsSync(dirname)) {
		fs.mkdirSync(dirname, { recursive: true })
	}
	return filePath
}

/**
 * Take a base path and list all the files in the directory and subdirectories, ending with `.md`, in a flat array.
 *
 * @param basePath The base path to start listing files from
 * @returns A flat array of all files in the directory and subdirectories ending with `.md`
 */
export const listAllMdFiles = (basePath: string): string[] => {
	if (!fs.existsSync(basePath)) throw new Error(`File or directory not found: ${basePath}`)

	if (!fs.lstatSync(basePath).isDirectory()) {
		if (basePath.endsWith('.md')) {
			return [basePath]
		} else {
			throw new Error(`File is not a markdown file: ${basePath}`)
		}
	}

	const files = fs.readdirSync(basePath)
	const allFiles: string[] = []
	for (const file of files) {
		const fullPath = path.join(basePath, file)
		if (fs.statSync(fullPath).isDirectory()) {
			allFiles.push(...listAllMdFiles(fullPath))
		} else if (file.endsWith('.md')) {
			allFiles.push(fullPath)
		}
	}
	return allFiles
}
