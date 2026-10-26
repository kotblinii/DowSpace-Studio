# 🎨 Interface do Usuário & Frontend — DowSpace Studio

Este documento detalha a implementação visual e o controlador de interface gráfica localizados no diretório [`public/`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public).

---

## 1. Estrutura de Abas e Componentes ([`public/index.html`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public/index.html))

A aplicação adota um layout com **Sidebar Fixa à Esquerda** e **Área de Conteúdo com Abas à Direita**:

1. **Aba 1 — Baixar Vídeo (`#tab-download`):**
   - Campo de URL do YouTube com botão de colar automático do clipboard.
   - Grade seletora de qualidade (4K, 1080p, 720p, Áudio MP3).
   - Seletor de pasta de destino com suporte a diálogo nativo do Windows.
   - Cartão de metadados do vídeo com capa, canal e duração.
   - Barra de progresso com estatísticas ao vivo (MB/s, ETA, porcentagem).

2. **Aba 2 — Compactador de Vídeo (`#tab-compress`):**
   - Zona de arrastar e soltar arquivos (*Drag and Drop*) e botão seletor de arquivo de vídeo.
   - Painel de metadados do vídeo carregado (resolução, duração, codec atual, tamanho).
   - Seletor de níveis rápidos (Fraco, Médio, Forte).
   - Controle interativo de tamanho exato com slider de 2 MB a 500+ MB e campo numérico sincronizado.
   - Indicador de economia estimada e badge de 2-Pass Encoding ativado.
   - Opção para substituir o arquivo original diretamente.
   - Cartão de resumo comparativo pós-compressão (*Tamanho Antes* $\rightarrow$ *Tamanho Depois* e *Espaço Economizado*).

3. **Aba 3 — Gerenciador de Espaço do SSD (`#tab-storage`):**
   - Seletor de unidades do Windows (C:, D:, etc.) no cabeçalho com porcentagem de uso.
   - Cartão de visão geral do disco atual com medidor gradiente e estatísticas de GB usado, livre e total.
   - Barra de ações com exibição do diretório alvo, link "Alterar pasta", badge de status do banco de dados e botões "Atualizar Tudo" e "Escanear Unidade".
   - Sub-abas de visualização:
     - **SpaceSniffer (Treemap Interativo):** Visualização em blocos coloridos proporcionais.
     - **Pastas Mais Pesadas:** Tabela classificada com barras de porcentagem.
     - **Vídeos Gigantes:** Tabela de arquivos pesados com ações de abrir pasta, destacar no Explorer, compactar e excluir.

---

## 2. Lógica do Controlador ([`public/renderer.js`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public/renderer.js))

- **Gerenciamento de Estado:**
  - Armazena a aba ativa, unidade selecionada, dados da raiz escaneada (`rootScanData`), pasta atual no SpaceSniffer (`currentFolderPath`) e histórico de navegação.
  - Mantém um cache local de pastas em memória (`localFolderCache`) para navegação instantânea para frente e para trás sem travamentos.
- **Treemap Dinâmico do SpaceSniffer (`renderSpaceSniffer`):**
  - Calcula a área visual de cada bloco proporcionalmente à sua fatia em relação ao tamanho total da pasta.
  - Aplica classes semânticas (`.folder` em ciano/azul, `.video` em magenta/roxo e `.file` em cinza ardósia).
  - Permite duplo clique ou clique no botão "Entrar" para navegar recursivamente para dentro de qualquer diretório.
- **Sincronização em Tempo Real na Exclusão (`handleFileDeleted`):**
  - Ao excluir um vídeo ou pasta, atualiza imediatamente os contadores numéricos, deduz os GB do medidor superior e da barra lateral, e recalcula as pastas pai sem necessidade de reescanear o disco inteiro.

---

## 3. Design System & Responsividade ([`public/styles.css`](file:///c:/Users/Usuario/.gemini/antigravity-ide/scratch/downvideo/public/styles.css))

- **Cores & Variáveis CSS:**
  - Suporta alternância total entre **Modo Escuro (Dark Obsidian)** e **Modo Claro (Clean Minimal)** através do atributo `data-theme="light"` aplicado ao elemento `<html>`.
  - Paleta com toques vibrantes em ciano neon (`--accent-cyan: #00d2ff`), magenta elétrico (`--accent-magenta: #d946ef`), verde esmeralda (`--accent-green: #10b981`) e vermelho alerta (`--accent-red: #ef4444`).
- **Prevenção de Quebras de Texto no Modo Janela Padrão:**
  - Largura da barra lateral otimizada para `220px` (e `200px` em telas compactas).
  - Preenchimento do conteúdo principal reduzido para `24px 30px` para liberar mais de 50px de espaço horizontal.
  - Regras rígidas de `white-space: nowrap;` em botões de ação, badges e links curtos ("Alterar pasta") para evitar quebras feias de duas linhas.
  - Grades CSS com `repeat(auto-fit, minmax(...))` para que cartões de qualidade e níveis de compressão se distribuam equilibradamente em qualquer tamanho de monitor.
- **Uso Minimalista de Emojis:**
  - Emojis reservados exclusivamente para informações e identidades principais: logo (`🎬`), abas primárias (`⬇`, `🗜`, `💾`), alternador de tema (`☀️`/`🌙`) e ícones de tipo de arquivo (`📁`, `🎬`, `📄`).
