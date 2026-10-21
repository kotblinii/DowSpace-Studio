# 🎬 DownVideo CLI — Baixador de Vídeos do YouTube (Clean)

Uma ferramenta de linha de comando (CLI) super limpa, rápida e direta para baixar vídeos do YouTube na melhor qualidade e **100% compatíveis com softwares de edição (Adobe After Effects, Premiere Pro, DaVinci Resolve)** ou extrair áudio em MP3.

---

## 💡 Por que o After Effects importava apenas áudio?
O YouTube frequentemente entrega vídeos em codecs modernos como **AV1 (`av01`)** ou **VP9 (`vp09`)** dentro do container MP4. Softwares da Adobe (After Effects e Premiere Pro) não possuem decodificador nativo para AV1/VP9 no Windows, o que faz com que eles importem somente a trilha de áudio e ignorem o vídeo.

O **DownVideo CLI** agora:
1. **Prioriza nativamente streams H.264 (AVC1) e áudio AAC (m4a)**, que são o padrão ouro da Adobe.
2. **Auto-converte qualquer resolução (incluindo 4K ou Shorts que só existam em AV1/VP9)** para **H.264** com formato de pixel **`yuv420p`**, garantindo que o After Effects sempre reconheça vídeo e áudio juntos na timeline.

---

## 🚀 Como Usar

### 1. Baixar Novo Vídeo (Pronto para o After Effects)
```bash
.\down "https://www.youtube.com/watch?v=..."
```
*(ou `node down.js "https://..."`)*

### 2. Corrigir um Vídeo que Você Já Baixou
Se você já tem um arquivo `.mp4` no seu computador que o After Effects não está abrindo o vídeo:
```bash
.\down "C:\Users\Usuario\Downloads\seu_video.mp4"
```
*Ele detectará o arquivo local e converterá o codec para H.264 (yuv420p) / AAC em segundos.*

### 3. Baixar Apenas Áudio (MP3)
```bash
.\down "https://www.youtube.com/watch?v=..." --mp3
```

### 4. Modo Interativo (Sem parâmetros)
Basta digitar:
```bash
.\down
```
E colar o link ou caminho do arquivo.

### 5. Atualizar o Motor yt-dlp
```bash
.\down --update
```
