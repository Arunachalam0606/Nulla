/**
 * Recursive Directory Traversal for Drag-and-Drop and Folder Upload
 */

export interface ScannedFile {
  file: File;
  relativePath: string;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file: (callback: (file: File) => void, errorCallback?: (error: unknown) => void) => void;
}

interface FileSystemDirectoryReaderLike {
  readEntries: (
    successCallback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: (error: unknown) => void
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader: () => FileSystemDirectoryReaderLike;
}

async function readAllEntriesFromReader(
  reader: FileSystemDirectoryReaderLike
): Promise<FileSystemEntryLike[]> {
  const entries: FileSystemEntryLike[] = [];

  const readBatch = async (): Promise<void> => {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (batch.length > 0) {
      entries.push(...batch);
      await readBatch();
    }
  };

  await readBatch();
  return entries;
}

async function traverseEntry(
  entry: FileSystemEntryLike,
  currentPath: string
): Promise<ScannedFile[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntryLike;
    return new Promise<ScannedFile[]>((resolve) => {
      fileEntry.file(
        (file) => {
          const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
          resolve([{ file, relativePath }]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntryLike;
    const dirReader = dirEntry.createReader();
    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const subEntries = await readAllEntriesFromReader(dirReader);

    const subResults = await Promise.all(
      subEntries.map((subEntry) => traverseEntry(subEntry, newPath))
    );

    return subResults.flat();
  }

  return [];
}

export async function scanDataTransferItems(
  items: DataTransferItemList
): Promise<ScannedFile[]> {
  const scanned: ScannedFile[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.kind === 'file') {
      const entry = (
        typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
      ) as FileSystemEntryLike | null;

      if (entry) {
        const results = await traverseEntry(entry, '');
        scanned.push(...results);
      } else {
        const file = item.getAsFile();
        if (file) {
          scanned.push({ file, relativePath: file.name });
        }
      }
    }
  }

  return scanned;
}

export function scanFileList(files: FileList | File[]): ScannedFile[] {
  const result: ScannedFile[] = [];
  const list = Array.from(files);

  for (const file of list) {
    const relativePath =
      'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string' && file.webkitRelativePath.length > 0
        ? file.webkitRelativePath
        : file.name;

    result.push({ file, relativePath });
  }

  return result;
}
