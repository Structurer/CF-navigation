// 导航页主入口文件 - 合并版（精简架构，纯 localStorage，无云端同步）

// ==========================
// 工具函数模块 (utils)
// ==========================

// 生成唯一ID：确保每个图标唯一标识，拖拽/刷新后仍能精准删除
function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
}

// 修复URL前缀：自动补 http/https 前缀
function fixUrlPrefix(url) {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
    return url;
  }
  return `https://${url}`;
}

// 清除上传预览
function clearUpload() {
  window.uploadedBase64 = null;
  const previewImg = document.getElementById('previewImg');
  const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  if (imagePreviewPlaceholder) {
    imagePreviewPlaceholder.style.display = 'flex';
    imagePreviewPlaceholder.style.background = '';
  }
  const fileInput = document.getElementById('fileUploadInput');
  if (fileInput) fileInput.value = '';
}

// 初始化颜色预设
function initColorPresets() {
  const colorPresets = document.getElementById('colorPresets');
  const colorPicker = document.getElementById('colorPicker');
  const DEFAULT_COLOR_PRESETS = [
    '#ffffff', '#ff3838', '#ff9d32', '#ffd131', '#49d838', '#36cfc9',
    '#4cafef', '#3a86ff', '#9d4edd', '#ff2e99', '#6e7c7c', '#000000'
  ];
  if (!colorPresets) return;
  colorPresets.innerHTML = '';
  DEFAULT_COLOR_PRESETS.forEach(color => {
    const colorItem = document.createElement('div');
    colorItem.className = 'color-preset-item';
    colorItem.style.backgroundColor = color;
    colorItem.dataset.color = color;
    if (color === '#ffffff') {
      colorItem.style.border = '1px solid #ddd';
    }
    colorItem.onclick = () => {
      colorPicker.value = color;
      setActiveColorPreset(color);
      colorPicker.dispatchEvent(new Event('input'));
    };
    colorPresets.appendChild(colorItem);
  });
}

// 设置活跃颜色预设
function setActiveColorPreset(targetColor) {
  document.querySelectorAll('.color-preset-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.color === targetColor) {
      item.classList.add('active');
    }
  });
}

// 显示提示信息
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast';
  toast.classList.add(type, 'show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// 文件转 Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// 检查文件类型
function checkFileType(file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif', 'image/x-icon'];
  return allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.ico');
}

// 检查文件大小（默认 2MB）
function checkFileSize(file, maxSize = 2 * 1024 * 1024) {
  return file.size <= maxSize;
}

// 调用 Cloudflare Pages Function /api/favicon 获取网站图标 Base64
// 部署到 CF Pages 后生效；本地 http server 无 Function 时静默返回 null
async function tryGetFavicon(url) {
  try {
    if (!url) return;
    const apiUrl = '/api/favicon?url=' + encodeURIComponent(url);
    const response = await fetch(apiUrl, { method: 'GET' });
    if (!response.ok) return;
    const result = await response.json();
    if (result && result.success && result.base64) {
      window.uploadedBase64 = result.base64;
      updatePreviews();
      showToast('网站图标获取成功！', 'success');
    }
  } catch (_) {
    // 本地无 /api/favicon 会走这里，静默即可
  }
}

// ==========================
// 存储模块 (storage)
// ==========================

const STORAGE_KEY = 'nav_data';

// 从 localStorage 读取（单键）
function getLocalStorageData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { navList: [], operateLog: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      navList: Array.isArray(parsed.navList) ? parsed.navList : [],
      operateLog: Array.isArray(parsed.operateLog) ? parsed.operateLog : []
    };
  } catch (_) {
    return { navList: [], operateLog: [] };
  }
}

