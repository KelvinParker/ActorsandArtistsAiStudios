/**
 * Collects `{ file, relativePath }` from a drag `DataTransfer`.
 * Uses `webkitGetAsEntry` + directory walk so **dropped folders** keep nested paths
 * (Chrome/Safari). Falls back to `dataTransfer.files` + `webkitRelativePath`.
 */

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    entries.push(...batch);
  }
  return entries;
}

async function walkEntry(
  entry: FileSystemEntry,
  basePath: string,
  out: { file: File; relativePath: string }[],
): Promise<void> {
  if (entry.isFile) {
    const fe = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fe.file(resolve, reject);
    });
    const relativePath = basePath ? `${basePath}/${file.name}` : file.name;
    out.push({ file, relativePath });
    return;
  }

  if (!entry.isDirectory) return;

  const dir = entry as FileSystemDirectoryEntry;
  const reader = dir.createReader();
  const dirName = dir.name;
  const nextBase = basePath ? `${basePath}/${dirName}` : dirName;
  const children = await readAllDirectoryEntries(reader);
  for (const child of children) {
    await walkEntry(child, nextBase, out);
  }
}

export async function collectFilesFromDataTransfer(
  dt: DataTransfer,
): Promise<{ file: File; relativePath: string }[]> {
  const items = [...dt.items].filter((i) => i.kind === "file");

  if (items.length > 0 && typeof items[0]!.webkitGetAsEntry === "function") {
    const out: { file: File; relativePath: string }[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        await walkEntry(entry, "", out);
      }
    }
    if (out.length > 0) {
      return out;
    }
  }

  const files = [...dt.files];
  return files.map((file) => ({
    file,
    relativePath:
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}
