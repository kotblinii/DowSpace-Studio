// src/compressor.js
// Motor inteligente de compactação de vídeos usando ffmpeg
// Otimiza o tamanho do arquivo preservando a compatibilidade total (H.264 / AAC / yuv420p)

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ffmpegPath, ensureBinaries } from './binaries.js';
import {
  colors,
  step,
  info,
  renderProgress,
  clearProgress,
  formatBytes,
  formatDuration
} from './ui.js';

/**
 * Calcula o bitrate ótimo para atingir um tamanho exato em MB com máxima fidelidade visual.
 */
export function calculateTargetBitrate(targetSizeMB, durationSec, resolution = '1080p') {
  const dur = Math.max(1, Number(durationSec) || 1);
  const targetBytes = Number(targetSizeMB) * 1024 * 1024;
  const totalBitrateKbps = Math.floor((targetBytes * 8) / (dur * 1000));

  let audioBitrate = '128k';
  let audioBitrateNum = 128;
  if (totalBitrateKbps >= 3000) {
    audioBitrate = '160k';
    audioBitrateNum = 160;
  } else if (totalBitrateKbps >= 1200) {
    audioBitrate = '128k';
    audioBitrateNum = 128;
  } else if (totalBitrateKbps >= 500) {
    audioBitrate = '96k';
    audioBitrateNum = 96;
  } else {
    audioBitrate = '64k';
    audioBitrateNum = 64;
  }

  const videoBitrateKbps = Math.max(80, totalBitrateKbps - audioBitrateNum);

  // Downscale preventivo suave se o bitrate for muito baixo para a resolução nativa
  let recommendedScale = null;
  const is1080pOrHigher = resolution.includes('1080') || resolution.includes('2160') || resolution.includes('1440');
  const is720pOrHigher = is1080pOrHigher || resolution.includes('720');

  if (videoBitrateKbps < 500 && is720pOrHigher) {
    recommendedScale = '-2:480';
  } else if (videoBitrateKbps < 1100 && is1080pOrHigher) {
    recommendedScale = '-2:720';
  }

  return {
    totalBitrateKbps,
    videoBitrateKbps,
    audioBitrate,
    recommendedScale
  };
}

/**
 * Perfis pré-definidos de compactação.
 */
export const COMPRESSION_LEVELS = {
  fraco: {
    id: 'fraco',
    name: 'Fraco (Leve — Alta Qualidade)',
    description: 'Alta fidelidade visual, compressão sutil (~25% a 40% menor)',
    crf: 22,
    preset: 'medium',
    audioBitrate: '160k',
    expectedSavings: '25% - 40%',
    color: colors.green
  },
  medio: {
    id: 'medio',
    name: 'Médio (Equilibrado — Recomendado)',
    description: 'Ótima relação tamanho/qualidade (~50% a 70% menor)',
    crf: 28,
    preset: 'medium',
    audioBitrate: '128k',
    expectedSavings: '50% - 70%',
    color: colors.cyan
  },
  forte: {
    id: 'forte',
    name: 'Forte (Ultra Leve — Máxima Redução)',
    description: 'Máxima redução de tamanho (~75% a 90% menor), ideal para WhatsApp/Discord',
    crf: 34,
    preset: 'slow',
    audioBitrate: '96k',
    expectedSavings: '75% - 90%',
    color: colors.magenta
  }
};

/**
 * Extrai dados técnicos detalhados do arquivo de vídeo.
 */
