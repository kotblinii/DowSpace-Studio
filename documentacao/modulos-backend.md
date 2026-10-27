# ⚙️ Módulos do Backend (Node.js Core) — DowSpace Studio

Este documento descreve detalhadamente cada módulo localizado no diretório [`src/`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src), explicando suas funções, parâmetros, retornos e decisões de engenharia.

---

## 1. [`src/downloader.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/downloader.js) — Motor de Download do YouTube

Responsável por orquestrar o download e a conversão de vídeos do YouTube em formatos garantidamente compatíveis com softwares de edição não-linear (como **Adobe Premiere Pro** e **Adobe After Effects**).

### Principais Funções:
- **`findCookiesFile()`**: Varre recursivamente o diretório raiz e pastas comuns em busca de um arquivo `cookies.txt` (exportado de extensões como *Get cookies.txt LOCALLY*). Isso contorna restrições do YouTube como *Sign in to confirm you’re not a bot* e *Age-restricted content*.
- **`getVideoMetadata(url)`**: Executa `yt-dlp.exe --dump-single-json` para inspecionar o vídeo de forma ultra-rápida sem baixar a mídia, retornando título, canal, duração, thumbnail e formato padrão.
- **`downloadMedia(target, options, onProgress)`**:
  - Aceita tanto URLs do YouTube quanto caminhos de arquivos locais (`.mp4`, `.webm`, `.mkv`) para transcodificação.
  - **Suporte a Resoluções:**
    - `4k`: `bestvideo[height<=2160]+bestaudio/best[height<=2160]`
    - `1080p`: `bestvideo[height<=1080]+bestaudio/best[height<=1080]`
    - `720p`: `bestvideo[height<=720]+bestaudio/best[height<=720]`
    - `audio`: Extrai áudio em MP3 (`-x --audio-format mp3 --audio-quality 0`).
  - **Conversão de Compatibilidade NLE:** Usa os pós-processadores do FFmpeg `--postprocessor-args "ffmpeg:-c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 -c:a aac -b:a 192k"` para garantir que o MP4 funcione perfeitamente sem erros de decodificação no Premiere e After Effects.

---

## 2. [`src/compressor.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/compressor.js) — Compactador Inteligente 2-Pass

Desenvolvido para entregar a menor perda de qualidade possível ao reduzir o tamanho de vídeos, utilizando algoritmo de **2-Pass Encoding** e alocação dinâmica de bitrate.

### Presets de Compactação:
- **Fraco (Leve - CRF 22):** ~30% menor. Ideal para preservar detalhes máximos em vídeos brutos de edição.
- **Médio (Equilibrado - CRF 28):** ~60% menor. Padrão recomendado para YouTube, web e portfólios.
- **Forte (Ultra Leve - CRF 34):** ~80% menor. Otimizado para WhatsApp, Discord e envio por e-mail.

### Modo Tamanho Alvo Exato (MB Slider):
Quando um tamanho em Megabytes é solicitado pelo usuário (ex: 25 MB para upload no Discord):
1. **Cálculo de Bitrate Total:**
   $$\text{Bitrate Total (kbps)} = \frac{\text{Tamanho Alvo (MB)} \times 8192}{\text{Duração (segundos)}} \times 0.95$$
2. **Subtração do Bitrate de Áudio:** Reserva 64 a 128 kbps para o áudio AAC e atribui o restante ao canal de vídeo.
3. **Passada 1 (Análise):** Executa o FFmpeg com `-b:v {bitrate} -pass 1 -an -f null NUL` para mapear a complexidade temporal das cenas em um arquivo de log temporário.
4. **Passada 2 (Renderização):** Executa o FFmpeg com `-b:v {bitrate} -pass 2 -c:a aac` para distribuir os bits de forma inteligente, alocando mais dados em cenas com muito movimento e economizando em quadros estáticos.

---

## 3. [`src/diskAnalyzer.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/diskAnalyzer.js) — Analisador de Armazenamento e SpaceSniffer

Realiza medições estruturais de diretórios e unidades de disco no Windows de forma resiliente contra pastas de sistema inacessíveis (`System Volume Information`, `$Recycle.Bin`).

