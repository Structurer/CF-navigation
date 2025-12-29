// 右键菜单全局屏蔽+仅图标内右键有效
document.addEventListener('contextmenu', event => {
  event.preventDefault();
  if (!event.target.closest('.icon-item')) {
    document.querySelectorAll('.right-click-menu').forEach(menu => menu.classList.remove('show'));
  }
});

// 全局常量定义（模块存储KEY、默认配置）
const STORAGE_KEY_COL1 = 'nav_icons_column1'; // 上栏 = webs1.json
const STORAGE_KEY_COL2 = 'nav_icons_column2'; // 下栏 = webs2.json
const DEFAULT_ICON_PREFIX = './icons/';
const DEFAULT_COLOR_PRESETS = [
  '#ff3838', '#ff9d32', '#ffd131', '#49d838', '#36cfc9', '#4cafef',
  '#3a86ff', '#9d4edd', '#ff2e99', '#6e7c7c', '#2c3e50', '#000000'
];
// 拖拽延迟时间（毫秒），可根据需要调整
const DRAG_DELAY = 500;

// 全局变量：仅用于新增/编辑图标（导入导出单独锁定，不共用）
let currentOptData = { type: 'add', targetCol: STORAGE_KEY_COL1, index: -1, data: {} };
// 导入导出专用锁定变量：核心防串模块，右键操作时锁定当前模块
let importExportTargetCol = null;
// 拖拽相关变量
let dragTimer = null;
let isDraggingEnabled = false;
let currentDraggedElement = null;

// 页面DOM元素初始化（图标容器、上下栏）
const container = document.getElementById('icon-container');
const column1 = document.createElement('div');
const column2 = document.createElement('div');
column1.className = 'category-column';
column2.className = 'category-column';
const iconWrap1 = document.createElement('div');
const iconWrap2 = document.createElement('div');
iconWrap1.className = 'icon-wrap';
iconWrap2.className = 'icon-wrap';
column1.appendChild(iconWrap1);
column2.appendChild(iconWrap2);
container.appendChild(column1);
container.appendChild(column2);

// 1. 生成唯一ID：确保每个图标唯一标识，拖拽/刷新后仍能精准删除
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// 2. 本地存储读取：自动补全唯一ID，兼容旧数据/导入数据
function getIconsFromStorage(storageKey) {
  const data = localStorage.getItem(storageKey);
  if (!data) return [];
  return JSON.parse(data).map(icon => {
    if (!icon.id) icon.id = generateId();
    return icon;
  });
}