// 加载图标数据：优先 localStorage，空则 fetch nav_data.json 作为种子写入
async function loadIcons() {
  const local = getLocalStorageData();
  if (local.navList.length > 0) {
    console.log('✅ 从本地存储加载成功，共', local.navList.length, '个图标');
    return local;
  }
  console.log('🟡 本地存储为空，从 nav_data.json 加载种子数据...');
  try {
    const resp = await fetch('./nav_data.json');
    if (resp.ok) {
      const data = await resp.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('✅ 种子数据已写入本地，共', (data.navList || []).length, '个图标');
      return {
        navList: Array.isArray(data.navList) ? data.navList : [],
        operateLog: Array.isArray(data.operateLog) ? data.operateLog : []
      };
    }
  } catch (e) {
    console.error('加载种子数据失败：', e);
  }
  return { navList: [], operateLog: [] };
}

// 保存图标数据到 localStorage（单键）
async function saveIcons(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('保存失败：', e);
    return false;
  }
}

// 导出 localStorage 最新数据为 JSON 文件（格式化缩进 2 空格，文件名带日期）
function exportData() {
  const data = getLocalStorageData();
  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  link.download = `nav_data_${date}.json`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
}

// ==========================
// 视图渲染模块 (render)
// ==========================

let dragTimer = null;
let isDraggingEnabled = false;
let currentDraggedElement = null;
let touchStartTime = 0;
let isTouchDragReady = false;
const DRAG_DELAY = 200;

let container, iconWrap1, iconWrap2;

// 初始化页面结构（上下两栏）
function initPageStructure() {
  container = document.getElementById('icon-container');
  if (!container) return;
  container.innerHTML = '';
  const column1 = document.createElement('div');
  const column2 = document.createElement('div');
  column1.className = 'category-column';
  column2.className = 'category-column';
  iconWrap1 = document.createElement('div');
  iconWrap2 = document.createElement('div');
  iconWrap1.className = 'icon-wrap';
  iconWrap2.className = 'icon-wrap';
  column1.appendChild(iconWrap1);
  column2.appendChild(iconWrap2);
  container.appendChild(column1);
  container.appendChild(column2);
}

