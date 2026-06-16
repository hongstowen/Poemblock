// content.js — Poemblock Chrome Extension Content Script
// 模块化 IIFE 架构: Detection, Display, UI, Scanner, Diagnostics

const Poemblock = (() => {
  'use strict';

  // ============================================================
  // 私有状态
  // ============================================================
  const MAX_REPLACE_PER_SESSION = 20;
  let replaceCount = 0;

  // ============================================================
  // Diagnostics 模块 — 诊断工具
  // ============================================================
  function diagnosePage() {
  console.log('========== Poemblock 诊断工具 ==========');
  console.log('1. 扫描所有可能的广告元素...');
  
  let foundElements = [];
  
  // 扫描所有常见广告标签
  const allIframes = document.querySelectorAll('iframe');
  console.log('   - 找到 ' + allIframes.length + ' 个 iframe');
  allIframes.forEach((iframe, i) => {
    console.log('     iframe[' + i + ']: src=' + iframe.src + ', class=' + iframe.className + ', id=' + iframe.id);
  });
  
  // 扫描所有包含广告关键词的元素
  const selectors = [
    '[class*="ad" i]', '[id*="ad" i]',
    '[class*="banner" i]', '[id*="banner" i]',
    '[class*="sponsor" i]', '[id*="sponsor" i]',
    'ins', 'aside'
  ];
  
  selectors.forEach(sel => {
    try {
      const elements = document.querySelectorAll(sel);
      console.log('   - 选择器 "' + sel + '" 找到 ' + elements.length + ' 个元素');
      elements.forEach(el => {
        if (!el.closest('[data-poem-processed="true"]')) {
          foundElements.push({
            selector: sel,
            element: el,
            className: el.className,
            id: el.id,
            tagName: el.tagName
          });
        }
      });
    } catch (e) {
      console.warn('   - 选择器 "' + sel + '" 失败:', e);
    }
  });
  
  console.log('2. 对找到的 ' + foundElements.length + ' 个元素运行 isPotentialAd() 检测...');
  let passedElements = [];
  foundElements.forEach(item => {
    try {
      const result = isPotentialAd(item.element);
      if (result) {
        console.log('   ✓ ' + item.tagName + ' ' + (item.id ? '#'+item.id : '') + ' ' + (item.className ? '.'+item.className : '') + ' - 通过检测');
        passedElements.push(item);
      }
    } catch (e) {
      console.warn('   ✗ 检测失败:', item, e);
    }
  });
  
  console.log('3. 通过检测的元素: ' + passedElements.length + ' 个');
  
  if (passedElements.length > 0) {
    console.log('4. 尝试替换第一个通过检测的元素...');
    if (passedElements[0] && passedElements[0].element) {
      try {
        replaceAdWithPoem(passedElements[0].element);
        console.log('   ✓ 替换成功！');
      } catch (e) {
        console.error('   ✗ 替换失败:', e);
      }
    }
  }
  
  console.log('========== 诊断完成 ==========');
  return {
    allIframes: allIframes,
    foundElements: foundElements,
    passedElements: passedElements
  };
}

// 把诊断函数暴露到全局作用域
window.poemblockDiagnose = diagnosePage;

console.log('%c========== Poemblock 已加载 ==========', 'color: green; font-size: 14px; font-weight: bold;');
console.log('在控制台输入 %cpoemblockDiagnose() %c 运行诊断', 'color: blue; font-weight: bold;', 'color: black;');

// ============================================================
// Detection 模块 — 三层广告检测模型
// ============================================================

// Tier 1: 已知广告标记（100% 置信，零误伤）
const KNOWN_AD_SELECTORS = [
  'ins.adsbygoogle',
  'div[id^="google_ads_iframe"]',
  'iframe[id^="google_ads_iframe"]',
  'div[data-google-query-id]',
  'div[id^="div-gpt-ad"]',
  'amp-ad[type="adsense"]',
  '[data-ad-slot]',
  '[data-ad-client]',
  '[data-ad-format]',
  'iframe[src*="doubleclick.net" i]',
  'iframe[src*="googlesyndication" i]',
  'iframe[src*="googleadservices" i]',
  'iframe[src*="pagead2" i]',
  'iframe[src*="ads." i]',
  'iframe[src*="adform" i]',
  'iframe[src*="adnxs" i]',
];

// Tier 2: 精确类名/ID模式（高置信，使用完整词匹配）
const SPECIFIC_AD_SELECTORS = [
  '.ad',          // 精确类 "ad"
  '.ads',         // 精确类 "ads"
  '.adsbygoogle',
  '.advertisement',
  '.google-auto-placed',
  '[class*="ad-container" i]',
  '[class*="adContainer" i]',
  '[class*="ad-unit" i]',
  '[class*="adslot" i]',
  '[class*="ad-slot" i]',
  '[class*="ad-wrapper" i]',
  '[class*="ad-box" i]',
  '[class*="ad-box " i]',
  '[class*="ad-banner" i]',
  '[class*="ad-placeholder" i]',
  '[class*="fixed-ad" i]',
  '[class*="bottom-ad" i]',
  '[class*="sticky-ad" i]',
  '[class*="right-ad" i]',
  '[class*="left-ad" i]',
  '[class*="top-ad" i]',
  '[class*="sidebar-ad" i]',
  '[class*="ad-label" i]',
  '[class*="ad-title" i]',
  '[class*="ad-text" i]',
  '[class*="ad-icon" i]',
  '[class*="ad-image" i]',
  '[class*="ad-div" i]',
  '[class*="ad-list" i]',
  '[class*="ad-item" i]',
  '[class*="ad-link" i]',
  '[class*="ad-code" i]',
  '[class*="ad-section" i]',
  '[class*="ad-wrapper2" i]',
  '[class*="adrow" i]',
  '[class*="adRow" i]',
  '[class*="adInner" i]',
  '[class*="google_ads" i]',
  '[class*="adsense" i]',
  '[class*="banner-ad" i]',
  '[class*="banner_" i]',
  '[class*="sponsor" i]',
  '[class*="sponsored" i]',
  '[class*="promo" i]',
  '[class*="advert" i]',
  '[id*="google_ads" i]',
  '[id*="ad-container" i]',
  '[id*="adslot" i]',
  '[id*="ad-slot" i]',
  '[id*="ad-banner" i]',
  '[id*="ad-wrapper" i]',
  '[id*="ad-box" i]',
];

// ============================================================
// Display 模块 — 主题与配色
// ============================================================

// 获取网页主体颜色以适配（支持深色模式）
function getThemeColor(node, preferredTheme) {
  // 1. 如果用户指定了主题偏好
  if (preferredTheme === 'dark') return '#1a1a2e';
  if (preferredTheme === 'sepia') return '#f5ecd7';

  // 2. 尝试从当前节点的父级获取背景色
  let current = node;
  while (current && current !== document.body) {
    const bg = window.getComputedStyle(current).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      return bg;
    }
    current = current.parentElement;
  }

  // 3. 尝试从 body 获取
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
    return bodyBg;
  }

  // 4. 检测系统深色模式
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return '#1a1a2e';
  }

  // 5. 默认回退色
  return '#ffffff';
}

// 检测页面是否处于深色模式
function isPageDarkMode() {
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
    const rgb = bodyBg.match(/\d+/g);
    if (rgb) {
      const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
      return brightness < 60;
    }
  }
  return false;
}

// 根据主题和背景获取完整配色方案
function getColorScheme(themeColor, preferredTheme) {
  if (preferredTheme === 'dark') {
    return {
      bgColor: '#1a1a2e',
      textColor: '#e0e0e0',
      borderColor: 'rgba(255,255,255,0.1)',
      shadowColor: 'rgba(0,0,0,0.3)',
      hoverBg: '#2d2d44',
      nextBtnBg: 'rgba(255,255,255,0.15)',
      nextBtnColor: '#ccc',
      nextBtnHoverBg: 'rgba(255,255,255,0.25)',
    };
  }
  if (preferredTheme === 'sepia') {
    return {
      bgColor: '#f5ecd7',
      textColor: '#5b4636',
      borderColor: 'rgba(91,70,54,0.15)',
      shadowColor: 'rgba(91,70,54,0.12)',
      hoverBg: '#efe3c9',
      nextBtnBg: 'rgba(255,255,255,0.85)',
      nextBtnColor: '#5b4636',
      nextBtnHoverBg: '#fff',
    };
  }

  const rgb = themeColor.match(/\d+/g);
  let textColor, borderColor, shadowColor;
  if (rgb) {
    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    if (brightness > 180) {
      textColor = '#222'; borderColor = 'rgba(0,0,0,0.1)'; shadowColor = 'rgba(0,0,0,0.12)';
    } else if (brightness > 128) {
      textColor = '#333'; borderColor = 'rgba(0,0,0,0.1)'; shadowColor = 'rgba(0,0,0,0.12)';
    } else if (brightness > 60) {
      textColor = '#ccc'; borderColor = 'rgba(255,255,255,0.1)'; shadowColor = 'rgba(0,0,0,0.3)';
    } else {
      textColor = '#f0f0f0'; borderColor = 'rgba(255,255,255,0.1)'; shadowColor = 'rgba(0,0,0,0.3)';
    }
  } else {
    textColor = '#333'; borderColor = 'rgba(0,0,0,0.1)'; shadowColor = 'rgba(0,0,0,0.12)';
  }
  return {
    bgColor: themeColor, textColor, borderColor, shadowColor,
    hoverBg: null, nextBtnBg: 'rgba(255,255,255,0.85)', nextBtnColor: '#555', nextBtnHoverBg: '#fff',
  };
}

// ============================================================
// Detection 模块 — 安全元素检测 + 广告检测
// ============================================================

