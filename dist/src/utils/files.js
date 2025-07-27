import fs from 'node:fs';
import path from 'node:path';
/**
 * Get the current directory of the file that calls this function.
 *
 * @param filePath File path or module URL (import.meta.url)
 * @returns The current directory of the file that calls this function
 */
export const getDir = (filePath) => path.dirname(filePath).replace(/^file:\/\//, '');
/**
 * Ensures that a directory exists for a given file path.
 *
 * @param filePath The file path to ensure the directory exists for
 * @returns The original file path
 */
export const ensureDirectoryExists = (filePath) => {
    const dirname = getDir(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
    return filePath;
};
/**
 * Get the content of a file which is located relative to the passed base path.
 *
 * @param basePath The base path to resolve the file path against
 * @param filePath The relative file path to read
 * @param encoding The encoding of the file, defaults to automatic based on file extension
 * @throws If the file does not exist
 * @returns The content of the file
 */
export const getFileInfo = (basePath, filePath, encoding) => {
    const fullPath = path.join(basePath, filePath);
    if (!fs.existsSync(fullPath))
        throw new Error(`File not found: ${fullPath}`);
    const extension = path.extname(fullPath).slice(1).toLowerCase();
    const type = ({
        png: {
            category: 'image',
            mime: 'image/png',
            encoding: 'base64',
        },
        jpg: {
            category: 'image',
            mime: 'image/jpeg',
            encoding: 'base64',
        },
        jpeg: {
            category: 'image',
            mime: 'image/jpeg',
            encoding: 'base64',
        },
        gif: {
            category: 'image',
            mime: 'image/gif',
            encoding: 'base64',
        },
        webp: {
            category: 'image',
            mime: 'image/webp',
            encoding: 'base64',
        },
        txt: {
            category: 'text',
            mime: 'text/plain',
            encoding: 'utf-8',
        },
        md: {
            category: 'text',
            mime: 'text/markdown',
            encoding: 'utf-8',
        },
        yaml: {
            category: 'text',
            mime: 'text/yaml',
            encoding: 'utf-8',
        },
        yml: {
            category: 'text',
            mime: 'text/yaml',
            encoding: 'utf-8',
        },
        json: {
            category: 'text',
            mime: 'application/json',
            encoding: 'utf-8',
        },
        csv: {
            category: 'text',
            mime: 'text/csv',
            encoding: 'utf-8',
        },
        tsv: {
            category: 'text',
            mime: 'text/tab-separated-values',
            encoding: 'utf-8',
        },
        html: {
            category: 'text',
            mime: 'text/html',
            encoding: 'utf-8',
        },
        xml: {
            category: 'text',
            mime: 'text/xml',
            encoding: 'utf-8',
        },
        css: {
            category: 'text',
            mime: 'text/css',
            encoding: 'utf-8',
        },
        js: {
            category: 'text',
            mime: 'application/javascript',
            encoding: 'utf-8',
        },
        jsx: {
            category: 'text',
            mime: 'application/javascript',
            encoding: 'utf-8',
        },
        ts: {
            category: 'text',
            mime: 'application/typescript',
            encoding: 'utf-8',
        },
        tsx: {
            category: 'text',
            mime: 'application/typescript',
            encoding: 'utf-8',
        },
        pdf: {
            category: 'file',
            mime: 'application/pdf',
            encoding: 'binary',
        },
        docx: {
            category: 'file',
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            encoding: 'binary',
        },
        xlsx: {
            category: 'file',
            mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            encoding: 'binary',
        },
        pptx: {
            category: 'file',
            mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            encoding: 'binary',
        },
        mp3: {
            category: 'file',
            mime: 'audio/mpeg',
            encoding: 'binary',
        },
        mp4: {
            category: 'file',
            mime: 'video/mp4',
            encoding: 'binary',
        },
        mkv: {
            category: 'file',
            mime: 'video/x-matroska',
            encoding: 'binary',
        },
        wav: {
            category: 'file',
            mime: 'audio/wav',
            encoding: 'binary',
        },
    }[extension] ?? 'file');
    return {
        fullPath,
        type,
        fileName: path.basename(fullPath),
        extension: path.extname(fullPath),
        content: fs.readFileSync(fullPath, encoding ?? type.encoding),
    };
};
/**
 * Take a base path and list all the files in the directory and subdirectories, ending with `.md`, in a flat array.
 *
 * @param basePath The base path to start listing files from
 * @returns A flat array of all files in the directory and subdirectories ending with `.md`
 */
export const listAllMdFiles = (basePath) => {
    if (!fs.existsSync(basePath))
        throw new Error(`File or directory not found: ${basePath}`);
    if (!fs.lstatSync(basePath).isDirectory()) {
        if (basePath.endsWith('.md')) {
            return [basePath];
        }
        else {
            throw new Error(`File is not a markdown file: ${basePath}`);
        }
    }
    const files = fs.readdirSync(basePath);
    const allFiles = [];
    for (const file of files) {
        const fullPath = path.join(basePath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            allFiles.push(...listAllMdFiles(fullPath));
        }
        else if (file.endsWith('.md')) {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
};
/**
 * Take a base path and list all the files in the directory and subdirectories, ending with `.yaml` or `.yml`, in a flat array.
 *
 * @param basePath The base path to start listing files from
 * @returns A flat array of all files in the directory and subdirectories ending with `.yaml` or `.yml`
 */
export const listAllYamlFiles = (basePath) => {
    if (!fs.existsSync(basePath))
        throw new Error(`File or directory not found: ${basePath}`);
    if (!fs.lstatSync(basePath).isDirectory()) {
        if (basePath.endsWith('.yaml') || basePath.endsWith('.yml')) {
            return [basePath];
        }
        else {
            throw new Error(`File is not a YAML file: ${basePath}`);
        }
    }
    const files = fs.readdirSync(basePath);
    const allFiles = [];
    for (const file of files) {
        const fullPath = path.join(basePath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            allFiles.push(...listAllYamlFiles(fullPath));
        }
        else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
};
/**
 * Create a new file with the given content, ensuring the directory exists.
 *
 * @param filePath The path to the file to create
 * @param content The content to write to the file
 * @param encoding The encoding to use when writing the file, defaults to 'utf-8'
 */
export const createFile = (filePath, content, encoding = 'utf-8') => {
    ensureDirectoryExists(filePath);
    fs.writeFileSync(filePath, content, { encoding });
    return filePath;
};
