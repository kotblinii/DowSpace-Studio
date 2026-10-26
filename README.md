# 🎬 DowSpace Studio

<p align="center">
  <strong>A suíte definitiva para Download de Vídeos em Alta Qualidade, Compactação Inteligente 2-Pass e Gerenciamento Visual de SSD no estilo SpaceSniffer.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Plataforma-Windows%2010%20%7C%2011%20(64--bit)-00d2ff?style=for-the-badge&logo=windows" alt="Windows 64-bit" />
  <img src="https://img.shields.io/badge/Framework-Electron-47848F?style=for-the-badge&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Motor-FFmpeg%20%26%20yt--dlp-d946ef?style=for-the-badge" alt="FFmpeg & yt-dlp" />
  <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-10b981?style=for-the-badge" alt="MIT" />
</p>

---

## 🌟 O Que é o DowSpace Studio?

O **DowSpace Studio** combina três ferramentas poderosas em uma única aplicação desktop moderna, elegante e com suporte completo a **Modo Claro** e **Modo Escuro**:

1. **⬇ Baixar do YouTube (Pronto para Edição):**
   - Baixe vídeos em **4K Ultra HD (2160p)**, **1080p Full HD**, **720p HD** ou extraia apenas o **Áudio em MP3**.
   - **Compatibilidade Total com NLEs:** Garante transcodificação e remux automático para H.264 (`yuv420p`) e áudio AAC, abrindo direto no **Adobe Premiere Pro** e **Adobe After Effects** sem telas pretas ou erros de decodificação.
   - Suporte a `cookies.txt` para vídeos com restrição de idade ou checagem de bot.

2. **🗜 Compactador Inteligente com 2-Pass Encoding & Slider de MB:**
   - **Tamanho Alvo Exato (MB):** Ajuste a barra interativa ou digite o tamanho exato que deseja para o vídeo final (ex: 25 MB para Discord, 16 MB para WhatsApp).
   - **2-Pass Encoding:** Na passada 1, analisa a complexidade cena a cena; na passada 2, renderiza distribuindo o bitrate de forma inteligente, entregando a **menor perda de qualidade visual possível**.
   - **Presets Rápidos:** Botões para modo *Fraco* (~30% menor), *Médio* (~60% menor) e *Forte* (~80% menor).
   - Resumo pós-compressão comparando tamanho anterior, tamanho final e porcentagem de espaço economizado.

3. **💾 Gerenciador de Armazenamento do SSD (Estilo SpaceSniffer):**
   - **Mapa Treemap Interativo:** Visualize graficamente em blocos proporcionais e coloridos (`📁 Pastas`, `🎬 Vídeos`, `📄 Arquivos`) onde está indo o espaço do seu disco.
   - **Navegação Profunda (Drill-Down):** Dê duplo clique em qualquer pasta para navegar para dentro dela com caminho de navegação (*breadcrumbs*) e botão de subir nível.
   - **Banco de Dados Local Persistente:** Salva as varreduras para carregar instantaneamente ao reabrir o app, sem precisar escanear o SSD do zero toda vez.
   - **Detector de Vídeos Gigantes (>50 MB / >1 GB):** Tabela classificada com botões rápidos para *Abrir Pasta*, *Ver no Explorer*, *Compactar* e *Lixeira Segura*.
   - **Sincronização em Tempo Real:** Ao enviar qualquer arquivo para a Lixeira, os GBs livres/usados do SSD, os contadores e os tamanhos das pastas pai são deduzidos na mesma hora.

---

## 🖥️ Como Abrir ou Instalar o Aplicativo

### Método 1: Instalador Oficial do Windows (Recomendado)
Execute o arquivo na raiz do projeto com um duplo clique:
```powershell
.\instalar.bat
```
O instalador configura o DowSpace Studio no seu computador, adiciona os atalhos com ícone na sua **Área de Trabalho** e no **Menu Iniciar**, e registra o software nas Configurações do Windows (*Adicionar ou Remover Programas*).

### Método 2: Executável Portátil (.exe)
Você também pode rodar diretamente o executável compilado sem instalar:
```powershell
.\dist\DownVideo Studio-win32-x64\DownVideo Studio.exe
```
*(Ou dê duplo clique no atalho `DowSpace Studio.lnk` na Área de Trabalho)*