// 3. 本地存储写入：直接存储图标数据
function setIconsToStorage(storageKey, data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

// 4. 图标渲染：根据模块数据生成图标，绑定右键菜单
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
    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = item.alt;
    // 图标加载失败时显示文字替代
    img.onerror = () => {
      iconDiv.removeChild(img);
      const altText = document.createElement('span');
      altText.textContent = item.alt;
      altText.style.color = 'white';
      altText.style.fontSize = '14px';
      altText.style.fontWeight = 'bold';
      altText.style.textAlign = 'center';
      iconDiv.appendChild(altText);
    };
    const iconName = document.createElement('div');
    iconName.className = 'icon-name';
    iconName.textContent = item.name;
    
    // 图标点击跳转功能
    iconItem.onclick = (e) => {
      if (e.target.closest('.right-click-menu') || isDraggingEnabled) return;
      if (item.url && item.url.trim().startsWith('http')) {
        window.open(item.url, '_self');
      } else {
        showToast('图标URL无效！', 'error');
      }
    };

    // 拖拽延迟处理
    iconDiv.addEventListener('mousedown', (e) => {
      // 右键点击不触发拖拽
      if (e.button === 2) return;
      
      currentDraggedElement = iconItem;
      iconDiv.classList.add('waiting');
      
      dragTimer = setTimeout(() => {
        isDraggingEnabled = true;
        iconItem.style.cursor = 'grabbing';
        // 开始拖拽时添加抖动效果
        iconItem.classList.add('shaking');
        showToast('可以拖拽了（抖动中）', 'info');
      }, DRAG_DELAY);
    });
    
    // 鼠标释放时重置拖拽状态和抖动效果
    document.addEventListener('mouseup', () => {
      clearTimeout(dragTimer);
      if (currentDraggedElement) {
        currentDraggedElement.querySelector('.icon').classList.remove('waiting');
        currentDraggedElement.style.cursor = 'grab';
        // 结束拖拽时移除抖动效果
        currentDraggedElement.classList.remove('shaking');
      }
      isDraggingEnabled = false;
      currentDraggedElement = null;
    });
    
    // 鼠标移动超出元素时重置拖拽状态
    iconItem.addEventListener('mouseleave', () => {
      if (!isDraggingEnabled) {
        clearTimeout(dragTimer);
        if (currentDraggedElement) {
          currentDraggedElement.querySelector('.icon').classList.remove('waiting');
          currentDraggedElement.classList.remove('shaking');
        }
      }
    });

    // 绑定右键菜单
    const rightMenu = createRightClickMenu(columnKey, idx, item);
    iconItem.appendChild(rightMenu);
    // 右键菜单位置校准（防止超出屏幕）
    iconItem.oncontextmenu = (e) => {
      e.preventDefault();
      document.querySelectorAll('.right-click-menu').forEach(menu => menu.classList.remove('show'));
      rightMenu.classList.add('show');
      const menuWidth = rightMenu.offsetWidth;
      const menuHeight = rightMenu.offsetHeight;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      let leftPos = e.clientX;
      let topPos = e.clientY - 20;
      if (leftPos + menuWidth > screenWidth) leftPos = screenWidth - menuWidth;
      if (topPos + menuHeight > screenHeight) topPos = screenHeight - menuHeight;
      if (topPos < 0) topPos = 0;
      if (leftPos < 0) leftPos = 0;
      rightMenu.style.left = `${leftPos}px`;
      rightMenu.style.top = `${topPos}px`;
    };

    iconDiv.appendChild(img);
    iconItem.appendChild(iconDiv);
    iconItem.appendChild(iconName);
    iconWrap.appendChild(iconItem);
  });
}

// 5. 右键菜单创建：核心防串模块，导入/导出时锁定当前模块
function createRightClickMenu(columnKey, idx, item) {
  const menu = document.createElement('ul');
  menu.className = 'right-click-menu';

  // 编辑图标
  const editLi = document.createElement('li');
  editLi.textContent = '编辑图标';
  editLi.onclick = () => {
    menu.classList.remove('show');
    currentOptData = { type: 'edit', targetCol: columnKey, index: idx, data: item };
    openEditModal();
  };

  // 新增图标
  const addLi = document.createElement('li');
  addLi.textContent = '添加图标';
  addLi.onclick = () => {
    menu.classList.remove('show');
    currentOptData = { type: 'add', targetCol: columnKey, index: -1, data: {} };
    openAddModal(columnKey === STORAGE_KEY_COL1 ? '上栏' : '下栏');
  };

  // 删除图标
  const delLi = document.createElement('li');
  delLi.textContent = '删除图标';
  delLi.onclick = () => {
    menu.classList.remove('show');
    currentOptData = { type: 'delete', targetCol: columnKey, index: idx, data: item };
    openDeleteModal();
  };

  // 导入本栏数据：点击即锁定当前模块
  const importLi = document.createElement('li');
  importLi.textContent = '导入本栏数据';
  importLi.onclick = () => {
    menu.classList.remove('show');
    importExportTargetCol = columnKey;
    document.getElementById('fileInput').click();
  };

  // 导出本栏数据：点击即锁定当前模块，直接导出
  const exportLi = document.createElement('li');
  exportLi.textContent = '导出本栏数据';
  exportLi.onclick = () => {
    menu.classList.remove('show');
    importExportTargetCol = columnKey;
    exportColumnIcons(importExportTargetCol);
    importExportTargetCol = null;
  };

  menu.appendChild(editLi);
  menu.appendChild(addLi);
  menu.appendChild(delLi);
  menu.appendChild(importLi);
  menu.appendChild(exportLi);

  // 点击空白处关闭右键菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-item')) menu.classList.remove('show');
  });
  return menu;
}