// ===== 安全元素检测：绕过非广告页面内容 =====
function isSafeElement(node) {
  try {
    // 语义标签直接跳过
    if (['MAIN', 'NAV', 'ARTICLE', 'HEADER', 'FOOTER'].includes(node.tagName)) {
      return true;
    }
    // 安全ID
    const id = (node.id || '').toLowerCase();
    if (['main', 'content', 'wrapper', 'container', 'page'].includes(id)) {
      return true;
    }
    // 有大量文本内容 → 不是广告
    const text = (node.textContent || '').trim();
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 100) return true;
    // 覆盖大部分视口 → 不是广告
    const r = node.getBoundingClientRect();
    if (r.width >= window.innerWidth * 0.85 && r.height >= window.innerHeight * 0.85) return true;
  } catch (e) {
    // 安全失败：允许检测继续
  }
  return false;
}

// ============================================================
// Scanner 模块 — 智能选诗请求
// ============================================================

// ===== 智能增强：页面语言检测 =====
function detectPageLang() {
  var htmlLang = document.documentElement.lang || '';
  if (/^zh/i.test(htmlLang)) return 'chinese';
  if (/^en/i.test(htmlLang)) return 'english';
  var text = document.body.innerText || '';
  var sample = text.slice(0, 2000);
  var cc = (sample.match(/[一-鿿]/g) || []).length;
  var ew = (sample.match(/[a-zA-Z]+/g) || []).length;
  return (cc > ew * 3) ? 'chinese' : (ew > cc) ? 'english' : 'chinese';
}

// ===== 智能选诗（带页面上下文，带重试机制）=====
function requestSmartPoem(adNode, cb, retryCount) {
  retryCount = retryCount || 0;
  var rect = adNode.getBoundingClientRect();
  chrome.runtime.sendMessage({
    action: 'getPoem',
    lang: detectPageLang(),
    maxLines: Math.max(2, Math.floor(rect.height / 40)),
    minLines: Math.max(1, Math.floor(rect.height / 60)),
    timeMatch: true,
    url: window.location.href,
  }, function(response) {
    // 成功获取响应
    if (response && (response.disabled || !response.poem)) {
      cb({ poem: null, index: -1 });
      return;
    }
    if (response && response.poem) {
      cb(response);
      return;
    }
    // response 为 undefined，消息发送失败，重试最多 5 次（递增延迟）
    // MV3 service worker 可能需要额外时间启动，用递增延迟等待
    if (retryCount < 5) {
      console.log('[Poemblock] 获取诗歌失败，重试第 ' + (retryCount + 1) + ' 次');
      var delay = 500 + retryCount * 300; // 500ms, 800ms, 1100ms, 1400ms, 1700ms
      setTimeout(function() {
        requestSmartPoem(adNode, cb, retryCount + 1);
      }, delay);
    } else {
      console.warn('[Poemblock] 获取诗歌失败，已重试 ' + retryCount + ' 次');
      cb({ poem: null, index: -1 });
    }
  });
}

// ===== 文摘转诗歌格式：保持段落原样，不分行 =====
function excerptToPoem(excerpt) {
  if (!excerpt || !excerpt.text) return null;
  return {
    title: excerpt.author,
    author: excerpt.source || '',
    lines: [excerpt.text],
    source: '',
    _isExcerpt: true,
    _originalText: excerpt.text,
  };
}

// ===== 智能获取内容（诗歌或文摘，统一接口）=====
function requestSmartContent(adNode, cb, retryCount) {
  retryCount = retryCount || 0;
  var rect = adNode.getBoundingClientRect();
  chrome.runtime.sendMessage({
    action: 'getContent',
    lang: detectPageLang(),
    maxLines: Math.max(2, Math.floor(rect.height / 40)),
    minLines: Math.max(1, Math.floor(rect.height / 60)),
    timeMatch: true,
    url: window.location.href,
  }, function(response) {
    if (response && (response.disabled || !response.content || !response.content.data)) {
      cb({ content: null, disabled: true });
      return;
    }
    if (response && response.content) {
      cb(response);
      return;
    }
    if (retryCount < 5) {
      console.log('[Poemblock] 获取内容失败，重试第 ' + (retryCount + 1) + ' 次');
      var delay = 500 + retryCount * 300;
      setTimeout(function() {
        requestSmartContent(adNode, cb, retryCount + 1);
      }, delay);
    } else {
      console.warn('[Poemblock] 获取内容失败，已重试 ' + retryCount + ' 次');
      cb({ content: null });
    }
  });
}

// ============================================================
// UI 模块 — 诗歌显示交互（下一首、关闭、展开/收起）
// ============================================================

// ===== 获取下一首 =====
function requestNextPoem(idx, cb) {
  chrome.runtime.sendMessage({ action: 'getNextPoem', currentIndex: idx }, cb);
}

// ===== 获取下一条文摘 =====
function requestNextExcerpt(idx, cb) {
  chrome.runtime.sendMessage({
    action: 'getNextExcerpt',
    currentExcerptIndex: idx,
    lang: detectPageLang(),
  }, function(response) {
    if (response && response.excerpt) {
      cb({ excerpt: response.excerpt, index: response.index });
    } else {
      cb({ excerpt: null, index: -1 });
    }
  });
}

// ===== 重建诗歌内容（给下一首按钮用）=====
function rebuildPoemDisplay(container, shadowRoot, poemData) {
  // 移除旧内容
  var oldContent = container.querySelector('.poemblock-content');
  if (oldContent) oldContent.remove();
  var oldBtn = container.querySelector('.poemblock-next-btn');
  if (oldBtn) oldBtn.remove();
  var oldCloseBtn = container.querySelector('.poemblock-close-btn');
  if (oldCloseBtn) oldCloseBtn.remove();

  // 移除旧的展开/收缩
  var oldToggle = container.querySelector('.poemblock-expand-toggle');
  if (oldToggle) oldToggle.remove();

  container.dataset.poemIndex = poemData.index;
  var titleEl = container.querySelector('.poemblock-title');
  var authorEl = container.querySelector('.poemblock-author');
  // 判断是否为文摘（通过 _isExcerpt 标记或 dataset 标记）
  var isExcerptRebuild = poemData.poem._isExcerpt === true || container.dataset.isExcerpt === 'true';
  if (isExcerptRebuild) {
    // 文摘：标题显示「作者 · 来源」，隐藏作者行
    if (titleEl) {
      if (poemData.poem.title && poemData.poem.author) {
        titleEl.textContent = poemData.poem.title + ' · ' + poemData.poem.author;
      } else {
        titleEl.textContent = poemData.poem.title || poemData.poem.author || '';
      }
    }
    if (authorEl) authorEl.style.display = 'none';
  } else {
    if (titleEl) titleEl.textContent = poemData.poem.title;
    if (authorEl) authorEl.textContent = poemData.poem.author;
  }

  // 建新内容
  var lines = poemData.poem.lines;
  // 从 container dataset 读取布局参数，计算最大行数
  var useTwoColumns = container.dataset.useTwoColumns === 'true';
  var isHorizontalBanner = container.dataset.isHorizontalBanner === 'true';
  var baseFontSize = parseFloat(container.dataset.baseFontSize) || 14;
  var maxLines = parseInt(container.dataset.maxLines, 10) || 8;
  // 如果 dataset 中没有 maxLines，根据容器尺寸计算
  var linesToShow = lines.slice(0, maxLines);

  var newContent = buildLinesContent(linesToShow, maxLines, useTwoColumns, baseFontSize, isHorizontalBanner);
  container.appendChild(newContent);

  // 展开/收缩
  var isExpanded = false;
  if (lines.length > maxLines) {
    var expandToggle = document.createElement('div');
    expandToggle.className = 'poemblock-line poemblock-expand-toggle';
    expandToggle.textContent = '... 展开全文';
    expandToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      isExpanded = !isExpanded;
      var oldC = container.querySelector('.poemblock-content');
      var oldT = container.querySelector('.poemblock-expand-toggle');
      if (isExpanded) {
        var newC = buildLinesContent(lines, maxLines, useTwoColumns, baseFontSize, isHorizontalBanner);
        if (oldC) container.replaceChild(newC, oldC);
        expandToggle.textContent = '△ 收起';
      } else {
        var newC = buildLinesContent(lines.slice(0, maxLines), maxLines, useTwoColumns, baseFontSize, isHorizontalBanner);
        if (oldC) container.replaceChild(newC, oldC);
        expandToggle.textContent = '... 展开全文';
      }
    });
    container.appendChild(expandToggle);
  }

  // 关闭按钮
  var closeBtn = document.createElement('div');
  closeBtn.className = 'poemblock-close-btn';
  closeBtn.title = '关闭';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    container.classList.add('poemblock-dismissed');
  });
  container.appendChild(closeBtn);

  // 下一首按钮（根据用户偏好）
  if (container.dataset.showNextButton !== 'false') {
    var btn = document.createElement('div');
    btn.className = 'poemblock-next-btn';
    btn.title = '下一首';
    btn.textContent = '▶';
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var ci = parseInt(container.dataset.poemIndex, 10);
      requestNextPoem(ci, function(resp) {
        if (resp && resp.poem) rebuildPoemDisplay(container, shadowRoot, resp);
      });
    });
    container.appendChild(btn);
  }
}

