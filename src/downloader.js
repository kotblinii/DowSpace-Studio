// src/downloader.js
// Motor de extração de metadados e download de vídeo/áudio via yt-dlp
// Compatível 100% com Adobe After Effects, Premiere Pro e outros editores

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { ytDlpPath, binDir, ffmpegPath } from './binaries.js';
import { renderProgress, clearProgress, step, success, error, info, colors } from './ui.js';

/**
 * Retorna o diretório padrão de Downloads do usuário.
 */
export function getDefaultDownloadDir() {
  const userDownloads = path.join(os.homedir(), 'Downloads');
  if (fs.existsSync(userDownloads)) {
    return userDownloads;
  }
  const localDownloads = path.resolve('downloads');
  if (!fs.existsSync(localDownloads)) {
    fs.mkdirSync(localDownloads, { recursive: true });
  }
  return localDownloads;
}

/**
 * Formata segundos em mm:ss ou hh:mm:ss.
 */
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formata erros conhecidos do YouTube para mensagens claras e amigáveis em português.
 */
export function formatYouTubeError(errStr) {
  if (!errStr) return 'Erro desconhecido ao processar vídeo.';
  
  if (errStr.includes("Sign in to confirm") || 
      errStr.includes("not a bot") ||
      errStr.includes("Faça login para confirmar") ||
      errStr.includes("LOGIN_REQUIRED")) {
    return 'O YouTube bloqueou este vídeo exigindo confirmação de login ("Sign in to confirm you\'re not a bot").\n' +
           '   Isso ocorre em vídeos com restrição de idade, direitos musicais ou checagem anti-bot do Google.\n' +
           '   💡 Solução: Baixe a extensão "Get cookies.txt LOCALLY" no seu navegador, exporte o arquivo "cookies.txt" do YouTube e salve na pasta do projeto.';
  }

  if (errStr.includes("Private video") || errStr.includes("Video unavailable")) {
    return 'Este vídeo é privado ou não está disponível.';
  }

  return errStr;
}

/**
 * Obtém informações do vídeo rapidamente sem baixar.
 */
export async function getVideoMetadata(url, cookiesPath = null) {
  return new Promise((resolve, reject) => {
    const nodeRuntime = `node:${process.execPath}`;
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      '--js-runtimes', nodeRuntime
    ];

    if (cookiesPath && fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    args.push(url);

    const child = spawn(ytDlpPath, args, { windowsHide: true });
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', chunk => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderrData += chunk.toString();
    });

    child.on('close', code => {
      if (code === 0 && stdoutData.trim()) {
        try {
          const json = JSON.parse(stdoutData.trim());
          resolve({
            title: json.title || 'Vídeo sem título',
            channel: json.uploader || json.channel || 'Desconhecido',
            duration: formatDuration(json.duration),
            id: json.id
          });
        } catch (e) {
          reject(new Error(`Falha ao ler dados do vídeo: ${e.message}`));
        }
      } else {
        const rawErr = stderrData.trim() || 'Link inválido ou vídeo indisponível.';
        reject(new Error(formatYouTubeError(rawErr)));
      }
    });

    child.on('error', err => reject(err));
  });
}

/**
 * Detecta o codec de vídeo do arquivo baixado usando o ffmpeg.
 */
export function getVideoCodec(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(ffmpegPath) || !fs.existsSync(filePath)) {
      return resolve('unknown');
    }

    const child = spawn(ffmpegPath, ['-i', filePath], { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('close', () => {
      // Procura linha ex: Stream #0:0[0x1](und): Video: h264 (Main) ... ou Video: av1 ... ou Video: vp9 ...
      const match = stderr.match(/Stream #\d+:\d+.*?: Video: ([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        resolve(match[1].toLowerCase());
      } else {
        resolve('unknown');
      }
    });

    child.on('error', () => resolve('unknown'));
  });
}

/**
 * Converte vídeo para H.264/AAC com pixel format yuv420p (padrão exigido pelo After Effects / Premiere).
 */
export function convertToH264(filePath) {
  return new Promise((resolve, reject) => {
    const tempOut = filePath.replace(/\.mp4$/i, `_ae_compat_${Date.now()}.mp4`);
    
    const ffmpegArgs = [
      '-y',
      '-i', filePath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      tempOut
    ];

    const child = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempOut)) {
        try {
          fs.unlinkSync(filePath);
          fs.renameSync(tempOut, filePath);
          resolve(true);
        } catch (err) {
          reject(err);
        }
      } else {
        if (fs.existsSync(tempOut)) {
          try { fs.unlinkSync(tempOut); } catch {}
        }
        reject(new Error(`Falha na conversão para H.264 (Código ${code})`));
      }
    });

    child.on('error', err => reject(err));
  });
}

/**
 * Procura automaticamente por um arquivo cookies.txt no projeto ou na pasta Downloads.
 */
export function findCookiesFile(customPath = null) {
  if (customPath && fs.existsSync(customPath)) {
    return path.resolve(customPath);
  }
  const localProject = path.resolve('cookies.txt');
  if (fs.existsSync(localProject)) {
    return localProject;
  }
  const userDownloads = path.join(os.homedir(), 'Downloads', 'cookies.txt');
  if (fs.existsSync(userDownloads)) {
    return userDownloads;
  }
  return null;
}

