// popup.js
document.addEventListener('DOMContentLoaded', function() {
  let cachedPreferences = null;

  // 一次性加载所有数据
  chrome.runtime.sendMessage({ action: 'getPreferences' }, function(response) {
    if (response && response.preferences) {
      cachedPreferences = response.preferences;
      const prefs = response.preferences;
      document.getElementById('enabled').checked = prefs.enabled;
      document.getElementById('language').value = prefs.language;
      document.getElementById('theme').value = prefs.theme;
      document.getElementById('maxPoemLines').value = String(prefs.maxPoemLines);
      document.getElementById('showNextButton').checked = prefs.showNextButton !== false;
      document.getElementById('contentMode').value = prefs.contentMode || 'mix';
	      document.getElementById('fontFamily').value = prefs.fontFamily || 'auto';

      // 获取当前标签页信息（依赖 cachedPreferences）
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url) {
          const hostname = new URL(currentTab.url).hostname;

          // 检查当前站点是否已被排除（精确匹配）
          const isExcluded = prefs.excludedSites.some(
            p => hostname === p || hostname.endsWith('.' + p)
          );
          if (isExcluded) {
            document.getElementById('excludeSite').textContent = '✅ 已排除此网站（点击恢复）';
          }

          // 排除/恢复当前网站
          document.getElementById('excludeSite').addEventListener('click', function() {
            let excluded = cachedPreferences ? [...cachedPreferences.excludedSites] : [];
            const existing = excluded.findIndex(p => hostname === p || hostname.endsWith('.' + p));
            if (existing >= 0) {
              excluded.splice(existing, 1);
              document.getElementById('excludeSite').textContent = '🚫 排除当前网站';
            } else {
              excluded.push(hostname);
              document.getElementById('excludeSite').textContent = '✅ 已排除此网站（点击恢复）';
            }
            chrome.runtime.sendMessage({
              action: 'setPreferences',
              preferences: { excludedSites: excluded }
            });
            if (cachedPreferences) cachedPreferences.excludedSites = excluded;
          });
        }
      });
    }
  });

  // 加载统计数据
  chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
    if (response && response.stats) {
      document.getElementById('statsCount').textContent = response.stats.poemsDisplayed;
    }
  });

  // 加载缓存和文摘状态
  chrome.runtime.sendMessage({ action: 'healthCheck' }, function(response) {
    if (response) {
      document.getElementById('poemCount').textContent = response.poemCount || 0;
      document.getElementById('excerptCount').textContent = response.excerptCount || 0;
      var excerptStatusEl = document.getElementById('excerptStatus');
      if (excerptStatusEl) {
        if (response.onlineExcerptsLoaded) {
          excerptStatusEl.textContent = '✅ 在线文摘已加载 (' + (response.excerptCount || 0) + ' 条)';
          excerptStatusEl.style.color = '#4a7c59';
        } else if (response.onlineExcerptsLoading) {
          excerptStatusEl.textContent = '⏳ 在线文摘加载中...';
          excerptStatusEl.style.color = '#b8860b';
        } else {
          excerptStatusEl.textContent = 'ℹ️ 仅本地文摘 (' + (response.excerptCount || 0) + ' 条)';
          excerptStatusEl.style.color = '#888';
        }
      }
    }
  });

  // 刷新按钮
  document.getElementById('refreshBtn').addEventListener('click', function() {
    this.textContent = '刷新中...';
    chrome.runtime.sendMessage({ action: 'healthCheck' }, function(response) {
      if (response) {
        document.getElementById('poemCount').textContent = response.poemCount || 0;
        document.getElementById('excerptCount').textContent = response.excerptCount || 0;
        var excerptStatusEl = document.getElementById('excerptStatus');
        if (excerptStatusEl) {
          if (response.onlineExcerptsLoaded) {
            excerptStatusEl.textContent = '✅ 在线文摘已加载 (' + (response.excerptCount || 0) + ' 条)';
            excerptStatusEl.style.color = '#4a7c59';
          } else if (response.onlineExcerptsLoading) {
            excerptStatusEl.textContent = '⏳ 在线文摘加载中...';
            excerptStatusEl.style.color = '#b8860b';
          } else {
            excerptStatusEl.textContent = 'ℹ️ 仅本地文摘 (' + (response.excerptCount || 0) + ' 条)';
            excerptStatusEl.style.color = '#888';
          }
        }
      }
      document.getElementById('refreshBtn').textContent = '刷新数据';
    });
  });

  // 保存偏好
  function saveSetting(key, value) {
    const prefs = {};
    prefs[key] = value;
    chrome.runtime.sendMessage({ action: 'setPreferences', preferences: prefs });
    if (cachedPreferences) cachedPreferences[key] = value;
  }

  document.getElementById('enabled').addEventListener('change', function(e) {
    saveSetting('enabled', e.target.checked);
  });

  document.getElementById('language').addEventListener('change', function(e) {
    saveSetting('language', e.target.value);
  });

  document.getElementById('theme').addEventListener('change', function(e) {
    saveSetting('theme', e.target.value);
  });

  document.getElementById('maxPoemLines').addEventListener('change', function(e) {
    saveSetting('maxPoemLines', parseInt(e.target.value, 10));
  });

  document.getElementById('showNextButton').addEventListener('change', function(e) {
    saveSetting('showNextButton', e.target.checked);
  });

  document.getElementById('contentMode').addEventListener('change', function(e) {
    saveSetting('contentMode', e.target.value);
  });

  document.getElementById('fontFamily')?.addEventListener('change', function(e) {
    saveSetting('fontFamily', e.target.value);
  });
});