// 渲染图标列表
function renderIcons(iconWrap, iconsData, columnKey) {
  iconWrap.innerHTML = '';
  iconsData.forEach((item, idx) => {
    const iconItem = document.createElement('div');
    iconItem.className = 'icon-item';
    iconItem.dataset.iconData = JSON.stringify(item);
    iconItem.dataset.iconId = item.id;
    iconItem.dataset.column = columnKey;

    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';
    iconDiv.style.backgroundColor = item.backgroundColor;
    // 2级兜底：Base64 图片 → alt 文字
    if (item.iconBase64 && item.iconBase64.trim()) {
      const img = document.createElement('img');
      img.alt = item.alt || '';
      img.src = item.iconBase64;
      img.onerror = () => {
        if (!iconDiv.parentNode) return;
        iconDiv.removeChild(img);
        const altText = document.createElement('span');
        altText.textContent = item.alt || '';
        altText.style.cssText = 'color:white;font-size:14px;font-weight:bold;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;text-shadow:1px 1px 2px rgba(0,0,0,0.8);';
        iconDiv.appendChild(altText);
      };
      iconDiv.appendChild(img);
    } else {
      const altText = document.createElement('span');
      altText.textContent = item.alt || '';
      altText.style.cssText = 'color:white;font-size:14px;font-weight:bold;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;text-shadow:1px 1px 2px rgba(0,0,0,0.8);';
      iconDiv.appendChild(altText);
    }
    const iconName = document.createElement('div');
    iconName.className = 'icon-name';
    iconName.textContent = item.name || '';

    iconItem.onclick = (e) => {
      if (e.target.closest('.right-click-menu') || isDraggingEnabled) return;
      if (item.url && item.url.trim().startsWith('http')) {
        window.open(item.url, '_self');
      } else {
        showToast('图标URL无效！', 'error');
      }
    };

    function handleStart(e) {
      if (e.button === 2 || (e.type === 'touchstart' && e.touches.length > 1)) return;
      currentDraggedElement = iconItem;
      iconDiv.classList.add('waiting');
      touchStartTime = e.timeStamp;
      isTouchDragReady = false;
      dragTimer = setTimeout(() => {
        isDraggingEnabled = true;
        isTouchDragReady = true;
        iconItem.style.cursor = 'grabbing';
        iconItem.classList.add('shaking');
        showToast('可以拖拽了', 'info');
      }, DRAG_DELAY);
    }
    iconDiv.addEventListener('mousedown', handleStart);
    iconDiv.addEventListener('touchstart', handleStart);

    iconDiv.addEventListener('touchmove', (e) => {
      if (isTouchDragReady) e.preventDefault();
    });

    function handleEnd(e) {
      clearTimeout(dragTimer);
      if (currentDraggedElement) {
        const ic = currentDraggedElement.querySelector('.icon');
        if (ic) ic.classList.remove('waiting');
        currentDraggedElement.style.cursor = 'grab';
        currentDraggedElement.classList.remove('shaking');
      }
      const touchDuration = e.timeStamp - touchStartTime;
      if (touchDuration < DRAG_DELAY && !isDraggingEnabled && e.type === 'touchend') {
        if (item.url && item.url.trim().startsWith('http')) {
          window.open(item.url, '_self');
        } else {
          showToast('图标URL无效！', 'error');
        }
      }
      isDraggingEnabled = false;
      isTouchDragReady = false;
      currentDraggedElement = null;
      touchStartTime = 0;
    }
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    iconItem.addEventListener('mouseleave', () => {
      if (!isDraggingEnabled) {
        clearTimeout(dragTimer);
        if (currentDraggedElement) {
          const ic = currentDraggedElement.querySelector('.icon');
          if (ic) ic.classList.remove('waiting');
          currentDraggedElement.classList.remove('shaking');
        }
      }
    });

    const rightMenu = createRightClickMenu(columnKey, idx, item);
    iconItem.appendChild(rightMenu);
    iconItem.oncontextmenu = (e) => {
      e.preventDefault();
      document.querySelectorAll('.right-click-menu').forEach(menu => menu.classList.remove('show'));
      rightMenu.classList.add('show');
      const mw = rightMenu.offsetWidth;
      const mh = rightMenu.offsetHeight;
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      let left = e.clientX;
      let top = e.clientY - 20;
      if (left + mw > sw) left = sw - mw;
      if (top + mh > sh) top = sh - mh;
      if (top < 0) top = 0;
      if (left < 0) left = 0;
      rightMenu.style.left = `${left}px`;
      rightMenu.style.top = `${top}px`;
    };

    iconItem.appendChild(iconDiv);
    iconItem.appendChild(iconName);
    iconWrap.appendChild(iconItem);
  });
}

// 检查并创建占位图标（双栏独立）
function checkPlaceholders(navList) {
  if (!iconWrap1 || !iconWrap2) return;
  const col1Real = navList.filter(icon => icon.k === 1 && !icon.isPlaceholder);
  const col2Real = navList.filter(icon => icon.k === 2 && !icon.isPlaceholder);
  const p1 = document.querySelector('#placeholder1');
  if (col1Real.length === 0 && !p1) iconWrap1.appendChild(createPlaceholder(1));
  else if (col1Real.length > 0 && p1) p1.remove();
  const p2 = document.querySelector('#placeholder2');
  if (col2Real.length === 0 && !p2) iconWrap2.appendChild(createPlaceholder(2));
  else if (col2Real.length > 0 && p2) p2.remove();
}

