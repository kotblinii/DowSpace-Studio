// src/binaries.js
// Gerenciamento e download automático dos executáveis yt-dlp e ffmpeg

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { renderProgress, clearProgress, step, success, warn, error, colors } from './ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
export const binDir = path.join(rootDir, 'bin');

export const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
export const ffmpegPath = path.join(binDir, 'ffmpeg.exe');

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_ZIP_URL = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip';

/**
 * Baixa um arquivo via streaming com barra de progresso no terminal.
 */
async function downloadFileWithProgress(url, destPath, label) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Falha ao baixar ${label} (HTTP ${res.status}: ${res.statusText})`);
  }

  const totalBytes = Number(res.headers.get('content-length')) || 0;
  let receivedBytes = 0;
  const startTime = Date.now();

  const tempPath = `${destPath}.tmp`;
  const fileStream = fs.createWriteStream(tempPath);

  // Monitoramento através de um ReadableStream
  const reader = res.body.getReader();

  const progressStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const percent = (receivedBytes / totalBytes) * 100;
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speedBytes = elapsedSec > 0 ? receivedBytes / elapsedSec : 0;
          const speedStr = `${(speedBytes / (1024 * 1024)).toFixed(1)} MB/s`;
          const remainingSec = speedBytes > 0 ? Math.ceil((totalBytes - receivedBytes) / speedBytes) : 0;
          const etaStr = `${Math.floor(remainingSec / 60)}m${(remainingSec % 60).toString().padStart(2, '0')}s`;
          const sizeStr = `${(receivedBytes / (1024 * 1024)).toFixed(1)} / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

          renderProgress(percent, speedStr, etaStr, sizeStr);
        }
        this.push(value);
      } catch (err) {
        this.destroy(err);
      }
    }
  });

  await pipeline(progressStream, fileStream);
  clearProgress();

  if (fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
  }
  fs.renameSync(tempPath, destPath);
}

/**
 * Garante que o diretório bin/ exista.
 */
function ensureBinDir() {
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
}

/**
 * Verifica se ffmpeg está no PATH global do sistema.
 */
function hasSystemFfmpeg() {
  try {
    const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Garante que yt-dlp e ffmpeg estejam instalados e prontos para uso.
 */
export async function ensureBinaries() {
  ensureBinDir();

  // 1. Checar yt-dlp
  if (!fs.existsSync(ytDlpPath)) {
    console.log(`\n ${colors.yellow}⚡ Configurando motor de download yt-dlp pela primeira vez...${colors.reset}`);
    step('Baixando yt-dlp.exe oficial (~17 MB)...');
    try {
      await downloadFileWithProgress(YT_DLP_URL, ytDlpPath, 'yt-dlp.exe');
      success('yt-dlp configurado com sucesso!');
    } catch (err) {
      error(`Erro ao baixar yt-dlp: ${err.message}`);
      throw err;
    }
  }

  // 2. Checar ffmpeg (essencial para 1080p, 4K e MP3)
  const ffmpegExistsLocally = fs.existsSync(ffmpegPath);
  const ffmpegInPath = hasSystemFfmpeg();

  if (!ffmpegExistsLocally && !ffmpegInPath) {
    console.log(`\n ${colors.yellow}⚡ Configurando ffmpeg (necessário para MP3 e vídeos em 1080p/4K)...${colors.reset}`);
    step('Baixando pacote ffmpeg (~52 MB)...');
    const zipPath = path.join(binDir, 'ffmpeg.zip');

    try {
      await downloadFileWithProgress(FFMPEG_ZIP_URL, zipPath, 'ffmpeg.zip');
      step('Extraindo ffmpeg.exe...');

      // Extração usando tar nativo do Windows
      try {
        execSync(`tar -xf "${zipPath}" -C "${binDir}"`, { stdio: 'ignore' });
      } catch {
        // Fallback para PowerShell se tar falhar
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`, { stdio: 'ignore' });
      }

      // Limpeza do zip
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }

      success('ffmpeg configurado com sucesso!');
    } catch (err) {
      warn(`Não foi possível baixar o ffmpeg automaticamente (${err.message}). O download ocorrerá em até 720p.`);
    }
  }
}

/**
 * Atualiza o yt-dlp para a versão mais recente.
 */
export function updateYtDlp() {
  ensureBinDir();
  if (!fs.existsSync(ytDlpPath)) {
    warn('yt-dlp ainda não está instalado. Instalando agora...');
    return ensureBinaries();
  }

  step('Verificando atualizações do yt-dlp...');
  const res = spawnSync(ytDlpPath, ['-U'], { stdio: 'inherit' });
  if (res.status === 0) {
    success('Motor de download atualizado com sucesso!');
  } else {
    error('Falha ao atualizar o yt-dlp.');
  }
}
