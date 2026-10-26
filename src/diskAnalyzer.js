// src/diskAnalyzer.js
// Motor de análise e diagnóstico de armazenamento do SSD / HD
// Suporta visualização SpaceSniffer, navegação hierárquica profunda e detecção de arquivos gigantes

import fs from 'node:fs';
import path from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { formatBytes } from './ui.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv',
  '.wmv', '.m4v', '.m2ts', '.mpg', '.mpeg', '.3gp'
]);

const SYSTEM_IGNORE_FOLDERS = new Set([
  '$recycle.bin',
  'system volume information',
  '$windows.~bt',
  '$windows.~ws',
  'config.msi',
  'recovery',
  'hiberfil.sys',
  'pagefile.sys',
  'swapfile.sys',
  'dumpstack.log'
]);

/**
 * Obtém informações de todas as unidades lógicas locais (SSDs / HDDs).
 */
export async function getDrivesInfo() {
  try {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd);
    if (!stdout.trim()) return [];

    let parsed = JSON.parse(stdout.trim());
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }

    return parsed.map(drive => {
      const id = drive.DeviceID || 'C:';
      const label = drive.VolumeName ? `${drive.VolumeName} (${id})` : `Disco Local (${id})`;
      const total = Number(drive.Size) || 0;
      const free = Number(drive.FreeSpace) || 0;
      const used = Math.max(0, total - free);
      const usedPercent = total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0;

      return {
        id,
        label,
        totalBytes: total,
        freeBytes: free,
        usedBytes: used,
        usedPercent,
        totalFormatted: formatBytes(total),
        freeFormatted: formatBytes(free),
        usedFormatted: formatBytes(used)
      };
    });
  } catch (err) {
    console.error('Erro ao consultar unidades de disco:', err);
    return [];
  }
}

/**
 * Realiza a varredura profunda de um diretório ou unidade.
 * Retorna os itens de primeiro nível medidos e a lista de grandes arquivos de vídeo.
 */
