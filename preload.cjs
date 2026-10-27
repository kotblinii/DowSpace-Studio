// preload.cjs
// Ponte segura entre a interface gráfica do Electron e o processo Node.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Diálogos nativos
  selectVideoFile: () => ipcRenderer.invoke('dialog:select-video-file'),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  openInExplorer: (targetPath) => ipcRenderer.invoke('disk:open-explorer', targetPath),
  openFolderInExplorer: (targetPath) => ipcRenderer.invoke('disk:open-folder', targetPath),
  selectInExplorer: (targetPath) => ipcRenderer.invoke('disk:select-file', targetPath),
  moveToRecycleBin: (targetPath, freedBytes) => ipcRenderer.invoke('disk:move-recycle-bin', targetPath, freedBytes),

  // Gerenciador de SSD & Banco de Dados Persistente
  getDrives: () => ipcRenderer.invoke('disk:get-drives'),
  scanDirectory: (targetPath, options) => ipcRenderer.invoke('disk:scan-directory', targetPath, options),
  getSavedScan: (targetPath) => ipcRenderer.invoke('disk:get-saved-scan', targetPath),
  getFolderContents: (dirPath, options) => ipcRenderer.invoke('disk:get-folder-contents', dirPath, options),
  removeFileFromDb: (filePath, freedBytes) => ipcRenderer.invoke('disk:remove-file-db', filePath, freedBytes),
  cancelScan: () => ipcRenderer.invoke('disk:cancel-scan'),
  scanAppCaches: () => ipcRenderer.invoke('cache:scan'),
  cleanSelectedCaches: (cacheIds) => ipcRenderer.invoke('cache:clean', cacheIds),
  onScanProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('disk:scan-progress', handler);
    return () => ipcRenderer.removeListener('disk:scan-progress', handler);
  },
  onFolderItemUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('disk:folder-item-updated', handler);
    return () => ipcRenderer.removeListener('disk:folder-item-updated', handler);
  },

  // Compactador de Vídeo
  getVideoDetails: (filePath) => ipcRenderer.invoke('video:get-details', filePath),
  compressVideo: (filePath, options) => ipcRenderer.invoke('video:compress', filePath, options),
  onCompressProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('video:compress-progress', handler);
    return () => ipcRenderer.removeListener('video:compress-progress', handler);
  },

  // Baixador do YouTube
  getYoutubeMetadata: (url) => ipcRenderer.invoke('youtube:get-metadata', url),
  downloadYoutube: (url, options) => ipcRenderer.invoke('youtube:download', url, options),
  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('youtube:download-progress', handler);
    return () => ipcRenderer.removeListener('youtube:download-progress', handler);
  }
});
