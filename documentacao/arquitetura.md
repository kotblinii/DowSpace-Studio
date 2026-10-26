# 🏛️ Arquitetura do Sistema — DowSpace Studio

O **DowSpace Studio** é uma aplicação desktop desenvolvida sobre o framework **Electron**. Este documento detalha a estrutura de processos, o isolamento de segurança e a comunicação entre as camadas.

---

## 1. Modelo de Processos do Electron

A aplicação é dividida em dois tipos fundamentais de processos:

### 1.1 Processo Principal (Main Process)
- **Arquivo de Entrada:** [`main.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/main.js)
- **Ambiente:** Node.js completo com acesso a módulos nativos do sistema (`node:fs`, `node:path`, `node:child_process`, `node:os`).
- **Responsabilidades:**
  - Gerenciamento do ciclo de vida da aplicação (`app.on('ready')`, `app.on('window-all-closed')`).
  - Criação e configuração da janela principal ([`BrowserWindow`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/main.js#L34-L57)) com dimensões responsivas mínimas (980x680px), ícone da aplicação e preferências web seguras.
  - Registro de canais de comunicação IPC ([`ipcMain.handle`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/main.js#L65-L310)).
  - Execução de tarefas intensivas de I/O e processamento de arquivos (varreduras de disco, conversão de vídeo, download e compressão).

### 1.2 Processo de Renderização (Renderer Process)
- **Arquivos:** [`public/index.html`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public/index.html), [`public/renderer.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public/renderer.js), [`public/styles.css`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public/styles.css)
- **Ambiente:** Navegador Chromium isolado da API direta do Node.js por razões de segurança.
- **Responsabilidades:**
  - Apresentação visual da interface, animações, feedback de progresso e manipulação do DOM.
  - Alternância de temas (Claro / Escuro).
  - Renderização do mapa interativo SpaceSniffer (Treemap) e navegação em pastas.
  - Controle interativo dos parâmetros de compressão (slider de MB e presets) e seleção de qualidades de vídeo.

### 1.3 Camada de Ponte (Preload Script)
- **Arquivo:** [`preload.cjs`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/preload.cjs)
- **Mecanismo:** Utiliza [`contextBridge.exposeInMainWorld('api', {...})`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/preload.cjs#L10-L75).
- **Vantagem de Segurança:** Impede que scripts maliciosos ou vulnerabilidades do navegador executem código arbitrário no sistema operacional, expondo apenas funções estritamente controladas e parametrizadas para o `window.api`.

---

## 2. Protocolo de Comunicação IPC (Inter-Process Communication)

A comunicação entre a interface do usuário e o sistema operacional ocorre através de métodos assíncronos baseados em Promises (`ipcRenderer.invoke` <-> `ipcMain.handle`) e eventos de streaming unidirecionais (`webContents.send` -> `ipcRenderer.on`):

| Canal IPC | Tipo | Origem | Destino | Descrição |
| :--- | :---: | :---: | :---: | :--- |
| `yt:get-meta` | Invoke | Renderer | Main | Extrai metadados do vídeo do YouTube (título, canal, duração, thumbnail). |
| `yt:download` | Invoke | Renderer | Main | Inicia o download e conversão para H.264/AAC. |
| `yt:progress` | Event | Main | Renderer | Notifica o progresso do download (porcentagem, velocidade em MB/s e ETA). |
| `video:get-details` | Invoke | Renderer | Main | Executa `ffprobe` e extrai resolução, duração, tamanho e codecs de um vídeo local. |
| `video:compress` | Invoke | Renderer | Main | Executa a compactação em 2 passos (2-Pass Encoding) ou CRF no vídeo selecionado. |
| `video:compress-progress` | Event | Main | Renderer | Notifica o progresso da compactação (porcentagem, velocidade relativa `x` e ETA). |
| `disk:get-drives` | Invoke | Renderer | Main | Obtém unidades de disco do Windows (C:, D:, etc.), espaço usado, livre e total. |
| `disk:scan-directory` | Invoke | Renderer | Main | Realiza a varredura profunda de uma pasta ou unidade, classificando pastas e vídeos. |
| `disk:scan-progress` | Event | Main | Renderer | Emite em tempo real a contagem de arquivos varridos e pasta atual. |
| `disk:cancel-scan` | Invoke | Renderer | Main | Interrompe imediatamente a varredura em andamento via `AbortController`. |
| `disk:get-folder-contents` | Invoke | Renderer | Main | Mede os itens imediatos de uma subpasta para a navegação do SpaceSniffer. |
| `db:get-saved-scan` | Invoke | Renderer | Main | Carrega instantaneamente dados de varredura prévios salvos em cache JSON. |
| `disk:delete-file` | Invoke | Renderer | Main | Move o arquivo ou pasta diretamente para a **Lixeira do Windows** de forma segura. |

---

## 3. Diretórios de Trabalho e Persistência

- **`bin/`**: Contém os utilitários de mídia binários (`yt-dlp.exe` e `ffmpeg.exe`). Se ausentes, são baixados automaticamente via streaming na primeira execução por [`src/binaries.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/binaries.js).
- **`data/`**: Contém o banco de dados local [`data/storage_db.json`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/src/storageDatabase.js). Esse arquivo é ignorado no repositório Git para garantir a privacidade dos arquivos do usuário.
- **`dist/`**: Pasta de saída das compilações de produção geradas pelo `electron-packager`.