export async function scanDirectory(rootPath, options = {}, onProgress = null) {
  const resolvedRoot = path.resolve(rootPath);
  const minVideoSize = options.minVideoSize || 50 * 1024 * 1024; // Padrão: 50MB
  const maxVideos = options.maxVideos || 150;
  const signal = options.signal || null;

  let totalFilesScanned = 0;
  let totalBytesScanned = 0;
  const largeVideos = [];

  let topItems = [];
  try {
    topItems = await fs.promises.readdir(resolvedRoot, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Não foi possível acessar a pasta: ${err.message}`);
  }

  const validTopItems = topItems.filter(item => {
    return !SYSTEM_IGNORE_FOLDERS.has(item.name.toLowerCase());
  });

  const folderStats = [];
  let rootFilesSize = 0;
  let rootFilesCount = 0;

  const dirItems = validTopItems.filter(i => i.isDirectory());
  const fileItems = validTopItems.filter(i => i.isFile());

  // Mede arquivos da raiz em paralelo
  await Promise.all(fileItems.map(async (item) => {
    const itemPath = path.join(resolvedRoot, item.name);
    try {
      const stat = await fs.promises.stat(itemPath);
      rootFilesSize += stat.size;
      rootFilesCount++;
      totalBytesScanned += stat.size;
      totalFilesScanned++;

      const ext = path.extname(item.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext) && stat.size >= minVideoSize) {
        largeVideos.push({
          name: item.name,
          path: itemPath,
          folderPath: resolvedRoot,
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          ext,
          modifiedDate: stat.mtime
        });
      }
    } catch {}
  }));

  // Mede diretórios de primeiro nível com pool concorrente controlado
  const CONCURRENCY_SCAN = 4;
  const measuredTopFolders = await mapConcurrent(dirItems, CONCURRENCY_SCAN, async (item) => {
    if (signal?.aborted) return null;
    const itemPath = path.join(resolvedRoot, item.name);
    const folderRes = await measureFolderRecursive(itemPath, {
      minVideoSize,
      largeVideos,
      signal,
      onProgress: (folderPath, count, bytes) => {
        totalFilesScanned += count;
        totalBytesScanned += bytes;
        if (onProgress) {
          onProgress({
            currentFolder: folderPath,
            filesScanned: totalFilesScanned,
            bytesScanned: totalBytesScanned
          });
        }
      }
    });

    return {
      name: item.name,
      path: itemPath,
      isDirectory: true,
      sizeBytes: folderRes.size,
      sizeFormatted: formatBytes(folderRes.size),
      fileCount: folderRes.files
    };
  });

  for (const f of measuredTopFolders) {
    if (f) folderStats.push(f);
  }

  if (rootFilesCount > 0) {
    folderStats.push({
      name: '(Arquivos na raiz)',
      path: resolvedRoot,
      isDirectory: false,
      sizeBytes: rootFilesSize,
      sizeFormatted: formatBytes(rootFilesSize),
      fileCount: rootFilesCount
    });
  }

  folderStats.sort((a, b) => b.sizeBytes - a.sizeBytes);

  const grandTotal = totalBytesScanned || 1;
  for (const f of folderStats) {
    f.percentOfTotal = Number(((f.sizeBytes / grandTotal) * 100).toFixed(1));
  }

  largeVideos.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const topVideos = largeVideos.slice(0, maxVideos);

  return {
    rootPath: resolvedRoot,
    totalFilesScanned,
    totalBytesScanned,
    totalFormatted: formatBytes(totalBytesScanned),
    folders: folderStats,
    largeVideos: topVideos
  };
}

/**
 * Utilitário de controle de concorrência leve (Pool de Workers assíncronos)
 */
async function mapConcurrent(items, limit, fn) {
  if (!items || items.length === 0) return [];
  const results = new Array(items.length);
  let currentIndex = 0;
  const actualLimit = Math.max(1, Math.min(limit, items.length));

  const workers = Array.from({ length: actualLimit }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Obtém e mede os conteúdos diretos de qualquer pasta para navegação profunda (Drill-Down).
 * Utiliza pool concorrente de até 8 workers e suporte a callback onItemMeasured.
 */
export async function getFolderContents(dirPath, options = {}) {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('Pasta não encontrada.');
  }

  let entries = [];
  try {
    entries = await fs.promises.readdir(resolved, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Permissão negada ou erro ao ler pasta: ${err.message}`);
  }

  const dirsList = [];
  const filesList = [];

  for (const entry of entries) {
    if (SYSTEM_IGNORE_FOLDERS.has(entry.name.toLowerCase())) continue;
    const fullPath = path.join(resolved, entry.name);

    if (entry.isDirectory()) {
      dirsList.push({ name: entry.name, fullPath });
    } else if (entry.isFile()) {
      filesList.push({ name: entry.name, fullPath });
    }
  }

  // 1. Mede arquivos diretos da pasta em lote paralelo (<5ms)
  const fileItems = (await Promise.all(filesList.map(async (file) => {
    try {
      const stat = await fs.promises.stat(file.fullPath);
      const ext = path.extname(file.name).toLowerCase();
      const it = {
        name: file.name,
        path: file.fullPath,
        isDirectory: false,
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        ext,
        isVideo: VIDEO_EXTENSIONS.has(ext)
      };
      if (options.onItemMeasured) options.onItemMeasured(it);
      return it;
    } catch {
      return null;
    }
  }))).filter(Boolean);

  let totalDirBytes = fileItems.reduce((acc, f) => acc + f.sizeBytes, 0);
  const items = [...fileItems];

  // 2. Mede subdiretórios com pool concorrente de alta performance (6 workers paralelos)
  const SUBDIR_CONCURRENCY = 6;
  const dirResults = await mapConcurrent(dirsList, SUBDIR_CONCURRENCY, async (dir) => {
    if (options.signal?.aborted) return null;
    try {
      const { size, files } = await measureFolderRecursive(dir.fullPath, {
        signal: options.signal,
        minVideoSize: 10 * 1024 * 1024,
        largeVideos: []
      });

      const dirItem = {
        name: dir.name,
        path: dir.fullPath,
        isDirectory: true,
        sizeBytes: size,
        sizeFormatted: formatBytes(size),
        fileCount: files
      };

      if (options.onItemMeasured) {
        options.onItemMeasured(dirItem);
      }

      return dirItem;
    } catch {
      return null;
    }
  });

  for (const dirItem of dirResults) {
    if (dirItem) {
      items.push(dirItem);
      totalDirBytes += dirItem.sizeBytes;
    }
  }

  items.sort((a, b) => b.sizeBytes - a.sizeBytes);

  const grandTotal = totalDirBytes || 1;
  items.forEach(item => {
    item.percentOfParent = Number(((item.sizeBytes / grandTotal) * 100).toFixed(1));
  });

  return {
    path: resolved,
    name: path.basename(resolved) || resolved,
    totalBytes: totalDirBytes,
    totalFormatted: formatBytes(totalDirBytes),
    items
  };
}

