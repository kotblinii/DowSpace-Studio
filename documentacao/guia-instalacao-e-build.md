# 🚀 Guia de Instalação, Build e Empacotamento — DowSpace Studio

Este guia orienta sobre como rodar o projeto em ambiente de desenvolvimento, compilar o executável portátil (`.exe`), criar o instalador para Windows e distribuir o software.

---

## 1. Requisitos do Sistema

- **Sistema Operacional:** Windows 10 ou Windows 11 (64 bits).
- **Node.js:** Versão 20.x ou superior instalada.
- **Git:** Para clonar e gerenciar versões do repositório.

---

## 2. Executando em Ambiente de Desenvolvimento

Clone o repositório e instale as dependências:

```powershell
# 1. Clonar o repositório
git clone https://github.com/kotblinii/DowSpace-Studio.git
cd DowSpace-Studio

# 2. Instalar dependências
npm.cmd install

# 3. Iniciar o aplicativo desktop em modo de desenvolvimento
npm.cmd run app
```
*(Ou dê um duplo clique no arquivo `iniciar_app.bat` na raiz do projeto)*

---

## 3. Gerando o Executável Nativo Portátil (.exe)

O projeto está configurado com o `electron-packager` para compilar o executável sem depender de instalações globais:

```powershell
npm.cmd run build
```

O comando realiza as seguintes etapas automaticamente:
1. Empacota a aplicação com o motor do Electron de 64 bits.
2. Incorpora o ícone oficial em alta resolução [`assets/icon.ico`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/assets/icon.ico) no executável.
3. Empacota os binários de mídia (`ffmpeg.exe` e `yt-dlp.exe`) dentro do diretório `resources/app/bin/`.
4. Salva a saída completa pronta para execução em:
   ```
   dist/DownVideo Studio-win32-x64/DownVideo Studio.exe
   ```

---

## 4. Criando Atalhos na Área de Trabalho

Para gerar os atalhos automáticos apontando para o executável com o ícone personalizado:

```powershell
npm.cmd run shortcut
```
Este comando executa o script [`scripts/create_shortcuts.ps1`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/scripts/create_shortcuts.ps1), gerando:
- Atalho na Área de Trabalho: `C:\Users\<Usuario>\Desktop\DowSpace Studio.lnk`
- Atalho na pasta raiz do projeto: `DowSpace Studio.lnk`

---

## 5. Instalador para Windows

### Opção A: Instalador Automatizado com Registro no Windows (`instalar.bat`)
Para instalar o DowSpace Studio como um aplicativo padrão no Windows:
1. Dê um duplo clique no arquivo [`instalar.bat`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/instalar.bat) na raiz do projeto.
2. O script:
   - Instala os arquivos em `%LOCALAPPDATA%\DowSpace Studio`.
   - Cria o atalho no **Menu Iniciar** e na **Área de Trabalho**.
   - Registra o aplicativo no Painel de Controle e nas Configurações do Windows (*Adicionar ou Remover Programas*), permitindo que você ou seus usuários desinstalem o aplicativo a qualquer momento de forma limpa.

### Opção B: Compilar Instalador Setup (.exe) com Inno Setup
Se desejar gerar um arquivo único `DowSpace-Studio-Setup.exe` clássico para distribuir aos seus usuários:
1. Abra o arquivo [`installer/DowSpace-Studio.iss`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/installer/DowSpace-Studio.iss) no [Inno Setup Compiler](https://jrsoftware.org/isdl.php).
2. Clique em **Build > Compile**.
3. O instalador unificado com assistente de passos será gerado dentro de `dist/`.

---

## 6. Utilização via Linha de Comando (CLI)

Além da interface gráfica, o DowSpace Studio oferece suporte completo a comandos no terminal:

```powershell
# Baixar vídeo do YouTube pronto para edição
.\down "https://www.youtube.com/watch?v=..."

# Baixar somente áudio MP3
.\down "https://www.youtube.com/watch?v=..." --mp3

# Compactar vídeo local com nível Médio
.\compactar "C:\caminho\video.mp4"

# Compactar vídeo local com nível Forte (para WhatsApp/Discord)
.\compactar "C:\caminho\video.mp4" --forte

# Compactar substituindo o original
.\compactar "C:\caminho\video.mp4" --replace
```
