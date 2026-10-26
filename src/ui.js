// src/ui.js
// Utilitários de interface de terminal limpa (Cores ANSI, Caixas, Barra de Progresso)

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgCyan: '\x1b[46m\x1b[30m',
};

export function banner() {
  console.log();
  console.log(` ${colors.cyan}╭─────────────────────────────────────────────────────────────╮${colors.reset}`);
  console.log(` ${colors.cyan}│${colors.reset}  ${colors.bold}${colors.white}🎬 DownVideo CLI${colors.reset} ${colors.gray}— Baixador de Vídeos do YouTube (Clean)${colors.reset}   ${colors.cyan}│${colors.reset}`);
  console.log(` ${colors.cyan}╰─────────────────────────────────────────────────────────────╯${colors.reset}`);
  console.log();
}

export function bannerCompress() {
  console.log();
  console.log(` ${colors.magenta}╭─────────────────────────────────────────────────────────────╮${colors.reset}`);
  console.log(` ${colors.magenta}│${colors.reset}  ${colors.bold}${colors.white}🗜️  DownVideo Compress${colors.reset} ${colors.gray}— Compactador de Vídeo Inteligente${colors.reset}   ${colors.magenta}│${colors.reset}`);
  console.log(` ${colors.magenta}╰─────────────────────────────────────────────────────────────╯${colors.reset}`);
  console.log();
}

export function info(label, value) {
  console.log(` ${colors.cyan}▶${colors.reset} ${colors.gray}${label.padEnd(16)}${colors.reset} ${colors.bold}${value}${colors.reset}`);
}

export function success(msg) {
  console.log();
  console.log(` ${colors.green}${colors.bold}✔ ${msg}${colors.reset}`);
}

export function error(msg) {
  console.log();
  console.log(` ${colors.red}${colors.bold}✖ Erro:${colors.reset} ${colors.red}${msg}${colors.reset}`);
}

export function warn(msg) {
  console.log(` ${colors.yellow}⚠ ${msg}${colors.reset}`);
}

export function step(msg) {
  console.log(` ${colors.cyan}⏳ ${msg}${colors.reset}`);
}

/**
 * Formata bytes em representação humana amigável (B, KB, MB, GB).
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

/**
 * Formata segundos em mm:ss ou hh:mm:ss.
 */
export function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Renderiza uma barra de progresso suave no terminal em linha única.
 * @param {number} percent 0 a 100
 * @param {string} speed ex: "12.4MiB/s" ou "2.5x"
 * @param {string} eta ex: "00:15"
 * @param {string} size ex: "45.2MiB"
 */
export function renderProgress(percent, speed = '', eta = '', size = '') {
  const barLength = 26;
  const clampedPercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  const filledLength = Math.round((clampedPercent / 100) * barLength);
  const emptyLength = barLength - filledLength;

  const filledBar = `${colors.cyan}${'█'.repeat(filledLength)}${colors.reset}`;
  const emptyBar = `${colors.gray}${'░'.repeat(emptyLength)}${colors.reset}`;

  const pctStr = `${clampedPercent.toFixed(1)}%`.padStart(6);
  const speedStr = speed ? ` ${colors.gray}|${colors.reset} ${colors.bold}${speed}${colors.reset}` : '';
  const etaStr = eta ? ` ${colors.gray}|${colors.reset} ETA: ${colors.yellow}${eta}${colors.reset}` : '';
  const sizeStr = size ? ` ${colors.gray}|${colors.reset} ${colors.magenta}${size}${colors.reset}` : '';

  process.stdout.write(`\r [${filledBar}${emptyBar}] ${colors.bold}${pctStr}${colors.reset}${speedStr}${etaStr}${sizeStr} `);
}

export function clearProgress() {
  process.stdout.write('\r\x1b[K');
}

/**
 * Exibe um resumo visual comparativo de antes e depois da compactação.
 */
export function renderCompressionSummary(summary) {
  const { originalSize, finalSize, elapsedSec, outputPath, levelName } = summary;
  const savedBytes = Math.max(0, originalSize - finalSize);
  const reductionPct = originalSize > 0 ? ((savedBytes / originalSize) * 100).toFixed(1) : '0.0';

  console.log();
  console.log(` ${colors.magenta}╭─────────────────────────────────────────────────────────────╮${colors.reset}`);
  console.log(` ${colors.magenta}│${colors.reset}  ${colors.bold}${colors.white}📊 Resumo da Otimização${colors.reset}                                    ${colors.magenta}│${colors.reset}`);
  console.log(` ${colors.magenta}├─────────────────────────────────────────────────────────────┤${colors.reset}`);
  console.log(` ${colors.magenta}│${colors.reset}  ${colors.gray}Nível Usado    :${colors.reset} ${colors.bold}${levelName.padEnd(42)}${colors.reset} ${colors.magenta}│${colors.reset}`);
  console.log(` ${colors.magenta}│${colors.reset}  ${colors.gray}Tamanho Original:${colors.reset} ${colors.yellow}${formatBytes(originalSize).padEnd(42)}${colors.reset} ${colors.magenta}│${colors.reset}`);
  console.log(` ${colors.magenta}│${colors.reset}  ${colors.gray}Tamanho Final   :${colors.reset} ${colors.green}${colors.bold}${formatBytes(finalSize).padEnd(42)}${colors.reset} ${colors.magenta}│${colors.reset}`);
  
  if (savedBytes > 0) {
    const savingsStr = `🔻 -${reductionPct}% (${formatBytes(savedBytes)} mais leve)`;
    console.log(` ${colors.magenta}│${colors.reset}  ${colors.gray}Economia        :${colors.reset} ${colors.green}${colors.bold}${savingsStr.padEnd(42)}${colors.reset} ${colors.magenta}│${colors.reset}`);
  } else {
    const noSaveStr = `O arquivo original já estava altamente otimizado`;
    console.log(` ${colors.magenta}│${colors.reset}  ${colors.gray}Observação      :${colors.reset} ${colors.yellow}${noSaveStr.padEnd(42)}${colors.reset} ${colors.magenta}│${colors.reset}`);
  }

  if (elapsedSec) {
    const timeStr = `${elapsedSec.toFixed(1)} segundos`;
    console.log(` ${colors.magenta}│${colors.reset}  ${colors.gray}Tempo Gasto     :${colors.reset} ${timeStr.padEnd(42)} ${colors.magenta}│${colors.reset}`);
  }

  console.log(` ${colors.magenta}╰─────────────────────────────────────────────────────────────╯${colors.reset}`);
  console.log();
  console.log(` ${colors.gray}📁 Arquivo pronto e otimizado:${colors.reset} ${colors.bold}${outputPath}${colors.reset}\n`);
}