export function getVideoDetails(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve(null);
    }

    const stat = fs.statSync(filePath);
    const child = spawn(ffmpegPath, ['-i', filePath], { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('close', () => {
      // Duração (ex: Duration: 00:01:23.45)
      let durationSec = 0;
      let durationFormatted = '--:--';
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):([\d\.]+)/i);
      if (durMatch) {
        const h = parseInt(durMatch[1], 10);
        const m = parseInt(durMatch[2], 10);
        const s = parseFloat(durMatch[3]);
        durationSec = h * 3600 + m * 60 + s;
        durationFormatted = formatDuration(durationSec);
      }

      // Resolução (ex: 1920x1080)
      let resolution = 'Original';
      const resMatch = stderr.match(/,\s*(\d{2,5})x(\d{2,5})/i);
      if (resMatch) {
        resolution = `${resMatch[1]}x${resMatch[2]}`;
      }

      // Codec de vídeo
      let videoCodec = 'desconhecido';
      const vMatch = stderr.match(/Stream #\d+:\d+.*?: Video: ([a-zA-Z0-9_-]+)/i);
      if (vMatch && vMatch[1]) {
        videoCodec = vMatch[1].toLowerCase();
      }

      // Codec de áudio
      let audioCodec = null;
      const aMatch = stderr.match(/Stream #\d+:\d+.*?: Audio: ([a-zA-Z0-9_-]+)/i);
      if (aMatch && aMatch[1]) {
        audioCodec = aMatch[1].toLowerCase();
      }

      resolve({
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        durationSec,
        durationFormatted,
        resolution,
        videoCodec,
        audioCodec,
        hasAudio: !!audioCodec
      });
    });

    child.on('error', () => resolve(null));
  });
}

/**
 * Gera um caminho seguro de saída para o arquivo compactado.
 */
export function generateOutputPath(inputPath, options = {}) {
  const {
    outputPath = null,
    outputDir = null,
    levelKey = 'medio',
    replace = false
  } = options;

  if (outputPath) {
    return path.resolve(outputPath);
  }

  const dir = outputDir ? path.resolve(outputDir) : path.dirname(inputPath);
  const ext = path.extname(inputPath) || '.mp4';
  const baseName = path.basename(inputPath, ext);

  if (replace) {
    return inputPath;
  }

  const candidate = path.join(dir, `${baseName}_compactado.mp4`);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  // Se já existir, busca um sufixo numerado disponível (1), (2), etc.
  let counter = 1;
  while (true) {
    const nextCandidate = path.join(dir, `${baseName}_compactado (${counter}).mp4`);
    if (!fs.existsSync(nextCandidate)) {
      return nextCandidate;
    }
    counter++;
  }
}

let activeChildProcess = null;
let currentTempFile = null;

// Garante limpeza caso o usuário cancele com Ctrl+C
process.on('SIGINT', () => {
  if (activeChildProcess) {
    try {
      activeChildProcess.kill('SIGKILL');
    } catch {}
  }
  if (currentTempFile && fs.existsSync(currentTempFile)) {
    try {
      fs.unlinkSync(currentTempFile);
    } catch {}
  }
  clearProgress();
});

/**
 * Executa a compactação de um vídeo existente.
 * 
 * @param {string} inputPath Caminho do vídeo de entrada
 * @param {object} options Configurações de compactação
 * @returns {Promise<object>} Detalhes e estatísticas da compactação
 */
