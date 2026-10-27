// src/cacheCleaner.js
// Motor de detecção e limpeza inteligente de caches pesados de aplicativos (After Effects, NVIDIA, Temp, etc.)

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { formatBytes } from './ui.js';

const execAsync = promisify(exec);

const LOCAL_APPDATA = process.env.LOCALAPPDATA || '';
const ROAMING_APPDATA = process.env.APPDATA || '';
const TEMP_DIR = process.env.TEMP || '';

/**
 * Catálogo de regras para detecção de caches de aplicativos conhecidos no Windows.
 */
export const CACHE_CATALOG = [
  {
    id: 'ae_disk_cache',
    app: 'Adobe After Effects',
    name: 'After Effects — Disk Cache',
    description: 'Quadros de pré-visualização (RAM preview) acumulados. 100% seguro para limpar; o After Effects recria automaticamente conforme necessário.',
    processNames: ['AfterFX.exe'],
    locate: () => {
      // Procura em Temp/Adobe/After Effects/*/Disk Cache*
      const base = path.join(TEMP_DIR, 'Adobe', 'After Effects');
      if (!fs.existsSync(base)) return null;
      try {
        const versions = fs.readdirSync(base, { withFileTypes: true });
        for (const v of versions) {
          if (v.isDirectory()) {
            const vPath = path.join(base, v.name);
            const sub = fs.readdirSync(vPath, { withFileTypes: true });
            for (const s of sub) {
              if (s.isDirectory() && s.name.toLowerCase().includes('disk cache')) {
                return path.join(vPath, s.name);
              }
            }
          }
        }
      } catch {}
      return base;
    }
  },
  {
    id: 'adobe_media_cache',
    app: 'Adobe Common',
    name: 'Adobe — Media Cache & Peak Files',
    description: 'Caches de waveforms de áudio (.cfa, .pek) e metadados de vídeo compartilhados entre Premiere Pro e After Effects.',
    processNames: ['Adobe Premiere Pro.exe', 'AfterFX.exe', 'Adobe Media Encoder.exe'],
    locate: () => {
      const p = path.join(ROAMING_APPDATA, 'Adobe', 'Common');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'windows_temp',
    app: 'Windows Temp',
    name: 'Arquivos Temporários do Windows',
    description: 'Instaladores descompactados, logs e arquivos temporários deixados por programas fechados.',
    processNames: [],
    locate: () => {
      return fs.existsSync(TEMP_DIR) ? TEMP_DIR : null;
    }
  },
  {
    id: 'nvidia_dxcache',
    app: 'NVIDIA',
    name: 'NVIDIA — DirectX Shader Cache',
    description: 'Shaders pré-compilados de jogos e softwares 3D. Seguro para limpar; a placa gráfica recompila quando necessário.',
    processNames: [],
    locate: () => {
      const p = path.join(LOCAL_APPDATA, 'NVIDIA', 'DXCache');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'nvidia_glcache',
    app: 'NVIDIA',
    name: 'NVIDIA — OpenGL/Vulkan Cache',
    description: 'Cache de shaders OpenGL e Vulkan da placa de vídeo.',
    processNames: [],
    locate: () => {
      const p = path.join(LOCAL_APPDATA, 'NVIDIA', 'GLCache');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'amd_dxcache',
    app: 'AMD',
    name: 'AMD — Radeon Shader Cache',
    description: 'Cache de shaders DirectX da placa de vídeo AMD Radeon.',
    processNames: [],
    locate: () => {
      const p = path.join(LOCAL_APPDATA, 'AMD', 'DxCache');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'discord_cache',
    app: 'Discord',
    name: 'Discord — Cache de Mídias',
    description: 'Imagens, vídeos e avatares armazenados em cache pelo cliente do Discord.',
    processNames: ['Discord.exe'],
    locate: () => {
      const p = path.join(ROAMING_APPDATA, 'discord', 'Cache');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'spotify_storage',
    app: 'Spotify',
    name: 'Spotify — Cache de Músicas',
    description: 'Músicas e capas cacheadas localmente para streaming rápido.',
    processNames: ['Spotify.exe'],
    locate: () => {
      const p = path.join(ROAMING_APPDATA, 'Spotify', 'Storage');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'chrome_cache',
    app: 'Google Chrome',
    name: 'Google Chrome — Cache Web',
    description: 'Arquivos temporários e mídias de páginas web salvas pelo Chrome.',
    processNames: ['chrome.exe'],
    locate: () => {
      const p = path.join(LOCAL_APPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Cache');
      return fs.existsSync(p) ? p : null;
    }
  },
  {
    id: 'edge_cache',
    app: 'Microsoft Edge',
    name: 'Microsoft Edge — Cache Web',
    description: 'Arquivos temporários e mídias de páginas web salvas pelo Edge.',
    processNames: ['msedge.exe'],
    locate: () => {
      const p = path.join(LOCAL_APPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache');
      return fs.existsSync(p) ? p : null;
    }
  }
];

/**
 * Calcula o tamanho total de um diretório recursivamente de forma segura.
 */
export function getDirectorySizeSafe(dirPath, maxDepth = 4, currentDepth = 0) {
  let size = 0;
  let fileCount = 0;

  if (currentDepth > maxDepth) return { size: 0, fileCount: 0 };

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          const sub = getDirectorySizeSafe(fullPath, maxDepth, currentDepth + 1);
          size += sub.size;
          fileCount += sub.fileCount;
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          size += stat.size;
          fileCount++;
        }
      } catch {}
    }
  } catch {}

  return { size, fileCount };
}

/**
 * Verifica se algum dos processos associados está rodando no momento.
 */
export async function isProcessRunning(processNames = []) {
  if (!processNames || processNames.length === 0) return { running: false, activeProcesses: [] };

  try {
    const filter = processNames.map(p => `Name = '${p}'`).join(' or ');
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"${filter}\\" | Select-Object -ExpandProperty Name"`;
    const { stdout } = await execAsync(cmd);
    const names = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return {
      running: names.length > 0,
      activeProcesses: names
    };
  } catch {
    return { running: false, activeProcesses: [] };
  }
}

/**
 * Varre todos os caches do catálogo e retorna apenas os existentes e mensuráveis.
 */
export async function scanAppCaches() {
  const results = [];

  for (const def of CACHE_CATALOG) {
    try {
      const targetPath = def.locate();
      if (!targetPath || !fs.existsSync(targetPath)) continue;

      const { size, fileCount } = getDirectorySizeSafe(targetPath);
      // Ignora caches insignificantes (< 2 MB)
      if (size < 2 * 1024 * 1024) continue;

      const procInfo = await isProcessRunning(def.processNames);

      results.push({
        id: def.id,
        app: def.app,
        name: def.name,
        description: def.description,
        path: targetPath,
        sizeBytes: size,
        sizeFormatted: formatBytes(size),
        fileCount,
        processRunning: procInfo.running,
        activeProcesses: procInfo.activeProcesses
      });
    } catch (err) {
      console.warn(`Erro ao verificar cache ${def.id}:`, err.message);
    }
  }

  // Ordena do mais pesado para o mais leve
  results.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return results;
}

/**
 * Limpa os arquivos internos de uma pasta de cache de forma segura.
 * Preserva a pasta raiz para que o aplicativo continue funcionando perfeitamente.
 */
export function purgeCacheFolder(targetPath) {
  let freedBytes = 0;
  let deletedFiles = 0;
  let skippedFiles = 0;

  if (!fs.existsSync(targetPath)) {
    return { freedBytes: 0, deletedFiles: 0, skippedFiles: 0 };
  }

  function purgeInternal(dir, isRoot = false) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) {
            purgeInternal(p, false);
            try {
              fs.rmdirSync(p);
            } catch {
              skippedFiles++;
            }
          } else if (entry.isFile()) {
            try {
              const sz = fs.statSync(p).size;
              fs.unlinkSync(p);
              freedBytes += sz;
              deletedFiles++;
            } catch {
              // Arquivo em uso ou protegido pelo Windows
              skippedFiles++;
            }
          }
        } catch {
          skippedFiles++;
        }
      }
    } catch {
      skippedFiles++;
    }
  }

  purgeInternal(targetPath, true);

  return {
    freedBytes,
    freedFormatted: formatBytes(freedBytes),
    deletedFiles,
    skippedFiles
  };
}

/**
 * Limpa os caches selecionados pelos IDs.
 */
export async function cleanSelectedCaches(cacheIds = []) {
  const caches = await scanAppCaches();
  const toClean = caches.filter(c => cacheIds.includes(c.id));

  let totalFreed = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;
  const cleanedItems = [];

  for (const item of toClean) {
    const result = purgeCacheFolder(item.path);
    totalFreed += result.freedBytes;
    totalDeleted += result.deletedFiles;
    totalSkipped += result.skippedFiles;

    cleanedItems.push({
      id: item.id,
      name: item.name,
      freedBytes: result.freedBytes,
      freedFormatted: result.freedFormatted,
      deletedFiles: result.deletedFiles
    });
  }

  return {
    success: true,
    totalFreedBytes: totalFreed,
    totalFreedFormatted: formatBytes(totalFreed),
    totalDeletedFiles: totalDeleted,
    totalSkippedFiles: totalSkipped,
    cleanedItems
  };
}