// 检测广告元素（简化版）
function isPotentialAd(node) {
  try {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'BODY' || tag === 'HTML' || tag === 'HEAD') return false;

    // 如果父级已经被处理过，不再处理子级
    if (node.closest('[data-poem-processed="true"]')) return false;

    // 安全检查：跳过非广告页面内容
    if (isSafeElement(node)) return false;

    // 1. Tier 1: 已知广告标记（100% 置信）
    for (const selector of KNOWN_AD_SELECTORS) {
      try {
        if (node.matches(selector)) {
          console.log('[Poemblock] Tier 1 检测到广告:', selector, node);
          return true;
        }
      } catch(e) {
        continue;
      }
    }

    // 2. Tier 2: 精确类名/ID模式（高置信）
    for (const selector of SPECIFIC_AD_SELECTORS) {
      try {
        if (node.matches(selector)) {
          console.log('[Poemblock] Tier 2 检测到广告:', selector, node);
          return true;
        }
      } catch(e) {
        continue;
      }
    }

    // 2. 检查可见性
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;

    // 3. 广告 iframe 检测（优先于尺寸检测：DNR 拦截后 iframe 可能折叠）
    if (tag === 'IFRAME') {
      const src = node.src || node.getAttribute('src') || '';
      // 常见广告网络（包括中国广告平台）
      if (/(doubleclick|googlesyndication|googleadservices|googleads|pagead2|googletagmanager|ad\.|ads\.|advertising|adform|adnxs|casalemedia|outbrain|taboola|criteo|amazon-adsystem|pubmatic|openx|appnexus|exponential|rubiconproject|media\.net|adriver|adfox|adserver|adtech|adriver|baidustatic|baidu\.com|bdstatic|cpro\.baidu|cb\.baidu|alimama|tanx\.com|mmstat|sinaimg|sogou|360\.cn|quantserve|scorecardresearch)/i.test(src)) {
        console.log('[Poemblock] 检测到广告 iframe:', node);
        return true;
      }
      // 空 iframe 且不在安全区域内 → 可能是被拦截的广告
      if (!node.hasAttribute('data-poem-processed')) {
        try {
          const doc = node.contentDocument || node.contentWindow?.document;
          if (doc && (!doc.body || doc.body.innerText.trim().length < 20)) {
            const parentSafe = isSafeElement(node.parentElement || node);
            if (!parentSafe) {
              console.log('[Poemblock] 检测到空白 iframe（可能为广告）:', node);
              return true;
            }
          }
        } catch(e) {
          // 跨域 iframe 无法访问 contentDocument，忽略
        }
      }
    }

    // 4. 检查尺寸（对已通过广告检测的元素仅做参考，不过滤）
    const rect = node.getBoundingClientRect();
    // 如果已经通过 tier1/tier2 或 iframe 检测返回了 true，这里不会执行到
    // 但检测关键词匹配的元素时，尺寸太小则跳过

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 防止误判网页主体大容器
    if (rect.width >= viewportWidth * 0.9 && rect.height >= viewportHeight * 0.9) return false;

    // 5. 检查 data-ad 属性
    if (node.hasAttribute('data-ad-client') || 
        node.hasAttribute('data-ad-slot') || 
        node.hasAttribute('data-google-query-id') ||
        node.hasAttribute('data-ad') ||
        node.hasAttribute('data-ad-type') ||
        node.hasAttribute('data-ad-name')) {
      console.log('[Poemblock] 检测到 data-ad 属性:', node);
      return true;
    }

    // 6. 检查类名和ID中的广告关键词（仅限完整复合词，不使用裸"ad"）
    const className = (node.className || '').toLowerCase();
    const id = (node.id || '').toLowerCase();
    const adKeywords = ['advertisement', 'advert', 'promo', 'promoted', 'sponsor', 'sponsored', 'banner', 'guanggao', 'ggad', 'ggao'];

    for (const keyword of adKeywords) {
      if (className.includes(keyword) || id.includes(keyword)) {
        console.log('[Poemblock] 检测到广告关键词:', keyword, node);
        return true;
      }
    }

    // 7. 检查父级容器（检查更多层级）
    let parent = node.parentElement;
    let level = 0;
    while (parent && level < 5) {
      const parentClass = (parent.className || '').toLowerCase();
      const parentId = (parent.id || '').toLowerCase();
      
      for (const keyword of adKeywords) {
        if (parentClass.includes(keyword) || parentId.includes(keyword)) {
          console.log('[Poemblock] 检测到父级广告容器:', keyword, parent);
          return true;
        }
      }
      
      parent = parent.parentElement;
      level++;
    }

    // 8. Tier 3: 位置检测 — 固定/粘性定位且位于视口边缘的元素（低置信，仅用于辅助检测）
    try {
      const pos = window.getComputedStyle(node).position;
      if ((pos === 'fixed' || pos === 'sticky') && rect.width > 0 && rect.height > 0) {
        const edgeThreshold = Math.min(50, Math.max(20, window.innerHeight * 0.05));
        const nearBottom = (window.innerHeight - rect.bottom) < edgeThreshold;
        const nearRight = (window.innerWidth - rect.right) < edgeThreshold;
        const nearTop = rect.top < edgeThreshold;
        const nearLeft = rect.left < edgeThreshold;

        // 在视口边缘、非主内容区、不包含导航链接 → 可能是广告
        const hasLinks = node.querySelectorAll('a').length > 2;
        const childText = (node.textContent || '').trim();
        const hasLongText = childText.split(/\s+/).length > 30;

        if ((nearBottom || nearRight || nearTop || nearLeft) && !hasLinks && !hasLongText) {
          // 进一步验证：尺寸符合常见广告尺寸，或 z-index 较高
          const zIdx = parseInt(style.zIndex, 10);
          const isAdSized = (rect.width >= 200 && rect.height >= 60) || (rect.width >= 120 && rect.height >= 400);
          const isMaybeAd = zIdx >= 1000 || isAdSized;
          if (isMaybeAd) {
            console.log('[Poemblock] Tier 3 位置检测到广告:', node);
            return true;
          }
        }
      }
    } catch (e) {}

    return false;
  } catch (e) {
    console.error('[Poemblock] 广告检测出错:', e);
    return false;
  }
}

// ============================================================
// Display 模块 — 布局计算
// ============================================================

// 计算智能排版参数（根据容器尺寸和诗句内容自适应）
function calculateLayout(containerWidth, containerHeight, poemLines, isHorizontal, isTallSkinny, isVerySmall, isExtraWideBanner) {
  // 检测语言：检查诗句中是否包含拉丁字符
  const isEnglish = poemLines.some(line => /[a-zA-Z]/.test(line));

  // 找出最长诗句的长度（UTF-8 字符数）
  const maxLineLen = Math.max(...poemLines.map(l => l.length));

  // 计算基础字号（px）— 更合理的计算方式
  const safetyMargin = 0.9;
  let baseFontSize;

  if (isExtraWideBanner) {
    // 超宽横幅（如 728×90）优化：仅显示 1-2 行，字号大、标题与诗句并排
    const availableWidth = (containerWidth - 20) * safetyMargin;
    const charWidth = isEnglish ? 0.55 : 0.9;
    // 只显示 1-2 行，所以字号可以很大
    baseFontSize = Math.min(28, Math.max(16, availableWidth / Math.max(maxLineLen + 10, 8) / charWidth));
  } else if (isHorizontal) {
    // 横幅模式优化：留出更多空间给标题作者，诗句更宽松
    const headerWidth = Math.min(containerWidth * 0.35, 150);
    const availableWidth = (containerWidth - headerWidth - 40) * safetyMargin;
    // 英文按 0.6em/字符，中文按 1em/字符估算
    const charWidth = isEnglish ? 0.6 : 1.0;
    // 横幅模式下字号更大一些
    baseFontSize = Math.min(20, Math.max(12, availableWidth / Math.max(maxLineLen, 4) / charWidth));
  } else if (isTallSkinny) {
    // 细高广告（如160x600摩天楼）：宽度是瓶颈，用宽度计算字号
    const availableWidth = (containerWidth - 20) * safetyMargin;
    const charWidth = isEnglish ? 0.6 : 1.0;
    baseFontSize = Math.min(18, Math.max(10, availableWidth / Math.max(maxLineLen, 4) / charWidth));
  } else if (isVerySmall) {
    // 极小广告：用更紧凑的尺寸
    const availableHeight = (containerHeight - 20) * safetyMargin;
    const lineHeight = 1.5;
    const neededLines = Math.min(poemLines.length, 4);
    baseFontSize = Math.min(16, Math.max(9, availableHeight / Math.max(neededLines, 1) / lineHeight));
  } else {
    // 竖排模式：更合理的高度分配
    const headerHeight = containerWidth < 200 ? 40 : 60;
    const availableHeight = (containerHeight - headerHeight) * safetyMargin;
    const lineHeight = 1.7;
    const neededLines = Math.min(poemLines.length, 10);
    baseFontSize = Math.min(18, Math.max(11, availableHeight / (neededLines * lineHeight)));
  }

  return { baseFontSize, isEnglish, maxLineLen };
}

// ============================================================
// Display 模块 — 多模式显示引擎
// ============================================================

// 根据广告尺寸和诗歌内容选择最佳显示模式
const DISPLAY_MODE = {
  GOLDEN_LINE: 'golden_line',  // 横幅：只显示金句 + 作者签名
  GOLDEN_MULTI: 'golden_multi', // 中高横幅：显示金句2-3行 + 作者签名
  CLASSIC: 'classic',          // 标准矩形：标题 + 分隔线 + 诗句
  SKINNY: 'skinny',            // 摩天楼：窄竖排，每行2-4字
  COMPACT: 'compact',          // 小尺寸：紧凑显示
};

function getDisplayMode(width, height, poemLines) {
  if (width <= 0 || height <= 0) return DISPLAY_MODE.COMPACT;
  const ratio = width / height;
  // 超宽横幅（728×90 等）→ 金句模式
  // 但高度超过视口 1/4 时不使用金句，避免空旷
  if (ratio > 2.5 && height <= window.innerHeight / 4) {
    // 超宽横幅：
    // 高度 ≤ 100px → 单行金句模式（经典窄横幅如 728×90）
    // 高度 100~180px → 多行金句模式（2-3行，适合中等高度横幅）
    // 高度 > 180px → 经典模式，避免空旷
    if (height > 100 && height <= 180) return DISPLAY_MODE.GOLDEN_MULTI;
    if (height > 180) return DISPLAY_MODE.CLASSIC;
    return DISPLAY_MODE.GOLDEN_LINE;
  }
  // 细高（160×600 摩天楼）→ 细长模式
  if (ratio < 0.45 && height > 350) return DISPLAY_MODE.SKINNY;
  // 极小广告 → 紧凑模式
  if (width < 200 || height < 120) return DISPLAY_MODE.COMPACT;
  // 标准尺寸 → 经典模式
  if (width >= 250 && height >= 150) return DISPLAY_MODE.CLASSIC;
  return DISPLAY_MODE.COMPACT;
}