// 6. 颜色预设初始化：生成颜色选择器预设色块
const urlInput = document.getElementById('urlInput');
const iconInput = document.getElementById('iconInput');
const colorPicker = document.getElementById('colorPicker');
const colorPresets = document.getElementById('colorPresets');
initColorPresets();
// URL自动补全https：输入时自动补全协议头
urlInput.addEventListener('blur', () => {
  const url = urlInput.value.trim();
  if (!url) return;
  urlInput.value = fixUrlPrefix(url);
});
function fixUrlPrefix(url) {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
    return url;
  }
  return `https://${url}`;
}
function initColorPresets() {
  colorPresets.innerHTML = '';
  DEFAULT_COLOR_PRESETS.forEach(color => {
    const colorItem = document.createElement('div');
    colorItem.className = 'color-preset-item';
    colorItem.style.backgroundColor = color;
    colorItem.dataset.color = color;
    colorItem.onclick = () => {
      colorPicker.value = color;
      setActiveColorPreset(color);
    };
    colorPresets.appendChild(colorItem);
  });
  colorPicker.addEventListener('input', () => {
    setActiveColorPreset(colorPicker.value);
  });
}
// 选中颜色预设时高亮
function setActiveColorPreset(targetColor) {
  document.querySelectorAll('.color-preset-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.color === targetColor) {
      item.classList.add('active');
    }
  });
}

// 7. 编辑图标回显：编辑时填充原有数据到弹窗
function fillEditForm(data) {
  urlInput.value = data.url || '';
  document.getElementById('nameInput').value = data.name || '';
  const fillColor = data.backgroundColor || '#4cafef';
  colorPicker.value = fillColor;
  setActiveColorPreset(fillColor);
  document.getElementById('altInput').value = data.alt || '';
  iconInput.value = data.icon || DEFAULT_ICON_PREFIX;
}

// 8. 导入数据：仅导入锁定模块，防串栏，导入后释放锁定
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file || !importExportTargetCol) {
    showToast('导入失败：请右键对应模块后再导入！', 'error');
    event.target.value = '';
    importExportTargetCol = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data = JSON.parse(e.target.result);
      // 导入数据自动补全ID
      data = data.map(icon => {
        if (!icon.id) icon.id = generateId();
        return icon;
      });
      // 仅写入锁定的模块
      setIconsToStorage(importExportTargetCol, data);
      refreshIconsRender();
      // 提示对应模块导入成功
      const colName = importExportTargetCol === STORAGE_KEY_COL1 ? '上栏' : '下栏';
      showToast(`${colName}成功导入 ${data.length} 个图标数据`, 'success');
    } catch (err) {
      showToast('导入失败：文件格式不正确', 'error');
    }
    event.target.value = '';
    importExportTargetCol = null;
  };
  reader.readAsText(file);
}

// 9. 页面初始化：加载时自动读取webs1.json/webs2.json初始化图标
async function initIcons() {
  const col1Data = getIconsFromStorage(STORAGE_KEY_COL1);
  if (col1Data.length === 0) {
    try {
      const res = await fetch('webs1.json');
      const jsonData = await res.json();
      const jsonDataWithId = jsonData.map(icon => ({...icon, id: icon.id || generateId()}));
      setIconsToStorage(STORAGE_KEY_COL1, jsonDataWithId);
      renderIcons(iconWrap1, jsonDataWithId, STORAGE_KEY_COL1);
    } catch (err) {
      renderIcons(iconWrap1, [], STORAGE_KEY_COL1);
    }
  } else {
    renderIcons(iconWrap1, col1Data, STORAGE_KEY_COL1);
  }

  const col2Data = getIconsFromStorage(STORAGE_KEY_COL2);
  if (col2Data.length === 0) {
    try {
      const res = await fetch('webs2.json');
      const jsonData = await res.json();
      const jsonDataWithId = jsonData.map(icon => ({...icon, id: icon.id || generateId()}));
      setIconsToStorage(STORAGE_KEY_COL2, jsonDataWithId);
      renderIcons(iconWrap2, jsonDataWithId, STORAGE_KEY_COL2);
    } catch (err) {
      renderIcons(iconWrap2, [], STORAGE_KEY_COL2);
    }
  } else {
    renderIcons(iconWrap2, col2Data, STORAGE_KEY_COL2);
  }
  // 初始化拖拽排序
  initCrossColumnSortable();
}