// 创建占位图标
function createPlaceholder(k) {
  const placeholder = document.createElement('div');
  placeholder.id = `placeholder${k}`;
  placeholder.className = 'icon-item';
  placeholder.dataset.k = k;
  placeholder.dataset.isPlaceholder = true;
  const iconDiv = document.createElement('div');
  iconDiv.className = 'icon';
  iconDiv.style.backgroundColor = '#ccc';
  const plus = document.createElement('span');
  plus.textContent = '+';
  plus.style.cssText = 'color:white;font-size:20px;font-weight:bold;text-align:center;';
  iconDiv.appendChild(plus);
  const iconName = document.createElement('div');
  iconName.className = 'icon-name';
  iconName.textContent = k === 1 ? '上栏占位' : '下栏占位';
  placeholder.appendChild(iconDiv);
  placeholder.appendChild(iconName);
  const rightMenu = createRightClickMenu(k, -1, { k, isPlaceholder: true });
  placeholder.appendChild(rightMenu);
  placeholder.oncontextmenu = (e) => {
    e.preventDefault();
    document.querySelectorAll('.right-click-menu').forEach(menu => menu.classList.remove('show'));
    rightMenu.classList.add('show');
    const mw = rightMenu.offsetWidth;
    const mh = rightMenu.offsetHeight;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    let left = e.clientX;
    let top = e.clientY - 20;
    if (left + mw > sw) left = sw - mw;
    if (top + mh > sh) top = sh - mh;
    if (top < 0) top = 0;
    if (left < 0) left = 0;
    rightMenu.style.left = `${left}px`;
    rightMenu.style.top = `${top}px`;
  };
  return placeholder;
}

// 右键菜单：仅 4 项（编辑/添加/删除/导出）
function createRightClickMenu(columnKey, idx, item) {
  const menu = document.createElement('ul');
  menu.className = 'right-click-menu';

  const editLi = document.createElement('li');
  editLi.textContent = '编辑图标';
  editLi.onclick = () => {
    menu.classList.remove('show');
    window.currentOptData = { type: 'edit', targetCol: columnKey, index: idx, data: item };
    openEditModal();
  };

  const addLi = document.createElement('li');
  addLi.textContent = '添加图标';
  addLi.onclick = () => {
    menu.classList.remove('show');
    window.currentOptData = { type: 'add', targetCol: columnKey, index: -1, data: {} };
    openAddModal(item.k || 1);
  };

  const delLi = document.createElement('li');
  delLi.textContent = '删除图标';
  delLi.onclick = () => {
    menu.classList.remove('show');
    window.currentOptData = { type: 'delete', targetCol: columnKey, index: idx, data: item };
    openDeleteModal();
  };

  const exportLi = document.createElement('li');
  exportLi.textContent = '导出数据';
  exportLi.onclick = () => {
    menu.classList.remove('show');
    exportData();
  };

  menu.appendChild(addLi);
  menu.appendChild(editLi);
  if (!item.isPlaceholder) menu.appendChild(delLi); // 占位图标不显示删除
  menu.appendChild(exportLi);

  document.addEventListener('click', () => {
    if (!event.target.closest('.icon-item')) menu.classList.remove('show');
  });
  return menu;
}

// 初始化图标渲染
async function initIcons() {
  const data = await loadIcons();
  const navList = data.navList || [];
  const col1 = navList.filter(icon => icon.k === 1);
  const col2 = navList.filter(icon => icon.k === 2);
  renderIcons(iconWrap1, col1, 1);
  renderIcons(iconWrap2, col2, 2);
  checkPlaceholders(navList);
  initCrossColumnSortable();
}