// 从诗歌中选取最经典的一句（金句）
function pickGoldenLine(poem) {
  if (!poem.lines || poem.lines.length === 0) return '';
  if (poem.lines.length === 1) return poem.lines[0];

  // 检测是否为英文诗歌
  const isEnglish = poem.lines.some(l => /[a-zA-Z]{2,}/.test(l));

  if (isEnglish) {
    // 英文诗：取第一句（通常是主题句）
    return poem.lines[0];
  }

  // 中文诗：检查是否有行包含标题（常见于中国古典诗）
  const title = poem.title || '';
  const titleMatch = poem.lines.find(l => l.includes(title) || title.includes(l.replace(/[，。！？、；：""''（）　\s]/g, '')));
  if (titleMatch) return titleMatch;

  // 取最长的一句（通常最有分量）
  const sorted = [...poem.lines].sort((a, b) => b.length - a.length);
  return sorted[0];
}

// 选取2-3句金句（用于多行金句模式）
function pickGoldenLines(poem, count) {
  if (!poem.lines || poem.lines.length === 0) return [];
  count = count || 3;
  const needed = Math.min(count, poem.lines.length);

  // 检测是否为英文诗歌
  const isEnglish = poem.lines.some(l => /[a-zA-Z]{2,}/.test(l));

  let candidates = [];

  if (isEnglish) {
    // 英文诗：取开头几句
    candidates = poem.lines.slice(0, needed);
  } else {
    // 中文诗：优先选择包含标题的行
    const title = poem.title || '';
    const titleMatches = poem.lines.filter(l => l.includes(title) || title.includes(l.replace(/[，。！？、；：""''（）　\s]/g, '')));
    // 去重
    const seen = new Set();
    titleMatches.forEach(l => { if (!seen.has(l)) { seen.add(l); candidates.push(l); } });
    if (candidates.length < needed) {
      // 按长度排序，取最长的几句
      const sorted = [...poem.lines].sort((a, b) => b.length - a.length);
      for (const l of sorted) {
        if (!seen.has(l)) { seen.add(l); candidates.push(l); }
        if (candidates.length >= needed) break;
      }
    }
  }

  return candidates.slice(0, needed);
}

// 计算多行金句模式的自适应字号
function calculateMultiGoldenFontSize(containerWidth, containerHeight, lines, isEnglish) {
  // 基础字号：根据容器高度，多行金句比单行金句小一些
  let fontSize = Math.min(28, Math.max(14, Math.min(containerWidth * 0.05, containerHeight * 0.25)));

  // 逐行计算宽度，找出最宽的行
  let maxRequiredWidth = 0;
  for (const text of lines) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      if (/[一-鿿　-〿＀-￯]/.test(ch)) {
        totalWidth += 1.3; // 中文字符
      } else {
        totalWidth += 0.6; // 英文字符、数字、标点
      }
    }
    const requiredWidth = totalWidth * fontSize;
    if (requiredWidth > maxRequiredWidth) maxRequiredWidth = requiredWidth;
  }

  // 容器可用宽度：扣除两侧 padding（约 40px）和署名区域（约 120px）+间距（16px）
  const availableTextWidth = containerWidth - 40 - 136;
  // 对于多行模式，署名在下方，可用宽度更大
  const availableWidth = containerWidth - 40;

  if (availableWidth > 0) {
    if (maxRequiredWidth > availableWidth) {
      const shrinkRatio = availableWidth / maxRequiredWidth;
      fontSize = Math.max(12, Math.floor(fontSize * shrinkRatio * 10) / 10);
    }
  }

  // 最终限制范围
  return Math.min(28, Math.max(12, fontSize));
}

// 计算金句模式的自适应字号，确保文本完整可见
function calculateGoldenFontSize(containerWidth, containerHeight, text, isEnglish) {
  // 基础字号：根据容器尺寸
  let fontSize = Math.min(32, Math.max(18, Math.min(containerWidth * 0.07, containerHeight * 0.7)));

  // 估算文本宽度：对引号内的文本，中文字符约占 1.3em 宽度，英文字符约占 0.6em
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (/[一-鿿　-〿＀-￯]/.test(ch)) {
      totalWidth += 1.3; // 中文字符
    } else {
      totalWidth += 0.6; // 英文字符、数字、标点
    }
  }

  // 金句容器可用宽度：扣除两侧 padding（共 40px），再扣除署名区域（约 120px）和间距（16px）
  const availableTextWidth = containerWidth - 40 - 136;

  if (availableTextWidth > 0) {
    // 文本在所选字号下需要的宽度（px）
    const requiredWidth = totalWidth * fontSize;
    // 如果需要宽度超了，按比例缩小，但保留最小字号 12px
    if (requiredWidth > availableTextWidth) {
      const shrinkRatio = availableTextWidth / requiredWidth;
      fontSize = Math.max(12, Math.floor(fontSize * shrinkRatio * 10) / 10);
    }
  }

  // 最终限制在合理范围
  return Math.min(32, Math.max(12, fontSize));
}

// 选取最适合细长模式的2-4句
function pickSkinnyLines(poem, maxChars) {
  maxChars = maxChars || 6;
  // 选取每行不超过 maxChars 个字符的短句，至少2句
  const shortLines = poem.lines.filter(l => l.length <= maxChars);
  if (shortLines.length >= 2) return shortLines.slice(0, 4);
  // 如果没有短句，取前4句并截断
  return poem.lines.slice(0, 4).map(l => l.length > maxChars ? l.slice(0, maxChars) : l);
}

// ============================================================
// Display 模块 — 广告替换与诗歌渲染
// ============================================================

