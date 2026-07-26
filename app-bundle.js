// 导航页主入口文件 - 合并版

// ==========================
// 工具函数模块 (utils.js)
// ==========================

// 全局配置
const CONFIG = {
  API_URL: 'http://127.0.0.1:8787',  // 本地开发服务器地址
  CLOUD_API_URL: '',  // 云端API地址
  API_KEY: 'Y0urC0mpl3xAP1K3y168'  // API密钥
};

// 生成唯一ID：确保每个图标唯一标识，拖拽/刷新后仍能精准删除
function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
}

// 修复URL前缀：自动补http/https前缀
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
    // 重置占位符样式
    imagePreviewPlaceholder.style.background = '';
  }

  // 清空文件输入
  const fileInput = document.getElementById('fileUploadInput');
  if (fileInput) fileInput.value = '';
}

// 初始化颜色预设
function initColorPresets() {
  const colorPresets = document.getElementById('colorPresets');
  const colorPicker = document.getElementById('colorPicker');
  
  const DEFAULT_COLOR_PRESETS = [
    '#ffffff', '#ff3838', '#ff9d32', '#ffd131', '#49d838', '#36cfc9', 
    '#4cafef','#3a86ff', '#9d4edd', '#ff2e99', '#6e7c7c',  '#000000'
  ];

  colorPresets.innerHTML = '';
  DEFAULT_COLOR_PRESETS.forEach(color => {
    const colorItem = document.createElement('div');
    colorItem.className = 'color-preset-item';
    colorItem.style.backgroundColor = color;
    colorItem.dataset.color = color;
    // 白色背景添加边框，便于识别
    if (color === '#ffffff') {
      colorItem.style.border = '1px solid #ddd';
    }
    colorItem.onclick = () => {
      colorPicker.value = color;
      setActiveColorPreset(color);
      // 触发input事件，确保预览更新
      colorPicker.dispatchEvent(new Event('input'));
    };
    colorPresets.appendChild(colorItem);
  });
  
  // 移除多余的input事件监听，避免冲突
  // 预览更新由openEditModal中的事件监听器处理
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
  toast.textContent = message;
  toast.className = 'toast';
  toast.classList.add(type, 'show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// 文件转Base64
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
  // 检查MIME类型或文件扩展名（处理某些浏览器无法正确识别ICO文件MIME类型的情况）
  return allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.ico');
}

// 检查文件大小
function checkFileSize(file, maxSize = 2 * 1024 * 1024) {
  return file.size <= maxSize;
}

// ==========================
// 存储模块 (storage.js)
// ==========================

// 全局常量定义
const STORAGE_KEY = 'nav_data'; // 统一存储键，包含图标和操作记录
const STORAGE_KEY_BASE64 = 'nav_data_base64'; // 兼容旧代码
const DEFAULT_ICON_PREFIX = './icons/';

// 从本地存储读取数据（回退机制）
function getLocalStorageData() {
  // 优先尝试读取Base64版本
  let data = localStorage.getItem(STORAGE_KEY_BASE64);
  if (data) {
    return JSON.parse(data);
  }

  // 回退到普通版本
  data = localStorage.getItem(STORAGE_KEY);
  if (!data) return { navList: [], operateLog: [] };
  return JSON.parse(data);
}

// 从KV获取数据（通过API） - 优先使用本地存储
async function getIconsFromStorage() {
  try {
    // 优先检查本地存储是否有数据
    const localData = getLocalStorageData();
    if (localData.navList.length > 0) {
      console.log('✅ 从本地存储加载数据成功，共', localData.navList.length, '个图标');
      return localData;
    }
    
    // 本地存储为空时，直接从云端获取数据
    console.log('🟡 本地存储为空，尝试从云端获取数据...');
    const response = await fetch(`${CONFIG.CLOUD_API_URL}/api/get`);
    
    if (response.ok) {
      const data = await response.json();
      // 将API获取的数据保存到本地存储
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(STORAGE_KEY_BASE64, JSON.stringify(data));
      console.log('✅ 从云端KV加载数据成功，共', data.navList.length, '个图标');
      return data;
    }
    
    // 失败时回退到本地存储（即使为空）
    console.warn('❌ 从云端获取数据失败，回退到本地存储');
    return localData;
  } catch (error) {
    console.error('获取数据失败:', error);
    // 失败时回退到本地存储
    return getLocalStorageData();
  }
}

// 保存数据到本地存储（仅本地，不上传到KV）
async function setIconsToStorage(data) {
  try {
    // 只保存到本地存储，不上传至KV
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEY_BASE64, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('保存数据到本地失败:', error);
    return false;
  }
}



// 加载Base64数据（如果不存在）
async function loadBase64DataIfNeeded() {
  console.log('开始加载数据...');
  
  // 检查localStorage中是否已有数据
  const localData = getLocalStorageData();
  if (localData.navList.length > 0) {
    console.log('✅ 从本地存储加载数据成功，共', localData.navList.length, '个图标');
    return true;
  }
  
  // 检查API返回的数据是否为空
  const apiData = await getIconsFromStorage();
  if (apiData.navList.length > 0) {
    console.log('✅ 从云端KV加载数据成功，共', apiData.navList.length, '个图标');
    return true;
  }
  
  // 不再自动加载本地文件，确保数据来源清晰可辨
  console.log('❌ 本地存储和云端KV都没有数据，不再自动加载本地文件');
  return true;
}

// ==========================
// API模块 (api.js)
// ==========================

// 手动上传到云端
async function manualUploadToCloud(data = null) {
  try {
    // 如果没有提供数据，从本地存储获取
    const uploadData = data || getLocalStorageData();
    if (!uploadData || uploadData.navList.length === 0) {
      throw new Error('没有可上传的数据');
    }

    // 发送请求到Cloudflare Workers
    const response = await fetch(`${CONFIG.CLOUD_API_URL}/api/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.API_KEY}`
      },
      body: JSON.stringify(uploadData)
    });

    // 检查响应状态
    if (!response.ok) {
      // 尝试解析错误响应
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // 如果无法解析JSON，使用状态文本
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.error || `请求失败: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(error.message);
  }
}



// 手动从云端下载
async function manualDownloadFromCloud() {
  try {
    // 发送请求到Cloudflare Workers
    const response = await fetch(`${CONFIG.CLOUD_API_URL}/api/get`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('从云端获取数据失败');
    }

    const cloudData = await response.json();
    return cloudData;
  } catch (error) {
    throw new Error(error.message);
  }
}

// 导出数据
function exportData() {
  const data = getLocalStorageData();
  const dataStr = JSON.stringify(data);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nav_data_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// 导入数据
function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.navList || !Array.isArray(data.navList)) {
          reject(new Error('文件格式不正确'));
          return;
        }
        setIconsToStorage(data).then(() => resolve(data));
      } catch (error) {
        reject(new Error('文件格式不正确'));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ==========================
// 视图渲染模块 (render.js)
// ==========================

// 全局变量
let dragTimer = null;
let isDraggingEnabled = false;
let currentDraggedElement = null;
// 移动端触摸状态
let touchStartTime = 0;
let isTouchDragReady = false;
// 拖拽延迟时间（毫秒）
const DRAG_DELAY = 200;

// 页面DOM元素初始化
let container, iconWrap1, iconWrap2;

// 初始化页面DOM结构
function initPageStructure() {
  container = document.getElementById('icon-container');
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

// 渲染图标
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
    // 2级兜底渲染：Base64 → 文字
    if (item.iconBase64 && item.iconBase64.trim()) {
      const img = document.createElement('img');
      img.alt = item.alt;
      img.src = item.iconBase64;
      // 图标加载失败时兜底文字
      img.onerror = () => {
        iconDiv.removeChild(img);
        const altText = document.createElement('span');
        altText.textContent = item.alt;
        altText.style.color = 'white';
        altText.style.fontSize = '14px';
        altText.style.fontWeight = 'bold';
        altText.style.textAlign = 'center';
        altText.style.overflow = 'hidden';
        altText.style.textOverflow = 'ellipsis';
        altText.style.whiteSpace = 'nowrap';
        altText.style.width = '100%';
        // 添加文字阴影，解决白色背景下文字不可见问题
        altText.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
        iconDiv.appendChild(altText);
      };
      iconDiv.appendChild(img);
    } else {
      // 兜底文字：显示完整alt内容
      const altText = document.createElement('span');
      altText.textContent = item.alt;
      altText.style.color = 'white';
      altText.style.fontSize = '14px';
      altText.style.fontWeight = 'bold';
      altText.style.textAlign = 'center';
      altText.style.overflow = 'hidden';
      altText.style.textOverflow = 'ellipsis';
      altText.style.whiteSpace = 'nowrap';
      altText.style.width = '100%';
      // 添加文字阴影，解决白色背景下文字不可见问题
      altText.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
      iconDiv.appendChild(altText);
    };
    const iconName = document.createElement('div');
    iconName.className = 'icon-name';
    iconName.textContent = item.name;
    
    // 桌面端点击跳转
    iconItem.onclick = (e) => {
      if (e.target.closest('.right-click-menu') || isDraggingEnabled) return;
      if (item.url && item.url.trim().startsWith('http')) {
        window.open(item.url, '_self');
      } else {
        showToast('图标URL无效！', 'error');
      }
    };

    // 统一处理开始事件（鼠标+触摸）
    function handleStart(e) {
      // 右键或多点触摸不触发
      if (e.button === 2 || (e.type === 'touchstart' && e.touches.length > 1)) return;

      currentDraggedElement = iconItem;
      iconDiv.classList.add('waiting');

      touchStartTime = e.timeStamp;
      isTouchDragReady = false;

      dragTimer = setTimeout(() => {
        isDraggingEnabled = true;
        isTouchDragReady = true; // 移动端标记已准备好拖拽
        iconItem.style.cursor = 'grabbing';
        iconItem.classList.add('shaking');
        showToast('可以拖拽了', 'info');
      }, DRAG_DELAY);
    }

    // 绑定事件：桌面端mousedown + 移动端touchstart
    iconDiv.addEventListener('mousedown', handleStart);
    iconDiv.addEventListener('touchstart', handleStart);

    // 触摸移动事件（移动端）
    iconDiv.addEventListener('touchmove', (e) => {
      if (isTouchDragReady) {
        e.preventDefault(); // 仅拖拽时阻止滚动，不影响点击
      }
    });

    // 结束事件（鼠标+触摸）：区分点击和拖拽
    function handleEnd(e) {
      clearTimeout(dragTimer);
      if (currentDraggedElement) {
        currentDraggedElement.querySelector('.icon').classList.remove('waiting');
        currentDraggedElement.style.cursor = 'grab';
        currentDraggedElement.classList.remove('shaking');
      }

      // 关键：判断是点击（短按）还是拖拽（长按）
      const touchDuration = e.timeStamp - touchStartTime;
      if (touchDuration < DRAG_DELAY && !isDraggingEnabled && e.type === 'touchend') {
        // 移动端短按：执行跳转
        if (item.url && item.url.trim().startsWith('http')) {
          window.open(item.url, '_self');
        } else {
          showToast('图标URL无效！', 'error');
        }
      }

      // 重置所有状态
      isDraggingEnabled = false;
      isTouchDragReady = false;
      currentDraggedElement = null;
      touchStartTime = 0;
    }

    // 绑定结束事件
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd); // 意外中断（如来电）

    // 鼠标移出重置
    iconItem.addEventListener('mouseleave', () => {
      if (!isDraggingEnabled) {
        clearTimeout(dragTimer);
        if (currentDraggedElement) {
          currentDraggedElement.querySelector('.icon').classList.remove('waiting');
          currentDraggedElement.classList.remove('shaking');
        }
      }
    });

    // 右键菜单部分
    const rightMenu = createRightClickMenu(columnKey, idx, item);
    iconItem.appendChild(rightMenu);
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

    iconItem.appendChild(iconDiv);
    iconItem.appendChild(iconName);
    iconWrap.appendChild(iconItem);
  });
}

// 占位图标检查：双栏独立，每栏无真实图标时显示占位
function checkPlaceholders(navList) {
  const col1RealIcons = navList.filter(icon => icon.k === 1 && !icon.isPlaceholder);
  const col2RealIcons = navList.filter(icon => icon.k === 2 && !icon.isPlaceholder);

  // 上栏占位
  const existingPlaceholder1 = document.querySelector('#placeholder1');
  if (col1RealIcons.length === 0 && !existingPlaceholder1) {
    const placeholder = createPlaceholder(1);
    iconWrap1.appendChild(placeholder);
  } else if (col1RealIcons.length > 0 && existingPlaceholder1) {
    existingPlaceholder1.remove();
  }

  // 下栏占位
  const existingPlaceholder2 = document.querySelector('#placeholder2');
  if (col2RealIcons.length === 0 && !existingPlaceholder2) {
    const placeholder = createPlaceholder(2);
    iconWrap2.appendChild(placeholder);
  } else if (col2RealIcons.length > 0 && existingPlaceholder2) {
    existingPlaceholder2.remove();
  }
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
  const plusText = document.createElement('span');
  plusText.textContent = '+';
  plusText.style.color = 'white';
  plusText.style.fontSize = '20px';
  plusText.style.fontWeight = 'bold';
  plusText.style.textAlign = 'center';
  iconDiv.appendChild(plusText);

  const iconName = document.createElement('div');
  iconName.className = 'icon-name';
  iconName.textContent = k === 1 ? '上栏占位' : '下栏占位';

  placeholder.appendChild(iconDiv);
  placeholder.appendChild(iconName);

  // 绑定右键菜单（和真实图标一样，但隐藏删除）
  const rightMenu = createRightClickMenu(k, -1, { k, isPlaceholder: true });
  placeholder.appendChild(rightMenu);
  placeholder.oncontextmenu = (e) => {
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

  return placeholder;
}

// 右键菜单创建
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
    openAddModal(item.k || 1); // 占位图标用其k值
  };

  const delLi = document.createElement('li');
  delLi.textContent = '删除图标';
  delLi.onclick = () => {
    menu.classList.remove('show');
    window.currentOptData = { type: 'delete', targetCol: columnKey, index: idx, data: item };
    openDeleteModal();
  };

  const importLi = document.createElement('li');
  importLi.textContent = '导入数据到本地';
  importLi.onclick = () => {
    menu.classList.remove('show');
    window.importExportTargetCol = columnKey;
    document.getElementById('fileInput').click();
  };

  const exportLi = document.createElement('li');
  exportLi.textContent = '从本地导出数据';
  exportLi.onclick = () => {
    menu.classList.remove('show');
    window.importExportTargetCol = columnKey;
    exportData();
    window.importExportTargetCol = null;
  };

  const uploadLi = document.createElement('li');
  uploadLi.textContent = '本地数据覆盖云端';
  uploadLi.onclick = () => {
    menu.classList.remove('show');
    manualUpload();
  };

  const downloadLi = document.createElement('li');
  downloadLi.textContent = '云端数据覆盖本地';
  downloadLi.onclick = () => {
    menu.classList.remove('show');
    manualDownload();
  };

  const initKVLi = document.createElement('li');
  initKVLi.textContent = '初始化云端数据';
  initKVLi.onclick = () => {
    menu.classList.remove('show');
    initCloudKV();
  };

  menu.appendChild(editLi);
  menu.appendChild(addLi);
  if (!item.isPlaceholder) menu.appendChild(delLi); // 占位图标不显示删除
  menu.appendChild(importLi);
  menu.appendChild(exportLi);
  menu.appendChild(uploadLi);
  menu.appendChild(downloadLi);
  menu.appendChild(initKVLi);

  document.addEventListener('click', () => {
    if (!event.target.closest('.icon-item')) menu.classList.remove('show');
  });
  return menu;
}

// 初始化图标
async function initIcons() {
  const data = await getIconsFromStorage();
  const navList = data.navList || [];

  // 过滤上栏和下栏图标
  const col1Icons = navList.filter(icon => icon.k === 1);
  const col2Icons = navList.filter(icon => icon.k === 2);

  // 渲染图标
  renderIcons(iconWrap1, col1Icons, 1);
  renderIcons(iconWrap2, col2Icons, 2);

  // 检查占位符
  checkPlaceholders(navList);

  // 初始化拖拽功能
  initCrossColumnSortable();
}

// 初始化跨列拖拽排序
function initCrossColumnSortable() {
  const sortableConfig = {
    group: 'nav-icons-group',
    animation: 150,
    ghostClass: 'ghost',
    dragClass: 'dragging',
    handle: '.icon',
    forceFallback: true,
    fallbackClass: 'dragging',
    delay: 500,
    onStart: (evt) => {
      evt.item.classList.add('shaking');
    },
    onEnd: (evt) => {
      evt.item.classList.remove('shaking');
      const fromWrap = evt.from;
      const toWrap = evt.to;
      const fromK = fromWrap === iconWrap1 ? 1 : 2;
      const toK = toWrap === iconWrap1 ? 1 : 2;
      const getIconsFromDom = (wrap) => {
        return [...wrap.querySelectorAll('.icon-item')].map(item => {
          return JSON.parse(item.dataset.iconData);
        }).filter(icon => !icon.isPlaceholder); // 过滤占位图标
      };
      const data = getLocalStorageData();
      if (fromK === toK) {
        const newIcons = getIconsFromDom(toWrap);
        // 更新navList中对应k的图标
        data.navList = data.navList.filter(icon => icon.k !== toK).concat(newIcons.map(icon => ({ ...icon, k: toK })));
        setIconsToStorage(data);
        showToast('同栏排序成功！', 'success');
      } else {
        const fromNewIcons = getIconsFromDom(fromWrap);
        const toNewIcons = getIconsFromDom(toWrap);
        // 更新navList
        data.navList = data.navList.filter(icon => icon.k !== fromK && icon.k !== toK)
          .concat(fromNewIcons.map(icon => ({ ...icon, k: fromK })))
          .concat(toNewIcons.map(icon => ({ ...icon, k: toK })));
        setIconsToStorage(data);
        showToast('跨栏排序成功！', 'success');
      }
      refreshIconsRender();
    }
  };
  new Sortable(iconWrap1, sortableConfig);
  new Sortable(iconWrap2, sortableConfig);
}

// 刷新图标渲染
async function refreshIconsRender() {
  const data = await getIconsFromStorage();
  const col1Data = data.navList.filter(icon => icon.k === 1);
  const col2Data = data.navList.filter(icon => icon.k === 2);
  renderIcons(iconWrap1, col1Data, 1);
  renderIcons(iconWrap2, col2Data, 2);
  checkPlaceholders(data.navList);
  initCrossColumnSortable();
}

// 打开添加模态框
function openAddModal(k = 1) {
  window.currentOptData = { type: 'add', targetCol: 'nav_data', index: -1, data: { k } };
  openEditModal();
}

// 打开编辑模态框
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
      iconInput.value = ''; // 清空图标路径，不再保存到JSON

      // 如果有Base64数据，显示预览
      if (data.iconBase64) {
        window.uploadedBase64 = data.iconBase64;
        
        // 更新两个预览
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
    
    // 移除之前的事件监听器，避免累积
    urlInput.replaceWith(urlInput.cloneNode(true));
    altInput.replaceWith(altInput.cloneNode(true));
    colorPicker.replaceWith(colorPicker.cloneNode(true));
    iconInput.replaceWith(iconInput.cloneNode(true));
    
    // 重新获取DOM元素
    const newUrlInput = document.getElementById('urlInput');
    const newNameInput = document.getElementById('nameInput');
    const newAltInput = document.getElementById('altInput');
    const newColorPicker = document.getElementById('colorPicker');
    const newIconInput = document.getElementById('iconInput');
    
    // 打开模态框后，自动将焦点设置到网站地址输入框
    newUrlInput.focus();
    
    // 添加URL输入框回车键事件处理
    if (newUrlInput && newNameInput && newAltInput) {
      newUrlInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const url = newUrlInput.value.trim();
          if (!url) return;
          
          // 补全URL前缀
          const fullUrl = fixUrlPrefix(url);
          newUrlInput.value = fullUrl;
          
          // 只有当网站名称为空时才提取标题
          if (!newNameInput.value.trim()) {
            try {
              // 显示加载状态
              showToast('正在提取网站标题...', 'info');
              
              // 由于跨域限制，我们无法直接获取HTML内容
              // 这里使用URL的主机名作为网站标题的替代方案
              const urlObj = new URL(fullUrl);
              let title = urlObj.hostname;
              
              // 移除www.前缀
              if (title.startsWith('www.')) {
                title = title.slice(4);
              }
              
              // 移除域名后缀
              const domainParts = title.split('.');
              if (domainParts.length > 1) {
                title = domainParts[0];
              }
              
              // 将首字母大写
              title = title.charAt(0).toUpperCase() + title.slice(1);
              
              // 填充网站名称
              newNameInput.value = title;
              
              // 尝试自动获取网站的favicon图标
              await tryGetFavicon(fullUrl);
              
              // 实时更新预览
              updatePreviews();
              
              showToast('网站标题提取成功！', 'success');
            } catch (error) {
              console.error('提取网站标题失败:', error);
              showToast('网站标题提取失败，使用域名作为默认名称', 'warning');
              
              // 使用URL的主机名作为网站标题的替代方案
              const urlObj = new URL(fullUrl);
              let title = urlObj.hostname;
              
              // 移除www.前缀
              if (title.startsWith('www.')) {
                title = title.slice(4);
              }
              
              // 移除域名后缀
              const domainParts = title.split('.');
              if (domainParts.length > 1) {
                title = domainParts[0];
              }
              
              // 将首字母大写
              title = title.charAt(0).toUpperCase() + title.slice(1);
              
              // 填充网站名称
              newNameInput.value = title;
              
              // 尝试自动获取网站的favicon图标
              await tryGetFavicon(fullUrl);
              
              // 实时更新预览
              updatePreviews();
            }
          }
          
          // 将光标移动到网站名称输入框
          newNameInput.focus();
        }
      });
    };
    
    // 添加事件监听器，实时更新文字预览
    function updateTextPreview() {
      const altText = newAltInput.value.trim();
      const textPreview = document.getElementById('textPreview');
      const textPreviewIcon = document.getElementById('textPreviewIcon');
      const previewIcon = document.getElementById('previewIcon');
      const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
      
      if (textPreview) {
        textPreview.textContent = altText;
        textPreview.style.overflow = 'hidden';
        textPreview.style.textOverflow = 'ellipsis';
        textPreview.style.whiteSpace = 'nowrap';
        // 添加文字阴影，解决白色背景下文字不可见问题
        textPreview.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
      }
      
      const bgColor = newColorPicker.value;
      
      if (textPreviewIcon) {
        textPreviewIcon.style.backgroundColor = bgColor;
      }
      
      // 同时更新图片预览的背景色
      if (previewIcon) {
        previewIcon.style.backgroundColor = bgColor;
      }
      
      // 同时更新占位符的背景色
      if (imagePreviewPlaceholder) {
        imagePreviewPlaceholder.style.backgroundColor = bgColor;
        // 确保占位符的背景色能显示出来
        imagePreviewPlaceholder.style.background = `${bgColor} url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="50%" y="50%" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" dy=".3em" fill="white">+</text></svg>') center center no-repeat`;
      }
    }
    
    // 调用一次updateTextPreview初始化文字预览
    updateTextPreview();
    
    // 初始化选中状态
    updatePreviewSelection();
    
    // 监听alt输入变化
    newAltInput.addEventListener('input', updateTextPreview);
    // 监听背景色变化
    newColorPicker.addEventListener('input', updateTextPreview);
    // 添加图标路径实时预览功能
    // 注意：图标路径仅用于预览，不会保存到JSON文件
    newIconInput.addEventListener('input', function() {
      const iconPath = this.value.trim();
      if (iconPath) {
        // 使用fixUrlPrefix函数补全路径前缀
        const fullPath = fixUrlPrefix(iconPath);
        window.uploadedBase64 = null; // 清空Base64，使用URL预览
        
        // 更新两个预览
        updatePreviews();
      } else {
        clearUpload();
      }
    });
    
    // 移除双击删除功能，改为通过点击文字预览项删除
    const previewImgElement = document.getElementById('previewImg');
    if (previewImgElement) {
      // 移除双击事件监听
      previewImgElement.replaceWith(previewImgElement.cloneNode(true));
    };
    
    // 添加网站名称输入框回车键事件处理
    if (newNameInput && newAltInput) {
      newNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          // 只有当Alt文本为空时才自动填充，避免覆盖用户已修改的内容
          if (!newAltInput.value.trim()) {
            newAltInput.value = newNameInput.value.trim();
            // 实时更新预览
            updatePreviews();
          }
          
          // 如果按的是Enter键，阻止默认行为并将光标移动到Alt输入框
          if (e.key === 'Enter') {
            e.preventDefault();
            newAltInput.focus();
          }
          // Tab键会自动跳转到下一个输入框，不需要额外处理
        }
      });
    }
    
    // 添加Alt输入框回车键事件处理
    if (newAltInput && newColorPicker) {
      newAltInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          newColorPicker.focus();
        }
      });
    };

  modal.style.display = 'flex';
  initColorPresets();
}