// 初始化跨栏拖拽（Sortable）
function initCrossColumnSortable() {
  if (!iconWrap1 || !iconWrap2) return;
  // 清理旧的 Sortable（如果有）
  if (iconWrap1._sortable) iconWrap1._sortable.destroy();
  if (iconWrap2._sortable) iconWrap2._sortable.destroy();

  function getIconsFromDom(wrap) {
    return [...wrap.querySelectorAll('.icon-item')].map(el => {
      return JSON.parse(el.dataset.iconData);
    }).filter(icon => !icon.isPlaceholder);
  }

  const onEnd = (evt) => {
    evt.item.classList.remove('shaking');
    const fromWrap = evt.from;
    const toWrap = evt.to;
    const fromK = fromWrap === iconWrap1 ? 1 : 2;
    const toK = toWrap === iconWrap1 ? 1 : 2;
    const data = getLocalStorageData();
    if (fromK === toK) {
      const newIcons = getIconsFromDom(toWrap);
      data.navList = data.navList.filter(i => i.k !== toK).concat(newIcons.map(i => ({ ...i, k: toK })));
      saveIcons(data);
      showToast('同栏排序成功！', 'success');
    } else {
      const fromNew = getIconsFromDom(fromWrap);
      const toNew = getIconsFromDom(toWrap);
      data.navList = data.navList.filter(i => i.k !== fromK && i.k !== toK)
        .concat(fromNew.map(i => ({ ...i, k: fromK })))
        .concat(toNew.map(i => ({ ...i, k: toK })));
      saveIcons(data);
      showToast('跨栏排序成功！', 'success');
    }
    refreshIconsRender();
  };

  const cfg = {
    group: 'nav-icons-group',
    animation: 150,
    ghostClass: 'ghost',
    dragClass: 'dragging',
    handle: '.icon',
    forceFallback: true,
    fallbackClass: 'dragging',
    delay: 500,
    onStart: (evt) => evt.item.classList.add('shaking'),
    onEnd
  };
  iconWrap1._sortable = new Sortable(iconWrap1, cfg);
  iconWrap2._sortable = new Sortable(iconWrap2, cfg);
}

// 刷新图标渲染
async function refreshIconsRender() {
  const data = await loadIcons();
  const col1 = data.navList.filter(i => i.k === 1);
  const col2 = data.navList.filter(i => i.k === 2);
  renderIcons(iconWrap1, col1, 1);
  renderIcons(iconWrap2, col2, 2);
  checkPlaceholders(data.navList);
  initCrossColumnSortable();
}

// 打开添加模态框（指定 k 值）
function openAddModal(k = 1) {
  window.currentOptData = { type: 'add', targetCol: 'nav_data', index: -1, data: { k } };
  openEditModal();
}