// 替换广告为诗歌
function replaceAdWithPoem(adNode) {
  try {
    // 安全检查：已处理过或超过限制则跳过
    if (adNode.dataset.poemProcessed === 'true') {
      console.log('[Poemblock] 广告已处理，跳过', adNode);
      return;
    }
    if (replaceCount >= MAX_REPLACE_PER_SESSION) {
      console.log('[Poemblock] 已达到替换数量限制，跳过');
      return;
    }
    
    console.log('[Poemblock] 开始替换广告 #' + (replaceCount + 1), adNode);

    // ===== 智能尺寸检测（多级回退） =====
    function detectDimensions(node) {
      let w = 0, h = 0;

      // 1. 从 dataset 读取（data-ad-width / data-ad-height）
      if (node.dataset.adWidth || node.dataset.adHeight) {
        w = parseFloat(node.dataset.adWidth) || 0;
        h = parseFloat(node.dataset.adHeight) || 0;
        if (w > 20 && h > 20) { console.log('[Poemblock] 尺寸来源: dataset', w, h); return {w, h}; }
      }

      // 2. 从内联样式读取
      const styleW = node.style.width || '';
      const styleH = node.style.height || '';
      if (styleW && styleH) {
        const parsedW = parseFloat(styleW);
        const parsedH = parseFloat(styleH);
        if (!isNaN(parsedW) && !isNaN(parsedH) && parsedW > 20 && parsedH > 20) {
          // 如果是 px 单位直接使用
          if (styleW.includes('px') && styleH.includes('px')) {
            console.log('[Poemblock] 尺寸来源: 内联样式', parsedW, parsedH);
            return {w: parsedW, h: parsedH};
          }
        }
      }

      // 2.5 从 HTML width/height 属性读取（iframe 常用，DNR 拦截后依然保留）
      const attrW = node.getAttribute('width');
      const attrH = node.getAttribute('height');
      if (attrW && attrH) {
        const parsedW = parseFloat(attrW);
        const parsedH = parseFloat(attrH);
        if (!isNaN(parsedW) && !isNaN(parsedH) && parsedW > 20 && parsedH > 20) {
          console.log('[Poemblock] 尺寸来源: HTML属性', parsedW, parsedH);
          return {w: parsedW, h: parsedH};
        }
      }

      // 3. 从 getBoundingClientRect 读取
      try {
        const rect = node.getBoundingClientRect();
        w = rect.width || node.offsetWidth || 0;
        h = rect.height || node.offsetHeight || 0;
        if (w > 20 && h > 20) { console.log('[Poemblock] 尺寸来源: getBoundingClientRect', w, h); return {w, h}; }
      } catch (e) {}

      // 4. 从父容器获取尺寸
      try {
        if (node.parentElement) {
          const parentRect = node.parentElement.getBoundingClientRect();
          if (parentRect.width > 20 && parentRect.height > 20) {
            console.log('[Poemblock] 尺寸来源: 父容器', parentRect.width, parentRect.height);
            return {w: parentRect.width, h: parentRect.height};
          }
        }
      } catch (e) {}

      // 5. 从类名推断（如 ad-container-300x250）
      const cls = (node.className || '') + ' ' + (node.id || '');
      const sizeMatch = cls.match(/(\d{3,4})\s*[xX×]\s*(\d{2,4})/);
      if (sizeMatch) {
        w = parseInt(sizeMatch[1], 10);
        h = parseInt(sizeMatch[2], 10);
        if (w > 20 && h > 20) { console.log('[Poemblock] 尺寸来源: 类名推断', w, h); return {w, h}; }
      }

      // 6. 最后兜底：viewport 比例
      w = Math.min(360, window.innerWidth * 0.9);
      h = Math.round(w / 1.2); // 宽高比 1:1.2
      console.log('[Poemblock] 尺寸来源: viewport 兜底', w, h);
      return {w, h};
    }

    const dims = detectDimensions(adNode);
    let originalWidth = dims.w;
    let originalHeight = dims.h;

    let positionType = 'relative';
    let zIndex = 'auto';
    let parentDisplay = null;
    try {
      const originalStyle = window.getComputedStyle(adNode);
      positionType = originalStyle.position;
      zIndex = originalStyle.zIndex;
      if (adNode.parentElement) {
        parentDisplay = window.getComputedStyle(adNode.parentElement).display;
      }
    } catch (e) {
      // 忽略样式获取错误
    }

    // 先标记为已处理，防止重复处理
    adNode.dataset.poemProcessed = 'true';
    replaceCount++;

    requestSmartContent(adNode, (response) => {
      try {
        if (!response || !response.content || !response.content.data) {
          console.warn('[Poemblock] 内容获取失败，恢复广告标记');
          delete adNode.dataset.poemProcessed;
          replaceCount = Math.max(0, replaceCount - 1);
          return;
        }

        const { content: contentItem, preferences } = response;
        const isExcerpt = contentItem.type === 'excerpt';
        // 将文摘转换为诗歌格式以便复用渲染引擎
        let poem = contentItem.data;
        let poemIndex = contentItem.index || -1;
        if (isExcerpt) {
          poem = excerptToPoem(contentItem.data);
          poemIndex = -1;
        }

        // ===== 在回调中重新获取广告位的真实尺寸（异步后 DOM 可能已变化） =====
        let actualWidth = originalWidth;
        let actualHeight = originalHeight;
        try {
          const liveRect = adNode.getBoundingClientRect();
          if (liveRect && liveRect.width > 20 && liveRect.height > 20) {
            actualWidth = liveRect.width;
            actualHeight = liveRect.height;
          }
        } catch (e) {
          // 保持 original 值
        }

        // 确定主题
        let preferredTheme = (preferences && preferences.theme) || 'auto';
        if (preferredTheme === 'auto') {
          if (isPageDarkMode()) preferredTheme = 'dark';
          else preferredTheme = 'light';
        }

        const themeColor = getThemeColor(adNode, preferredTheme);
        const colors = getColorScheme(themeColor, preferredTheme);

        // 创建 Shadow DOM 容器
        const shadowHost = document.createElement('div');
        shadowHost.style.width = '100%';
        shadowHost.style.height = '100%';

        // 如果父容器是 flex/grid，设置合适的 flex 属性以占满空间
        if (parentDisplay && (parentDisplay === 'flex' || parentDisplay === 'inline-flex')) {
          shadowHost.style.flex = '1 1 auto';
          shadowHost.style.alignSelf = 'stretch';
        } else if (parentDisplay && (parentDisplay === 'grid' || parentDisplay === 'inline-grid')) {
          shadowHost.style.alignSelf = 'stretch';
          shadowHost.style.justifySelf = 'stretch';
        }
        shadowHost.style.position = 'relative';
        shadowHost.style.zIndex = '2147483647';

        const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

        // 注入 CSS 到 Shadow DOM
        const styleSheet = document.createElement('style');
        let fontUrl = '';
        try {
          fontUrl = chrome.runtime.getURL('汇文明朝体GBKv1.001.ttf');
        } catch (e) {
          console.warn('[Poemblock] 无法加载字体文件');
        }

        // 判断广告形状
        const isHorizontalBanner = actualWidth > 0 && actualHeight > 0 && (actualWidth / actualHeight > 2.5);
        // 超宽横幅（如 728×90）：宽高比 > 6，只显示 1-2 行
        const isExtraWideBanner = isHorizontalBanner && (actualWidth / actualHeight > 5);
        // 检测极小广告（如 120x90 按钮广告）
        const isVerySmall = actualWidth > 0 && actualHeight > 0 && actualWidth < 200 && actualHeight < 120;
        // 检测细高广告（如 160x600 摩天楼）
        const isTallSkinny = actualWidth > 0 && actualHeight > 0 && (actualHeight / actualWidth > 2.0);
        // 检测超大广告
        const isLargeAd = actualWidth >= 728 && actualHeight >= 90;

        // 多模式显示引擎
        const displayMode = getDisplayMode(actualWidth, actualHeight, poem.lines);
        const goldenLine = (displayMode === DISPLAY_MODE.GOLDEN_LINE) ? pickGoldenLine(poem) : '';

        // ===== 金句模式：横幅广告展示一句最经典的诗句 =====
        if (displayMode === DISPLAY_MODE.GOLDEN_LINE) {
          // 计算金句字号：先根据容器尺寸估算，再根据文本长度自适应缩小
          const isEnglish = /[a-zA-Z]/.test(goldenLine);
          const goldenFontSize = calculateGoldenFontSize(actualWidth, actualHeight, goldenLine, isEnglish);

        styleSheet.textContent = `
          @font-face {
            font-family: 'Huiwen-MinchoGBK';
            src: url('${fontUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          :host {
            display: block; width: 100%; height: 100%; margin: 0; padding: 0;
          }
          .poemblock-golden {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            width: 100%; height: 100%;
            background-color: ${colors.bgColor};
            padding: 10px 20px;
            box-sizing: border-box;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid ${colors.borderColor};
            font-family: ${isEnglish ? "'Georgia', 'Times New Roman', serif" : "'Huiwen-MinchoGBK', 'PingFang SC', 'Microsoft YaHei', 'Georgia', serif"};
          }
          .poemblock-golden:hover {
            ${colors.hoverBg ? `background-color: ${colors.hoverBg};` : 'filter: brightness(0.95);'}
            box-shadow: 0 2px 12px ${colors.shadowColor};
          }
          .poemblock-golden-quote {
            font-size: ${goldenFontSize}px;
            line-height: 1.3;
            color: ${colors.textColor};
            text-align: center;
            letter-spacing: 0.08em;
            flex: 1 1 auto;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .poemblock-golden-quote::before {
            content: ${isEnglish ? "'\\201C'" : "'\\300C'"};
            opacity: 0.6;
          }
          .poemblock-golden-quote::after {
            content: ${isEnglish ? "'\\201D'" : "'\\300D'"};
            opacity: 0.6;
          }
          .poemblock-golden-attribution {
            flex-shrink: 0;
            font-size: ${Math.round(goldenFontSize * 0.55)}px;
            color: ${colors.textColor};
            opacity: 0.65;
            font-style: italic;
            margin-left: 16px;
            white-space: nowrap;
            line-height: 1.2;
            text-align: right;
            padding-left: 16px;
            border-left: 1px solid ${colors.borderColor};
          }
          @keyframes poemblock-click-flash {
            0% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(0.97); filter: brightness(0.85); }
            100% { transform: scale(1); filter: brightness(1); }
          }
          .poemblock-golden.poemblock-clicked {
            animation: poemblock-click-flash 0.3s ease-out;
          }
          .poemblock-golden-close {
            position: absolute;
            top: 2px; right: 4px;
            width: 20px; height: 20px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: ${colors.textColor};
            opacity: 0.35;
            font-size: 14px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            transition: opacity 0.2s;
          }
          .poemblock-golden:hover .poemblock-golden-close { opacity: 0.6; }
          .poemblock-golden-close:hover {
            opacity: 1 !important;
            background: rgba(200,60,60,0.3);
          }
          .poemblock-dismissed {
            display: none !important;
          }
        `;
        shadowRoot.appendChild(styleSheet);

        const goldenContainer = document.createElement('div');
        goldenContainer.className = 'poemblock-golden';
        goldenContainer.style.position = 'relative';

        const quoteEl = document.createElement('div');
        quoteEl.className = 'poemblock-golden-quote';
        quoteEl.textContent = goldenLine;

        const attrEl = document.createElement('div');
        attrEl.className = 'poemblock-golden-attribution';
        // 文摘金句：显示作者 · 来源
	        if (isExcerpt) {
	          var ed = response.content.data;
	          if (ed.author && ed.source) {
	            attrEl.textContent = ed.author + ' · ' + ed.source;
	          } else {
	            attrEl.textContent = ed.author || ed.source || '';
	          }
	        } else {
	          attrEl.textContent = poem.author + '「' + poem.title + '」';
	        }

        goldenContainer.appendChild(quoteEl);
        goldenContainer.appendChild(attrEl);

        // 关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.className = 'poemblock-golden-close';
        closeBtn.title = '关闭';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          goldenContainer.classList.add('poemblock-dismissed');
        });
        goldenContainer.appendChild(closeBtn);

        // 点击跳转
        goldenContainer.addEventListener('click', function(e) {
          if (e.target.closest('.poemblock-close-btn') || e.target.closest('.poemblock-next-btn')) return;
          this.classList.add('poemblock-clicked');
          if (isExcerpt) return;
          setTimeout(function() {
            const opened = window.open(poem.source, '_blank');
            if (!opened || opened.closed) {
              const a = document.createElement('a');
              a.href = poem.source; a.target = '_blank'; a.rel = 'noopener noreferrer';
              a.style.display = 'none';
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
          }, 100);
        });

        shadowRoot.appendChild(goldenContainer);

        // 设置样式
        try {
          adNode.style.setProperty('width', actualWidth + 'px', 'important');
          adNode.style.setProperty('height', actualHeight + 'px', 'important');
          adNode.style.setProperty('position', positionType === 'static' ? 'relative' : positionType, 'important');
          adNode.style.setProperty('overflow', 'hidden', 'important');
          adNode.style.setProperty('display', 'block', 'important');
          adNode.style.setProperty('visibility', 'visible', 'important');
          adNode.style.setProperty('opacity', '1', 'important');
        } catch (e) {}
        while (adNode.firstChild) adNode.removeChild(adNode.firstChild);
        adNode.appendChild(shadowHost);
        console.log('[Poemblock] 金句模式替换成功 #' + replaceCount);
        return;
        }

        // ===== 多行金句模式（GOLDEN_MULTI）：横幅显示2-3行金句 =====
        if (displayMode === DISPLAY_MODE.GOLDEN_MULTI) {
          const goldenLines = pickGoldenLines(poem, 3);
          const isEnglish = goldenLines.some(l => /[a-zA-Z]{2,}/.test(l));
          const multiFontSize = calculateMultiGoldenFontSize(actualWidth, actualHeight, goldenLines, isEnglish);

        styleSheet.textContent = `
          @font-face {
            font-family: 'Huiwen-MinchoGBK';
            src: url('${fontUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          :host {
            display: block; width: 100%; height: 100%; margin: 0; padding: 0;
          }
          .poemblock-golden-multi {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%; height: 100%;
            background-color: ${colors.bgColor};
            padding: 8px 20px;
            box-sizing: border-box;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid ${colors.borderColor};
            font-family: ${isEnglish ? "'Georgia', 'Times New Roman', serif" : "'Huiwen-MinchoGBK', 'PingFang SC', 'Microsoft YaHei', 'Georgia', serif"};
          }
          .poemblock-golden-multi:hover {
            ${colors.hoverBg ? `background-color: ${colors.hoverBg};` : 'filter: brightness(0.95);'}
            box-shadow: 0 2px 12px ${colors.shadowColor};
          }
          .poemblock-golden-multi-lines {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            width: 100%;
            flex: 1 1 auto;
          }
          .poemblock-golden-multi-line {
            font-size: ${multiFontSize}px;
            line-height: 1.3;
            color: ${colors.textColor};
            text-align: center;
            letter-spacing: 0.08em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .poemblock-golden-multi-line::before {
            content: ${isEnglish ? "'\\201C'" : "'\\300C'"};
            opacity: 0.6;
            margin-right: 0.1em;
          }
          .poemblock-golden-multi-line::after {
            content: ${isEnglish ? "'\\201D'" : "'\\300D'"};
            opacity: 0.6;
            margin-left: 0.1em;
          }
          .poemblock-golden-multi-attribution {
            flex-shrink: 0;
            font-size: ${Math.round(multiFontSize * 0.55)}px;
            color: ${colors.textColor};
            opacity: 0.65;
            font-style: italic;
            margin-top: 4px;
            white-space: nowrap;
            line-height: 1.2;
            text-align: center;
            padding-top: 4px;
            border-top: 1px solid ${colors.borderColor};
            width: 100%;
            max-width: 90%;
          }
          @keyframes poemblock-click-flash {
            0% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(0.97); filter: brightness(0.85); }
            100% { transform: scale(1); filter: brightness(1); }
          }
          .poemblock-golden-multi.poemblock-clicked {
            animation: poemblock-click-flash 0.3s ease-out;
          }
          .poemblock-golden-multi-close {
            position: absolute;
            top: 2px; right: 4px;
            width: 20px; height: 20px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: ${colors.textColor};
            opacity: 0.35;
            font-size: 14px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            transition: opacity 0.2s;
          }
          .poemblock-golden-multi:hover .poemblock-golden-multi-close { opacity: 0.6; }
          .poemblock-golden-multi-close:hover {
            opacity: 1 !important;
            background: rgba(200,60,60,0.3);
          }
          .poemblock-dismissed {
            display: none !important;
          }
        `;
        shadowRoot.appendChild(styleSheet);

        const goldenMultiContainer = document.createElement('div');
        goldenMultiContainer.className = 'poemblock-golden-multi';
        goldenMultiContainer.style.position = 'relative';

        const linesContainer = document.createElement('div');
        linesContainer.className = 'poemblock-golden-multi-lines';

        for (const line of goldenLines) {
          const lineEl = document.createElement('div');
          lineEl.className = 'poemblock-golden-multi-line';
          lineEl.textContent = line;
          linesContainer.appendChild(lineEl);
        }

        const attrEl = document.createElement('div');
        attrEl.className = 'poemblock-golden-multi-attribution';
        if (isExcerpt) {
          var ed = response.content.data;
          if (ed.author && ed.source) {
            attrEl.textContent = ed.author + ' · ' + ed.source;
          } else {
            attrEl.textContent = ed.author || ed.source || '';
          }
        } else {
          attrEl.textContent = poem.author + '「' + poem.title + '」';
        }

        goldenMultiContainer.appendChild(linesContainer);
        goldenMultiContainer.appendChild(attrEl);

        // 关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.className = 'poemblock-golden-multi-close';
        closeBtn.title = '关闭';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          goldenMultiContainer.classList.add('poemblock-dismissed');
        });
        goldenMultiContainer.appendChild(closeBtn);

        // 点击跳转
        goldenMultiContainer.addEventListener('click', function(e) {
          if (e.target.closest('.poemblock-close-btn') || e.target.closest('.poemblock-next-btn')) return;
          this.classList.add('poemblock-clicked');
          if (isExcerpt) return;
          setTimeout(function() {
            const opened = window.open(poem.source, '_blank');
            if (!opened || opened.closed) {
              const a = document.createElement('a');
              a.href = poem.source; a.target = '_blank'; a.rel = 'noopener noreferrer';
              a.style.display = 'none';
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
          }, 100);
        });

        shadowRoot.appendChild(goldenMultiContainer);

        // 设置样式
        try {
          adNode.style.setProperty('width', actualWidth + 'px', 'important');
          adNode.style.setProperty('height', actualHeight + 'px', 'important');
          adNode.style.setProperty('position', positionType === 'static' ? 'relative' : positionType, 'important');
          adNode.style.setProperty('overflow', 'hidden', 'important');
          adNode.style.setProperty('display', 'block', 'important');
          adNode.style.setProperty('visibility', 'visible', 'important');
          adNode.style.setProperty('opacity', '1', 'important');
        } catch (e) {}
        while (adNode.firstChild) adNode.removeChild(adNode.firstChild);
        adNode.appendChild(shadowHost);
        console.log('[Poemblock] 多行金句模式替换成功 #' + replaceCount);
        return;
        }
        // ===== 多行金句模式结束 =====

        // ===== 金句模式结束 =====

        // 计算基础排版参数（字号、语言检测等）
        const { baseFontSize, isEnglish } = calculateLayout(actualWidth, actualHeight, poem.lines, isHorizontalBanner, isTallSkinny, isVerySmall, isExtraWideBanner);

        // ========== 优化分栏逻辑：更严格的双栏条件 ==========
        const lineHeightPx = baseFontSize * 1.7;
        const headerHeight = isHorizontalBanner ? 0 : (isVerySmall ? 35 : (isTallSkinny ? 45 : 60));
        const availableHeightSingle = actualHeight - headerHeight;
        const maxLinesSingle = Math.max(1, Math.min(
          Math.floor(availableHeightSingle / lineHeightPx),
          poem.lines.length
        ));
        const needMoreSpace = maxLinesSingle < poem.lines.length;
        
        // 简化分栏条件：只有非常明确需要时才分栏
        // 双栏条件：1) 非横幅 2) 足够宽 3) 行数足够多 4) 确实装不下
        const canSplit = actualWidth >= 350 && poem.lines.length >= 8 && needMoreSpace;
        let useTwoColumns = !isHorizontalBanner && canSplit;

      styleSheet.textContent = `
        @font-face {
          font-family: 'Huiwen-MinchoGBK';
          src: url('${fontUrl}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        :host {
          display: block;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }
        .poemblock-container {
          display: flex;
          flex-direction: ${isHorizontalBanner ? 'row' : 'column'};
          justify-content: ${isHorizontalBanner ? 'center' : 'flex-start'};
          align-items: center;
          background-color: ${colors.bgColor};
          padding: ${isHorizontalBanner ? '12px 20px' : (isVerySmall ? '8px 10px' : '16px 20px')};
          box-sizing: border-box;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          width: 100%;
          height: 100%;
          font-family: ${isEnglish ? "'Georgia', 'Times New Roman', serif" : "'Huiwen-MinchoGBK', 'PingFang SC', 'Microsoft YaHei', 'Georgia', serif"};
          border: 1px solid ${colors.borderColor};
          font-size: ${baseFontSize}px;
          color: ${colors.textColor};
          position: relative;
        }
        .poemblock-container:hover {
          ${colors.hoverBg ? `background-color: ${colors.hoverBg};` : 'filter: brightness(0.95);'}
        }
        .poemblock-header {
          flex-shrink: 0;
          display: ${isHorizontalBanner ? 'flex' : 'block'};
          flex-direction: column;
          margin-right: ${isHorizontalBanner ? '25px' : '0'};
          text-align: ${isHorizontalBanner ? 'right' : 'center'};
          min-width: ${isHorizontalBanner ? '100px' : 'auto'};
          padding-bottom: ${isHorizontalBanner ? '0' : (isVerySmall ? '5px' : '10px')};
        }
        .poemblock-title {
          font-weight: 700;
          margin-bottom: ${isVerySmall ? '3px' : '5px'};
          font-size: ${Math.min(baseFontSize * 1.25, 22)}px;
          color: inherit;
          ${isHorizontalBanner ? 'line-height: 1.3;' : 'line-height: 1.2;'}
        }
        .poemblock-author {
          font-style: italic;
          margin-bottom: 0;
          font-size: ${Math.min(baseFontSize * 0.85, 15)}px;
          opacity: 0.75;
          color: inherit;
          line-height: 1.4;
        }
        .poemblock-content {
          line-height: ${isHorizontalBanner ? '1.5' : '1.7'};
          font-size: ${baseFontSize}px;
          display: flex;
          flex-direction: ${isHorizontalBanner ? 'row' : (useTwoColumns ? 'row' : 'column')};
          gap: ${isHorizontalBanner ? '1.5em' : (useTwoColumns ? '30px' : '8px')};
          width: 100%;
          color: inherit;
          overflow-y: ${isHorizontalBanner ? 'visible' : 'auto'};
          max-height: 100%;
          flex-wrap: ${isHorizontalBanner ? 'nowrap' : 'wrap'};
          flex: ${isHorizontalBanner ? '0 0 auto' : '1 1 auto'};
          justify-content: center;
          align-items: ${isHorizontalBanner ? 'center' : 'stretch'};
        }
        .poemblock-content-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
          width: 50%;
          justify-content: center;
        }
        .poemblock-line { 
          text-align: center; 
          width: 100%;
          margin: 0;
          white-space: normal;
          word-wrap: break-word;
          overflow-wrap: break-word;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }
        .poemblock-line-empty {
          margin: 0;
          min-height: 1em;
          visibility: hidden;
        }
        .poemblock-mini .poemblock-title {
          font-size: 0.85em;
        }
        .poemblock-mini .poemblock-author {
          font-size: 0.75em;
        }
        @keyframes poemblock-click-flash {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(0.97); filter: brightness(0.85); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        .poemblock-container.poemblock-clicked {
          animation: poemblock-click-flash 0.3s ease-out;
        }
        @keyframes poemblock-line-fade-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .poemblock-line-fade {
          opacity: 0;
          animation: poemblock-line-fade-in 0.4s ease-out forwards;
        }
        .poemblock-next-btn {
          position: absolute;
          bottom: 4px; right: 4px;
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 1px solid ${colors.borderColor};
          background: ${colors.nextBtnBg};
          color: ${colors.nextBtnColor};
          font-size: 14px;
          line-height: 26px;
          text-align: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Georgia, serif;
        }
        .poemblock-container:hover .poemblock-next-btn { opacity: 1; }
        .poemblock-next-btn:hover {
          background: ${colors.nextBtnHoverBg};
          transform: scale(1.15);
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }
        .poemblock-close-btn {
          position: absolute;
          top: 4px; right: 4px;
          width: 22px; height: 22px;
          border-radius: 50%;
          border: 1px solid ${colors.borderColor};
          background: ${colors.nextBtnBg};
          color: ${colors.nextBtnColor};
          font-size: 12px;
          line-height: 22px;
          text-align: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
        }
        .poemblock-container:hover .poemblock-close-btn { opacity: 0.6; }
        .poemblock-close-btn:hover {
          opacity: 1 !important;
          transform: scale(1.15);
          background: rgba(200,60,60,0.8);
          color: #fff;
          border-color: rgba(200,60,60,0.8);
        }
        .poemblock-container:hover {
          box-shadow: 0 2px 12px ${colors.shadowColor};
        }
        .poemblock-expand-toggle {
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
          text-align: center;
          font-size: ${Math.max(baseFontSize * 0.75, 10)}px;
          padding: 2px 0;
          user-select: none;
        }
        .poemblock-expand-toggle:hover {
          opacity: 1;
        }
        .poemblock-dismissed {
          display: none !important;
        }`;
      shadowRoot.appendChild(styleSheet);

      const container = document.createElement('div');
      container.className = 'poemblock-container';
      container.style.color = colors.textColor;

      if (actualWidth < 250 || actualHeight < 150) {
        container.classList.add('poemblock-mini');
      }

      // 创建标题和作者元素
      var titleEl = document.createElement('div');
      titleEl.className = 'poemblock-title';
      var authorEl = document.createElement('div');
      authorEl.className = 'poemblock-author';

      // 文摘头部：显示「作者 · 来源」
      if (isExcerpt) {
        var excerptData2 = response.content.data;
        if (excerptData2.author && excerptData2.source) {
          titleEl.textContent = excerptData2.author + ' · ' + excerptData2.source;
        } else {
          titleEl.textContent = excerptData2.author || excerptData2.source || '';
        }
        authorEl.style.display = 'none';
      } else {
        titleEl.textContent = poem.title;
        authorEl.textContent = poem.author;
      }

      // 创建头部容器（标题+作者）
      const header = document.createElement('div');
      header.className = 'poemblock-header';
      header.appendChild(titleEl);
      header.appendChild(authorEl);

      const content = document.createElement('div');
      content.className = 'poemblock-content';

      // ================================================================
      // 排版策略优化
      // ================================================================

      let maxLines;
      if (isExtraWideBanner) {
        // 超宽横幅（如 728×90）：仅显示 1-2 行，字号大、标题与诗句并排
        const availableHeightH = actualHeight - 16;
        const lineHeightBig = baseFontSize * 1.8;
        const linesFit = Math.floor(availableHeightH / lineHeightBig);
        maxLines = Math.max(1, Math.min(linesFit, 2));
      } else if (isHorizontalBanner) {
        // 横幅模式优化：根据容器高度计算行数
        const availableHeightH = actualHeight - 24; // 减去padding
        const maxLinesByHeight = Math.floor(availableHeightH / (baseFontSize * 1.5));
        maxLines = Math.max(1, Math.min(maxLinesByHeight, poem.lines.length, 8));
      } else if (useTwoColumns) {
        // 双栏模式：每栏可容纳行数 = 单栏容量，总容量翻倍
        const availableHeightTC = actualHeight - 50; // 双栏时头部空间更紧凑
        const linesPerColumn = Math.max(1, Math.floor(availableHeightTC / lineHeightPx));
        maxLines = Math.min(linesPerColumn * 2, poem.lines.length);
        // 如果每栏只能显示 1 行，双栏无意义，退回单栏
        if (linesPerColumn < 2 || maxLines <= 4) {
          maxLines = maxLinesSingle;
          useTwoColumns = false;
        }
      } else {
        // 单栏居中模式
        maxLines = maxLinesSingle;
      }

      const linesToShow = poem.lines.slice(0, maxLines);

      // 使用 buildLinesContent 统一渲染（复用展开/收起逻辑）
      const builtContent = buildLinesContent(linesToShow, maxLines, useTwoColumns, baseFontSize, isHorizontalBanner);
      content.appendChild(builtContent);

      if (poem.lines.length > maxLines) {
        const more = document.createElement('div');
        more.className = 'poemblock-line poemblock-line-fade';
        more.style.animationDelay = (linesToShow.length * 0.08) + 's';
        more.style.opacity = '0.6';
        more.style.fontSize = '0.75em';
        more.textContent = '...';
        content.appendChild(more);
      }

      // 关闭按钮（X）
      var closeBtn = document.createElement('div');
      closeBtn.className = 'poemblock-close-btn';
      closeBtn.title = '关闭';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        container.classList.add('poemblock-dismissed');
        // 通知 background 记忆关闭状态
        chrome.runtime.sendMessage({
          action: 'dismissPoem',
          poemIndex: parseInt(container.dataset.poemIndex, 10),
        });
      });
      container.appendChild(closeBtn);

      // 如果诗词行数超出了显示范围，添加展开/收缩功能
      var isExpanded = false;
      var fullLines = poem.lines;
      var displayedLines = linesToShow;

      // 检测是否被截断
      if (poem.lines.length > maxLines) {
        var expandToggle = document.createElement('div');
        expandToggle.className = 'poemblock-line poemblock-expand-toggle';
        expandToggle.textContent = '... 展开全文';
        expandToggle.addEventListener('click', function(e) {
          e.stopPropagation();
          isExpanded = !isExpanded;
          // 替换内容区域
          var oldContent = container.querySelector('.poemblock-content');
          var oldToggle = container.querySelector('.poemblock-expand-toggle');
          if (isExpanded) {
            // 展开：显示所有行
            var newContent = buildLinesContent(poem.lines, maxLines, useTwoColumns, baseFontSize, isHorizontalBanner);
            if (oldContent) container.replaceChild(newContent, oldContent);
            expandToggle.textContent = '△ 收起';
          } else {
            // 收起：显示截断版
            var newContent = buildLinesContent(poem.lines.slice(0, maxLines), maxLines, useTwoColumns, baseFontSize, isHorizontalBanner);
            if (oldContent) container.replaceChild(newContent, oldContent);
            expandToggle.textContent = '... 展开全文';
          }
        });
        content.appendChild(expandToggle);
      }

      container.appendChild(header);
      container.appendChild(content);

      container.dataset.poemIndex = poemIndex;
      container.dataset.showNextButton = response.preferences ? String(response.preferences.showNextButton !== false) : 'true';
      container.dataset.useTwoColumns = String(useTwoColumns);
      container.dataset.isHorizontalBanner = String(isHorizontalBanner);
      container.dataset.baseFontSize = String(baseFontSize);
      container.dataset.maxLines = String(maxLines);

      // 下一首/下一条按钮（根据用户偏好）
      var showNext = container.dataset.showNextButton !== 'false';
      if (showNext) {
        var nextBtn = document.createElement('div');
        nextBtn.className = 'poemblock-next-btn';
        nextBtn.title = isExcerpt ? '下一条' : '下一首';
        nextBtn.textContent = '▶';
        nextBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (isExcerpt) {
            var ci = parseInt(container.dataset.poemIndex, 10);
            requestNextExcerpt(ci >= 0 ? ci : undefined, function(resp) {
              if (resp && resp.excerpt) {
                // 将新文摘转换为诗歌格式重建显示
                var newPoem = excerptToPoem(resp.excerpt);
                rebuildPoemDisplay(container, shadowRoot, { poem: newPoem, index: resp.index });
                // 更新文摘标记：在重建后需要重新标记isExcerpt，这里通过dataset传递
                container.dataset.isExcerpt = 'true';
                // 更新标题区域为文摘格式
                var te = container.querySelector('.poemblock-title');
                var ae = container.querySelector('.poemblock-author');
                if (te) {
                  if (resp.excerpt.author && resp.excerpt.source) {
                    te.textContent = resp.excerpt.author + ' · ' + resp.excerpt.source;
                  } else {
                    te.textContent = resp.excerpt.author || resp.excerpt.source || '';
                  }
                }
                if (ae) ae.style.display = 'none';
              }
            });
          } else {
            var ci = parseInt(container.dataset.poemIndex, 10);
            requestNextPoem(ci, function(resp) {
              if (resp && resp.poem) rebuildPoemDisplay(container, shadowRoot, resp);
            });
          }
        });
        container.appendChild(nextBtn);
      }

      // 点击跳转（文摘无来源链接，仅做动画反馈）
      container.addEventListener('click', (e) => {
        e.stopPropagation();

        container.classList.add('poemblock-clicked');
        setTimeout(() => container.classList.remove('poemblock-clicked'), 300);

        if (isExcerpt) return;

        // 延迟导航让动画先播放（6ms = 约 1 帧 @60fps，通常足够触发 Composite）
        setTimeout(() => {
          // 主方案：window.open 打开链接
          const opened = window.open(poem.source, '_blank');

          // 备用方案：若被弹窗拦截（opened 为 null），使用 <a> 标签模拟点击
          if (!opened || opened.closed) {
            const a = document.createElement('a');
            a.href = poem.source;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }, 100); // 100ms 足够动画呈现后再导航
      });

      shadowRoot.appendChild(container);

      // 安全检查（在替换前再次验证）
      const isPageContent = adNode.tagName === 'MAIN' ||
        adNode.tagName === 'NAV' ||
        adNode.tagName === 'ARTICLE' ||
        adNode.tagName === 'HEADER' ||
        adNode.tagName === 'FOOTER' ||
        adNode.tagName === 'SECTION' ||
        adNode.id === 'main' ||
        adNode.id === 'content' ||
        adNode.id === 'wrapper' ||
        adNode.id === 'container';

      if (isPageContent) {
        console.warn('[Poemblock] 安全保护：跳过替换页面主要内容元素', adNode);
        delete adNode.dataset.poemProcessed;
        replaceCount = Math.max(0, replaceCount - 1);
        return;
      }

      // 同步原广告位的布局属性
      try {
        adNode.style.setProperty('width', actualWidth + 'px', 'important');
        adNode.style.setProperty('height', actualHeight + 'px', 'important');

        // 如果父容器是 flex/grid，设置额外属性以确保尺寸生效
        if (parentDisplay && (parentDisplay === 'flex' || parentDisplay === 'inline-flex')) {
          adNode.style.setProperty('flex', 'none', 'important');
        }

        adNode.style.setProperty('position', positionType === 'static' ? 'relative' : positionType, 'important');
        adNode.style.setProperty('z-index', zIndex === 'auto' ? '10' : zIndex, 'important');
        adNode.style.setProperty('overflow', 'hidden', 'important');
        adNode.style.setProperty('display', 'block', 'important');
        adNode.style.setProperty('visibility', 'visible', 'important');
        adNode.style.setProperty('opacity', '1', 'important');
      } catch (e) {
        console.warn('[Poemblock] 设置样式时出错', e);
      }

      // 清空并插入 Shadow Host
      try {
        while (adNode.firstChild) {
          adNode.removeChild(adNode.firstChild);
        }
        adNode.appendChild(shadowHost);
        console.log('[Poemblock] 广告替换成功 #' + replaceCount);
      } catch (e) {
        console.error('[Poemblock] 替换广告时出错', e);
        delete adNode.dataset.poemProcessed;
        replaceCount = Math.max(0, replaceCount - 1);
      }
    } catch (e) {
      console.error('[Poemblock] 处理诗歌时出错', e);
      delete adNode.dataset.poemProcessed;
      replaceCount = Math.max(0, replaceCount - 1);
    }
  });
} catch (e) {
  console.error('[Poemblock] 替换广告时出错', e);
  // 出错时确保标记被清除
  try {
    if (adNode.dataset.poemProcessed === 'true') {
      delete adNode.dataset.poemProcessed;
    }
  } catch (e2) {}
  }
}