// 更新预览选中状态
function updatePreviewSelection() {
  const textPreviewItem = document.getElementById('textPreviewItem');
  const imagePreviewItem = document.getElementById('imagePreviewItem');
  const hasImage = window.uploadedBase64;
  
  if (textPreviewItem && imagePreviewItem) {
    // 移除之前的选中状态
    textPreviewItem.classList.remove('selected');
    imagePreviewItem.classList.remove('selected');
    
    // 设置当前选中状态
    if (hasImage) {
      imagePreviewItem.classList.add('selected');
    } else {
      textPreviewItem.classList.add('selected');
    }
  }
}

// 尝试获取网站的favicon图标
async function tryGetFavicon(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // 使用Google的favicon服务，它支持跨域访问
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    
    // 尝试加载Google提供的favicon
    try {
      // 使用Image对象尝试加载favicon
      const img = new Image();
      
      // 设置超时
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load favicon from Google'));
        img.onabort = () => reject(new Error('Favicon load aborted'));
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Favicon load timeout')), 2000);
      });
      
      img.src = googleFaviconUrl;
      
      // 等待加载完成或超时
      const loadedImg = await Promise.race([loadPromise, timeoutPromise]);
      
      // 将图片转换为Base64
      const base64 = await imageToBase64(loadedImg);
      
      // 保存到全局变量
      window.uploadedBase64 = base64;
      
      return; // 成功获取favicon
    } catch (error) {
      console.warn(`Failed to load favicon from Google: ${error.message}`);
      
      // 如果Google的服务不可用，尝试使用直接链接
      const domainUrl = urlObj.origin;
      const directFaviconUrl = `${domainUrl}/favicon.ico`;
      
      const img = new Image();
      
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load direct favicon'));
        img.onabort = () => reject(new Error('Direct favicon load aborted'));
      });
      
      img.src = directFaviconUrl;
      
      try {
        const loadedImg = await Promise.race([loadPromise, timeoutPromise]);
        const base64 = await imageToBase64(loadedImg);
        window.uploadedBase64 = base64;
      } catch (directError) {
        console.warn(`Failed to load direct favicon: ${directError.message}`);
      }
    }
  } catch (error) {
    // 忽略所有favicon获取错误，不影响其他功能
    console.warn(`Error getting favicon: ${error.message}`);
  }
}