// 打开编辑模态框（核心：URL Enter / Blur 触发图标获取）
function openEditModal() {
  const modal = document.getElementById('iconModal');
  const modalTitle = document.getElementById('modalTitle');
  const urlInput = document.getElementById('urlInput');
  const nameInput = document.getElementById('nameInput');
  const colorPicker = document.getElementById('colorPicker');
  const altInput = document.getElementById('altInput');
  const iconInput = document.getElementById('iconInput');

  if (window.currentOptData.type === 'edit') {
    modalTitle.textContent = '编辑图标';
    const data = window.currentOptData.data;
    urlInput.value = data.url || '';
    nameInput.value = data.name || '';
    colorPicker.value = data.backgroundColor || '#4cafef';
    altInput.value = data.alt || '';
    iconInput.value = '';
    if (data.iconBase64) {
      window.uploadedBase64 = data.iconBase64;
      updatePreviews();
    } else {
      clearUpload();
    }
  } else {
    modalTitle.textContent = `添加${window.currentOptData.data.k === 1 ? '上栏' : '下栏'}图标`;
    urlInput.value = '';
    nameInput.value = '';
    colorPicker.value = '#4cafef';
    altInput.value = '';
    iconInput.value = '';
    clearUpload();
  }

  // 克隆节点清理旧监听器，避免累积
  urlInput.replaceWith(urlInput.cloneNode(true));
  altInput.replaceWith(altInput.cloneNode(true));
  colorPicker.replaceWith(colorPicker.cloneNode(true));
  iconInput.replaceWith(iconInput.cloneNode(true));

  const newUrlInput = document.getElementById('urlInput');
  const newNameInput = document.getElementById('nameInput');
  const newAltInput = document.getElementById('altInput');
  const newColorPicker = document.getElementById('colorPicker');
  const newIconInput = document.getElementById('iconInput');

  newUrlInput.focus();

  // --- URL Enter：补前缀 + 提取名称 + 自动获取图标 ---
  newUrlInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const url = newUrlInput.value.trim();
      if (!url) return;
      const fullUrl = fixUrlPrefix(url);
      newUrlInput.value = fullUrl;

      if (!newNameInput.value.trim()) {
        try {
          showToast('正在提取网站标题...', 'info');
          const urlObj = new URL(fullUrl);
          let title = urlObj.hostname;
          if (title.startsWith('www.')) title = title.slice(4);
          const parts = title.split('.');
          if (parts.length > 1) title = parts[0];
          title = title.charAt(0).toUpperCase() + title.slice(1);
          newNameInput.value = title;
          showToast('网站标题提取成功！', 'success');
        } catch (_) {
          showToast('网站标题提取失败，使用域名作为默认名称', 'warning');
        }
      }

      // 若用户未手动上传图片，自动尝试拉取 favicon
      if (!window.uploadedBase64) {
        showToast('正在获取网站图标...', 'info');
        await tryGetFavicon(fullUrl);
      }
      updatePreviews();
      newNameInput.focus();
    }
  });

  // --- URL Blur：失焦时也尝试自动获取图标 ---
  newUrlInput.addEventListener('blur', async () => {
    const url = newUrlInput.value.trim();
    if (!url) return;
    const fullUrl = fixUrlPrefix(url);
    if (fullUrl !== newUrlInput.value) newUrlInput.value = fullUrl;
    if (!window.uploadedBase64) {
      await tryGetFavicon(fullUrl);
      updatePreviews();
    }
  });

  // --- 文字 / 背景色 实时预览 ---
  function updateTextPreview() {
    const alt = newAltInput.value.trim();
    const bg = newColorPicker.value;
    const textPreview = document.getElementById('textPreview');
    const textPreviewIcon = document.getElementById('textPreviewIcon');
    const previewIcon = document.getElementById('previewIcon');
    const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
    if (textPreview) {
      textPreview.textContent = alt;
      textPreview.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:1px 1px 2px rgba(0,0,0,0.8);';
    }
    if (textPreviewIcon) textPreviewIcon.style.backgroundColor = bg;
    if (previewIcon) previewIcon.style.backgroundColor = bg;
    if (imagePreviewPlaceholder) {
      imagePreviewPlaceholder.style.background = `${bg} url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="50%" y="50%" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" dy=".3em" fill="white">+</text></svg>') center center no-repeat`;
    }
  }
  updateTextPreview();
  updatePreviewSelection();
  newAltInput.addEventListener('input', updateTextPreview);
  newColorPicker.addEventListener('input', updateTextPreview);

  // iconInput（纯预览，不保存）
  newIconInput.addEventListener('input', function () {
    const p = this.value.trim();
    if (p) {
      // 只做预览，不写入 Base64
      window.uploadedBase64 = null;
      updatePreviews();
    } else {
      clearUpload();
    }
  });

  const previewImgElement = document.getElementById('previewImg');
  if (previewImgElement) {
    previewImgElement.replaceWith(previewImgElement.cloneNode(true));
  }

  // --- Name Enter/Tab：填充 alt ---
  if (newNameInput && newAltInput) {
    newNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (!newAltInput.value.trim()) {
          newAltInput.value = newNameInput.value.trim();
          updatePreviews();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          newAltInput.focus();
        }
      }
    });
  }

  // --- Alt Enter：跳至颜色选择器 ---
  if (newAltInput && newColorPicker) {
    newAltInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        newColorPicker.focus();
      }
    });
  }

  modal.style.display = 'flex';
  initColorPresets();
}

// 更新预览选中状态（有图片选图片，无图片选文字）
function updatePreviewSelection() {
  const textItem = document.getElementById('textPreviewItem');
  const imgItem = document.getElementById('imagePreviewItem');
  const has = !!window.uploadedBase64;
  if (textItem) textItem.classList.toggle('selected', !has);
  if (imgItem) imgItem.classList.toggle('selected', has);
}

