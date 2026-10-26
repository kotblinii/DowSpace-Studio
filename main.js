// main.js
// Processo principal do Electron para o DownVideo Studio Desktop

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBinaries } from './src/binaries.js';
import { getVideoMetadata, downloadMedia, findCookiesFile } from './src/downloader.js';
import { compressVideo, getVideoDetails } from './src/compressor.js';
import {
  getDrivesInfo,
  scanDirectory,
  getFolderContents,
  openFolderInExplorer,
  selectInExplorer,
  moveToRecycleBin
} from './src/diskAnalyzer.js';
import {
  saveScanResult,
  getSavedScan,
  saveFolderContentsCache,
  getSavedFolderContents,
  removeFileFromDatabase
} from './src/storageDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderMemoryCache = new Map();

let mainWindow = null;
let currentScanController = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'DowSpace Studio — Baixador, Compactador & Gerenciador de SSD',
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos no navegador padrão do usuário
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// -------------------------------------------------------------
// Registro de Handlers IPC
// -------------------------------------------------------------

// Diálogos Nativos do Windows
ipcMain.handle('dialog:select-video-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione um Arquivo de Vídeo',
    properties: ['openFile'],
    filters: [
      { name: 'Vídeos', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione uma Pasta',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Ações no Sistema de Arquivos
ipcMain.handle('disk:open-explorer', async (_event, targetPath) => {
  try {
    await selectInExplorer(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:open-folder', async (_event, targetPath) => {
  try {
    await openFolderInExplorer(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:select-file', async (_event, targetPath) => {
  try {
    await selectInExplorer(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:get-folder-contents', async (event, dirPath, options = {}) => {
  const normKey = path.resolve(dirPath).toLowerCase();
  const forceRefresh = Boolean(options.forceRefresh);

  // 1. Nível 1: Memória RAM (0 ms)
  if (!forceRefresh && folderMemoryCache.has(normKey)) {
    return { success: true, data: folderMemoryCache.get(normKey), cached: true, source: 'ram' };
  }

  // 2. Nível 2: Banco JSON Persistente (~5 ms)
  if (!forceRefresh) {
    const saved = getSavedFolderContents(dirPath);
    if (saved && saved.items && saved.items.length > 0) {
      folderMemoryCache.set(normKey, saved);
      return { success: true, data: saved, cached: true, source: 'database' };
    }
  }

  // 3. Nível 3: Varredura de Disco Otimizada Concorrente
  try {
    const data = await getFolderContents(dirPath, {
      ...options,
      onItemMeasured: (item) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('disk:folder-item-updated', {
            parentPath: dirPath,
            item
          });
        }
      }
    });

    folderMemoryCache.set(normKey, data);
    saveFolderContentsCache(dirPath, data);
    return { success: true, data, cached: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:get-saved-scan', async (_event, targetPath) => {
  try {
    const data = getSavedScan(targetPath);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:move-recycle-bin', async (_event, targetPath, freedBytes = 0) => {
  try {
    await moveToRecycleBin(targetPath);
    const dbUpdate = removeFileFromDatabase(targetPath, freedBytes);
    // Invalida a pasta pai no cache de memória
    try {
      const parentDir = path.dirname(path.resolve(targetPath)).toLowerCase();
      folderMemoryCache.delete(parentDir);
    } catch {}
    return { success: true, dbUpdate };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:remove-file-db', async (_event, filePath, freedBytes = 0) => {
  try {
    const dbUpdate = removeFileFromDatabase(filePath, freedBytes);
    return { success: true, dbUpdate };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Gerenciador de SSD
ipcMain.handle('disk:get-drives', async () => {
  return await getDrivesInfo();
});

ipcMain.handle('disk:scan-directory', async (event, targetPath, options = {}) => {
  if (currentScanController) {
    currentScanController.abort();
  }
  currentScanController = new AbortController();

  try {
    const result = await scanDirectory(
      targetPath,
      { ...options, signal: currentScanController.signal },
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('disk:scan-progress', progress);
        }
      }
    );
    // Salva automaticamente no banco de dados local
    saveScanResult(targetPath, result);

    currentScanController = null;
    return { success: true, data: result };
  } catch (err) {
    currentScanController = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('disk:cancel-scan', async () => {
  if (currentScanController) {
    currentScanController.abort();
    currentScanController = null;
    return { canceled: true };
  }
  return { canceled: false };
});

// Compactador de Vídeo
ipcMain.handle('video:get-details', async (_event, filePath) => {
  try {
    await ensureBinaries();
    const details = await getVideoDetails(filePath);
    return { success: true, data: details };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('video:compress', async (event, filePath, options = {}) => {
  try {
    await ensureBinaries();
    const summary = await compressVideo(filePath, {
      ...options,
      onProgress: (prog) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('video:compress-progress', prog);
        }
      }
    });
    return { success: true, data: summary };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Baixador do YouTube
ipcMain.handle('youtube:get-metadata', async (_event, url) => {
  try {
    await ensureBinaries();
    const cookiesFile = findCookiesFile();
    const meta = await getVideoMetadata(url, cookiesFile);
    return { success: true, data: meta };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('youtube:download', async (event, url, options = {}) => {
  try {
    await ensureBinaries();
    const cookiesFile = findCookiesFile(options.cookiesPath);
    const result = await downloadMedia(url, {
      ...options,
      cookiesPath: cookiesFile,
      onProgress: (prog) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('youtube:download-progress', prog);
        }
      }
    });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Inicialização do Electron
app.whenReady().then(async () => {
  createWindow();

  // Pré-aquecimento dos binários em background
  ensureBinaries().catch(err => {
    console.error('Falha ao verificar executáveis:', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