/**
 * Função interna para medição recursiva de pasta individual com processamento em lote.
 */
async function measureFolderRecursive(dirPath, context) {
  let size = 0;
  let files = 0;

  const stack = [dirPath];
  let lastReportTime = Date.now();
  let deltaFiles = 0;
  let deltaBytes = 0;

  while (stack.length > 0) {
    if (context.signal?.aborted) return { size, files };

    const currentDir = stack.pop();

    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const subFiles = [];
    for (const entry of entries) {
      if (SYSTEM_IGNORE_FOLDERS.has(entry.name.toLowerCase())) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        subFiles.push({ name: entry.name, fullPath });
      }
    }

    // Processamento de arquivos em lotes paralelos de 64 para aceleração de I/O
    if (subFiles.length > 0) {
      const BATCH_SIZE = 64;
      for (let i = 0; i < subFiles.length; i += BATCH_SIZE) {
        const batch = subFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (file) => {
          try {
            const stat = await fs.promises.stat(file.fullPath);
            size += stat.size;
            files++;
            deltaBytes += stat.size;
            deltaFiles++;

            if (context.largeVideos && stat.size >= (context.minVideoSize || 50 * 1024 * 1024)) {
              const ext = path.extname(file.name).toLowerCase();
              if (VIDEO_EXTENSIONS.has(ext)) {
                context.largeVideos.push({
                  name: file.name,
                  path: file.fullPath,
                  folderPath: currentDir,
                  sizeBytes: stat.size,
                  sizeFormatted: formatBytes(stat.size),
                  ext,
                  modifiedDate: stat.mtime
                });
              }
            }
          } catch {}
        }));
      }
    }

    if (context.onProgress && Date.now() - lastReportTime > 200) {
      context.onProgress(currentDir, deltaFiles, deltaBytes);
      deltaFiles = 0;
      deltaBytes = 0;
      lastReportTime = Date.now();
    }
  }

  if (context.onProgress && (deltaFiles > 0 || deltaBytes > 0)) {
    context.onProgress(dirPath, deltaFiles, deltaBytes);
  }

  return { size, files };
}

/**
 * Abre a pasta pai que contém o arquivo diretamente no Windows Explorer.
 */
export async function openFolderInExplorer(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('O caminho especificado não existe.');
  }

  const stat = fs.statSync(resolved);
  const folderToOpen = stat.isDirectory() ? resolved : path.dirname(resolved);
  await execFileAsync('explorer.exe', [folderToOpen]);
}

/**
 * Abre o Windows Explorer e destaca (seleciona) o arquivo especificado.
 */
export async function selectInExplorer(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('O caminho especificado não existe.');
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    await execFileAsync('explorer.exe', [resolved]);
  } else {
    await execFileAsync('explorer.exe', ['/select,', resolved]);
  }
}

/**
 * Move com segurança um arquivo ou pasta para a Lixeira nativa do Windows.
 */
export async function moveToRecycleBin(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('Arquivo não encontrado para exclusão.');
  }

  const isDir = fs.statSync(resolved).isDirectory();
  const escaped = resolved.replace(/'/g, "''");

  const psCmd = isDir
    ? `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
    : `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;

  await execAsync(`powershell -NoProfile -Command "${psCmd}"`);
  return true;
}