// 将Image对象转换为Base64格式
function imageToBase64(img) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // 将画布内容转换为Base64
    const base64 = canvas.toDataURL('image/png');
    resolve(base64);
  });
}

// 更新预览函数
function updatePreviews() {
  const previewImg = document.getElementById('previewImg');
  const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
  const textPreview = document.getElementById('textPreview');
  const textPreviewIcon = document.getElementById('textPreviewIcon');
  const previewIcon = document.getElementById('previewIcon');
  const colorPicker = document.getElementById('colorPicker');
  const altInput = document.getElementById('altInput');
  
  if (previewImg && imagePreviewPlaceholder) {
    // 设置预览图片
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
  
  // 设置文字预览（显示完整alt内容）
  const altText = altInput.value.trim();
  if (textPreview) {
    textPreview.textContent = altText;
    textPreview.style.overflow = 'hidden';
    textPreview.style.textOverflow = 'ellipsis';
    textPreview.style.whiteSpace = 'nowrap';
    // 添加文字阴影，解决白色背景下文字不可见问题
    textPreview.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
  }
  
  // 设置背景色
  const bgColor = colorPicker.value;
  if (previewIcon) {
    previewIcon.style.backgroundColor = bgColor;
  }
  if (textPreviewIcon) {
    textPreviewIcon.style.backgroundColor = bgColor;
  }
  if (imagePreviewPlaceholder) {
    imagePreviewPlaceholder.style.backgroundColor = bgColor;
    // 确保占位符的背景色能显示出来
    imagePreviewPlaceholder.style.background = `${bgColor} url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="50%" y="50%" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" dy=".3em" fill="white">+</text></svg>') center center no-repeat`;
  }
  
  // 更新选中状态
  updatePreviewSelection();
}

// 打开删除模态框
function openDeleteModal() {
  const modal = document.getElementById('deleteModal');
  modal.style.display = 'flex';
  const confirmBtn = document.getElementById('confirmDelBtn');
  confirmBtn.onclick = () => {
    const { targetCol, index, data } = window.currentOptData;
    if (!targetCol) {
      showToast('删除失败：请右键对应模块后再删除！', 'error');
      modal.style.display = 'none';
      return;
    }
    const fullData = getLocalStorageData();
    let deleted = false;
    if (data && data.id) {
      const originLength = fullData.navList.length;
      fullData.navList = fullData.navList.filter(icon => icon.id !== data.id);
      if (fullData.navList.length < originLength) deleted = true;
    }
    if (!deleted && index >= 0 && index < fullData.navList.length) {
      fullData.navList.splice(index, 1);
      deleted = true;
    }
    if (deleted) {
      setIconsToStorage(fullData);
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
  const modal = document.getElementById('iconModal');
  const deleteModal = document.getElementById('deleteModal');
  modal.style.display = 'none';
  deleteModal.style.display = 'none';
  clearUpload();
}



// ==========================
// 主入口模块 (app.js)
// ==========================

// 全局变量
window.currentOptData = { type: 'add', targetCol: 'nav_data', index: -1, data: {} };
window.importExportTargetCol = null;
window.uploadedBase64 = null;

// 重置表单
function resetForm() {
  const urlInput = document.getElementById('urlInput');
  const iconInput = document.getElementById('iconInput');
  const colorPicker = document.getElementById('colorPicker');
  urlInput.value = '';
  document.getElementById('nameInput').value = '';
  colorPicker.value = '#4cafef';
  document.getElementById('altInput').value = '';
  iconInput.value = './icons/';
  clearUpload(); // 清除上传预览
}

// 初始化DOM相关功能
function initDomEvents() {
  // 右键菜单全局屏蔽+仅图标内右键有效
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (!event.target.closest('.icon-item')) {
      document.querySelectorAll('.right-click-menu').forEach(menu => menu.classList.remove('show'));
    }
  });

  // URL自动补全前缀和提取网站标题
  const urlInput = document.getElementById('urlInput');
  const nameInput = document.getElementById('nameInput');
  const altInput = document.getElementById('altInput');
  const colorPicker = document.getElementById('colorPicker');
  if (urlInput) {
    urlInput.addEventListener('blur', () => {
      const url = urlInput.value.trim();
      if (!url) return;
      urlInput.value = fixUrlPrefix(url);
    });
    
    // URL输入框按Enter键时自动提取标题
    urlInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (!url) return;
        
        // 补全URL前缀
        const fullUrl = fixUrlPrefix(url);
        urlInput.value = fullUrl;
        
        // 只有当网站名称为空时才提取标题
        if (!nameInput.value.trim()) {
          try {
            // 显示加载状态
            showToast('正在提取网站标题...', 'info');
            
            // 使用fetch获取网站内容（注意：可能会遇到跨域问题）
            const response = await fetch(fullUrl, {
              mode: 'no-cors',
              redirect: 'follow'
            });
            
            // 由于跨域限制，我们无法直接获取HTML内容
            // 这里使用URL的主机名作为网站标题的替代方案
            const urlObj = new URL(fullUrl);
            let title = urlObj.hostname;
            
            // 移除www.前缀
            if (title.startsWith('www.')) {
              title = title.slice(4);
            }
            
            // 移除域名后缀
            const domainParts = title.split('.');
            if (domainParts.length > 1) {
              title = domainParts[0];
            }
            
            // 将首字母大写
            title = title.charAt(0).toUpperCase() + title.slice(1);
            
            // 填充网站名称
            nameInput.value = title;
            
            // 只有当Alt文本为空时才自动填充
            if (!altInput.value.trim()) {
              altInput.value = title;
              // 实时更新预览
              updatePreviews();
            }
            
            showToast('网站标题提取成功！', 'success');
          } catch (error) {
            console.error('提取网站标题失败:', error);
            showToast('网站标题提取失败，使用域名作为默认名称', 'warning');
            
            // 使用URL的主机名作为网站标题的替代方案
            const urlObj = new URL(fullUrl);
            let title = urlObj.hostname;
            
            // 移除www.前缀
            if (title.startsWith('www.')) {
              title = title.slice(4);
            }
            
            // 移除域名后缀
            const domainParts = title.split('.');
            if (domainParts.length > 1) {
              title = domainParts[0];
            }
            
            // 将首字母大写
            title = title.charAt(0).toUpperCase() + title.slice(1);
            
            // 填充网站名称
            nameInput.value = title;
            
            // 只有当Alt文本为空时才自动填充
            if (!altInput.value.trim()) {
              altInput.value = title;
              // 实时更新预览
              updatePreviews();
            }
          }
        }
        
        // 将光标移动到网站名称输入框
        nameInput.focus();
      }
    });
  }
  
  // 网站名称自动填充到Alt文本（按Enter或Tab键时）
  if (nameInput && altInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        // 只有当Alt文本为空时才自动填充，避免覆盖用户已修改的内容
        if (!altInput.value.trim()) {
          altInput.value = nameInput.value.trim();
          // 实时更新预览
          updatePreviews();
        }
        
        // 如果按的是Enter键，阻止默认行为并将光标移动到Alt输入框
        if (e.key === 'Enter') {
          e.preventDefault();
          altInput.focus();
        }
        // Tab键会自动跳转到下一个输入框，不需要额外处理
      }
    });
  }
  
  // Alt文本变化时实时更新预览
  if (altInput) {
    altInput.addEventListener('input', () => {
      updatePreviews();
    });
    
    // Alt输入框按Enter键时跳转到下一个输入框（颜色选择器）
    altInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        colorPicker.focus();
      }
    });
  }
}