// ============================================================
// Display 模块 — 诗歌内容构建
// ============================================================

// ===== 构建诗歌内容块（用于展开/收起） =====
function buildLinesContent(lines, maxLines, useTwoColumns, baseFontSize, isHorizontalBanner) {
  var content = document.createElement('div');
  content.className = 'poemblock-content';

  var linesToShow = lines;
  if (useTwoColumns) {
    var totalLines = linesToShow.length;
    var half = Math.ceil(totalLines / 2);
    var col1Lines = linesToShow.slice(0, half);
    var col2Lines = linesToShow.slice(half, totalLines);
    while (col2Lines.length < col1Lines.length) {
      col2Lines.push('');
    }

    var col1 = document.createElement('div');
    col1.className = 'poemblock-content-col';
    var col2 = document.createElement('div');
    col2.className = 'poemblock-content-col';

    col1Lines.forEach(function(lineText, idx) {
      var line = document.createElement('div');
      line.className = 'poemblock-line poemblock-line-fade';
      line.style.animationDelay = (idx * 0.08) + 's';
      line.textContent = lineText;
      col1.appendChild(line);
    });
    col2Lines.forEach(function(lineText, idx) {
      var line = document.createElement('div');
      if (lineText === '') {
        line.className = 'poemblock-line-empty';
        line.innerHTML = '&nbsp;';
      } else {
        line.className = 'poemblock-line poemblock-line-fade';
        line.style.animationDelay = ((idx + col1Lines.length) * 0.08) + 's';
        line.textContent = lineText;
      }
      col2.appendChild(line);
    });
    content.appendChild(col1);
    content.appendChild(col2);
  } else {
    linesToShow.forEach(function(lineText, idx) {
      var line = document.createElement('div');
      line.className = 'poemblock-line poemblock-line-fade';
      line.style.animationDelay = (idx * 0.08) + 's';
      line.textContent = lineText;
      content.appendChild(line);
    });
  }

  return content;
}

