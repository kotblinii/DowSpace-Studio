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

export function info(label, value) {
  console.log(` ${colors.cyan}▶${colors.reset} ${colors.gray}${label.padEnd(10)}${colors.reset} ${colors.bold}${value}${colors.reset}`);
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
 * Renderiza uma barra de progresso suave no terminal em linha única.
 * @param {number} percent 0 a 100
 * @param {string} speed ex: "12.4MiB/s"
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
