#!/usr/bin/env node
// compactar.js — Ferramenta CLI de Compactação de Vídeo Inteligente
// Permite reduzir o tamanho do arquivo com perfis Forte, Médio e Fraco

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { ensureBinaries } from './src/binaries.js';
import { compressVideo, getVideoDetails, COMPRESSION_LEVELS } from './src/compressor.js';
import {
  bannerCompress,
  renderCompressionSummary,
  error,
  warn,
  colors
} from './src/ui.js';

function showHelp() {
  bannerCompress();
  console.log(` ${colors.bold}Uso:${colors.reset}`);
  console.log(`   ${colors.magenta}compactar${colors.reset} ${colors.yellow}"<caminho-do-video.mp4>"${colors.reset} [opções]`);
  console.log(`   ${colors.magenta}compactar${colors.reset}                                 ${colors.gray}(Modo interativo com assistente)${colors.reset}`);
  console.log();
  console.log(` ${colors.bold}Níveis de Compactação:${colors.reset}`);
  console.log(`   ${colors.green}--fraco, -f${colors.reset}        Alta fidelidade visual (~25% a 40% menor, CRF 22)`);
  console.log(`   ${colors.cyan}--medio, -m${colors.reset}        Equilibrado - Padrão recomendado (~50% a 70% menor, CRF 28)`);
  console.log(`   ${colors.magenta}--forte, -s${colors.reset}        Ultra leve para WhatsApp/Discord (~75% a 90% menor, CRF 34)`);
  console.log(`   ${colors.yellow}--mb, -t <MB>${colors.reset}      Define o tamanho exato desejado em MB (ativa 2-Pass Encoding)`);
  console.log(`   ${colors.gray}--nivel <nome>${colors.reset}     Define o nível: "forte", "medio" ou "fraco"`);
  console.log();
  console.log(` ${colors.bold}Opções Adicionais:${colors.reset}`);
  console.log(`   ${colors.white}--out, -o <caminho>${colors.reset}   Caminho completo do arquivo de saída`);
  console.log(`   ${colors.white}--dir, -d <pasta>${colors.reset}     Define uma pasta destino para o arquivo gerado`);
  console.log(`   ${colors.white}--replace, -r${colors.reset}         Substitui o arquivo original diretamente`);
  console.log(`   ${colors.white}--crf <número>${colors.reset}        Define um valor CRF manual (18 a 40)`);
  console.log(`   ${colors.white}--help, -h${colors.reset}            Exibe esta mensagem de ajuda`);
  console.log();
  console.log(` ${colors.bold}Exemplos:${colors.reset}`);
  console.log(`   ${colors.gray}$${colors.reset} compactar "C:\\Videos\\meu_video.mp4"`);
  console.log(`   ${colors.gray}$${colors.reset} compactar "C:\\Videos\\meu_video.mp4" --mb 25`);
  console.log(`   ${colors.gray}$${colors.reset} compactar "C:\\Videos\\meu_video.mp4" --forte`);
  console.log(`   ${colors.gray}$${colors.reset} compactar "meu_video.mp4" --replace`);
  console.log();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  let targetPath = '';
  let level = 'medio';
  let targetMB = null;
  let customCrf = null;
  let customOut = null;
  let customDir = null;
  let replace = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--forte' || arg === '-s' || arg === '--strong') {
      level = 'forte';
    } else if (arg === '--medio' || arg === '-m' || arg === '--medium') {
      level = 'medio';
    } else if (arg === '--fraco' || arg === '-f' || arg === '--light') {
      level = 'fraco';
    } else if (arg === '--mb' || arg === '-t' || arg === '--target') {
      const val = parseFloat(args[++i]);
      if (!isNaN(val) && val > 0) targetMB = val;
    } else if (arg === '--nivel' || arg === '-n') {
      const next = args[++i];
      if (next && ['forte', 'medio', 'fraco'].includes(next.toLowerCase())) {
        level = next.toLowerCase();
      }
    } else if (arg === '--crf') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) customCrf = val;
    } else if (arg === '--out' || arg === '-o') {
      customOut = args[++i];
    } else if (arg === '--dir' || arg === '-d') {
      customDir = args[++i];
    } else if (arg === '--replace' || arg === '-r') {
      replace = true;
    } else if (!arg.startsWith('-') && !targetPath) {
      targetPath = arg.trim();
    }
  }

  bannerCompress();

  // Modo Interativo se nenhum arquivo foi especificado
  if (!targetPath) {
    const rl = readline.createInterface({ input, output });

    try {
      console.log(` ${colors.gray}Dica: Você pode arrastar e soltar o arquivo de vídeo aqui dentro do terminal.${colors.reset}\n`);
      const fileAnswer = await rl.question(` ${colors.magenta}▶${colors.reset} ${colors.bold}Caminho do vídeo para compactar:${colors.reset} `);
      targetPath = fileAnswer.trim().replace(/^["']|["']$/g, '');

      if (!targetPath) {
        warn('Nenhum arquivo fornecido. Operação cancelada.');
        rl.close();
        process.exit(0);
      }

      const resolved = path.resolve(targetPath);
      if (!fs.existsSync(resolved)) {
        error(`Arquivo não encontrado: ${resolved}`);
        rl.close();
        process.exit(1);
      }

      await ensureBinaries();
      const details = await getVideoDetails(resolved);
      if (details) {
        console.log();
        console.log(` ${colors.gray}Informações do arquivo:${colors.reset}`);
        console.log(`   ${colors.gray}Tamanho:${colors.reset} ${colors.yellow}${details.sizeFormatted}${colors.reset} | ${colors.gray}Duração:${colors.reset} ${details.durationFormatted} | ${colors.gray}Resolução:${colors.reset} ${details.resolution}`);
      }

      console.log();
      console.log(` ${colors.bold}Escolha o nível de compactação:${colors.reset}`);
      console.log(`  ${colors.green}[1] Fraco${colors.reset}  — Leve, máxima fidelidade visual ${colors.gray}(~25% a 40% menor, CRF 22)${colors.reset}`);
      console.log(`  ${colors.cyan}[2] Médio${colors.reset}  — Equilibrado, recomendado ${colors.gray}(~50% a 70% menor, CRF 28)${colors.reset}`);
      console.log(`  ${colors.magenta}[3] Forte${colors.reset}  — Ultra leve, ideal para WhatsApp/Discord ${colors.gray}(~75% a 90% menor, CRF 34)${colors.reset}`);
      
      const levelChoice = await rl.question(`\n ${colors.magenta}▶${colors.reset} Escolha o nível ${colors.gray}[1, 2 ou 3, padrão: 2]${colors.reset}: `);
      const trimmedChoice = levelChoice.trim();

      if (trimmedChoice === '1') {
        level = 'fraco';
      } else if (trimmedChoice === '3') {
        level = 'forte';
      } else {
        level = 'medio';
      }

      console.log();
      console.log(` ${colors.bold}Como deseja salvar o arquivo?${colors.reset}`);
      console.log(`  ${colors.cyan}[1] Criar novo arquivo compactado${colors.reset} ${colors.gray}(ex: video_compactado.mp4)${colors.reset}`);
      console.log(`  ${colors.yellow}[2] Substituir o arquivo original${colors.reset}`);

      const saveChoice = await rl.question(`\n ${colors.magenta}▶${colors.reset} Escolha ${colors.gray}[1 ou 2, padrão: 1]${colors.reset}: `);
      if (saveChoice.trim() === '2') {
        replace = true;
      }

    } finally {
      rl.close();
    }
  }

  const cleanTarget = targetPath.replace(/^["']|["']$/g, '');
  const resolved = path.resolve(cleanTarget);

  if (!fs.existsSync(resolved)) {
    error(`Arquivo não encontrado: ${resolved}`);
    process.exit(1);
  }

  try {
    const summary = await compressVideo(resolved, {
      level,
      targetSizeMB: targetMB,
      crf: customCrf,
      outputPath: customOut,
      outputDir: customDir,
      replace
    });

    renderCompressionSummary(summary);
  } catch (err) {
    error(err.message || 'Ocorreu um erro durante a compactação.');
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log(`\n\n ${colors.yellow}Compactação cancelada pelo usuário.${colors.reset}\n`);
  process.exit(0);
});

main();