### Principais Recursos:
- **`getDrivesInfo()`**: Executa `wmic logicaldisk` e `powershell Get-CimInstance Win32_LogicalDisk` para detectar letras de unidade, capacidade total, espaço livre e porcentagem de uso.
- **`scanDirectory(targetPath, options, onProgress)`**:
  - Varre o sistema de arquivos recursivamente calculando o tamanho total de cada pasta e subpasta.
  - Emite eventos de progresso via callback `onProgress` informando quantidade de arquivos varridos e diretório atual.
  - Suporta cancelamento imediato seguro via sinal `AbortSignal`.
- **`moveToRecycleBin(filePath)`**: Em vez de exclusões permanentes destrutivas que causariam perda irreparável de dados, utiliza o objeto nativo COM do Windows `(New-Object -ComObject Shell.Application).Namespace(0).ParseName(...).InvokeVerb("delete")` para enviar qualquer arquivo ou pasta diretamente para a **Lixeira do Windows**, permitindo recuperação se necessário.

---

## 4. [`src/storageDatabase.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/storageDatabase.js) — Persistência e Cache Local

Elimina a necessidade de esperar minutos para reescanear o disco sempre que o aplicativo for reaberto.

- **Arquivo de Armazenamento:** `data/storage_db.json`.
- **`saveScanResult(rootPath, scanData)`**: Salva a lista de pastas mais pesadas, treemap e vídeos gigantes junto com o timestamp da varredura.
- **`getSavedScan(rootPath)`**: Recupera instantaneamente os dados da última análise para a unidade ou pasta solicitada.
- **`removeFileFromDatabase(filePath, sizeBytes)`**: Quando um arquivo é enviado para a lixeira pela interface, esta função atualiza o banco JSON local, deduzindo o tamanho das pastas pai e removendo o arquivo da lista sem exigir uma nova varredura completa.

---

## 5. [`src/binaries.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/binaries.js) — Gerenciador Automático de Binários

Garante que o aplicativo seja 100% autônomo e não exija que o usuário instale manualmente o FFmpeg ou o yt-dlp.

- **`ensureBinaries()`**:
  - Verifica se `bin/yt-dlp.exe` existe. Se ausente, faz o download via streaming com barra de progresso da versão oficial mais recente do GitHub.
  - Verifica se `bin/ffmpeg.exe` existe ou está no PATH do Windows. Se ausente, baixa o pacote pré-compilado de 64 bits e extrai automaticamente usando o utilitário nativo `tar.exe` do Windows.
- **`updateYtDlp()`**: Executa `yt-dlp.exe -U` para atualizar o motor de extração sempre que o YouTube modificar seus algoritmos.

---

## 6. [`src/cacheCleaner.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/cacheCleaner.js) — Limpeza Inteligente de Caches de Aplicativos

Detecta e remove gigabytes acumulados por softwares de edição de vídeo, placas de vídeo e programas do Windows sem afetar projetos, configurações ou mídias do usuário.

### Catálogo de Caches Monitorados:
- **Adobe After Effects (Disk Cache):** Caches de pré-visualização de RAM e renderizações temporárias (`Temp/Adobe/After Effects/.../Disk Cache`). Seguro para limpar; o After Effects recria sob demanda.
- **Adobe Common (Media Cache & Peak Files):** Arquivos de forma de onda (.cfa, .pek) e metadados compartilhados entre Premiere Pro, After Effects e Media Encoder.
- **NVIDIA DirectX & OpenGL/Vulkan Cache:** Caches de shaders compilados pela placa de vídeo em `AppData/Local/NVIDIA/DXCache` e `GLCache`.
- **AMD Radeon Shader Cache:** Shaders da placa gráfica AMD em `AppData/Local/AMD/DxCache`.
- **Windows Temp:** Instaladores residuais e arquivos temporários descompactados em `%TEMP%`.
- **Caches de Aplicativos e Web:** Discord, Spotify, Google Chrome e Microsoft Edge.

### Funções Principais:
- **`scanAppCaches()`**: Varre o catálogo de locais conhecidos, calcula o tamanho ocupado em disco e verifica se o aplicativo associado está atualmente aberto no Windows via `Get-CimInstance Win32_Process`.
- **`purgeCacheFolder(targetPath)`**: Remove recursivamente arquivos internos e subpastas mantendo a raiz do diretório intacta para total estabilidade dos aplicativos.
- **`cleanSelectedCaches(cacheIds)`**: Executa a limpeza em lote dos caches selecionados pelo usuário, contabilizando arquivos excluídos, arquivos bloqueados em uso e o total de gigabytes liberados.