// 10. 拖拽排序：支持同栏/跨栏拖拽，排序后数据同步本地存储
function initCrossColumnSortable() {
  const sortableConfig = {
    group: 'nav-icons-group',
    animation: 150,
    ghostClass: 'ghost',
    dragClass: 'dragging',
    handle: '.icon',
    forceFallback: true,
    fallbackClass: 'dragging',
    delay: 500, // 按住图标后延迟500毫秒（0.5秒）才可开始拖动
    onStart: (evt) => {
      // 开始拖拽时添加抖动效果（兼容SortableJS的拖拽事件）
      evt.item.classList.add('shaking');
    },
    onEnd: (evt) => {
      // 结束拖拽时移除抖动效果
      evt.item.classList.remove('shaking');
      
      const fromWrap = evt.from;
      const toWrap = evt.to;
      const fromKey = fromWrap === iconWrap1 ? STORAGE_KEY_COL1 : STORAGE_KEY_COL2;
      const toKey = toWrap === iconWrap1 ? STORAGE_KEY_COL1 : STORAGE_KEY_COL2;
      // 从DOM中读取排序后的图标数据
      const getIconsFromDom = (wrap) => {
        return [...wrap.querySelectorAll('.icon-item')].map(item => {
          return JSON.parse(item.dataset.iconData);
        });
      };
      // 同栏排序
      if (fromKey === toKey) {
        const newIcons = getIconsFromDom(toWrap);
        setIconsToStorage(toKey, newIcons);
        showToast('同栏排序成功！', 'success');
      } else {
        // 跨栏排序
        const fromNewIcons = getIconsFromDom(fromWrap);
        const toNewIcons = getIconsFromDom(toWrap);
        setIconsToStorage(fromKey, fromNewIcons);
        setIconsToStorage(toKey, toNewIcons);
        showToast('跨栏排序成功！', 'success');
      }
      refreshIconsRender();
    }
  };
  new Sortable(iconWrap1, sortableConfig);
  new Sortable(iconWrap2, sortableConfig);
}

// 11. 新增图标弹窗：打开弹窗并重置表单
function openAddModal(colName) {
  document.getElementById('modalTitle').textContent = `添加${colName}图标`;
  document.getElementById('modalSubmitBtn').textContent = '保存（即时生效）';
  resetForm();
  document.getElementById('iconModal').style.display = 'flex';
  urlInput.focus();
}

// 12. 编辑图标弹窗：打开弹窗并回显数据
function openEditModal() {
  document.getElementById('modalTitle').textContent = '编辑图标';
  document.getElementById('modalSubmitBtn').textContent = '保存修改';
  fillEditForm(currentOptData.data);
  document.getElementById('iconModal').style.display = 'flex';
}

// 13. 删除图标：唯一ID+索引双重兜底，精准删除，不串模块
function openDeleteModal() {
  const modal = document.getElementById('deleteModal');
  modal.style.display = 'flex';
  const confirmBtn = document.getElementById('confirmDelBtn');
  confirmBtn.onclick = () => {
    const { targetCol, index, data } = currentOptData;
    if (!targetCol) {
      showToast('删除失败：未选中有效栏位！', 'error');
      modal.style.display = 'none';
      return;
    }
    let oldIcons = getIconsFromStorage(targetCol);
    let deleted = false;
    // 优先用唯一ID删除（核心）
    if (data && data.id) {
      const originLength = oldIcons.length;
      oldIcons = oldIcons.filter(icon => icon.id !== data.id);
      if (oldIcons.length < originLength) deleted = true;
    }
    // ID失效时，索引兜底删除
    if (!deleted && index >= 0 && index < oldIcons.length) {
      oldIcons.splice(index, 1);
      deleted = true;
    }
    if (deleted) {
      setIconsToStorage(targetCol, oldIcons);
      refreshIconsRender();
      showToast('图标删除成功！', 'success');
    } else {
      showToast('删除失败：未找到目标图标！', 'error');
    }
    modal.style.display = 'none';
  };
}

// 14. 关闭弹窗：关闭所有弹窗
function closeModal() {
  document.getElementById('iconModal').style.display = 'none';
  document.getElementById('deleteModal').style.display = 'none';
}