// ============================================================
// Scanner 模块 — DOM 观察与扫描
// ============================================================

// 增强版 DOM 观察器：累积所有新增节点，防抖后统一处理，避免闭包过时
let pendingAdNodes = new Set();
let observerTimer = null;
const observer = new MutationObserver((mutations) => {
  if (replaceCount >= MAX_REPLACE_PER_SESSION) return;

  // 累积所有新增的元素节点
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        pendingAdNodes.add(node);
      }
    }
  }

  // 防抖：延迟处理，避免短时间内大量触发
  if (observerTimer) clearTimeout(observerTimer);
  observerTimer = setTimeout(() => {
    const nodesToCheck = Array.from(pendingAdNodes);
    pendingAdNodes.clear();
    for (const node of nodesToCheck) {
      try {
        // 跳过已断开连接的节点
        if (!node.isConnected) continue;
        // 跳过已处理的父级
        if (node.closest('[data-poem-processed="true"]')) continue;
        if (isPotentialAd(node)) {
          replaceAdWithPoem(node);
          if (replaceCount >= MAX_REPLACE_PER_SESSION) break;
        }
      } catch (e) {
        console.warn('[Poemblock] 观察器处理节点出错:', e);
      }
    }
  }, 1500); // 1500ms 防抖
});

// 开始观察（安全检测 document.body 是否存在）
function startObserver() {
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    // body 尚未就绪，等待 DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
}
startObserver();