export async function compressVideo(inputPath, options = {}) {
  await ensureBinaries();

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Arquivo de vídeo não encontrado: ${resolvedInput}`);
  }

  const levelKey = (options.level || 'medio').toLowerCase();
  const profile = COMPRESSION_LEVELS[levelKey] || COMPRESSION_LEVELS.medio;
  const crf = (options.crf !== null && options.crf !== undefined && !isNaN(Number(options.crf)))
    ? Number(options.crf)
    : profile.crf;
  const isReplacing = Boolean(options.replace);

  const finalDestination = generateOutputPath(resolvedInput, {
    outputPath: options.outputPath,
    outputDir: options.outputDir,
    levelKey,
    replace: isReplacing
  });

  const targetDir = path.dirname(finalDestination);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Obter metadados do arquivo original
  step('Analisando metadados do vídeo...');
  const details = await getVideoDetails(resolvedInput);
  if (!details) {
    throw new Error('Não foi possível ler as informações do vídeo.');
  }

  console.log();
  info('Arquivo Original', path.basename(resolvedInput));
  info('Tamanho Atual', details.sizeFormatted);
  info('Duração', details.durationFormatted);
  info('Resolução', details.resolution);
  info('Nível Escolhido', `${profile.color}${profile.name}${colors.reset} (CRF: ${crf})`);
  console.log();

  // Arquivo temporário para escrita atômica segura
  const tempOutputFile = path.join(
    targetDir,
    `_temp_compress_${Date.now()}_${path.basename(finalDestination)}`
  );
  currentTempFile = tempOutputFile;

  // Helper para limpar logs de 2 passadas
  function cleanupPassLogs(prefix) {
    try {
      const dir = path.dirname(prefix);
      const base = path.basename(prefix);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.startsWith(base)) {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          }
        }
      }
    } catch {}
  }

  // Executa uma passada do FFmpeg com parsing de progresso unificado
  function runFfmpegPass(args, totalDurationSec, progressCallback) {
    return new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      activeChildProcess = child;
      let stderrData = '';
      const totalDurationUs = totalDurationSec * 1_000_000;

      child.stdout.on('data', chunk => {
        const lines = chunk.toString().split(/[\r\n]+/);
        let outTimeUs = null;
        let speedStr = '';
        let totalSizeStr = '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('out_time_us=')) {
            const val = parseInt(line.replace('out_time_us=', '').trim(), 10);
            if (!isNaN(val)) outTimeUs = val;
          } else if (line.startsWith('speed=')) {
            speedStr = line.replace('speed=', '').trim();
          } else if (line.startsWith('total_size=')) {
            const bytes = parseInt(line.replace('total_size=', '').trim(), 10);
            if (!isNaN(bytes) && bytes > 0) {
              totalSizeStr = formatBytes(bytes);
            }
          }
        }

        if (outTimeUs !== null && totalDurationUs > 0) {
          const pct = Math.min(99.9, Math.max(0, (outTimeUs / totalDurationUs) * 100));
          let etaStr = '--:--';
          const speedMatch = speedStr.match(/([\d\.]+)x/);
          if (speedMatch) {
            const speedFactor = parseFloat(speedMatch[1]);
            if (speedFactor > 0) {
              const remainingVideoSec = Math.max(0, totalDurationSec - (outTimeUs / 1_000_000));
              const remainingRealSec = Math.ceil(remainingVideoSec / speedFactor);
              etaStr = formatDuration(remainingRealSec);
            }
          }
          if (progressCallback) {
            progressCallback({ percent: pct, speed: speedStr, eta: etaStr, size: totalSizeStr });
          }
        }
      });

      child.stderr.on('data', chunk => {
        stderrData += chunk.toString();
      });

      child.on('close', code => {
        activeChildProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Falha no FFmpeg (Código ${code}).\n${stderrData.slice(-300)}`));
        }
      });

      child.on('error', err => {
        activeChildProcess = null;
        reject(err);
      });
    });
  }

  const startTime = Date.now();
  const targetMB = (options.targetSizeMB !== undefined && options.targetSizeMB !== null && !isNaN(Number(options.targetSizeMB)) && Number(options.targetSizeMB) > 0)
    ? Number(options.targetSizeMB)
    : null;

  const useTwoPass = Boolean(targetMB && details.durationSec > 0);
  let bitrateInfo = null;
  let passLogPrefix = null;

  if (useTwoPass) {
    bitrateInfo = calculateTargetBitrate(targetMB, details.durationSec, details.resolution);
    passLogPrefix = path.join(os.tmpdir(), `ffpass_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    info('Modo de Compressão', `2-Pass Encoding Inteligente (Alvo: ${targetMB} MB)`);
    info('Bitrate de Vídeo', `${bitrateInfo.videoBitrateKbps} kbps (Áudio: ${bitrateInfo.audioBitrate})`);
    if (bitrateInfo.recommendedScale) {
      info('Downscale Preventivo', `${bitrateInfo.recommendedScale} (garante máxima nitidez visual)`);
    }
  }

  try {
    if (useTwoPass) {
      // ===== PASSADA 1: Análise Estatística do Vídeo =====
      step('Passada 1/2: Analisando complexidade dos quadros...');
      const pass1Args = [
        '-y',
        '-i', resolvedInput,
        '-progress', 'pipe:1',
        '-c:v', 'libx264',
        '-b:v', `${bitrateInfo.videoBitrateKbps}k`,
        '-pass', '1',
        '-passlogfile', passLogPrefix,
        '-preset', profile.preset,
        '-an',
        '-f', 'null',
        process.platform === 'win32' ? 'NUL' : '/dev/null'
      ];

      const scaleToUse = options.scale || bitrateInfo.recommendedScale;
      if (scaleToUse) {
        pass1Args.push('-vf', `scale=${scaleToUse}`);
      }

      await runFfmpegPass(pass1Args, details.durationSec, (p) => {
        const overall = p.percent * 0.45;
        renderProgress(overall, p.speed ? `${p.speed} (Passo 1/2)` : 'Passo 1/2', p.eta, p.size);
        if (options.onProgress) {
          options.onProgress({
            percent: Math.round(overall),
            speed: p.speed,
            eta: p.eta,
            pass: '1/2 (Análise Estatística)'
          });
        }
      });

      // ===== PASSADA 2: Renderização Final com Distribuição Perfeita de Bits =====
      step('Passada 2/2: Compactando com retenção máxima de qualidade...');
      const pass2Args = [
        '-y',
        '-i', resolvedInput,
        '-progress', 'pipe:1',
        '-c:v', 'libx264',
        '-b:v', `${bitrateInfo.videoBitrateKbps}k`,
        '-pass', '2',
        '-passlogfile', passLogPrefix,
        '-preset', profile.preset,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ];

      if (scaleToUse) {
        pass2Args.push('-vf', `scale=${scaleToUse}`);
      }

      if (details.hasAudio) {
        pass2Args.push('-c:a', 'aac', '-b:a', bitrateInfo.audioBitrate);
      } else {
        pass2Args.push('-an');
      }

      pass2Args.push(tempOutputFile);

      await runFfmpegPass(pass2Args, details.durationSec, (p) => {
        const overall = 45 + (p.percent * 0.55);
        renderProgress(overall, p.speed ? `${p.speed} (Passo 2/2)` : 'Passo 2/2', p.eta, p.size);
        if (options.onProgress) {
          options.onProgress({
            percent: Math.min(100, Math.round(overall)),
            speed: p.speed,
            eta: p.eta,
            pass: '2/2 (Renderização Final)'
          });
        }
      });
    } else {
      // ===== MODO PADRÃO CRF (Passada Única Rápida) =====
      step(`Compactando vídeo com perfil ${profile.color}${profile.name}${colors.reset}...`);
      const singleArgs = [
        '-y',
        '-i', resolvedInput,
        '-progress', 'pipe:1',
        '-c:v', 'libx264',
        '-crf', String(crf),
        '-preset', profile.preset,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ];

      if (options.scale) {
        singleArgs.push('-vf', `scale=${options.scale}`);
      }

      if (details.hasAudio) {
        singleArgs.push('-c:a', 'aac', '-b:a', profile.audioBitrate);
      } else {
        singleArgs.push('-an');
      }

      singleArgs.push(tempOutputFile);

      await runFfmpegPass(singleArgs, details.durationSec, (p) => {
        renderProgress(p.percent, p.speed, p.eta, p.size);
        if (options.onProgress) {
          options.onProgress({
            percent: Math.round(p.percent),
            speed: p.speed,
            eta: p.eta,
            pass: 'Compactando...'
          });
        }
      });
    }

    clearProgress();

    if (!fs.existsSync(tempOutputFile)) {
      throw new Error('Arquivo de saída não foi gerado pelo FFmpeg.');
    }

    // Salva o arquivo no destino final
    if (isReplacing) {
      fs.unlinkSync(resolvedInput);
      fs.renameSync(tempOutputFile, resolvedInput);
    } else {
      if (fs.existsSync(finalDestination)) {
        fs.unlinkSync(finalDestination);
      }
      fs.renameSync(tempOutputFile, finalDestination);
    }

    currentTempFile = null;
    const finalPath = isReplacing ? resolvedInput : finalDestination;
    const finalStat = fs.statSync(finalPath);
    const elapsedSec = (Date.now() - startTime) / 1000;

    return {
      success: true,
      inputPath: resolvedInput,
      outputPath: finalPath,
      originalSize: details.sizeBytes,
      finalSize: finalStat.size,
      elapsedSec,
      levelKey,
      levelName: profile.name,
      crf: useTwoPass ? null : crf,
      targetSizeMB: targetMB,
      isTwoPass: useTwoPass
    };
  } catch (err) {
    clearProgress();
    if (fs.existsSync(tempOutputFile)) {
      try { fs.unlinkSync(tempOutputFile); } catch {}
    }
    currentTempFile = null;
    throw err;
  } finally {
    if (passLogPrefix) {
      cleanupPassLogs(passLogPrefix);
    }
  }
}