/**
 * Executa o download com parsing de progresso em tempo real e garante compatibilidade com After Effects.
 */
export async function downloadMedia(url, options = {}) {
  const {
    isAudioOnly = false,
    outputDir = getDefaultDownloadDir(),
    cookiesPath = null
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Template de nome de arquivo seguro
  const outputTemplate = path.join(outputDir, '%(title)s [%(id)s].%(ext)s');

  const nodeRuntime = `node:${process.execPath}`;
  const args = [
    '--no-playlist',
    '--newline',
    '--no-warnings',
    '--concurrent-fragments', '4',
    '--ffmpeg-location', binDir,
    '--js-runtimes', nodeRuntime,
    '-o', outputTemplate,
    '--progress-template', 'download:PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str)s',
    '--print', 'after_move:FINAL_DEST:%(filepath)s'
  ];

  if (cookiesPath && fs.existsSync(cookiesPath)) {
    args.push('--cookies', cookiesPath);
  }

  if (isAudioOnly) {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    // IMPORTANTE: Prioriza H.264 (avc1) e áudio AAC (m4a/mp4a) nativamente.
    // É o padrão 100% suportado pelo Adobe After Effects, Premiere Pro e outros editores.
    args.push(
      '-S', 'vcodec:h264,res,acodec:m4a',
      '--merge-output-format', 'mp4'
    );
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    let finalFilePath = '';
    let hasMerged = false;
    let lastError = '';

    child.stdout.on('data', chunk => {
      const lines = chunk.toString().split(/[\r\n]+/);

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('FINAL_DEST:')) {
          finalFilePath = line.replace('FINAL_DEST:', '').trim();
          continue;
        }

        // Detecta sleep solicitado pelo YouTube
        const sleepMatch = line.match(/Sleeping\s+([\d\.]+)\s+seconds/i);
        if (sleepMatch) {
          clearProgress();
          step(`Aguardando liberação dos servidores do YouTube (${sleepMatch[1]}s)...`);
          continue;
        }

        // Detecta início do stream de vídeo ou áudio
        if (line.includes('Destination:') && !line.includes('.temp.')) {
          clearProgress();
          if (line.includes('.f') || line.includes('f399') || line.includes('f137')) {
            step('Baixando fluxo de dados...');
          }
        }

        // 1. Parser via template customizado
        if (line.includes('PROGRESS:')) {
          const raw = line.substring(line.indexOf('PROGRESS:') + 9).trim();
          const [rawPct, speed, eta, size] = raw.split('|');

          const cleanPct = parseFloat((rawPct || '').replace('%', '').trim());
          if (!isNaN(cleanPct)) {
            renderProgress(cleanPct, speed?.trim(), eta?.trim(), size?.trim());
          }
          continue;
        }

        // 2. Parser padrão do yt-dlp [download] xx.x% of xxMiB at xxMiB/s ETA xx:xx
        const dlMatch = line.match(/\[download\]\s+([\d\.]+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)(?:\s+ETA\s+([^\s]+))?/i);
        if (dlMatch) {
          const pct = parseFloat(dlMatch[1]);
          const size = dlMatch[2];
          const speed = dlMatch[3];
          const eta = dlMatch[4] || '';
          if (!isNaN(pct)) {
            renderProgress(pct, speed, eta, size);
          }
          continue;
        }

        // Identifica etapas de pós-processamento (muxing/conversão)
        if (line.includes('[Merger]') || line.includes('[ExtractAudio]') || line.includes('[Fixup')) {
          if (!hasMerged) {
            hasMerged = true;
            clearProgress();
            step(isAudioOnly ? 'Convertendo áudio para MP3 de alta qualidade...' : 'Mesclando áudio e vídeo em MP4...');
          }
        }
      }
    });

    child.stderr.on('data', chunk => {
      const msg = chunk.toString().trim();
      if (msg && !msg.includes('WARNING:')) {
        lastError += `${msg}\n`;
      }
    });

    child.on('close', async (code) => {
      clearProgress();
      if (code === 0) {
        try {
          // Se for vídeo, verifica se o codec é compatível com o After Effects
          if (!isAudioOnly && finalFilePath && fs.existsSync(finalFilePath)) {
            const codec = await getVideoCodec(finalFilePath);
            
            // Se o YouTube entregou AV1 ou VP9 (ex: 4K onde não há H.264 nativo), converte para H.264
            if (codec !== 'h264' && codec !== 'unknown') {
              step(`Ajustando codec (${codec.toUpperCase()} -> H.264/AAC) para compatibilidade com After Effects...`);
              await convertToH264(finalFilePath);
            }
          }

          resolve({
            success: true,
            filePath: finalFilePath || outputDir
          });
        } catch (postErr) {
          reject(postErr);
        }
      } else {
        const rawErr = lastError.trim() || `Falha no download (Código ${code})`;
        reject(new Error(formatYouTubeError(rawErr)));
      }
    });

    child.on('error', err => {
      clearProgress();
      reject(err);
    });
  });
}
