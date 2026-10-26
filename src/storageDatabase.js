// src/storageDatabase.js
// Banco de dados local persistente para armazenar resultados de varredura do SSD
// Permite abrir o app instantaneamente sem re-escanear e atualizar dados ao apagar arquivos

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBytes } from './ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dbFilePath = path.join(dataDir, 'storage_db.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Lê o banco de dados do disco.
 */
export function readDatabase() {
  ensureDataDir();
  if (!fs.existsSync(dbFilePath)) {
    return {
      version: 1,
      lastUpdated: null,
      scans: {},
      folderContents: {}
    };
  }

  try {
    const raw = fs.readFileSync(dbFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler banco de dados de armazenamento, reiniciando:', err);
    return {
      version: 1,
      lastUpdated: null,
      scans: {},
      folderContents: {}
    };
  }
}

/**
 * Salva o banco de dados de forma atômica no disco.
 */
export function writeDatabase(db) {
  ensureDataDir();
  db.lastUpdated = new Date().toISOString();
  const tempPath = `${dbFilePath}.tmp_${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempPath, dbFilePath);
    return true;
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    console.error('Erro ao salvar banco de dados de armazenamento:', err);
    return false;
  }
}

/**
 * Salva uma varredura completa de uma unidade ou pasta.
 */
export function saveScanResult(rootPath, scanData) {
  const db = readDatabase();
  const key = path.resolve(rootPath).toLowerCase();

  db.scans[key] = {
    rootPath: path.resolve(rootPath),
    scannedAt: new Date().toISOString(),
    totalFilesScanned: scanData.totalFilesScanned || 0,
    totalBytesScanned: scanData.totalBytesScanned || 0,
    totalFormatted: scanData.totalFormatted || formatBytes(scanData.totalBytesScanned || 0),
    folders: scanData.folders || [],
    largeVideos: scanData.largeVideos || []
  };

  writeDatabase(db);
  return db.scans[key];
}

/**
 * Obtém a última varredura salva para uma unidade ou pasta.
 */
export function getSavedScan(rootPath) {
  const db = readDatabase();
  const key = path.resolve(rootPath).toLowerCase();
  const scan = db.scans[key];
  if (!scan) return null;

  return {
    ...scan,
    isSaved: true
  };
}

/**
 * Salva o conteúdo de uma pasta específica (drill-down do SpaceSniffer).
 */
export function saveFolderContentsCache(dirPath, data) {
  const db = readDatabase();
  const key = path.resolve(dirPath).toLowerCase();

  if (!db.folderContents) db.folderContents = {};
  db.folderContents[key] = {
    path: path.resolve(dirPath),
    savedAt: new Date().toISOString(),
    name: data.name,
    totalBytes: data.totalBytes,
    totalFormatted: data.totalFormatted,
    items: data.items || []
  };

  writeDatabase(db);
}

/**
 * Obtém o conteúdo salvo em cache de uma pasta.
 */
export function getSavedFolderContents(dirPath) {
  const db = readDatabase();
  if (!db.folderContents) return null;
  const key = path.resolve(dirPath).toLowerCase();
  return db.folderContents[key] || null;
}

/**
 * Remove um arquivo apagado do banco de dados e recalcula totais.
 */
export function removeFileFromDatabase(filePath, freedBytes = 0) {
  const db = readDatabase();
  const resolvedTarget = path.resolve(filePath).toLowerCase();

  let removed = false;
  let actuallyFreed = freedBytes;

  // 1. Atualizar todas as varreduras salvas
  for (const scanKey of Object.keys(db.scans || {})) {
    const scan = db.scans[scanKey];
    if (scan.largeVideos && Array.isArray(scan.largeVideos)) {
      const initialLen = scan.largeVideos.length;
      scan.largeVideos = scan.largeVideos.filter(v => {
        const matches = path.resolve(v.path).toLowerCase() === resolvedTarget;
        if (matches && !actuallyFreed) {
          actuallyFreed = v.sizeBytes || 0;
        }
        return !matches;
      });

      if (scan.largeVideos.length !== initialLen) {
        removed = true;
        scan.totalBytesScanned = Math.max(0, scan.totalBytesScanned - actuallyFreed);
        scan.totalFormatted = formatBytes(scan.totalBytesScanned);

        // Atualizar tamanho da pasta pai correspondente na lista de pastas
        const parentDir = path.dirname(resolvedTarget);
        if (scan.folders && Array.isArray(scan.folders)) {
          scan.folders.forEach(f => {
            const fResolved = path.resolve(f.path).toLowerCase();
            if (parentDir.startsWith(fResolved)) {
              f.sizeBytes = Math.max(0, f.sizeBytes - actuallyFreed);
              f.sizeFormatted = formatBytes(f.sizeBytes);
            }
          });

          // Recalcular porcentagens
          const grandTotal = scan.totalBytesScanned || 1;
          scan.folders.forEach(f => {
            f.percentOfTotal = Number(((f.sizeBytes / grandTotal) * 100).toFixed(1));
          });
        }
      }
    }
  }

  // 2. Atualizar cache de pastas do SpaceSniffer
  for (const folderKey of Object.keys(db.folderContents || {})) {
    const fc = db.folderContents[folderKey];
    if (fc.items && Array.isArray(fc.items)) {
      const initLen = fc.items.length;
      fc.items = fc.items.filter(it => {
        return path.resolve(it.path).toLowerCase() !== resolvedTarget;
      });
      if (fc.items.length !== initLen) {
        fc.totalBytes = Math.max(0, fc.totalBytes - actuallyFreed);
        fc.totalFormatted = formatBytes(fc.totalBytes);
      }
    }
  }

  if (removed || actuallyFreed > 0) {
    writeDatabase(db);
  }

  return {
    success: true,
    freedBytes: actuallyFreed,
    freedFormatted: formatBytes(actuallyFreed)
  };
}