// 增强的初始检查
function initialAdScan() {
  console.log('[Poemblock] ========== 开始初始扫描 ==========');
  let foundCount = 0;

  // Tier 1: 已知广告标记
  for (const selector of KNOWN_AD_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!el.closest('[data-poem-processed="true"]')) {
          replaceAdWithPoem(el);
          foundCount++;
        }
      });
    } catch (e) {
      console.warn('[Poemblock] 选择器扫描错误:', selector, e);
    }
  }

  // Tier 2: 精确类名/ID模式
  for (const selector of SPECIFIC_AD_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!el.closest('[data-poem-processed="true"]') && isPotentialAd(el)) {
          replaceAdWithPoem(el);
          foundCount++;
        }
      });
    } catch (e) {
      console.warn('[Poemblock] 选择器扫描错误:', selector, e);
    }
  }

  console.log('[Poemblock] ========== 初始扫描完成，找到 ' + foundCount + ' 个广告 ==========');

  // 延迟再扫描，捕获懒加载广告
  setTimeout(() => {
    console.log('[Poemblock] ========== 执行延迟再扫描 (3秒) ==========');
    let delayedFound = 0;
    const selectors = [...KNOWN_AD_SELECTORS, ...SPECIFIC_AD_SELECTORS];
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (!el.closest('[data-poem-processed="true"]') && isPotentialAd(el)) {
            replaceAdWithPoem(el);
            delayedFound++;
          }
        });
      } catch (e) {}
    }
    console.log('[Poemblock] ========== 延迟扫描(3s)找到 ' + delayedFound + ' 个广告 ==========');
  }, 3000);

  // 额外延迟扫描，捕获更晚加载的广告（如某些延迟加载的广告位）
  setTimeout(() => {
    console.log('[Poemblock] ========== 执行延迟再扫描 (5秒) ==========');
    let lateFound = 0;
    const selectors = [...KNOWN_AD_SELECTORS, ...SPECIFIC_AD_SELECTORS];
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (!el.closest('[data-poem-processed="true"]') && isPotentialAd(el)) {
            replaceAdWithPoem(el);
            lateFound++;
          }
        });
      } catch (e) {}
    }
    // 额外扫描所有 iframe（不局限于已知选择器）
    try {
      const allIframes = document.querySelectorAll('iframe');
      allIframes.forEach(iframe => {
        if (!iframe.closest && !iframe.closest('[data-poem-processed="true"]') && isPotentialAd(iframe)) {
          replaceAdWithPoem(iframe);
          lateFound++;
        }
      });
    } catch (e) {}
    console.log('[Poemblock] ========== 延迟扫描(5s)找到 ' + lateFound + ' 个广告 ==========');
  }, 5000);
}

// 延迟执行初始扫描，避免阻塞页面加载
function startAdScan() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialAdScan, 300);
    });
  } else {
    setTimeout(initialAdScan, 300);
  }
}

// 开始扫描
try {
  startAdScan();
} catch (e) {
  console.error('[Poemblock] 启动扫描失败:', e);
}

  // ============================================================
  // 公开 API
  // ============================================================
  return {
    init: startAdScan,
    diagnose: diagnosePage,
  };
})();