// 更新预览区（两侧预览同步）
function updatePreviews() {
  const previewImg = document.getElementById('previewImg');
  const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
  const textPreview = document.getElementById('textPreview');
  const textPreviewIcon = document.getElementById('textPreviewIcon');
  const previewIcon = document.getElementById('previewIcon');
  const colorPicker = document.getElementById('colorPicker');
  const altInput = document.getElementById('altInput');

  if (previewImg && imagePreviewPlaceholder) {
    if (window.uploadedBase64) {
      previewImg.src = window.uploadedBase64;
      previewImg.style.display = 'block';
      imagePreviewPlaceholder.style.display = 'none';
    } else {
      previewImg.src = '';
      previewImg.style.display = 'none';
      imagePreviewPlaceholder.style.display = 'flex';
    }
  }
  const alt = (altInput ? altInput.value : '').trim();
  const bg = colorPicker ? colorPicker.value : '#4cafef';
  if (textPreview) {
    textPreview.textContent = alt;
    textPreview.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:1px 1px 2px rgba(0,0,0,0.8);';
  }
  if (previewIcon) previewIcon.style.backgroundColor = bg;
  if (textPreviewIcon) textPreviewIcon.style.backgroundColor = bg;
  if (imagePreviewPlaceholder) {
    imagePreviewPlaceholder.style.background = `${bg} url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="50%" y="50%" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" dy=".3em" fill="white">+</text></svg>') center center no-repeat`;
  }
  updatePreviewSelection();
}

// 打开删除确认框
function openDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (!modal) return;
  modal.style.display = 'flex';
  const confirmBtn = document.getElementById('confirmDelBtn');
  if (!confirmBtn) return;
  confirmBtn.onclick = () => {
    const { targetCol, index, data } = window.currentOptData;
    if (!targetCol) {
      showToast('删除失败：请右键对应模块后再删除！', 'error');
      modal.style.display = 'none';
      return;
    }
    const full = getLocalStorageData();
    let deleted = false;
    if (data && data.id) {
      const len = full.navList.length;
      full.navList = full.navList.filter(i => i.id !== data.id);
      if (full.navList.length < len) deleted = true;
    }
    if (!deleted && index >= 0 && index < full.navList.length) {
      full.navList.splice(index, 1);
      deleted = true;
    }
    if (deleted) {
      saveIcons(full);
      refreshIconsRender();
      showToast('图标删除成功！', 'success');
    } else {
      showToast('删除失败：未找到目标图标！', 'error');
    }
    modal.style.display = 'none';
  };
}

// 关闭模态框
function closeModal() {
  const m = document.getElementById('iconModal');
  const dm = document.getElementById('deleteModal');
  if (m) m.style.display = 'none';
  if (dm) dm.style.display = 'none';
  clearUpload();
}

// ==========================
// 主入口模块 (app)
// ==========================

window.currentOptData = { type: 'add', targetCol: 'nav_data', index: -1, data: {} };
window.uploadedBase64 = null;

// 全局右键屏蔽（仅图标内右键有效）
function initDomEvents() {
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (!event.target.closest('.icon-item')) {
      document.querySelectorAll('.right-click-menu').forEach(menu => menu.classList.remove('show'));
    }
  });
}