// 提交图标表单
async function submitIcon() {
  const urlInput = document.getElementById('urlInput');
  const iconInput = document.getElementById('iconInput');
  const colorPicker = document.getElementById('colorPicker');
  
  const url = urlInput.value.trim();
  const name = document.getElementById('nameInput').value.trim();
  const backgroundColor = colorPicker.value;
  const alt = document.getElementById('altInput').value.trim();
  const iconPath = iconInput.value.trim();
  
  if (!url || !name || !alt) {
    showToast('请填写所有必填项！', 'error');
    return;
  }
  
  const fixedUrl = fixUrlPrefix(url);
  // 只保留7个key的结构，value可以为空
  const newIcon = {
    id: window.currentOptData.type === 'edit' && window.currentOptData.data.id ? window.currentOptData.data.id : `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`,
    k: window.currentOptData.data.k || 1, // 新增k字段
    name,
    url: fixedUrl,
    alt,
    backgroundColor,
    iconBase64: window.uploadedBase64 || null  // 保留Base64字段，为空则为null
  };
  
  const data = await getIconsFromStorage();
  if (window.currentOptData.type === 'add') {
    data.navList.push(newIcon);
  } else {
    const editIdx = data.navList.findIndex(icon => icon.id === newIcon.id);
    if (editIdx >= 0) {
      data.navList[editIdx] = newIcon;
    } else {
      data.navList[window.currentOptData.index] = newIcon;
    }
  }
  
  // 保存数据到KV
  const success = await setIconsToStorage(data);
  
  if (success) {
    if (window.currentOptData.type === 'add') {
      showToast(`${newIcon.k === 1 ? '上栏' : '下栏'}图标添加成功！`, 'success');
    } else {
      showToast('图标修改成功！', 'success');
    }
    await refreshIconsRender();
    closeModal();
  } else {
    showToast('图标保存失败，权限不足！', 'error');
  }
}