### Método 3: Modo de Desenvolvimento
```powershell
npm.cmd install
npm.cmd run app
```

---

## ⚡ Comandos via Terminal (Modo CLI)

Se você trabalha frequentemente pelo prompt de comando ou PowerShell:

```powershell
# 1. Baixar vídeo do YouTube
.\down "https://www.youtube.com/watch?v=..."

# 2. Baixar somente áudio MP3
.\down "https://www.youtube.com/watch?v=..." --mp3

# 3. Compactar vídeo com preset Médio (equilibrado)
.\compactar "C:\videos\meu_video.mp4"

# 4. Compactar vídeo com preset Forte (ultra leve)
.\compactar "C:\videos\meu_video.mp4" --forte

# 5. Compactar substituindo o arquivo original
.\compactar "C:\videos\meu_video.mp4" --replace

# 6. Atualizar motor de download yt-dlp
.\down --update
```

---

## 🗜️ Tabela de Presets de Compactação

| Modo | Flag CLI | Redução Média | CRF | Bitrate Áudio | Indicação Principal |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Fraco** | `--fraco` | **~25% a 40%** | 22 | 160 kbps | Máxima fidelidade e nitidez visual para arquivos brutos de edição. |
| **Médio** | `--medio` | **~50% a 70%** | 28 | 128 kbps | Equilíbrio perfeito (Recomendado para YouTube, portfólios e web). |
| **Forte** | `--forte` | **~75% a 90%** | 34 | 96 kbps | Máxima compressão para envio no WhatsApp, Discord ou e-mails. |

---

## 📁 Estrutura do Projeto

```
DowSpace-Studio/
├── assets/                  # Ícones oficiais de alta resolução (.ico e .png)
├── bin/                     # Motores binários locais (ffmpeg.exe e yt-dlp.exe)
├── documentacao/            # 📚 Documentação técnica completa do código
│   ├── README.md            # Índice da documentação técnica
│   ├── arquitetura.md       # Arquitetura Electron e canais IPC
│   ├── modulos-backend.md   # Módulos Node.js (downloader, compressor, diskAnalyzer, etc.)
│   ├── interface-frontend.md# UI, CSS, Temas e Treemap do SpaceSniffer
│   └── guia-instalacao-e-build.md # Compilação, atalhos e instaladores
├── installer/               # Scripts de instalador (Inno Setup .iss)
├── public/                  # Frontend (HTML, CSS e JavaScript do Renderer)
│   ├── index.html           # Estrutura semântica do app
│   ├── renderer.js          # Lógica da interface, tabelas e treemap
│   └── styles.css           # Estilização com Glassmorphism e temas Claro/Escuro
├── scripts/                 # Scripts PowerShell de automação (build, atalhos, instalador)
├── src/                     # Núcleo de lógica do backend
│   ├── binaries.js          # Auto-download e checagem de binários
│   ├── compressor.js        # 2-Pass Encoding e cálculo de bitrate
│   ├── diskAnalyzer.js      # Varredura de SSD e Lixeira do Windows
│   ├── downloader.js        # Download de vídeos e suporte a After Effects
│   ├── storageDatabase.js   # Banco de dados local e cache JSON
│   └── ui.js                # Utilitários de terminal e formatação
├── down.js / compactar.js   # Pontos de entrada para a CLI
├── main.js                  # Processo principal do Electron
├── preload.cjs              # Camada de segurança e ContextBridge
├── instalar.bat             # Atalho de 1 clique para instalação no Windows
└── package.json             # Metadados e scripts de build
```

---

## 📖 Documentação Completa do Código

Para entender a fundo como cada função, módulo e algoritmo foi projetado, consulte os manuais na pasta **[`documentacao/`](documentacao/README.md)**:
- [Arquitetura Geral](documentacao/arquitetura.md)
- [Módulos do Backend](documentacao/modulos-backend.md)
- [Interface e Componentes](documentacao/interface-frontend.md)
- [Guia de Build e Empacotamento](documentacao/guia-instalacao-e-build.md)

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo `LICENSE` para mais detalhes.
Criado e mantido por [kotblinii](https://github.com/kotblinii).
