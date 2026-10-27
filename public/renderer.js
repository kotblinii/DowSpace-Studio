// public/renderer.js
// Lógica de interface, SpaceSniffer Treemap, Modo Claro e Ações de Disco

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.electronAPI;
  if (!api) {
    console.error('Electron API não está disponível no contexto.');
    return;
  }

  // =========================================================================
  // 1. Alternador de Modo Claro / Modo Escuro
  // =========================================================================
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const themeLabel = document.getElementById('theme-label');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('downvideo_theme', theme);

    if (theme === 'light') {
      themeIcon.textContent = '🌙';
      themeLabel.textContent = 'Modo Escuro';
    } else {
      themeIcon.textContent = '☀️';
      themeLabel.textContent = 'Modo Claro';
    }
  }

  // Carrega preferência salva ou padrão escuro
  const savedTheme = localStorage.getItem('downvideo_theme') || 'dark';
  applyTheme(savedTheme);

  btnThemeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  // =========================================================================
  // 2. Navegação por Abas Principais
  // =========================================================================
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(tabId) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Sub-abas do Scanner (SpaceSniffer x Pastas x Vídeos)
  const subtabBtns = document.querySelectorAll('.subtab-btn');
  const subtabPanes = document.querySelectorAll('.subtab-pane');

  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subtabBtns.forEach(b => b.classList.remove('active'));
      subtabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.subtab);
      if (targetPane) targetPane.classList.add('active');
      if (btn.dataset.subtab === 'subtab-cache') {
        loadAndRenderAppCaches(true);
      }
    });
  });

  // =========================================================================
  // 3. Estado do Gerenciador de Armazenamento
  // =========================================================================
  let currentDrives = [];
  let selectedDrive = null;
  let customScanPath = null;
  let isScanning = false;

  // Estado da navegação profunda SpaceSniffer
  let currentFolderPath = null;
  let rootScanData = null;

  async function loadDrives(targetDriveId = null) {
    try {
      currentDrives = await api.getDrives();
      if (!currentDrives || currentDrives.length === 0) return;

      const driveToSelectId = targetDriveId || (selectedDrive ? selectedDrive.id : null);
      if (driveToSelectId) {
        selectedDrive = currentDrives.find(d => d.id.toUpperCase() === driveToSelectId.toUpperCase()) || currentDrives[0];
      } else {
        selectedDrive = currentDrives.find(d => d.id.toUpperCase() === 'C:') || currentDrives[0];
      }

      await selectDrive(selectedDrive, false);
    } catch (err) {
      console.error('Falha ao carregar informações das unidades:', err);
    }
  }

  async function selectDrive(drive, autoScanIfMissing = true) {
    if (!drive) return;
    selectedDrive = drive;
    const driveRoot = drive.id.endsWith('\\') ? drive.id : drive.id + '\\';
    customScanPath = driveRoot;
    currentFolderPath = driveRoot;
    localFolderCache.clear();

    renderDriveSelector();
    updateDriveOverview(drive);
    updateSidebarSSDWidget(drive);

    const loaded = await loadSavedScanIfAvailable(customScanPath);
    if (!loaded) {
      rootScanData = null;
      if (autoScanIfMissing) {
        await performScan(customScanPath);
      } else {
        scanResultsContainer.classList.add('hidden');
      }
    }
  }

  function updateSidebarSSDWidget(drive) {
    const pill = document.getElementById('nav-storage-pill');
    const nameEl = document.getElementById('sidebar-ssd-name');
    const pctEl = document.getElementById('sidebar-ssd-pct');
    const barEl = document.getElementById('sidebar-ssd-bar');
    const freeEl = document.getElementById('sidebar-ssd-free');

    const pct = `${drive.usedPercent}%`;
    pill.textContent = pct;
    pill.classList.toggle('warning', drive.usedPercent >= 85);

    nameEl.textContent = `SSD (${drive.id})`;
    pctEl.textContent = pct;
    barEl.style.width = pct;
    barEl.className = `progress-fill ${drive.usedPercent >= 90 ? 'magenta' : drive.usedPercent >= 75 ? 'gradient-storage' : 'cyan'}`;
    freeEl.textContent = `${drive.freeFormatted} livres`;
  }

  function renderDriveSelector() {
    const container = document.getElementById('drives-selector-container');
    container.innerHTML = '';

    currentDrives.forEach(drive => {
      const btn = document.createElement('button');
      btn.className = `drive-pill ${drive.id.toUpperCase() === selectedDrive.id.toUpperCase() ? 'active' : ''}`;
      btn.title = `${drive.label} (${drive.totalFormatted}) - ${drive.usedPercent}% utilizado`;
      btn.innerHTML = `<span class="pill-drive-name">Disco (${drive.id})</span> <span class="pill-drive-pct">${drive.usedPercent}%</span>`;
      btn.addEventListener('click', async () => {
        if (selectedDrive && selectedDrive.id.toUpperCase() === drive.id.toUpperCase()) {
          return;
        }
        await selectDrive(drive, true);
      });
      container.appendChild(btn);
    });
  }

  function updateDriveOverview(drive) {
    document.getElementById('current-drive-title').textContent = `${drive.label}`;
    document.getElementById('current-drive-status').textContent = `Espaço total: ${drive.totalFormatted} • ${drive.usedPercent}% utilizado`;
    document.getElementById('metric-used').textContent = drive.usedFormatted;
    document.getElementById('metric-free').textContent = drive.freeFormatted;
    document.getElementById('metric-total').textContent = drive.totalFormatted;

    const meterBar = document.getElementById('storage-meter-bar');
    const meterPct = document.getElementById('storage-meter-pct');
    meterBar.style.width = `${drive.usedPercent}%`;
    meterPct.textContent = `${drive.usedPercent}%`;

    document.getElementById('scan-target-path').textContent = customScanPath;
  }

  // =========================================================================
  // 4. Scanner de SSD & Visualizador SpaceSniffer & Banco de Dados
  // =========================================================================
  const btnStartScan = document.getElementById('btn-start-scan');
  const btnCancelScan = document.getElementById('btn-cancel-scan');
  const btnChangeScanFolder = document.getElementById('btn-change-scan-folder');
  const scanLiveProgress = document.getElementById('scan-live-progress');
  const scanCounterBadge = document.getElementById('scan-counter-badge');
  const scanLivePath = document.getElementById('scan-live-path');
  const scanResultsContainer = document.getElementById('scan-results-container');
  const dbStatusBadge = document.getElementById('db-status-badge');

  const spacesnifferGrid = document.getElementById('spacesniffer-grid');
  const sniffBreadcrumbs = document.getElementById('sniff-breadcrumbs');
  const btnSniffUp = document.getElementById('btn-sniff-up');
  const btnSniffRefresh = document.getElementById('btn-sniff-refresh');
  const btnSniffExplorer = document.getElementById('btn-sniff-explorer');
  const sniffLoading = document.getElementById('sniff-loading');
  const localFolderCache = new Map();

  /**
   * Executa a varredura profunda de uma unidade ou pasta e renderiza os resultados
   */
  async function performScan(targetPath) {
    if (isScanning) return;
    isScanning = true;

    btnStartScan.disabled = true;
    btnCancelScan.classList.remove('hidden');
    scanLiveProgress.classList.remove('hidden');
    scanResultsContainer.classList.add('hidden');

    try {
      const res = await api.scanDirectory(targetPath, {
        minVideoSize: 50 * 1024 * 1024 // 50 MB
      });

      if (res.success && res.data) {
        rootScanData = res.data;
        currentFolderPath = res.data.rootPath;

        if (dbStatusBadge) {
          dbStatusBadge.textContent = 'Salvo Agora';
          dbStatusBadge.classList.remove('hidden');
        }

        renderAllScanResults(res.data);
      } else if (res.error) {
        alert(`Erro na varredura: ${res.error}`);
      }
    } catch (err) {
      alert(`Falha no escaneamento: ${err.message}`);
    } finally {
      isScanning = false;
      btnStartScan.disabled = false;
      btnCancelScan.classList.add('hidden');
      scanLiveProgress.classList.add('hidden');
    }
  }

  /**
   * Busca e carrega os dados salvos em banco local para a pasta/unidade selecionada
   */
  async function loadSavedScanIfAvailable(targetPath) {
    if (dbStatusBadge) dbStatusBadge.classList.add('hidden');
    try {
      const res = await api.getSavedScan(targetPath);
      if (res && res.success && res.data) {
        rootScanData = res.data;
        currentFolderPath = res.data.rootPath;

        if (dbStatusBadge) {
          const dateStr = res.data.scannedAt
            ? new Date(res.data.scannedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : '';
          dbStatusBadge.textContent = `Salvo (${dateStr})`;
          dbStatusBadge.classList.remove('hidden');
        }

        renderAllScanResults(res.data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao buscar dados salvos no banco:', err);
      return false;
    }
  }

  btnChangeScanFolder.addEventListener('click', async () => {
    const chosen = await api.selectFolder();
    if (chosen) {
      customScanPath = chosen.endsWith('\\') ? chosen : chosen + '\\';
      currentFolderPath = customScanPath;
      localFolderCache.clear();
      document.getElementById('scan-target-path').textContent = customScanPath;
      const loaded = await loadSavedScanIfAvailable(customScanPath);
      if (!loaded) {
        rootScanData = null;
        await performScan(customScanPath);
      }
    }
  });

  api.onScanProgress((prog) => {
    scanCounterBadge.textContent = `${prog.filesScanned.toLocaleString('pt-BR')} arquivos`;
    scanLivePath.textContent = prog.currentFolder;
  });

  const btnRefreshAll = document.getElementById('btn-refresh-all');

  async function refreshStorageOverview() {
    localFolderCache.clear();
    // 1. Atualiza métricas de todas as unidades conectadas sem perder o disco selecionado
    currentDrives = await api.getDrives();
    if (currentDrives && currentDrives.length > 0 && selectedDrive) {
      const updated = currentDrives.find(d => d.id.toUpperCase() === selectedDrive.id.toUpperCase());
      if (updated) {
        selectedDrive = updated;
        updateDriveOverview(selectedDrive);
        updateSidebarSSDWidget(selectedDrive);
        renderDriveSelector();
      }
    }
    // 2. Realiza nova varredura da unidade/pasta atualmente ativa
    if (customScanPath) {
      await performScan(customScanPath);
    }
  }

  if (btnRefreshAll) {
    btnRefreshAll.addEventListener('click', async () => {
      btnRefreshAll.disabled = true;
      const prevHtml = btnRefreshAll.innerHTML;
      btnRefreshAll.innerHTML = '<span>Atualizando...</span>';
      try {
        await refreshStorageOverview();
      } finally {
        btnRefreshAll.disabled = false;
        btnRefreshAll.innerHTML = prevHtml;
      }
    });
  }

  /**
   * Sincroniza métricas de disco, contadores, pastas e caches em tempo real ao excluir qualquer arquivo.
   */
  function handleFileDeleted(filePath, sizeBytes = 0) {
    // 1. Atualiza métricas de disco do topo e da barra lateral
    if (selectedDrive && sizeBytes > 0) {
      selectedDrive.usedBytes = Math.max(0, selectedDrive.usedBytes - sizeBytes);
      selectedDrive.freeBytes += sizeBytes;
      selectedDrive.usedFormatted = formatBytesJs(selectedDrive.usedBytes);
      selectedDrive.freeFormatted = formatBytesJs(selectedDrive.freeBytes);
      selectedDrive.usedPercent = selectedDrive.totalBytes > 0
        ? Number(((selectedDrive.usedBytes / selectedDrive.totalBytes) * 100).toFixed(1))
        : 0;

      updateDriveOverview(selectedDrive);
      updateSidebarSSDWidget(selectedDrive);
    }

    // 2. Atualiza contadores e listas em memória
    if (rootScanData && rootScanData.largeVideos) {
      rootScanData.largeVideos = rootScanData.largeVideos.filter(v => v.path.toLowerCase() !== filePath.toLowerCase());
      document.getElementById('count-videos').textContent = rootScanData.largeVideos.length;
    }

    // 3. Atualiza tamanho da pasta pai na tabela de pastas
    if (rootScanData && rootScanData.folders && filePath) {
      const parentDir = filePath.split(/[\\/]/).slice(0, -1).join('\\').toLowerCase();
      rootScanData.folders.forEach(f => {
        if (parentDir.startsWith(f.path.toLowerCase())) {
          f.sizeBytes = Math.max(0, f.sizeBytes - sizeBytes);
          f.sizeFormatted = formatBytesJs(f.sizeBytes);
        }
      });
      renderFoldersTable(rootScanData.folders);
    }

    // 4. Limpa caches de navegação
    localFolderCache.clear();
  }

  btnStartScan.addEventListener('click', async () => {
    if (customScanPath) {
      await performScan(customScanPath);
    }
  });

  btnCancelScan.addEventListener('click', async () => {
    await api.cancelScan();
  });

  function renderAllScanResults(data) {
    scanResultsContainer.classList.remove('hidden');

    const folders = data.folders || [];
    const videos = data.largeVideos || [];

    document.getElementById('count-sniff-items').textContent = folders.length;
    document.getElementById('count-folders').textContent = folders.length;
    document.getElementById('count-videos').textContent = videos.length;

    // 1. Renderiza Treemap SpaceSniffer da raiz
    renderSpaceSniffer(folders, data.rootPath);

    // 2. Renderiza Tabela de Pastas
    renderFoldersTable(folders);

    // 3. Renderiza Tabela de Vídeos com ações completas
    renderVideosTable(videos);
  }

  // =========================================================================
  // 5. Motor SpaceSniffer (Treemap e Drill-Down)
  // =========================================================================

  function renderSpaceSniffer(items, currentPath) {
    currentFolderPath = currentPath;
    renderBreadcrumbs(currentPath);
    spacesnifferGrid.innerHTML = '';

    if (!items || items.length === 0) {
      spacesnifferGrid.innerHTML = `
        <div style="width: 100%; text-align: center; padding: 48px; color: var(--text-dim);">
          <strong style="font-size: 14px;">Esta pasta está vazia ou não contém arquivos mensuráveis.</strong>
        </div>`;
      return;
    }

    // Calcula o tamanho total somado para pesos proporcionais
    const totalBytes = items.reduce((acc, it) => acc + (it.sizeBytes || 0), 0) || 1;

    items.forEach(item => {
      const isDir = item.isDirectory !== false;
      const isVid = item.isVideo || (!isDir && item.ext && ['.mp4', '.mov', '.mkv', '.avi', '.webm'].includes(item.ext));
      const typeClass = isDir ? 'folder' : isVid ? 'video' : 'file';
      const typeIcon = isDir ? '📁' : isVid ? '🎬' : '📄';

      const pct = Math.max(0.5, ((item.sizeBytes / totalBytes) * 100));

      // Cálculo de flex-grow e largura mínima proporcional ao estilo SpaceSniffer
      const flexGrow = Math.max(1, Math.min(30, Math.round(pct * 1.5)));
      const minWidth = Math.max(130, Math.min(450, Math.round(pct * 6)));
      const minHeight = Math.max(80, Math.min(220, Math.round(pct * 3)));

      const block = document.createElement('div');
      block.className = `sniff-block ${typeClass}`;
      block.style.flexGrow = flexGrow;
      block.style.minWidth = `${minWidth}px`;
      block.style.minHeight = `${minHeight}px`;

      block.innerHTML = `
        <div class="sniff-block-header">
          <span class="sniff-block-icon">${typeIcon}</span>
          <span class="sniff-block-name" title="${escapeHtml(item.name)}&#10;${escapeHtml(item.path)}">${escapeHtml(item.name)}</span>
        </div>
        <div class="sniff-block-meta">
          <span class="sniff-size">${item.sizeFormatted}</span>
          <span class="sniff-pct">${pct.toFixed(1)}%</span>
        </div>
        <div class="sniff-block-actions">
          ${isDir ? `<button class="sniff-btn btn-drill" title="Entrar na pasta">Entrar</button>` : ''}
          <button class="sniff-btn btn-open-folder" title="Abrir pasta no Explorer">Pasta</button>
          ${isVid ? `<button class="sniff-btn compress btn-comp" title="Compactar com DownVideo">Compactar</button>` : ''}
          <button class="sniff-btn btn-trash" title="Enviar para a Lixeira">Excluir</button>
        </div>
      `;

      // Duplo clique ou botão "Entrar": Drill-down na pasta!
      if (isDir) {
        block.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          drillIntoFolder(item.path);
        });

        const drillBtn = block.querySelector('.btn-drill');
        if (drillBtn) {
          drillBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            drillIntoFolder(item.path);
          });
        }
      }

      // Ação: Abrir pasta no Explorer
      block.querySelector('.btn-open-folder').addEventListener('click', (e) => {
        e.stopPropagation();
        api.openFolderInExplorer(item.path);
      });

      // Ação: Compactar vídeo
      if (isVid) {
        block.querySelector('.btn-comp').addEventListener('click', (e) => {
          e.stopPropagation();
          loadVideoForCompression(item.path);
          switchTab('tab-compress');
        });
      }

      // Ação: Lixeira com sincronização em cascata
      block.querySelector('.btn-trash').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Deseja enviar "${item.name}" para a Lixeira do Windows?\n\nO item será removido e o banco de dados será atualizado.`)) {
          const res = await api.moveToRecycleBin(item.path, item.sizeBytes || 0);
          if (res.success) {
            block.style.transition = 'all 0.25s ease';
            block.style.opacity = '0';
            block.style.transform = 'scale(0.8)';
            setTimeout(() => {
              block.remove();
              handleFileDeleted(item.path, item.sizeBytes || 0);
            }, 250);
          } else {
            alert(`Erro ao mover para a Lixeira: ${res.error}`);
          }
        }
      });

      spacesnifferGrid.appendChild(block);
    });
  }

  // Drill-down profundo em qualquer subpasta com cache instantâneo em RAM e Banco
  async function drillIntoFolder(dirPath, forceRefresh = false) {
    const normKey = dirPath.toLowerCase();

    // 1. Nível 1: Memória RAM local (0ms instantâneo)
    if (!forceRefresh && localFolderCache.has(normKey)) {
      const cached = localFolderCache.get(normKey);
      renderSpaceSniffer(cached.items, cached.path);
      return;
    }

    sniffLoading.classList.remove('hidden');

    try {
      const res = await api.getFolderContents(dirPath, { forceRefresh });
      if (res.success && res.data) {
        localFolderCache.set(normKey, res.data);
        renderSpaceSniffer(res.data.items, res.data.path);
      } else {
        alert(res.error || 'Não foi possível acessar os arquivos desta pasta.');
      }
    } catch (err) {
      alert(`Erro ao abrir pasta: ${err.message}`);
    } finally {
      sniffLoading.classList.add('hidden');
      spacesnifferGrid.style.opacity = '1';
    }
  }

  // Renderiza a barra de navegação e breadcrumbs (C:\ > Users > Usuario ...)
  function renderBreadcrumbs(fullPath) {
    sniffBreadcrumbs.innerHTML = '';
    const clean = fullPath.replace(/[\\/]+$/, '');
    const parts = clean.split(/[\\/]/);

    let accumulated = '';
    parts.forEach((part, index) => {
      if (index === 0) {
        accumulated = part + '\\';
      } else {
        accumulated = accumulated + (accumulated.endsWith('\\') ? '' : '\\') + part;
      }

      const targetPath = accumulated;
      const isLast = index === parts.length - 1;

      const span = document.createElement('span');
      span.className = `crumb-item ${isLast ? 'active' : ''}`;
      span.textContent = part || 'Raiz';
      span.title = targetPath;

      span.addEventListener('click', () => {
        drillIntoFolder(targetPath);
      });

      sniffBreadcrumbs.appendChild(span);

      if (!isLast) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '>';
        sniffBreadcrumbs.appendChild(sep);
      }
    });

    // Rola para a direita para mostrar o final do caminho
    sniffBreadcrumbs.parentElement.scrollLeft = sniffBreadcrumbs.parentElement.scrollWidth;
  }

  // Botão "⬆ Subir"
  btnSniffUp.addEventListener('click', () => {
    if (!currentFolderPath) return;
    const parent = currentFolderPath.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).join('\\');
    if (parent && parent.length >= 2) {
      drillIntoFolder(parent.includes('\\') ? parent : parent + '\\');
    }
  });

  // Botão "🔄 Atualizar" (Força nova medição sob demanda)
  if (btnSniffRefresh) {
    btnSniffRefresh.addEventListener('click', () => {
      if (currentFolderPath) {
        drillIntoFolder(currentFolderPath, true);
      }
    });
  }

  // Botão "📂 Abrir no Explorer"
  btnSniffExplorer.addEventListener('click', () => {
    if (currentFolderPath) {
      api.openFolderInExplorer(currentFolderPath);
    }
  });

  // Ouvinte de streaming de itens de subpasta medidos em tempo real
  if (api.onFolderItemUpdated) {
    api.onFolderItemUpdated(({ parentPath, item }) => {
      if (currentFolderPath && currentFolderPath.toLowerCase() === parentPath.toLowerCase()) {
        const blocks = spacesnifferGrid.querySelectorAll('.sniff-block');
        blocks.forEach(block => {
          const nameEl = block.querySelector('.sniff-block-name');
          if (nameEl && nameEl.title && nameEl.title.includes(item.path)) {
            const sizeEl = block.querySelector('.sniff-size');
            if (sizeEl) sizeEl.textContent = item.sizeFormatted;
          }
        });
      }
    });
  }

  // =========================================================================
  // 6. Tabela de Pastas Mais Pesadas
  // =========================================================================
  function renderFoldersTable(folders) {
    const foldersTbody = document.getElementById('folders-table-body');
    foldersTbody.innerHTML = '';

    if (folders.length === 0) {
      foldersTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-dim);">Nenhuma pasta encontrada.</td></tr>';
      return;
    }

    folders.forEach(f => {
      const tr = document.createElement('tr');
      const isHeavy = f.sizeBytes > 5 * 1024 * 1024 * 1024; // > 5GB

      tr.innerHTML = `
        <td>
          <div class="folder-cell">
            <span class="folder-icon">📁</span>
            <div style="min-width: 0; flex: 1;">
              <div class="folder-name cell-ellipsis" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
              <small class="cell-ellipsis" style="color: var(--text-dim); font-size: 11px;" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</small>
            </div>
          </div>
        </td>
        <td>
          <span class="size-pill ${isHeavy ? 'heavy' : ''}">${f.sizeFormatted}</span>
        </td>
        <td>
          <div class="pct-bar-cell">
            <div class="pct-track">
              <div class="pct-fill" style="width: ${f.percentOfTotal || 0}%;"></div>
            </div>
            <span class="pct-text">${f.percentOfTotal || 0}%</span>
          </div>
        </td>
        <td style="text-align: right;">
          <div class="actions-cell-wrapper">
            <button class="table-btn btn-sniff-row" title="Ver no Mapa SpaceSniffer">Mapa</button>
            <button class="table-btn btn-open-folder-row" title="Abrir pasta no Explorer">Pasta</button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-sniff-row').addEventListener('click', () => {
        drillIntoFolder(f.path);
        // Ativa a sub-aba do SpaceSniffer
        subtabBtns[0].click();
      });

      tr.querySelector('.btn-open-folder-row').addEventListener('click', () => {
        api.openFolderInExplorer(f.path);
      });

      foldersTbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 7. Tabela de Vídeos Gigantes (Com Botão Explícito "Abrir Pasta")
  // =========================================================================
  function renderVideosTable(videos) {
    const videosTbody = document.getElementById('videos-table-body');
    videosTbody.innerHTML = '';

    if (videos.length === 0) {
      videosTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-dim);">Nenhum vídeo pesado (> 50 MB) encontrado nesta pasta.</td></tr>';
      return;
    }

    videos.forEach(v => {
      const tr = document.createElement('tr');
      const folderPath = v.folderPath || v.path.split(/[\\/]/).slice(0, -1).join('\\');

      tr.innerHTML = `
        <td>
          <div class="folder-cell">
            <span class="folder-icon">🎬</span>
            <div class="folder-name cell-ellipsis" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</div>
          </div>
        </td>
        <td>
          <span class="size-pill video">${v.sizeFormatted}</span>
        </td>
        <td>
          <span class="cell-ellipsis" style="color: var(--text-dim); font-size: 11px; font-family: var(--font-mono);" title="${escapeHtml(folderPath)}">
            ${escapeHtml(folderPath)}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="actions-cell-wrapper">
            <button class="table-btn btn-folder-row btn-open-parent" title="Abrir pasta onde o vídeo está salvo">Pasta</button>
            <button class="table-btn btn-select-file" title="Destacar arquivo no Explorer">Ver</button>
            <button class="table-btn btn-compress-row btn-compact" title="Compactar com DownVideo">Compactar</button>
            <button class="table-btn btn-delete-row btn-trash" title="Enviar para a Lixeira">Excluir</button>
          </div>
        </td>
      `;

      // Ação 1: 📂 Abrir Pasta (SOLICITADO PELO USUÁRIO)
      tr.querySelector('.btn-open-parent').addEventListener('click', () => {
        api.openFolderInExplorer(folderPath);
      });

      // Ação 2: 🎯 Destacar Arquivo no Explorer
      tr.querySelector('.btn-select-file').addEventListener('click', () => {
        api.selectInExplorer(v.path);
      });

      // Ação 3: 🗜️ Compactar com DownVideo
      tr.querySelector('.btn-compact').addEventListener('click', () => {
        loadVideoForCompression(v.path);
        switchTab('tab-compress');
      });

      // Ação 4: 🗑️ Lixeira com atualização em tempo real do banco de dados
      tr.querySelector('.btn-trash').addEventListener('click', async () => {
        if (confirm(`Deseja enviar "${v.name}" para a Lixeira do Windows?\n\nO arquivo será removido da lista e o banco de dados será atualizado.`)) {
          const delRes = await api.moveToRecycleBin(v.path, v.sizeBytes || 0);
          if (delRes.success) {
            tr.style.transition = 'all 0.25s ease';
            tr.style.opacity = '0';
            tr.style.transform = 'translateX(15px)';
            setTimeout(() => {
              tr.remove();

              // Sincroniza métricas globais, SSD, barra lateral, pastas pesadas e contadores
              handleFileDeleted(v.path, v.sizeBytes || 0);

              if (rootScanData && rootScanData.largeVideos && rootScanData.largeVideos.length === 0) {
                videosTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-dim);">Nenhum vídeo pesado (> 50 MB) encontrado nesta pasta.</td></tr>';
              }

              // Se esse vídeo estiver visível no mapa SpaceSniffer, remove também
              const sniffBlocks = spacesnifferGrid.querySelectorAll('.sniff-block');
              sniffBlocks.forEach(b => {
                const titleEl = b.querySelector('.sniff-block-name');
                if (titleEl && titleEl.title && titleEl.title.includes(v.path)) {
                  b.remove();
                }
              });
            }, 250);
          } else {
            alert(`Erro ao mover para a lixeira: ${delRes.error}`);
          }
        }
      });

      videosTbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 7.1 Limpeza de Cache de Aplicativos (After Effects, Placas de Vídeo, etc.)
  // =========================================================================
  const countCachesEl = document.getElementById('count-caches');
  const cacheItemsContainer = document.getElementById('cache-items-container');
  const cacheEmptyState = document.getElementById('cache-empty-state');
  const cacheTotalFreedVal = document.getElementById('cache-total-freed-val');
  const btnCleanSelectedCaches = document.getElementById('btn-clean-selected-caches');

  let currentAppCaches = [];
  let isScanningCaches = false;

  async function loadAndRenderAppCaches(renderUi = true) {
    if (isScanningCaches) return;
    isScanningCaches = true;

    try {
      const res = await api.scanAppCaches();
      if (res && res.success && Array.isArray(res.data)) {
        currentAppCaches = res.data;
        if (countCachesEl) {
          countCachesEl.textContent = currentAppCaches.length;
        }

        if (renderUi) {
          renderAppCachesList(currentAppCaches);
        }
      }
    } catch (err) {
      console.error('Erro ao varrer caches de aplicativos:', err);
    } finally {
      isScanningCaches = false;
    }
  }

  function updateCacheSelectedTotals() {
    if (!cacheItemsContainer) return;
    const checkboxes = cacheItemsContainer.querySelectorAll('.cache-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);

    let totalSelectedBytes = 0;
    currentAppCaches.forEach(item => {
      if (selectedIds.includes(item.id)) {
        totalSelectedBytes += item.sizeBytes || 0;
      }
    });

    if (cacheTotalFreedVal) {
      cacheTotalFreedVal.textContent = formatBytesJs(totalSelectedBytes);
    }

    if (btnCleanSelectedCaches) {
      btnCleanSelectedCaches.disabled = selectedIds.length === 0;
      const countStr = selectedIds.length > 0 ? ` (${selectedIds.length})` : '';
      btnCleanSelectedCaches.innerHTML = `<span>Limpar Caches Selecionados${countStr}</span>`;
    }
  }

  function renderAppCachesList(caches) {
    if (!cacheItemsContainer) return;
    cacheItemsContainer.innerHTML = '';

    if (!caches || caches.length === 0) {
      if (cacheEmptyState) cacheEmptyState.classList.remove('hidden');
      if (btnCleanSelectedCaches) btnCleanSelectedCaches.disabled = true;
      if (cacheTotalFreedVal) cacheTotalFreedVal.textContent = '0 B';
      return;
    }

    if (cacheEmptyState) cacheEmptyState.classList.add('hidden');

    caches.forEach(item => {
      const card = document.createElement('div');
      card.className = 'cache-item-card';
      card.dataset.id = item.id;

      const isHuge = item.sizeBytes > 1024 * 1024 * 1024; // > 1GB
      const procWarningHtml = item.processRunning
        ? `<span class="cache-proc-warn" title="O aplicativo está aberto no Windows. Feche-o para conseguir limpar todos os arquivos com segurança.">⚠️ Programa em execução (${escapeHtml(item.activeProcesses.join(', '))})</span>`
        : '';

      card.innerHTML = `
        <div class="cache-item-left">
          <input type="checkbox" class="cache-checkbox" data-id="${escapeHtml(item.id)}" checked title="Marcar para limpeza">
          <div class="cache-item-details">
            <div class="cache-item-title-row">
              <span class="cache-item-name">${escapeHtml(item.name)}</span>
              <span class="cache-app-tag">${escapeHtml(item.app)}</span>
              ${procWarningHtml}
            </div>
            <div class="cache-item-desc">${escapeHtml(item.description)}</div>
            <div class="cache-item-path" title="${escapeHtml(item.path)}">
              📁 ${escapeHtml(item.path)} • <strong>${item.fileCount ? item.fileCount.toLocaleString('pt-BR') : 0} arquivos</strong>
            </div>
          </div>
        </div>

        <div class="cache-item-right">
          <span class="cache-item-size ${isHuge ? 'huge' : ''}">${item.sizeFormatted}</span>
          <div class="cache-item-actions">
            <button class="table-btn btn-open-parent btn-cache-open" title="Abrir pasta no Windows Explorer">Pasta</button>
            <button class="table-btn btn-delete-row btn-cache-clean" title="Limpar este cache agora">Limpar</button>
          </div>
        </div>
      `;

      // Checkbox listener
      const cb = card.querySelector('.cache-checkbox');
      cb.addEventListener('change', () => {
        updateCacheSelectedTotals();
      });

      // Botão Pasta
      card.querySelector('.btn-cache-open').addEventListener('click', () => {
        api.openFolderInExplorer(item.path);
      });

      // Botão Limpar individual
      card.querySelector('.btn-cache-clean').addEventListener('click', async () => {
        if (confirm(`Deseja limpar o cache de "${item.name}"?\n\nTamanho a liberar: ${item.sizeFormatted}\n\nOs arquivos de cache e pré-visualização serão removidos com segurança.`)) {
          await executeCachesCleanup([item.id]);
        }
      });

      cacheItemsContainer.appendChild(card);
    });

    updateCacheSelectedTotals();
  }

  async function executeCachesCleanup(cacheIds) {
    if (!cacheIds || cacheIds.length === 0) return;

    if (btnCleanSelectedCaches) {
      btnCleanSelectedCaches.disabled = true;
      btnCleanSelectedCaches.innerHTML = '<span>Limpando Caches...</span>';
    }

    try {
      const res = await api.cleanSelectedCaches(cacheIds);
      if (res && res.success) {
        let msg = `Limpeza Concluída com Sucesso!\n\n` +
                  `Espaço liberado: ${res.totalFreedFormatted}\n` +
                  `Arquivos excluídos: ${res.totalDeletedFiles.toLocaleString('pt-BR')}`;
        if (res.totalSkippedFiles > 0) {
          msg += `\n\nNota: ${res.totalSkippedFiles.toLocaleString('pt-BR')} arquivo(s) foram ignorados por estarem bloqueados em uso pelo sistema operacional ou pelo próprio aplicativo.`;
        }
        alert(msg);

        // Recarrega informações do SSD e lista de caches
        await loadDrives(selectedDrive ? selectedDrive.id : null);
        await loadAndRenderAppCaches(true);
      } else {
        alert(res?.error || 'Erro ao realizar a limpeza de cache.');
      }
    } catch (err) {
      alert(`Falha na limpeza: ${err.message}`);
    } finally {
      updateCacheSelectedTotals();
    }
  }

  if (btnCleanSelectedCaches) {
    btnCleanSelectedCaches.addEventListener('click', async () => {
      if (!cacheItemsContainer) return;
      const checkedBoxes = cacheItemsContainer.querySelectorAll('.cache-checkbox:checked');
      const selectedIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);
      if (selectedIds.length === 0) return;

      const totalText = cacheTotalFreedVal ? cacheTotalFreedVal.textContent : '';
      if (confirm(`Deseja limpar os ${selectedIds.length} caches selecionados?\n\nEspaço estimado a liberar: ~${totalText}\n\nSeus projetos, vídeos e configurações NÃO serão afetados.`)) {
        await executeCachesCleanup(selectedIds);
      }
    });
  }

  // =========================================================================
  // 8. Aba de Compactação de Vídeo
  // =========================================================================
  const dropzone = document.getElementById('compress-dropzone');
  const dropzoneContent = document.getElementById('dropzone-content');
  const selectedVideoCard = document.getElementById('selected-video-card');
  const btnSelectVideo = document.getElementById('btn-select-video-file');
  const btnRemoveSelected = document.getElementById('btn-remove-selected-video');
  const btnStartCompression = document.getElementById('btn-start-compression');
  const compProgressCard = document.getElementById('comp-progress-card');
  const compProgressBar = document.getElementById('comp-progress-bar');
  const compProgressStats = document.getElementById('comp-progress-stats');
  const compSummaryCard = document.getElementById('comp-summary-card');

  // Controle interativo de MB Alvo & Slider
  const compSizeSlider = document.getElementById('comp-size-slider');
  const compSizeInput = document.getElementById('comp-size-input');
  const compSavingsBadge = document.getElementById('comp-savings-badge');
  const sliderMinMark = document.getElementById('slider-min-mark');
  const sliderCurrentMark = document.getElementById('slider-current-mark');
  const sliderMaxMark = document.getElementById('slider-max-mark');

  let selectedCompressFile = null;
  let currentLoadedVideoSizeMB = null;

  function updateTargetSizeSavings(targetMB, origMB) {
    if (sliderCurrentMark) sliderCurrentMark.textContent = `${targetMB} MB`;
    if (!compSavingsBadge) return;
    if (origMB && origMB > 0) {
      const savedMB = Math.max(0, origMB - targetMB);
      const savedPct = Math.min(99, Math.round((savedMB / origMB) * 100));
      compSavingsBadge.textContent = `Economia estimada: ~${savedMB} MB (-${savedPct}%)`;
    } else {
      compSavingsBadge.textContent = `Tamanho alvo: ${targetMB} MB (2-Pass Encoding)`;
    }
  }

  function syncPresetToSlider(level) {
    if (!currentLoadedVideoSizeMB || currentLoadedVideoSizeMB <= 0) return;
    let ratio = 0.40; // medio
    if (level === 'fraco') ratio = 0.70;
    else if (level === 'forte') ratio = 0.20;

    const minMB = Number(compSizeSlider.min) || 1;
    const maxMB = Number(compSizeSlider.max) || Math.max(10, currentLoadedVideoSizeMB);
    const calculated = Math.max(minMB, Math.min(maxMB, Math.round(currentLoadedVideoSizeMB * ratio)));

    compSizeSlider.value = calculated;
    compSizeInput.value = calculated;
    updateTargetSizeSavings(calculated, currentLoadedVideoSizeMB);
  }

  if (compSizeSlider && compSizeInput) {
    compSizeSlider.addEventListener('input', () => {
      compSizeInput.value = compSizeSlider.value;
      updateTargetSizeSavings(Number(compSizeSlider.value), currentLoadedVideoSizeMB);
    });

    compSizeInput.addEventListener('input', () => {
      let val = Number(compSizeInput.value);
      if (!isNaN(val) && val > 0) {
        compSizeSlider.value = Math.min(Number(compSizeSlider.max), Math.max(Number(compSizeSlider.min), val));
        updateTargetSizeSavings(val, currentLoadedVideoSizeMB);
      }
    });
  }

  document.querySelectorAll('input[name="comp-level"]').forEach(radio => {
    radio.addEventListener('change', () => {
      syncPresetToSlider(radio.value);
    });
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.path) {
        loadVideoForCompression(file.path);
      }
    }
  });

  btnSelectVideo.addEventListener('click', async (e) => {
    e.stopPropagation();
    const filePath = await api.selectVideoFile();
    if (filePath) {
      loadVideoForCompression(filePath);
    }
  });

  btnRemoveSelected.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedVideo();
  });

  async function loadVideoForCompression(filePath) {
    clearSelectedVideo();
    selectedCompressFile = filePath;

    dropzoneContent.classList.add('hidden');
    selectedVideoCard.classList.remove('hidden');
    document.getElementById('comp-file-name').textContent = filePath.split(/[\\/]/).pop();
    document.getElementById('comp-file-size').textContent = 'Carregando...';

    const res = await api.getVideoDetails(filePath);
    if (res.success && res.data) {
      const d = res.data;
      document.getElementById('comp-file-size').textContent = d.sizeFormatted;
      document.getElementById('comp-file-duration').textContent = d.durationFormatted;
      document.getElementById('comp-file-res').textContent = d.resolution;
      document.getElementById('comp-file-codec').textContent = d.videoCodec.toUpperCase();
      btnStartCompression.disabled = false;

      // Configura Slider e Input de MB Alvo com base no tamanho do arquivo real
      const sizeMB = Math.max(1, Math.round((d.sizeBytes || 0) / (1024 * 1024)));
      currentLoadedVideoSizeMB = sizeMB;

      const minMB = Math.max(1, Math.floor(sizeMB * 0.05));
      const maxMB = Math.max(minMB + 2, Math.floor(sizeMB * 0.95));

      if (compSizeSlider && compSizeInput) {
        compSizeSlider.min = minMB;
        compSizeSlider.max = Math.max(maxMB, minMB + 5);
        compSizeInput.min = minMB;
        compSizeInput.max = sizeMB;

        if (sliderMinMark) sliderMinMark.textContent = `${minMB} MB`;
        if (sliderMaxMark) sliderMaxMark.textContent = `${Math.max(maxMB, minMB + 5)} MB`;

        const currentLevel = document.querySelector('input[name="comp-level"]:checked')?.value || 'medio';
        syncPresetToSlider(currentLevel);
      }
    } else {
      document.getElementById('comp-file-size').textContent = 'Erro ao ler arquivo';
    }
  }

  function clearSelectedVideo() {
    selectedCompressFile = null;
    currentLoadedVideoSizeMB = null;
    dropzoneContent.classList.remove('hidden');
    selectedVideoCard.classList.add('hidden');
    btnStartCompression.disabled = true;
    compSummaryCard.classList.add('hidden');

    if (compSizeSlider && compSizeInput) {
      compSizeSlider.value = 50;
      compSizeInput.value = 50;
      if (sliderMinMark) sliderMinMark.textContent = '2 MB';
      if (sliderCurrentMark) sliderCurrentMark.textContent = '50 MB';
      if (sliderMaxMark) sliderMaxMark.textContent = '500 MB';
      if (compSavingsBadge) compSavingsBadge.textContent = 'Economia estimada: -- MB (- --%)';
    }
  }

  // Notificações de progresso da compactação em tempo real
  if (api.onCompressProgress) {
    api.onCompressProgress((prog) => {
      compProgressBar.style.width = `${prog.percent}%`;
      const passText = prog.pass ? `[Passo ${prog.pass}] ` : '';
      const speedText = prog.speed ? ` • ${prog.speed}` : '';
      const etaText = prog.eta ? ` • ETA: ${prog.eta}` : '';
      compProgressStats.textContent = `${passText}${prog.percent}%${speedText}${etaText}`;
    });
  }

  btnStartCompression.addEventListener('click', async () => {
    if (!selectedCompressFile) return;

    const level = document.querySelector('input[name="comp-level"]:checked')?.value || 'medio';
    const replace = document.getElementById('chk-replace-original').checked;
    const targetSizeMB = compSizeInput ? Number(compSizeInput.value) : null;

    btnStartCompression.disabled = true;
    compProgressCard.classList.remove('hidden');
    compSummaryCard.classList.add('hidden');
    compProgressBar.style.width = '0%';
    compProgressStats.textContent = 'Iniciando otimização com 2-Pass Encoding...';

    try {
      const res = await api.compressVideo(selectedCompressFile, {
        level,
        targetSizeMB,
        replace
      });

      if (res.success && res.data) {
        showCompressionSummary(res.data);
      } else {
        alert(`Erro na compactação: ${res.error || 'Falha desconhecida'}`);
      }
    } catch (err) {
      alert(`Falha: ${err.message}`);
    } finally {
      compProgressCard.classList.add('hidden');
      btnStartCompression.disabled = false;
    }
  });

  function showCompressionSummary(data) {
    compSummaryCard.classList.remove('hidden');
    document.getElementById('sum-original-size').textContent = formatBytesJs(data.originalSize);
    document.getElementById('sum-final-size').textContent = formatBytesJs(data.finalSize);

    const saved = Math.max(0, data.originalSize - data.finalSize);
    const pct = data.originalSize > 0 ? ((saved / data.originalSize) * 100).toFixed(1) : 0;
    document.getElementById('sum-saved-size').textContent = `${formatBytesJs(saved)} (-${pct}%)`;

    document.getElementById('btn-open-compressed-folder').onclick = () => {
      api.openFolderInExplorer(data.outputPath);
    };

    document.getElementById('btn-compress-another').onclick = () => {
      clearSelectedVideo();
    };
  }

  // =========================================================================
  // 9. Aba de Download do YouTube (Com Seletor de Resolução 4K, 1080p, 720p, Áudio)
  // =========================================================================
  const ytInput = document.getElementById('yt-url-input');
  const btnPaste = document.getElementById('btn-paste-url');
  const btnFetchMeta = document.getElementById('btn-fetch-meta');
  const btnChooseDest = document.getElementById('btn-choose-dest');
  const destFolderDisplay = document.getElementById('dest-folder-display');
  const ytMetaCard = document.getElementById('yt-meta-card');
  const btnStartDownload = document.getElementById('btn-start-download');
  const ytProgressCard = document.getElementById('yt-progress-card');
  const ytProgressBar = document.getElementById('yt-progress-bar');
  const ytProgressStats = document.getElementById('yt-progress-stats');
  const ytSuccessCard = document.getElementById('yt-success-card');
  let currentDownloadedFile = null;
  let customDestFolder = null;

  const qualityLabels = {
    '4k': '4K Ultra HD (2160p)',
    '1080p': '1080p Full HD (Padrão AE)',
    '720p': '720p HD Rápido',
    'audio': 'Áudio MP3 (Alta Fidelidade)'
  };

  function getSelectedYtQuality() {
    const checked = document.querySelector('input[name="yt-quality"]:checked');
    return checked ? checked.value : '1080p';
  }

  document.querySelectorAll('input[name="yt-quality"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const q = radio.value;
      const metaFormat = document.getElementById('yt-meta-format');
      if (metaFormat) {
        metaFormat.textContent = qualityLabels[q] || '1080p Full HD';
      }
    });
  });

  btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) ytInput.value = text.trim();
    } catch {}
  });

  btnChooseDest.addEventListener('click', async () => {
    const chosen = await api.selectFolder();
    if (chosen) {
      customDestFolder = chosen;
      destFolderDisplay.textContent = chosen.length > 25 ? '...' + chosen.slice(-22) : chosen;
      destFolderDisplay.title = chosen;
    }
  });

  btnFetchMeta.addEventListener('click', async () => {
    const url = ytInput.value.trim();
    if (!url) {
      alert('Por favor, cole um link válido do YouTube.');
      return;
    }

    btnFetchMeta.disabled = true;
    btnFetchMeta.textContent = 'Carregando...';
    ytMetaCard.classList.add('hidden');
    ytSuccessCard.classList.add('hidden');

    try {
      const res = await api.getYoutubeMetadata(url);
      if (res.success && res.data) {
        const meta = res.data;
        document.getElementById('yt-meta-title').textContent = meta.title;
        document.getElementById('yt-meta-channel').textContent = meta.channel;
        document.getElementById('yt-meta-duration').textContent = meta.duration;

        const chosenQ = getSelectedYtQuality();
        document.getElementById('yt-meta-format').textContent = qualityLabels[chosenQ] || '1080p Full HD';

        ytMetaCard.classList.remove('hidden');
      } else {
        alert(res.error || 'Vídeo não encontrado ou bloqueado.');
      }
    } catch (err) {
      alert(`Falha: ${err.message}`);
    } finally {
      btnFetchMeta.disabled = false;
      btnFetchMeta.textContent = 'Analisar';
    }
  });

  if (api.onDownloadProgress) {
    api.onDownloadProgress((prog) => {
      ytProgressBar.style.width = `${prog.percent}%`;
      const speed = prog.speed ? ` • ${prog.speed}` : '';
      const eta = prog.eta ? ` • ETA: ${prog.eta}` : '';
      ytProgressStats.textContent = `${prog.percent}%${speed}${eta}`;
    });
  }

  btnStartDownload.addEventListener('click', async () => {
    const url = ytInput.value.trim();
    const chosenQ = getSelectedYtQuality();
    const isAudio = chosenQ === 'audio';

    btnStartDownload.disabled = true;
    ytProgressCard.classList.remove('hidden');
    ytSuccessCard.classList.add('hidden');
    ytProgressBar.style.width = '0%';
    ytProgressStats.textContent = 'Preparando download...';

    try {
      const res = await api.downloadYoutube(url, {
        resolution: chosenQ,
        isAudioOnly: isAudio,
        outputDir: customDestFolder
      });

      if (res.success && res.data) {
        currentDownloadedFile = res.data.filePath;
        ytSuccessCard.classList.remove('hidden');
        document.getElementById('yt-success-path').textContent = currentDownloadedFile;
      } else {
        alert(res.error || 'Erro ao realizar download.');
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      ytProgressCard.classList.add('hidden');
      btnStartDownload.disabled = false;
    }
  });

  document.getElementById('btn-open-downloaded-folder').addEventListener('click', () => {
    if (currentDownloadedFile) api.openFolderInExplorer(currentDownloadedFile);
  });

  document.getElementById('btn-send-to-compressor').addEventListener('click', () => {
    if (currentDownloadedFile) {
      loadVideoForCompression(currentDownloadedFile);
      switchTab('tab-compress');
    }
  });

  // =========================================================================
  // Utilitários
  // =========================================================================
  function formatBytesJs(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicializa carregando as unidades do sistema e verificando caches
  await loadDrives();
  loadAndRenderAppCaches(false);
});