// 提交图标表单
async function submitIcon() {
  const urlInput = document.getElementById('urlInput');
  const colorPicker = document.getElementById('colorPicker');
  const url = urlInput ? urlInput.value.trim() : '';
  const name = document.getElementById('nameInput').value.trim();
  const backgroundColor = colorPicker ? colorPicker.value : '#4cafef';
  const alt = document.getElementById('altInput').value.trim();

  if (!url || !name || !alt) {
    showToast('请填写所有必填项！', 'error');
    return;
  }
  const fixedUrl = fixUrlPrefix(url);
  const newIcon = {
    id: window.currentOptData.type === 'edit' && window.currentOptData.data.id
      ? window.currentOptData.data.id
      : `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`,
    k: window.currentOptData.data.k || 1,
    name,
    url: fixedUrl,
    alt,
    backgroundColor,
    iconBase64: window.uploadedBase64 || null
  };

  const data = await loadIcons();
  if (window.currentOptData.type === 'add') {
    data.navList.push(newIcon);
  } else {
    const idx = data.navList.findIndex(i => i.id === newIcon.id);
    if (idx >= 0) data.navList[idx] = newIcon;
    else if (window.currentOptData.index >= 0) data.navList[window.currentOptData.index] = newIcon;
  }
  const ok = await saveIcons(data);
  if (ok) {
    showToast(
      window.currentOptData.type === 'add'
        ? `${newIcon.k === 1 ? '上栏' : '下栏'}图标添加成功！`
        : '图标修改成功！',
      'success'
    );
    await refreshIconsRender();
    closeModal();
  } else {
    showToast('图标保存失败！', 'error');
  }
}

// 初始化拖拽上传（图片预览区点击/拖拽上传）
function initDragUpload() {
  const dragArea = document.getElementById('dragUploadArea');
  const fileInput = document.getElementById('fileUploadInput');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const textPreviewItem = document.getElementById('textPreviewItem');
  const imagePreviewItem = document.getElementById('imagePreviewItem');
  if (!dragArea || !fileInput) return;
  updatePreviewSelection();

  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) {
      await handleFileUpload(f);
      updatePreviewSelection();
    }
  });

  if (imagePreviewContainer) {
    imagePreviewContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }
  if (textPreviewItem) {
    textPreviewItem.addEventListener('click', () => {
      window.uploadedBase64 = null;
      clearUpload();
      updatePreviewSelection();
    });
  }
  if (imagePreviewItem) {
    imagePreviewItem.addEventListener('click', () => {
      fileInput.click();
    });
  }
}

// 处理文件上传
async function handleFileUpload(file) {
  if (!checkFileType(file)) {
    showToast('不支持的文件格式，请选择图片文件', 'error');
    return;
  }
  if (!checkFileSize(file)) {
    showToast('文件大小超过2MB，请选择较小的图片', 'error');
    return;
  }
  try {
    const b64 = await fileToBase64(file);
    window.uploadedBase64 = b64;
    updatePreviews();
    showToast('图片上传成功！', 'success');
  } catch (_) {
    showToast('文件读取失败', 'error');
  }
}

// 将函数暴露到全局，供 HTML 内联事件调用
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.closeModal = closeModal;
window.submitIcon = submitIcon;
window.exportData = exportData;
window.initColorPresets = initColorPresets;
window.clearUpload = clearUpload;

// 页面加载完成初始化
window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('开始初始化...');
    initDomEvents();
    initPageStructure();
    initColorPresets();
    await initIcons();
    initDragUpload();

    // 搜索功能（百度 / Google）
    const baiduBtn = document.getElementById('baidusearchButton');
    const googleBtn = document.getElementById('googleButton');
    const searchInput = document.getElementById('searchInput');
    function performSearch(prefix, kw) {
      if (kw.trim()) window.location.href = `${prefix}${encodeURIComponent(kw.trim())}`;
    }
    if (baiduBtn && googleBtn && searchInput) {
      baiduBtn.addEventListener('click', () => performSearch('https://www.baidu.com/s?wd=', searchInput.value));
      googleBtn.addEventListener('click', () => performSearch('https://www.google.com/search?q=', searchInput.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch('https://www.baidu.com/s?wd=', searchInput.value);
      });
      console.log('搜索功能初始化成功');
    }
    console.log('初始化完成');
  } catch (e) {
    console.error('初始化失败：', e);
    showToast('应用初始化失败，请刷新页面重试', 'error');
  }
});
