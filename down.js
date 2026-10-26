#!/usr/bin/env node
// down.js — Clean YouTube Downloader CLI (Compatível com After Effects, Premiere e Autenticação de Cookies)

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { ensureBinaries, updateYtDlp } from './src/binaries.js';
import {
  getVideoMetadata,
  downloadMedia,
  getDefaultDownloadDir,
  getVideoCodec,
  convertToH264,
  findCookiesFile,
  compressVideo
} from './src/downloader.js';
import {
  banner,
  bannerCompress,
  renderCompressionSummary,
  info,
  step,
  success,
  error,
  warn,
  colors
} from './src/ui.js';

function showHelp() {
  banner();
  console.log(` ${colors.bold}Uso:${colors.reset}`);
  console.log(`   ${colors.cyan}down${colors.reset} ${colors.yellow}"<url-do-video>"${colors.reset} [opções]`);
  console.log(`   ${colors.cyan}down${colors.reset} ${colors.yellow}"<arquivo-local.mp4>"${colors.reset}       ${colors.gray}(Converte para compatibilidade com After Effects)${colors.reset}`);
  console.log(`   ${colors.cyan}down${colors.reset} ${colors.yellow}"<arquivo.mp4>"${colors.reset} --compactar   ${colors.gray}(Compacta e reduz o tamanho do vídeo)${colors.reset}`);
  console.log(`   ${colors.cyan}down${colors.reset}                            ${colors.gray}(Modo interativo com prompt)${colors.reset}`);
  console.log();
  console.log(` ${colors.bold}Opções:${colors.reset}`);
  console.log(`   ${colors.green}--4k, -4k${colors.reset}         Baixa em 4K Ultra HD (2160p)`);
  console.log(`   ${colors.green}--1080p${colors.reset}           Baixa em 1080p Full HD (Padrão After Effects)`);
  console.log(`   ${colors.green}--720p${colors.reset}            Baixa em 720p HD Rápido`);
  console.log(`   ${colors.green}--mp3, -a${colors.reset}          Baixa apenas o áudio convertido em MP3`);
  console.log(`   ${colors.green}--dir, -d <caminho>${colors.reset} Define a pasta de destino do arquivo`);
  console.log(`   ${colors.green}--cookies, -c <arq>${colors.reset} Caminho para arquivo cookies.txt do YouTube`);
  console.log(`   ${colors.green}--compactar${colors.reset}        Compacta o vídeo para deixá-lo mais leve`);
  console.log(`   ${colors.green}--forte, --medio, --fraco${colors.reset} Define o nível de compactação`);
  console.log(`   ${colors.green}--update, -u${colors.reset}       Atualiza o motor yt-dlp para a versão mais recente`);
  console.log(`   ${colors.green}--help, -h${colors.reset}         Exibe esta mensagem de ajuda`);
  console.log();
  console.log(` ${colors.bold}Novo Comando Dedicado para Compactação:${colors.reset}`);
  console.log(`   ${colors.magenta}compactar${colors.reset} ${colors.yellow}"<video.mp4>"${colors.reset} [--forte | --medio | --fraco]`);
  console.log(`   ${colors.gray}Ou digite apenas ${colors.magenta}compactar${colors.gray} para abrir o assistente interativo.${colors.reset}`);
  console.log();
  console.log(` ${colors.bold}Exemplos:${colors.reset}`);
  console.log(`   ${colors.gray}$${colors.reset} down "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`);
  console.log(`   ${colors.gray}$${colors.reset} down "https://youtu.be/dQw4w9WgXcQ" --mp3`);
  console.log(`   ${colors.gray}$${colors.reset} down "C:\\Users\\Usuario\\Downloads\\video_antigo.mp4"`);
  console.log(`   ${colors.gray}$${colors.reset} compactar "C:\\meu_video.mp4" --forte`);
  console.log();
}

/**
 * Valida se uma string aparenta ser uma URL do YouTube.
 */
function isYouTubeUrl(str) {
  if (!str) return false;
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+$/i.test(str.trim());
}

/**
 * Converte um arquivo local existente para H.264/AAC compatível com After Effects.
 */