// 处理文件导入
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) {
    showToast('导入失败：请选择文件！', 'error');
    event.target.value = '';
    return;
  }
  
  importData(file)
    .then(async (fullData) => {
      await refreshIconsRender();
      showToast('数据导入成功！', 'success');
    })
    .catch((error) => {
      showToast('导入失败：文件格式不正确', 'error');
    })
    .finally(() => {
      event.target.value = '';
    });
}

// 手动上传到云端
function manualUpload() {
  showToast('正在上传到云端...', 'info');
  manualUploadToCloud()
    .then(async (result) => {
      if (result && result.success) {
        showToast('✅ 手动上传成功！数据已保存到云端KV', 'success');
      } else {
        showToast('❌ 手动上传失败：' + (result.error || '未知错误'), 'error');
      }
    })
    .catch(async (error) => {
      showToast('❌ 手动上传失败：' + error.message, 'error');
    });
}

// 手动从云端下载
function manualDownload() {
  showToast('正在从云端下载...', 'info');
  manualDownloadFromCloud()
    .then(async (cloudData) => {
      // 保存到本地存储
      await setIconsToStorage(cloudData);
      await refreshIconsRender();
      showToast('手动下载成功！', 'success');
    })
    .catch(async (error) => {
      showToast('手动下载失败：' + error.message, 'error');
    });
}

