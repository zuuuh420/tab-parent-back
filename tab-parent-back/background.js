const openerMap = new Map();

const ENABLED_ICONS = {
  16: "icons/icon16.png",
  32: "icons/icon32.png",
  48: "icons/icon48.png",
  128: "icons/icon128.png"
};

const DISABLED_ICONS = {
  16: "icons/icon16_disabled.png",
  32: "icons/icon32_disabled.png",
  48: "icons/icon48_disabled.png",
  128: "icons/icon128_disabled.png"
};

function hasParent(tabId) {
  return openerMap.has(tabId);
}

async function updateActionForTab(tabId) {
  if (typeof tabId !== "number") return;

  const enabled = hasParent(tabId);

  await chrome.action.setIcon({
    tabId,
    path: enabled ? ENABLED_ICONS : DISABLED_ICONS
  });

  await chrome.action.setTitle({
    tabId,
    title: enabled ? "返回来源标签页" : "当前标签页没有可返回的来源标签页"
  });
}

// 记录新标签页的来源标签页
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId !== undefined && tab.openerTabId !== null) {
    openerMap.set(tab.id, tab.openerTabId);
    updateActionForTab(tab.id);
  } else {
    updateActionForTab(tab.id);
  }
});

// 有些场景标签页更新后才能拿到更稳定的信息
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.openerTabId !== undefined && tab.openerTabId !== null) {
    openerMap.set(tabId, tab.openerTabId);
  }

  updateActionForTab(tabId);
});

// 切换到某个标签页时，刷新它的图标状态
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateActionForTab(activeInfo.tabId);
});

// 窗口焦点变化时，也顺手刷新当前激活标签页
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  const tabs = await chrome.tabs.query({ active: true, windowId });
  if (tabs.length > 0) {
    updateActionForTab(tabs[0].id);
  }
});

// 关闭标签页时清理记录
chrome.tabs.onRemoved.addListener((tabId) => {
  openerMap.delete(tabId);

  for (const [childId, parentId] of openerMap.entries()) {
    if (parentId === tabId) {
      openerMap.delete(childId);
    }
  }
});

// 点击扩展图标：切回来源标签页，并关闭当前标签页
chrome.action.onClicked.addListener(async (currentTab) => {
  const parentTabId = openerMap.get(currentTab.id);

  if (!parentTabId) {
    await updateActionForTab(currentTab.id);
    return;
  }

  try {
    await chrome.tabs.update(parentTabId, { active: true });
    await chrome.tabs.remove(currentTab.id);
  } catch (e) {
    console.error("无法返回来源标签页：", e);
  }
});

// 扩展启动时，给当前所有标签页初始化一次图标状态
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    updateActionForTab(tab.id);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    updateActionForTab(tab.id);
  }
});