async function handleLocalFile(filePath) {
  const resolved = path.resolve(filePath.replace(/^["']|["']$/g, ''));
  if (!fs.existsSync(resolved)) {
    error(`Arquivo não encontrado: ${resolved}`);
    process.exit(1);
  }

  await ensureBinaries();
  step(`Analisando arquivo local: ${path.basename(resolved)}...`);
  const codec = await getVideoCodec(resolved);

  console.log();
  info('Arquivo', path.basename(resolved));
  info('Codec Atual', codec.toUpperCase());

  if (codec === 'h264') {
    success('Este arquivo já utiliza o codec H.264 compatível com o After Effects!');
    return;
  }

  step(`Convertendo de ${codec.toUpperCase()} para H.264 (yuv420p) / AAC...`);
  await convertToH264(resolved);

  success('Arquivo convertido e otimizado com sucesso!');
  console.log(` ${colors.gray}📁 Pronto para importar no After Effects:${colors.reset} ${colors.bold}${resolved}${colors.reset}\n`);
}

async function main() {
  const args = process.argv.slice(2);

  // Flags de ajuda ou update
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--update') || args.includes('-u')) {
    banner();
    updateYtDlp();
    process.exit(0);
  }

  let target = '';
  let isAudioOnly = false;
  let customDir = null;
  let customCookies = null;
  let isCompress = false;
  let compressLevel = 'medio';
  let isReplace = false;
  let resolution = '1080p';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mp3' || arg === '-a' || arg === '--audio') {
      isAudioOnly = true;
    } else if (arg === '--4k' || arg === '-4k' || arg === '--2160p') {
      resolution = '4k';
    } else if (arg === '--1080p' || arg === '-1080') {
      resolution = '1080p';
    } else if (arg === '--720p' || arg === '-720') {
      resolution = '720p';
    } else if (arg === '--dir' || arg === '-d') {
      customDir = args[++i];
    } else if (arg === '--cookies' || arg === '-c') {
      customCookies = args[++i];
    } else if (arg === '--compactar' || arg === '--compress') {
      isCompress = true;
    } else if (arg === '--forte' || arg === '--strong') {
      isCompress = true;
      compressLevel = 'forte';
    } else if (arg === '--medio' || arg === '--medium') {
      isCompress = true;
      compressLevel = 'medio';
    } else if (arg === '--fraco' || arg === '--light') {
      isCompress = true;
      compressLevel = 'fraco';
    } else if (arg === '--replace' || arg === '-r') {
      isReplace = true;
    } else if (!arg.startsWith('-') && !target) {
      target = arg.trim();
    }
  }

  // Se o argumento passado for um arquivo existente no computador
  const cleanTarget = target.replace(/^["']|["']$/g, '');
  if (cleanTarget && fs.existsSync(cleanTarget)) {
    try {
      if (isCompress) {
        bannerCompress();
        const summary = await compressVideo(cleanTarget, {
          level: compressLevel,
          outputDir: customDir,
          replace: isReplace
        });
        renderCompressionSummary(summary);
        process.exit(0);
      }
      banner();
      await handleLocalFile(cleanTarget);
      process.exit(0);
    } catch (err) {
      error(err.message || 'Falha ao processar arquivo local.');
      process.exit(1);
    }
  }

  banner();

  // Se o alvo não foi passado como argumento, solicita no modo interativo
  if (!target) {
    const rl = readline.createInterface({ input, output });

    try {
      console.log(` ${colors.gray}Dica: Cole o link do YouTube ou o caminho de um vídeo local para corrigir/compactar.${colors.reset}\n`);
      const answer = await rl.question(` ${colors.cyan}▶${colors.reset} ${colors.bold}Cole o link ou caminho do arquivo:${colors.reset} `);
      target = answer.trim();

      if (!target) {
        warn('Nenhum dado fornecido. Operação cancelada.');
        rl.close();
        process.exit(0);
      }

      const cleanInteractive = target.replace(/^["']|["']$/g, '');
      if (fs.existsSync(cleanInteractive)) {
        console.log();
        console.log(` ${colors.bold}Arquivo de vídeo local detectado! O que deseja fazer?${colors.reset}`);
        console.log(`  ${colors.cyan}[1]${colors.reset} Converter para After Effects ${colors.gray}(H.264 / AAC — Corrige timeline)${colors.reset}`);
        console.log(`  ${colors.magenta}[2]${colors.reset} Compactar vídeo ${colors.gray}(Reduzir peso com níveis Forte, Médio ou Fraco)${colors.reset}`);
        const actionChoice = await rl.question(`\n ${colors.cyan}▶${colors.reset} Escolha ${colors.gray}[1 ou 2, padrão: 1]${colors.reset}: `);

        if (actionChoice.trim() === '2') {
          console.log();
          console.log(` ${colors.bold}Escolha o nível de compactação:${colors.reset}`);
          console.log(`  ${colors.green}[1] Fraco${colors.reset}  — Leve, máxima fidelidade visual ${colors.gray}(~25% a 40% menor, CRF 22)${colors.reset}`);
          console.log(`  ${colors.cyan}[2] Médio${colors.reset}  — Equilibrado, recomendado ${colors.gray}(~50% a 70% menor, CRF 28)${colors.reset}`);
          console.log(`  ${colors.magenta}[3] Forte${colors.reset}  — Ultra leve, ideal para WhatsApp/Discord ${colors.gray}(~75% a 90% menor, CRF 34)${colors.reset}`);
          const lvl = await rl.question(`\n ${colors.magenta}▶${colors.reset} Escolha o nível ${colors.gray}[1, 2 ou 3, padrão: 2]${colors.reset}: `);
          let chosen = 'medio';
          if (lvl.trim() === '1') chosen = 'fraco';
          if (lvl.trim() === '3') chosen = 'forte';
          rl.close();

          bannerCompress();
          const summary = await compressVideo(cleanInteractive, { level: chosen });
          renderCompressionSummary(summary);
          process.exit(0);
        }

        rl.close();
        await handleLocalFile(cleanInteractive);
        process.exit(0);
      }

      console.log();
      console.log(` ${colors.bold}Formato desejado:${colors.reset}`);
      console.log(`  ${colors.cyan}[1]${colors.reset} Vídeo MP4 ${colors.gray}(H.264/AAC — 100% compatível com After Effects)${colors.reset}`);
      console.log(`  ${colors.cyan}[2]${colors.reset} Áudio MP3 ${colors.gray}(Somente áudio)${colors.reset}`);
      const formatChoice = await rl.question(`\n ${colors.cyan}▶${colors.reset} Escolha ${colors.gray}[1 ou 2, padrão: 1]${colors.reset}: `);

      if (formatChoice.trim() === '2') {
        isAudioOnly = true;
      }
    } finally {
      rl.close();
    }
  }

  const url = target;

  // Validação básica de URL
  if (!isYouTubeUrl(url)) {
    warn('O link fornecido não parece ser uma URL válida do YouTube.');
    console.log(` ${colors.gray}Exemplo esperado: https://www.youtube.com/watch?v=... ou https://youtu.be/...${colors.reset}\n`);
  }

  const outputDir = customDir ? path.resolve(customDir) : getDefaultDownloadDir();
  const cookiesFile = findCookiesFile(customCookies);

  try {
    // 1. Garantir que os executáveis necessários estejam presentes
    await ensureBinaries();

    // 2. Extração rápida de metadados
    step('Obtendo dados do vídeo...');
    const meta = await getVideoMetadata(url, cookiesFile);

    console.log();
    info('Título', meta.title);
    info('Canal', meta.channel);
    info('Duração', meta.duration);
    info('Formato', isAudioOnly ? `${colors.magenta}Áudio MP3${colors.reset}` : `${colors.cyan}Vídeo MP4 (H.264/AAC - After Effects Ready)${colors.reset}`);
    info('Destino', outputDir);
    if (cookiesFile) {
      info('Cookies', `${colors.green}Ativo (${path.basename(cookiesFile)})${colors.reset}`);
    }
    console.log();

    // 3. Início do Download
    step(`Iniciando download de "${meta.title}"...`);
    const result = await downloadMedia(url, {
      resolution: isAudioOnly ? 'audio' : resolution,
      isAudioOnly,
      outputDir,
      cookiesPath: cookiesFile
    });

    success('Download concluído com sucesso!');
    console.log(` ${colors.gray}📁 Pronto para usar no After Effects:${colors.reset} ${colors.bold}${result.filePath}${colors.reset}\n`);

  } catch (err) {
    error(err.message || 'Ocorreu um erro inesperado durante o download.');
    process.exit(1);
  }
}

// Tratamento de encerramento gracioso (Ctrl+C)
process.on('SIGINT', () => {
  console.log(`\n\n ${colors.yellow}Download cancelado pelo usuário.${colors.reset}\n`);
  process.exit(0);
});

main();