// 初始化云端KV：将pages中的json文件复制到KV空间
async function initCloudKV() {
  try {
    showToast('正在初始化云端KV...', 'info');
    
    // 从本地静态文件加载数据
    const response = await fetch('./nav_data.json');
    if (!response.ok) {
      throw new Error('无法加载本地nav_data.json文件');
    }
    
    const pageData = await response.json();
    
    // 处理数据，确保只有7个key的结构
    const processedData = {
      navList: (pageData.navList || []).map(icon => ({
        id: icon.id || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`,
        k: icon.k || 1,
        name: icon.name || '',
        url: icon.url || '',
        alt: icon.alt || '',
        backgroundColor: icon.backgroundColor || '#4cafef',
        iconBase64: icon.iconBase64 || null
      })),
      operateLog: []
    };
    
    // 将处理后的数据上传到KV存储
    const result = await manualUploadToCloud(processedData);
    
    if (result.success) {
      showToast('云端KV初始化成功！', 'success');
    } else {
      showToast('云端KV初始化失败：' + result.message, 'error');
    }
  } catch (error) {
    console.error('初始化云端KV失败:', error);
    showToast('云端KV初始化失败：' + error.message, 'error');
  }
}

// 初始化上传功能
function initDragUpload() {
  const dragArea = document.getElementById('dragUploadArea');
  const fileInput = document.getElementById('fileUploadInput');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const textPreviewItem = document.getElementById('textPreviewItem');
  const imagePreviewItem = document.getElementById('imagePreviewItem');
  
  if (!dragArea || !fileInput) return;
  
  // 初始化选中状态
  updatePreviewSelection();
  
  // 文件选择处理
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await handleFileUpload(file);
      updatePreviewSelection();
    }
  });
  
  // 点击图片预览占位符上传
  if (imagePreviewContainer) {
    imagePreviewContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }
  
  // 点击文字预览项切换到文字预览（清除图片）
  if (textPreviewItem) {
    textPreviewItem.addEventListener('click', () => {
      // 点击文字预览项时，清除图片预览，切换到文字预览
      window.uploadedBase64 = null;
      clearUpload();
      updatePreviewSelection();
    });
  }
  
  // 点击图片预览项触发上传
  if (imagePreviewItem) {
    imagePreviewItem.addEventListener('click', () => {
      // 点击图片预览项时，只触发上传，不改变选中状态
      fileInput.click();
    });
  }
}

// 处理文件上传
async function handleFileUpload(file) {
  // 检查文件类型
  if (!checkFileType(file)) {
    showToast('不支持的文件格式，请选择图片文件', 'error');
    return;
  }
  
  // 检查文件大小（限制为2MB）
  if (!checkFileSize(file)) {
    showToast('文件大小超过2MB，请选择较小的图片', 'error');
    return;
  }
  
  try {
    const base64 = await fileToBase64(file);
    window.uploadedBase64 = base64;
    
    // 更新两个预览
    updatePreviews();
    
    showToast('图片上传成功！', 'success');
  } catch (error) {
    showToast('文件读取失败', 'error');
  }
}

// 将函数暴露到全局，供HTML中的事件调用
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.closeModal = closeModal;
window.submitIcon = submitIcon;
window.handleFileImport = handleFileImport;
window.exportData = exportData;
window.manualUpload = manualUpload;
window.manualDownload = manualDownload;
window.initColorPresets = initColorPresets;
window.clearUpload = clearUpload;

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('开始完整初始化流程...');
    
    // 初始化DOM事件
    initDomEvents();
    
    // 初始化页面结构
    initPageStructure();
    
    // 初始化颜色预设
    initColorPresets();
    
    // 添加清除缓存按钮事件
    // 先加载Base64数据
    await loadBase64DataIfNeeded();
    
    // 然后初始化图标
    await initIcons();
    
    // 初始化拖拽上传功能
    initDragUpload();
    
    // 初始化搜索功能
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
      console.log('初始化搜索功能成功');
      baiduButton.addEventListener('click', () => performSearch('https://www.baidu.com/s?wd=', searchInput.value));
      googleButton.addEventListener('click', () => performSearch('https://www.google.com/search?q=', searchInput.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          performSearch('https://www.baidu.com/s?wd=', searchInput.value);
        }
      });
    } else {
      console.warn('搜索相关元素未找到，搜索功能初始化失败');
    }
    
    console.log('完整初始化流程完成');
  } catch (error) {
    console.error('初始化失败:', error);
    showToast('应用初始化失败，请刷新页面重试', 'error');
  }
});