// 15. 重置表单：新增图标时重置弹窗输入框
function resetForm() {
  urlInput.value = '';
  document.getElementById('nameInput').value = '';
  colorPicker.value = '#4cafef';
  setActiveColorPreset('#4cafef');
  document.getElementById('altInput').value = '';
  iconInput.value = DEFAULT_ICON_PREFIX;
}

// 16. 保存图标（新增/编辑）：自动生成/保留ID，同步本地存储
function submitIcon() {
  const url = urlInput.value.trim();
  const name = document.getElementById('nameInput').value.trim();
  const backgroundColor = colorPicker.value;
  const alt = document.getElementById('altInput').value.trim();
  const iconPath = iconInput.value.trim();
  const targetCol = currentOptData.targetCol;
  // 校验必填项
  if (!url || !name || !alt || !iconPath) {
    showToast('请填写所有必填项！', 'error');
    return;
  }
  const fixedUrl = fixUrlPrefix(url);
  // 新增图标生成ID，编辑图标保留原有ID
  const newIcon = {
    id: currentOptData.type === 'edit' && currentOptData.data.id ? currentOptData.data.id : generateId(),
    name,
    url: fixedUrl,
    icon: iconPath,
    alt,
    backgroundColor
  };
  const oldIcons = getIconsFromStorage(targetCol);
  if (currentOptData.type === 'add') {
    oldIcons.push(newIcon);
    const colName = targetCol === STORAGE_KEY_COL1 ? '上栏' : '下栏';
    showToast(`${colName}图标添加成功！`, 'success');
  } else {
    // 编辑时优先用ID查找替换
    const editIdx = oldIcons.findIndex(icon => icon.id === newIcon.id);
    if (editIdx >= 0) {
      oldIcons[editIdx] = newIcon;
    } else {
      oldIcons[currentOptData.index] = newIcon;
    }
    showToast('图标修改成功！', 'success');
  }
  setIconsToStorage(targetCol, oldIcons);
  refreshIconsRender();
  closeModal();
}

// 17. 刷新图标渲染：重新加载两个模块的图标数据
function refreshIconsRender() {
  const col1Data = getIconsFromStorage(STORAGE_KEY_COL1);
  renderIcons(iconWrap1, col1Data, STORAGE_KEY_COL1);
  const col2Data = getIconsFromStorage(STORAGE_KEY_COL2);
  renderIcons(iconWrap2, col2Data, STORAGE_KEY_COL2);
  initCrossColumnSortable();
}

// 18. 提示框：显示操作结果提示，3秒后自动消失
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast';
  toast.classList.add(type, 'show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// 19. 导出数据：仅导出锁定模块，文件名称与模块严格对应（col1=webs1，col2=webs2）
function exportColumnIcons(targetCol) {
  if (![STORAGE_KEY_COL1, STORAGE_KEY_COL2].includes(targetCol)) {
    showToast('导出失败：请右键对应模块后导出！', 'error');
    return;
  }
  const colIcons = getIconsFromStorage(targetCol);
  const fileName = targetCol === STORAGE_KEY_COL1 ? 'webs1.json' : 'webs2.json';
  const jsonStr = JSON.stringify(colIcons, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 页面加载完成后初始化图标
window.addEventListener('DOMContentLoaded', () => {
  initIcons(); // 原来的图标初始化

  // 搜索框事件绑定
  const baiduButton = document.getElementById('baidusearchButton');
  const googleButton = document.getElementById('googleButton');
  const searchInput = document.getElementById('searchInput');

  function performSearch(searchUrlPrefix, searchText) {
    if (searchText.trim() !== '') {
      const searchUrl = `${searchUrlPrefix}${encodeURIComponent(searchText)}`;
      window.location.href = searchUrl;
    }
  }

  if (baiduButton && googleButton && searchInput) {
    baiduButton.addEventListener('click', () => performSearch('https://www.baidu.com/s?wd=', searchInput.value));
    googleButton.addEventListener('click', () => performSearch('https://www.google.com/search?q=', searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performSearch('https://www.baidu.com/s?wd=', searchInput.value);
      }
    });
  } else {
    console.warn('搜索框相关元素未找到，事件绑定失败');
  }
});