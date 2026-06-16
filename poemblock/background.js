// background.js

// 缓存诗歌列表
let poemCache = [];
let isFetchingPoems = false;
let isFetchingExcerpts = false;
let onlineExcerptsLoaded = false;    // 在线文摘是否已成功加载
let onlineExcerptsLoading = false;   // 在线文摘是否正在加载中
let onlineExcerptsError = null;      // 在线文摘加载错误信息
let fetchExcerptsRetryCount = 0;     // 在线文摘重试次数
const MAX_FETCH_RETRIES = 3;         // 最大重试次数
let dismissedIndices = new Set();

// 文摘缓存
let excerptCache = [];
let excerptDismissed = new Set();

// 会话统计
let sessionStats = { poemsDisplayed: 0, adsReplaced: 0, excerptsDisplayed: 0 };

// 硬编码回退诗歌（当所有加载都失败时使用）
const fallbackPoems = [
  // 中国古代诗
  {
    title: "静夜思",
    author: "李白",
    lines: ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"],
    source: "https://www.gushiwen.cn/"
  },
  {
    title: "春晓",
    author: "孟浩然",
    lines: ["春眠不觉晓", "处处闻啼鸟", "夜来风雨声", "花落知多少"],
    source: "https://www.gushiwen.cn/"
  },
  
  // 中国现代诗（偏冷门深度）
  {
    title: "断章",
    author: "卞之琳",
    lines: [
      "你站在桥上看风景",
      "看风景的人在楼上看你",
      "明月装饰了你的窗子",
      "你装饰了别人的梦"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "赞美",
    author: "穆旦",
    lines: [
      "走不尽的山峦的起伏，河流和草原",
      "数不尽的密密的村庄，鸡鸣和狗吠",
      "接连在原是荒凉的亚洲的土地上",
      "在野草的茫茫中呼啸着干燥的风"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "蛇",
    author: "冯至",
    lines: [
      "我的寂寞是一条长蛇",
      "静静地没有言语",
      "你万一梦到它时",
      "千万啊，不要悚惧！"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "妆台",
    author: "废名",
    lines: [
      "因为梦里梦见我是个镜子",
      "沉在海里他将也是个镜子",
      "一位女郎拾去",
      "她将放上她的妆台"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "金黄的稻束",
    author: "郑敏",
    lines: [
      "金黄的稻束站在",
      "割过的秋天的田里",
      "我想起无数个疲倦的母亲",
      "黄昏的路上我看见那皱了的美丽的脸"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "航",
    author: "辛笛",
    lines: [
      "帆起了",
      "帆向落日的去处",
      "明净与古老",
      "风帆吻着暗色的水"
    ],
    source: "https://www.shicimingju.com/"
  },
  
  // 中国当代诗
  {
    title: "一棵开花的树",
    author: "席慕蓉",
    lines: [
      "如何让你遇见我",
      "在我最美丽的时刻",
      "为这",
      "我已在佛前求了五百年"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "回答",
    author: "北岛",
    lines: [
      "卑鄙是卑鄙者的通行证",
      "高尚是高尚者的墓志铭",
      "看吧，在那镀金的天空中",
      "飘满了死者弯曲的倒影"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "面朝大海，春暖花开",
    author: "海子",
    lines: [
      "从明天起，做一个幸福的人",
      "喂马，劈柴，周游世界",
      "从明天起，关心粮食和蔬菜",
      "我有一所房子，面朝大海，春暖花开"
    ],
    source: "https://www.shicimingju.com/"
  },
  
  // 英美现代诗（偏冷门深度 - 包含英国诗歌学会风格）
  {
    title: "The Snow Man",
    author: "Wallace Stevens",
    lines: [
      "One must have a mind of winter",
      "To regard the frost and the boughs",
      "Of the pine-trees crusted with snow;",
      "And have been cold a long time"
    ],
    source: "https://www.poetryfoundation.org/poems/45288/the-snow-man-wallace-stevens"
  },
  {
    title: "The Emperor of Ice-Cream",
    author: "Wallace Stevens",
    lines: [
      "Call the roller of big cigars,",
      "The muscular one, and bid him whip",
      "In kitchen cups concupiscent curds.",
      "Let the wenches dawdle in such dress"
    ],
    source: "https://www.poetryfoundation.org/poems/43485/the-emperor-of-ice-cream-wallace-stevens"
  },
  {
    title: "At the Fishhouses",
    author: "Elizabeth Bishop",
    lines: [
      "Although it is a cold evening,",
      "down by one of the fishhouses",
      "an old man sits netting,",
      "his net, in the gloaming almost invisible"
    ],
    source: "https://www.poetryfoundation.org/poems/52084/at-the-fishhouses-elizabeth-bishop"
  },
  {
    title: "The Fish",
    author: "Elizabeth Bishop",
    lines: [
      "I caught a tremendous fish",
      "and held him beside the boat",
      "half out of water, with my hook",
      "fast in a corner of his mouth."
    ],
    source: "https://www.poetryfoundation.org/poems/42860/the-fish-elizabeth-bishop"
  },
  {
    title: "The Idea of Order at Key West",
    author: "Wallace Stevens",
    lines: [
      "She sang beyond the genius of the sea.",
      "The water never formed to mind or voice,",
      "Like a body wholly body, fluttering",
      "Its empty sleeves; and yet its mimic motion"
    ],
    source: "https://www.poetryfoundation.org/poems/44400/the-idea-of-order-at-key-west-wallace-stevens"
  },
  {
    title: "The Bight",
    author: "Elizabeth Bishop",
    lines: [
      "At low tide like this how sheer the water is.",
      "White, crumbling ribs of marl protrude and glare",
      "and the boats are dry, the pilings dry as matches,",
      "absorbing, rather than being absorbed,"
    ],
    source: "https://www.poetryfoundation.org/poems/52083/the-bight-elizabeth-bishop"
  },
  {
    title: "Anecdote of the Jar",
    author: "Wallace Stevens",
    lines: [
      "I placed a jar in Tennessee,",
      "And round it was, upon a hill.",
      "It made the slovenly wilderness",
      "Surround that hill."
    ],
    source: "https://www.poetryfoundation.org/poems/45287/anecdote-of-the-jar-wallace-stevens"
  },
  {
    title: "To Brooklyn Bridge",
    author: "Hart Crane",
    lines: [
      "How many dawns, chill from his rippling rest",
      "The seagull’s wings shall dip and pivot him,",
      "Shedding white rings of tumult, building high",
      "Over the chained bay waters Liberty—"
    ],
    source: "https://www.poetryfoundation.org/poems/44286/to-brooklyn-bridge-hart-crane"
  },
  {
    title: "The Fish",
    author: "Marianne Moore",
    lines: [
      "wade through black jade.",
      "Of the crow-blue mussel-shells, one keeps",
      "adjusting the ash-heaps;",
      "opening and shutting itself like an"
    ],
    source: "https://www.poetryfoundation.org/poems/44280/the-fish-marianne-moore"
  },
  {
    title: "Poetry",
    author: "Marianne Moore",
    lines: [
      "I, too, dislike it: there are things that are important beyond",
      "all this fiddle. Reading it, however, with a perfect contempt",
      "for it, one discovers in it, after all, a place for the genuine."
    ],
    source: "https://www.poetryfoundation.org/poems/44279/poetry-marianne-moore"
  },
  {
    title: "The Unknown Citizen",
    author: "W.H. Auden",
    lines: [
      "He was found by the Bureau of Statistics to be",
      "One against whom there was no official complaint,",
      "And all the reports on his conduct agree",
      "That, in the modern sense of an old-fashioned word, he was a saint,"
    ],
    source: "https://www.poetryfoundation.org/poems/46548/the-unknown-citizen-w-h-auden"
  },
  {
    title: "Funeral Blues",
    author: "W.H. Auden",
    lines: [
      "Stop all the clocks, cut off the telephone,",
      "Prevent the dog from barking with a juicy bone,",
      "Silence the pianos and with muffled drum",
      "Bring out the coffin, let the mourners come."
    ],
    source: "https://www.poetryfoundation.org/poems/47559/funeral-blues-w-h-auden"
  },
  {
    title: "September 1, 1939",
    author: "W.H. Auden",
    lines: [
      "I sit in one of the dives",
      "On Fifty-second Street",
      "Uncertain and afraid",
      "As the clever hopes expire"
    ],
    source: "https://www.poetryfoundation.org/poems/46106/september-1-1939-w-h-auden"
  },
  {
    title: "The Love Song of J. Alfred Prufrock",
    author: "T.S. Eliot",
    lines: [
      "Let us go then, you and I,",
      "When the evening is spread out against the sky",
      "Like a patient etherized upon a table;",
      "Let us go, through certain half-deserted streets,"
    ],
    source: "https://www.poetryfoundation.org/poems/44212/the-love-song-of-j-alfred-prufrock-t-s-eliot"
  },
  {
    title: "The Hollow Men",
    author: "T.S. Eliot",
    lines: [
      "We are the hollow men",
      "We are the stuffed men",
      "Leaning together",
      "Headpiece filled with straw. Alas!"
    ],
    source: "https://www.poetryfoundation.org/poems/44213/the-hollow-men-t-s-eliot"
  },
  {
    title: "Do not go gentle into that good night",
    author: "Dylan Thomas",
    lines: [
      "Do not go gentle into that good night,",
      "Old age should burn and rave at close of day;",
      "Rage, rage against the dying of the light."
    ],
    source: "https://www.poetryfoundation.org/poems/51625/do-not-go-gentle-into-that-good-night-dylan-thomas"
  },
  {
    title: "Fern Hill",
    author: "Dylan Thomas",
    lines: [
      "Now as I was young and easy under the apple boughs",
      "About the lilting house and happy as the grass was green,",
      "The night above the dingle starry,"
    ],
    source: "https://www.poetryfoundation.org/poems/51627/fern-hill-dylan-thomas"
  },
  {
    title: "The Force That through the Green Fuse Drives the Flower",
    author: "Dylan Thomas",
    lines: [
      "The force that through the green fuse drives the flower",
      "Drives my green age; that blasts the roots of trees",
      "Is my destroyer."
    ],
    source: "https://www.poetryfoundation.org/poems/51626/the-force-that-through-the-green-fuse-drives-the-flower-dylan-thomas"
  },
  {
    title: "The Tyger",
    author: "William Blake",
    lines: [
      "Tyger Tyger, burning bright,",
      "In the forests of the night;",
      "What immortal hand or eye,",
      "Could frame thy fearful symmetry?"
    ],
    source: "https://www.poetryfoundation.org/poems/43011/the-tyger-william-blake"
  },
  {
    title: "London",
    author: "William Blake",
    lines: [
      "I wander through each chartered street,",
      "Near where the chartered Thames does flow.",
      "And mark in every face I meet",
      "Marks of weakness, marks of woe."
    ],
    source: "https://www.poetryfoundation.org/poems/43010/london-william-blake"
  },
  {
    title: "Ode to the West Wind",
    author: "Percy Bysshe Shelley",
    lines: [
      "O wild West Wind, thou breath of Autumn's being,",
      "Thou, from whose unseen presence the leaves dead",
      "Are driven, like ghosts from an enchanter fleeing,"
    ],
    source: "https://www.poetryfoundation.org/poems/45187/ode-to-the-west-wind-percy-bysshe-shelley"
  },
  {
    title: "To a Skylark",
    author: "Percy Bysshe Shelley",
    lines: [
      "Hail to thee, blithe Spirit!",
      "Bird thou never wert,",
      "That from Heaven, or near it,"
    ],
    source: "https://www.poetryfoundation.org/poems/45188/to-a-skylark-percy-bysshe-shelley"
  },
  {
    title: "Ode on a Grecian Urn",
    author: "John Keats",
    lines: [
      "Thou still unravish'd bride of quietness,",
      "Thou foster-child of silence and slow time,",
      "Sylvan historian, who canst thus express"
    ],
    source: "https://www.poetryfoundation.org/poems/44412/ode-on-a-grecian-urn-john-keats"
  },
  {
    title: "Ode to a Nightingale",
    author: "John Keats",
    lines: [
      "My heart aches, and a drowsy numbness pains",
      "My sense, as though of hemlock I had drunk,",
      "Or emptied some dull opiate to the drains"
    ],
    source: "https://www.poetryfoundation.org/poems/44411/ode-to-a-nightingale-john-keats"
  },
  
  // 英美经典现代诗（保留热门作为平衡）
  {
    title: "再别康桥",
    author: "徐志摩",
    lines: [
      "轻轻的我走了",
      "正如我轻轻的来",
      "我轻轻的招手",
      "作别西天的云彩"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "雨巷",
    author: "戴望舒",
    lines: [
      "撑着油纸伞",
      "独自彷徨在悠长",
      "悠长又寂寥的雨巷",
      "我希望逢着"
    ],
    source: "https://www.shicimingju.com/"
  },
  {
    title: "The Road Not Taken",
    author: "Robert Frost",
    lines: [
      "Two roads diverged in a yellow wood,",
      "And sorry I could not travel both",
      "And be one traveler, long I stood",
      "And looked down one as far as I could"
    ],
    source: "https://www.poetryfoundation.org/poems/42871/the-road-not-taken"
  },
  {
    title: "Because I could not stop for Death",
    author: "Emily Dickinson",
    lines: [
      "Because I could not stop for Death –",
      "He kindly stopped for me –",
      "The Carriage held but just Ourselves –",
      "And Immortality."
    ],
    source: "https://www.poetryfoundation.org/poems/47652/because-i-could-not-stop-for-death"
  }
];

// ====================================================================
// 文摘回退数据库
// ====================================================================
const fallbackExcerpts = [
  { text: "人的一切痛苦，本质上都是对自己的无能的愤怒。", source: "《沉默的大多数》", author: "王小波" },
  { text: "生活不能等待别人来安排，要自己去争取和奋斗。", source: "《平凡的世界》", author: "路遥" },
  { text: "人是为了活着本身而活着，而不是为了活着之外的任何事物而活着。", source: "《活着》", author: "余华" },
  { text: "世界上只有一种真正的英雄主义，那就是在认清生活真相之后依然热爱生活。", source: "《西西弗神话》", author: "罗曼·罗兰" },
  { text: "满地都是六便士，他却抬头看见了月亮。", source: "《月亮和六便士》", author: "毛姆" },
  { text: "一个人可以被毁灭，但不能被打败。", source: "《老人与海》", author: "海明威" },
  { text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", source: "Pride and Prejudice", author: "Jane Austen" },
  { text: "It was the best of times, it was the worst of times.", source: "A Tale of Two Cities", author: "Charles Dickens" },
  { text: "The only thing necessary for the triumph of evil is for good men to do nothing.", source: "Attributed", author: "Edmund Burke" },
  { text: "Two roads diverged in a wood, and I—I took the one less traveled by, And that has made all the difference.", source: "The Road Not Taken", author: "Robert Frost" },
  { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", source: "Self-Reliance", author: "Ralph Waldo Emerson" },
  { text: "We are all in the gutter, but some of us are looking at the stars.", source: "Lady Windermere's Fan", author: "Oscar Wilde" },
  { text: "All animals are equal, but some animals are more equal than others.", source: "Animal Farm", author: "George Orwell" },
  { text: "The unexamined life is not worth living.", source: "Apology", author: "Socrates" },
  { text: "生命中最重要的是找到值得为之活着的东西。", source: "《卡拉马佐夫兄弟》", author: "陀思妥耶夫斯基" },
];
excerptCache = [...fallbackExcerpts];

async function fetchPoems() {
  if (isFetchingPoems) return;
  isFetchingPoems = true;

  try {
    const promises = [];

    // 今日诗词 (中文)
    promises.push(
      Promise.all(
        Array.from({ length: 3 }, () =>
          fetch('https://v1.jinrishici.com/all.json')
            .then(r => r.json())
            .then(dataZh => {
              if (dataZh && dataZh.content) {
                poemCache.push({
                  title: dataZh.origin || '无题',
                  author: dataZh.author || '佚名',
                  lines: dataZh.content.split(/[，。！？\n]/).filter(s => s.trim()),
                  source: dataZh.source || 'https://www.gushiwen.cn/'
                });
              }
            }).catch(e => console.warn('Poemblock: 今日诗词获取失败:', e))
        )
      )
    );

    // PoetryDB.org (英文诗歌)
    promises.push(
      fetch('https://api.poetrydb.org/author/Emily%20Dickinson')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            data.slice(0, 5).forEach(p => {
              if (p && p.lines && p.lines.length > 0) {
                poemCache.push({
                  title: p.title || 'Untitled',
                  author: p.author || 'Unknown',
                  lines: p.lines.filter(l => l.trim()),
                  source: 'https://www.poetryfoundation.org/',
                  tags: ['english'],
                });
              }
            });
          }
        }).catch(e => console.warn('Poemblock: PoetryDB 获取失败:', e))
    );

    await Promise.allSettled(promises);

    // 去重（避免重复的诗歌）
    const seen = new Set();
    poemCache = poemCache.filter(item => {
      const key = `${item.title}-${item.author}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 重新标记所有诗歌的语言标签（在线补充的诗可能未带 tags 字段）
    tagAllPoems();

    console.log(`Poemblock: ${poemCache.length} poems loaded (在线补充)`);

    // 打乱顺序
    poemCache.sort(() => Math.random() - 0.5);

    console.log(`Poemblock: ${poemCache.length} poems loaded (主要为内置)`);
  } catch (error) {
    console.error('Failed to fetch poems:', error);
    // 确保缓存中至少有备用诗
    if (poemCache.length === 0) {
      poemCache = [...fallbackPoems];
    }
  } finally {
    isFetchingPoems = false;
  }
}

async function fetchLocalPoems() {
  try {
    // 加载本地 JSON 诗歌数据库
    const [chineseResp, englishResp] = await Promise.allSettled([
      fetch(chrome.runtime.getURL('src/data/poems_chinese.json')),
      fetch(chrome.runtime.getURL('src/data/poems_english.json'))
    ]);

    const localPoems = [];

    if (chineseResp.status === 'fulfilled' && chineseResp.value.ok) {
      const chinesePoems = await chineseResp.value.json();
      if (Array.isArray(chinesePoems)) {
        localPoems.push(...chinesePoems);
        console.log(`Poemblock: 加载了 ${chinesePoems.length} 首中文诗歌`);
      }
    }

    if (englishResp.status === 'fulfilled' && englishResp.value.ok) {
      const englishPoems = await englishResp.value.json();
      if (Array.isArray(englishPoems)) {
        localPoems.push(...englishPoems);
        console.log(`Poemblock: 加载了 ${englishPoems.length} 首英文诗歌`);
      }
    }

    // 去重后合并到主缓存
    const seen = new Set();
    const merged = [...fallbackPoems, ...localPoems].filter(item => {
      const key = `${item.title}-${item.author}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    poemCache = merged.sort(() => Math.random() - 0.5);
    tagAllPoems();
    console.log(`Poemblock: 共 ${poemCache.length} 首诗歌就绪`);
  } catch (error) {
    console.error('Poemblock: 加载本地诗歌失败，使用回退数据库', error);
    poemCache = [...fallbackPoems].sort(() => Math.random() - 0.5);
  }
}

// ====================================================================
// 文摘引擎
// ====================================================================

async function fetchLocalExcerpts() {
  try {
    const resp = await fetch(chrome.runtime.getURL('src/data/excerpts.json'));
    if (resp.ok) {
      const excerpts = await resp.json();
      if (Array.isArray(excerpts) && excerpts.length > 0) {
        // 合并本地文摘 + 已有的在线文摘（如果有的话），避免覆盖在线数据
        const existingIds = new Set(excerptCache.map(e => e.text + e.author));
        const merged = [
          ...excerptCache, // 保留已有的（可能包含在线获取的）
          ...excerpts.filter(e => !existingIds.has(e.text + e.author)) // 追加不重复的本地文摘
        ];
        excerptCache = merged.sort(() => Math.random() - 0.5);
        console.log(`Poemblock: 加载了 ${excerpts.length} 条文摘，合并后共 ${excerptCache.length} 条`);
        return;
      }
    }
  } catch (e) {
    console.warn('Poemblock: 加载本地文摘失败', e);
  }
  console.log(`Poemblock: 使用 ${excerptCache.length} 条回退文摘`);
}

// 在线获取文摘（增强版: 多API聚合 + 按作者精确获取书中原句）
async function fetchOnlineExcerpts() {
  if (isFetchingExcerpts) return;
  isFetchingExcerpts = true;
  try {
    const promises = [];

    // ================================================================
    // 替换: Quotable API (已停用) → DummyJSON Quotes (免费免Key)
    // API: https://dummyjson.com/quotes?limit=30
    // 返回 { quotes: [{ id, quote, author }] }
    // ================================================================
    promises.push(
      fetch('https://dummyjson.com/quotes?limit=30')
        .then(r => r.json())
        .then(data => {
          if (data && Array.isArray(data.quotes)) {
            for (const q of data.quotes) {
              if (q.quote && q.author) {
                excerptCache.push({
                  text: q.quote,
                  source: 'Great Minds',
                  author: q.author,
                });
              }
            }
          }
        }).catch(e => console.warn('Poemblock: DummyJSON 初始获取失败:', e))
    );

    // 额外随机获取（保证多样性）
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetch('https://dummyjson.com/quotes?limit=10&skip=' + (i * 10))
          .then(r => r.json())
          .then(data => {
            if (data && Array.isArray(data.quotes)) {
              for (const q of data.quotes) {
                if (q.quote && q.author) {
                  excerptCache.push({
                    text: q.quote,
                    source: 'Great Minds',
                    author: q.author,
                  });
                }
              }
            }
          }).catch(e => console.warn('Poemblock: DummyJSON 额外获取失败:', e))
      );
    }

    // ================================================================
    // 方案A: LitQuotes.com — 文学引文网站
    // 用 3 个随机页面获取书中原句
    // ================================================================
    const LIT_QUOTES_PAGES = [
      'https://www.litquotes.com/quote_index_result.php?search_type=random',
      'https://www.litquotes.com/quote_index_result.php?search_type=random&page=2',
      'https://www.litquotes.com/quote_index_result.php?search_type=random&page=3',
    ];
    for (const url of LIT_QUOTES_PAGES) {
      promises.push(
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
          .then(r => r.text())
          .then(html => {
            // 解析 LitQuotes 页面，提取引文区块
            // 格式: <blockquote><p>"引文"</p></blockquote> <p>— 作者, 《书名》</p>
            const blockquotes = html.match(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi) || [];
            const sources = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
            for (let i = 0; i < Math.min(blockquotes.length, 5); i++) {
              // 提取引文文本
              let text = blockquotes[i].replace(/<\/?[^>]+(>|$)/g, '').trim();
              text = text.replace(/^["""]|["""]$/g, '').trim();
              if (!text || text.length < 10) continue;
              // 查找对应的来源
              let source = '';
              let author = '';
              for (const s of sources) {
                const sText = s.replace(/<\/?[^>]+(>|$)/g, '').trim();
                if (sText.includes('—') || sText.includes('–') || sText.includes('-')) {
                  const parts = sText.replace(/^—\s*/, '').split(/[,，、]/);
                  if (parts.length >= 1) {
                    author = parts[0].trim();
                    if (parts.length >= 2) source = parts.slice(1).join(', ').trim();
                  }
                }
              }
              excerptCache.push({
                text,
                source: source || 'Classic Literature',
                author: author || 'Unknown',
              });
            }
          }).catch(e => console.warn('Poemblock: LitQuotes 解析失败:', e))
        );
      }

    // ================================================================
    // 今日诗词 API — 中文诗句作为文摘 (复用 fetchPoems 已成功验证的 API)
    // API: https://v1.jinrishici.com/all.json
    // ================================================================
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetch('https://v1.jinrishici.com/all.json')
          .then(r => r.json())
          .then(data => {
            if (data && data.content) {
              excerptCache.push({
                text: data.content,
                source: data.origin || '古诗',
                author: data.author || '佚名',
              });
            }
          }).catch(e => console.warn('Poemblock: 今日诗词文摘获取失败:', e.message))
      );
    }

    // ================================================================
    // 今日诗词·抒情 (中文) — 更多中文诗词抒情句子
    // API: https://v1.jinrishici.com/shuqing
    // ================================================================
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetch('https://v1.jinrishici.com/shuqing')
          .then(r => r.json())
          .then(data => {
            if (data && data.content) {
              excerptCache.push({
                text: data.content,
                source: data.origin || '古诗',
                author: data.author || '佚名',
              });
            }
          }).catch(e => console.warn('Poemblock: 今日诗词抒情获取失败:', e.message))
      );
    }

    // ================================================================
    // Hitokoto 一言 (中文) — 增强版：循环获取多条
    // ================================================================
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch('https://v1.hitokoto.cn')
          .then(r => r.json())
          .then(data => {
            if (data && data.hitokoto) {
              excerptCache.push({
                text: data.hitokoto,
                source: data.from || '',
                author: data.from_who || '佚名',
              });
            }
          }).catch(e => console.warn('Poemblock: Hitokoto 获取失败:', e.message))
      );
    }

    // ================================================================
    // 中文名言 API (btstu.cn) — 中文名人名言，免费免Key
    // API: https://api.btstu.cn/yan/api.php?charset=utf-8&encode=json
    // ================================================================
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetch('https://api.btstu.cn/yan/api.php?charset=utf-8&encode=json')
          .then(r => r.json())
          .then(data => {
            if (data && data.text) {
              excerptCache.push({
                text: data.text,
                source: data.source || data.from || '',
                author: data.author || '佚名',
              });
            }
          }).catch(e => console.warn('Poemblock: 中文名言获取失败:', e.message))
      );
    }
    await Promise.allSettled(promises);

    const seen = new Set();
    excerptCache = excerptCache.filter(item => {
      const key = item.text.slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`Poemblock: 在线补充后共 ${excerptCache.length} 条文摘（含书中原句）`);
    onlineExcerptsLoaded = true;
    onlineExcerptsError = null;
    fetchExcerptsRetryCount = 0; // 成功后重置重试计数
  } catch (e) {
    console.warn('Poemblock: 在线获取文摘失败', e);
    onlineExcerptsLoaded = false;
    onlineExcerptsError = e.message || '在线获取文摘失败';
  } finally {
    isFetchingExcerpts = false;
  }
  // 重试机制：所有API都失败时指数退避重试
  if (!onlineExcerptsLoaded && fetchExcerptsRetryCount < MAX_FETCH_RETRIES) {
    fetchExcerptsRetryCount++;
    const backoffDelay = Math.min(30000 * Math.pow(2, fetchExcerptsRetryCount - 1), 120000);
    console.log(`Poemblock: 将在 ${Math.round(backoffDelay/1000)} 秒后重试获取文摘 (第 ${fetchExcerptsRetryCount}/${MAX_FETCH_RETRIES} 次)`);
    setTimeout(() => { fetchOnlineExcerpts(); }, backoffDelay);
  } else if (!onlineExcerptsLoaded) {
    console.warn(`Poemblock: 已在 ${MAX_FETCH_RETRIES} 次重试后放弃在线获取文摘`);
  }
}

// 智能获取文摘
function getSmartExcerpt(options = {}) {
  const { lang, excludeIndex } = options;
  let pool = excerptCache;

  // 0. 检查偏好中的语言设置（覆盖页面检测结果）
  //    如果用户设置了语言偏好，优先使用用户偏好而非页面检测
  let effectiveLang = lang;
  if (userPreferences.language !== 'auto') {
    effectiveLang = userPreferences.language;
  }

  if (effectiveLang === 'chinese') {
    pool = pool.filter(e => /[一-鿿]/.test(e.text));
  } else if (effectiveLang === 'english') {
    pool = pool.filter(e => !/[一-鿿]/.test(e.text));
  }

  if (excerptDismissed.size > 0) {
    pool = pool.filter((_, i) => !excerptDismissed.has(i));
  }

  // 排除某条文摘（下一条用）
  if (excludeIndex !== undefined && excludeIndex >= 0 && excludeIndex < excerptCache.length) {
    const excluded = excerptCache[excludeIndex];
    pool = pool.filter(e => e.text !== excluded.text || e.author !== excluded.author);
  }

  if (pool.length === 0) pool = excerptCache;
  if (pool.length === 0) return { excerpt: null, index: -1 };

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];
  // 找到选中的文摘在原始 excerptCache 中的索引
  const cacheIndex = excerptCache.indexOf(selected);

  sessionStats.excerptsDisplayed++;

  return { excerpt: selected, index: cacheIndex >= 0 ? cacheIndex : randomIndex };
}


// ====================================================================
// 用户偏好系统（2.1）
// ====================================================================

const DEFAULT_PREFERENCES = {
  enabled: true,
  language: 'auto',        // 'auto' | 'chinese' | 'english'
  theme: 'auto',           // 'auto' | 'light' | 'dark' | 'sepia'
  maxPoemLines: 12,
  showSource: true,
  animationSpeed: 1.0,     // 0-2 multiplier
  fontFamily: 'auto',      // 'auto' | 'serif' | 'sans-serif'
  excludedSites: [],        // hostname patterns
  showNextButton: true,
  contentMode: 'mix',      // 'poem' | 'excerpt' | 'mix'
};

let userPreferences = { ...DEFAULT_PREFERENCES };

async function loadPreferences() {
  try {
    const result = await chrome.storage.sync.get('preferences');
    if (result.preferences) {
      userPreferences = { ...DEFAULT_PREFERENCES, ...result.preferences };
    }
  } catch (e) {
    console.warn('Poemblock: Failed to load preferences, using defaults', e);
  }
}

async function savePreferences(prefs) {
  userPreferences = { ...userPreferences, ...prefs };
  await chrome.storage.sync.set({ preferences: userPreferences });
}

// ====================================================================
// 多样性跟踪系统（2.4）：避免同一首诗歌短时间内多次展示
// ====================================================================

// 近期展示过的诗歌索引（session 级别，最长 30 首）
let recentPoemIndices = [];
const MAX_RECENT = 30;

// 会话内每首诗展示计数
let displayCount = {};

function trackPoemDisplay(index) {
  // 添加到近期列表
  recentPoemIndices.push(index);
  if (recentPoemIndices.length > MAX_RECENT) {
    recentPoemIndices.shift();
  }
  // 增加展示计数
  displayCount[index] = (displayCount[index] || 0) + 1;
  // 更新会话统计
  sessionStats.poemsDisplayed++;
}

function isRecentPoem(index) {
  return recentPoemIndices.includes(index);
}

function getDisplayWeight(index) {
  // 展示越多次，权重越低（指数衰减效果）
  const count = displayCount[index] || 0;
  return 1 / (1 + count * count);
}

function getAuthorDiversityWeight(poem, lastN) {
  // 如果最近 N 首中有多首同一作者，降低该作者权重
  const recentAuthors = recentPoemIndices
    .slice(-lastN)
    .map(i => poemCache[i]?.author)
    .filter(Boolean);
  const sameAuthorCount = recentAuthors.filter(a => a === poem.author).length;
  if (sameAuthorCount >= 2) {
    return 0.3; // 连续 2+ 首同一作者，降权 70%
  }
  if (sameAuthorCount === 1) {
    return 0.6; // 最近 1 首同一作者，降权 40%
  }
  return 1.0;
}

// ====================================================================
// 诗歌标签系统 & 智能选诗引擎（交互增强 + 智能增强）
// ====================================================================

// 标签定义
const TAGS = {
  HOMESICK: 'homesick',
  LOVE: 'love',
  LANDSCAPE: 'landscape',
  PHILOSOPHY: 'philosophy',
  SAD: 'sad',
  INSPIRE: 'inspire',
  NIGHT: 'night',
  LIFE: 'life',
  WAR: 'war',
  JOY: 'joy',
  FRIENDSHIP: 'friendship',
  SPRING: 'spring',
  AUTUMN: 'autumn',
  WINTER: 'winter',
};

// 关键词 → 标签映射
const TAG_KEYWORDS = {
  homesick: ['故乡', '家乡', '故园', '归', '思乡', '月是', '明月'],
  love: ['爱情', '相思', '爱人', '红豆', '伊人', '遇见', 'heart', 'love', 'kiss'],
  landscape: ['山水', '江', '河', '湖', '海', '山川', '云', '雪', '花', '鸟', 'sea', 'sun', 'snow', 'wind'],
  philosophy: ['人生', '生命', '存在', '意义', '时间', '永恒', 'death', 'life', 'soul', 'mind'],
  sad: ['愁', '悲', '泪', '孤独', '寂寞', '痛苦', '哀', 'sad', 'tears', 'cry', 'grief', 'mourn'],
  inspire: ['向前', '奋斗', '希望', '光', '梦想', '未来', '路', '勇', 'rise', 'dream', 'hope', 'brave'],
  night: ['夜', '月', '星', '梦', '黑暗', 'night', 'moon', 'dream', 'dark', 'sleep', 'evening'],
  life: ['生活', '人间', '世界', '尘世', '岁月', '时光', 'day', 'world', 'time', 'age'],
  joy: ['欢', '乐', '笑', '醉', '闲', '悠然', 'happy', 'joy', 'laugh', 'dance'],
  friendship: ['故人', '友', '送', '别', 'friend', 'together'],
  spring: ['春', '花开', '东风', '杨柳', 'spring', 'blossom'],
  autumn: ['秋', '落叶', '霜', '枫', 'autumn', 'fall', 'harvest'],
  winter: ['冬', '寒', '冰', 'winter', 'cold', 'frost'],
  war: ['战', '剑', '马', '将军', '征', 'war', 'battle', 'sword'],
};

// 为单首诗歌自动打标签
function tagPoem(poem) {
  if (poem.tags && poem.tags.length > 0) return poem;  // 已有标签
  const tags = new Set();
  const combined = (poem.title + poem.author + poem.lines.join('')).toLowerCase();
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        tags.add(tag);
        break;
      }
    }
  }
  // 尺寸标签
  const totalLines = poem.lines.length;
  if (totalLines <= 4) tags.add('short');
  else if (totalLines <= 8) tags.add('medium');
  else tags.add('long');
  // 语言标签
  tags.add(poem.lines.some(l => /[a-zA-Z]/.test(l)) ? 'english' : 'chinese');
  poem.tags = Array.from(tags);
  return poem;
}

// 批量打标签
function tagAllPoems() {
  poemCache.forEach(tagPoem);
}

// 立即用回退诗歌填充缓存，防止异步加载期间的竞争条件
poemCache = [...fallbackPoems].sort(() => Math.random() - 0.5);
tagAllPoems();

// 从存储中恢复已关闭的诗歌索引
chrome.storage.session.get('dismissedIndices', (data) => {
  if (data.dismissedIndices) {
    data.dismissedIndices.forEach(i => dismissedIndices.add(i));
  }
});

// 智能选诗（根据匹配条件过滤 + 随机 + 多样性优化）
function getSmartPoem(options = {}) {
  const {
    lang,           // 'chinese' | 'english' | null（不过滤）
    maxLines,       // 最大行数
    minLines,       // 最小行数
    timeMatch,      // true = 按当前时段匹配
    excludeIndex,   // 排除某首诗（下一首用）
  } = options;

  // 0. 检查偏好中的语言设置
  let effectiveLang = lang;
  if (userPreferences.language !== 'auto' && !lang) {
    effectiveLang = userPreferences.language;
  }

  // 1. 标签已经预填充，直接使用

  let pool = poemCache;

  // 2. 语言过滤
  if (effectiveLang === 'chinese') pool = pool.filter(p => p.tags.includes('chinese'));
  else if (effectiveLang === 'english') pool = pool.filter(p => p.tags.includes('english'));

  // 3. 行数过滤
  const effectiveMaxLines = maxLines || userPreferences.maxPoemLines;
  if (effectiveMaxLines) pool = pool.filter(p => p.lines.length <= effectiveMaxLines);
  if (minLines) pool = pool.filter(p => p.lines.length >= minLines);

  // 4. 时段匹配 - 优先推荐符合时段的诗
  //    仅当过滤后池子足够大（>= 10 首）时才启用，否则保持原池以保证多样性
  if (timeMatch && pool.length > 20) {
    const hour = new Date().getHours();
    let timeTags = [];
    if (hour >= 5 && hour < 8) timeTags = [TAGS.SPRING, TAGS.INSPIRE];          // 清晨
    else if (hour >= 8 && hour < 12) timeTags = [TAGS.INSPIRE, TAGS.LIFE];      // 上午
    else if (hour >= 12 && hour < 14) timeTags = [TAGS.LANDSCAPE, TAGS.JOY];    // 午后
    else if (hour >= 14 && hour < 17) timeTags = [TAGS.PHILOSOPHY, TAGS.LIFE];  // 下午
    else if (hour >= 17 && hour < 20) timeTags = [TAGS.NIGHT, TAGS.HOMESICK];   // 黄昏
    else if (hour >= 20 && hour < 23) timeTags = [TAGS.NIGHT, TAGS.LOVE];       // 夜晚
    else timeTags = [TAGS.NIGHT, TAGS.SAD, TAGS.PHILOSOPHY];                     // 深夜

    const timed = pool.filter(p => p.tags.some(t => timeTags.includes(t)));
    // 仅当时段匹配后的池子足够大（>= 10 首）时才使用，否则放弃时段匹配保证内容多样性
    if (timed.length >= 10) pool = timed;
  }

  // 5. 排除已关闭的诗
  if (dismissedIndices.size > 0) {
    pool = pool.filter((_, i) => !dismissedIndices.has(i));
  }

  // 6. 排除某首（下一首用）
  if (excludeIndex !== undefined && excludeIndex >= 0 && excludeIndex < poemCache.length) {
    const excluded = poemCache[excludeIndex];
    pool = pool.filter(p => p.title !== excluded.title || p.author !== excluded.author);
  }

  if (pool.length === 0) pool = poemCache; // fallback 到全部

  // 7. 多样性加权随机选取
  // 先按权重排序：近期展示过的低权重，同一作者连续出现降权
  const weighted = pool.map((p, i) => {
    const poemIndex = poemCache.indexOf(p);
    const displayW = getDisplayWeight(poemIndex);
    const authorW = getAuthorDiversityWeight(p, 3);
    const weight = displayW * authorW + Math.random() * 0.1; // 加一点随机噪声打破平局
    return { poem: p, index: poemIndex, weight };
  });

  // 按权重降序排列，取前 20% 随机选一个
  weighted.sort((a, b) => b.weight - a.weight);
  const topN = Math.max(1, Math.ceil(weighted.length * 0.2));
  const candidates = weighted.slice(0, topN);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  // 跟踪展示信息
  trackPoemDisplay(selected.index);

  return { poem: selected.poem, index: selected.index };
}

// 获取下一首（智能切换）
function getNextPoem(currentIndex) {
  return getSmartPoem({
    lang: poemCache[currentIndex]?.tags?.includes('english') ? 'english' : 'chinese',
    timeMatch: false, // 下一首不再时段过滤，让用户能看到多样化的内容
    excludeIndex: currentIndex,
  });
}

// 初始化时优先加载本地 JSON 诗歌数据库
fetchLocalPoems();

// 加载本地文摘库
fetchLocalExcerpts();

// 在线补充诗歌（延迟100ms等待其他初始化完成，确保内容尽快可用）
setTimeout(() => {
  fetchPoems();
}, 100);

// 在线补充文摘（延迟200ms等待其他初始化完成，确保内容尽快可用）
setTimeout(() => {
  fetchOnlineExcerpts();
}, 200);

// 加载用户偏好
loadPreferences();

// ====================================================================
// 消息处理器
// ====================================================================
// contentMode 决策：根据用户偏好决定返回诗歌还是文摘
function decideContent(contentMode) {
  if (contentMode === 'poem') return 'poem';
  if (contentMode === 'excerpt') return 'excerpt';
  // mix 模式：50% 概率
  return Math.random() < 0.5 ? 'poem' : 'excerpt';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'healthCheck') {
    sendResponse({ alive: true, poemCount: poemCache.length, excerptCount: excerptCache.length, onlineExcerptsLoaded, onlineExcerptsLoading });
    return true;
  }
  if (request.action === 'getContent') {
    // 统一接口：根据 contentMode 返回诗歌或文摘
    if (!userPreferences.enabled) {
      sendResponse({ content: null, disabled: true });
      return true;
    }
    if (request.url && userPreferences.excludedSites.length > 0) {
      try {
        const hostname = new URL(request.url).hostname;
        if (userPreferences.excludedSites.some(pattern => hostname === pattern || hostname.endsWith('.' + pattern))) {
          sendResponse({ content: null, disabled: true });
          return true;
        }
      } catch (e) {}
    }

    const mode = decideContent(userPreferences.contentMode);

    if (mode === 'excerpt') {
      const result = getSmartExcerpt({ lang: request.lang || null });
      if (result.excerpt) {
        sendResponse({ content: { type: 'excerpt', data: result.excerpt, index: result.index }, mode: 'excerpt', preferences: userPreferences });
      } else {
        sendResponse({ content: null, disabled: false });
      }
    } else {
      const poemResult = getSmartPoem({
        lang: request.lang || null,
        maxLines: request.maxLines || null,
        minLines: request.minLines || null,
        timeMatch: request.timeMatch !== false,
      });
      sendResponse({ content: { type: 'poem', data: poemResult.poem, index: poemResult.index }, preferences: userPreferences, mode: 'poem' });
    }
    return true;
  }
  if (request.action === 'getPoem') {
    // 检查扩展是否启用
    if (!userPreferences.enabled) {
      sendResponse({ poem: null, index: -1, disabled: true });
      return true; // MV3: 保持消息通道开放
    }
    // 检查排除站点
    if (request.url && userPreferences.excludedSites.length > 0) {
      try {
        const hostname = new URL(request.url).hostname;
        if (userPreferences.excludedSites.some(pattern => hostname === pattern || hostname.endsWith('.' + pattern))) {
          sendResponse({ poem: null, index: -1, disabled: true });
          return true; // MV3: 保持消息通道开放
        }
      } catch (e) {}
    }
    // 智能选诗：根据页面语言、时段、尺寸匹配
    const result = getSmartPoem({
      lang: request.lang || null,
      maxLines: request.maxLines || null,
      minLines: request.minLines || null,
      timeMatch: request.timeMatch !== false, // 默认开启时段匹配
    });
    sendResponse({ poem: result.poem, index: result.index, preferences: userPreferences });
    return true; // MV3: 保持消息通道开放
  }
  if (request.action === 'getNextPoem') {
    // 下一首：排除当前诗，保持语言和时段匹配
    const result = getNextPoem(request.currentIndex);
    sendResponse({ poem: result.poem, index: result.index });
    return true;
  }
  if (request.action === 'getNextExcerpt') {
    // 下一条文摘：排除当前文摘，随机获取
    const result = getSmartExcerpt({
      lang: request.lang || null,
      excludeIndex: request.currentExcerptIndex,
    });
    if (result.excerpt) {
      sendResponse({ excerpt: result.excerpt, index: result.index });
    } else {
      sendResponse({ excerpt: null, index: -1 });
    }
    return true;
  }
  if (request.action === 'getPoemByTags') {
    const result = getSmartPoem({
      lang: request.lang || null,
      maxLines: request.maxLines || null,
      minLines: request.minLines || null,
      timeMatch: request.timeMatch !== false,
      excludeIndex: request.excludeIndex,
    });
    sendResponse({ poem: result.poem, index: result.index });
    return true;
  }
  if (request.action === 'getPreferences') {
    sendResponse({ preferences: userPreferences });
    return true;
  }
  if (request.action === 'setPreferences') {
    savePreferences(request.preferences);
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'dismissPoem') {
    // 标记某诗为已关闭（排除展示）— 用 storage.session 存储
    if (request.poemIndex !== undefined) {
      dismissedIndices.add(request.poemIndex);
      chrome.storage.session.get('dismissedIndices', (data) => {
        const dismissed = data.dismissedIndices || [];
        if (!dismissed.includes(request.poemIndex)) {
          dismissed.push(request.poemIndex);
          chrome.storage.session.set({ dismissedIndices: dismissed });
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'getStats') {
    sendResponse({ stats: { ...sessionStats } });
    return true;
  }
  if (request.action === 'getExcerpt') {
    if (!userPreferences.enabled) {
      sendResponse({ excerpt: null, index: -1, disabled: true });
      return true;
    }
    if (request.url && userPreferences.excludedSites.length > 0) {
      try {
        const hostname = new URL(request.url).hostname;
        if (userPreferences.excludedSites.some(pattern => hostname === pattern || hostname.endsWith('.' + pattern))) {
          sendResponse({ excerpt: null, index: -1, disabled: true });
          return true;
        }
      } catch (e) {}
    }
    const result = getSmartExcerpt({ lang: request.lang || null });
    sendResponse({ excerpt: result.excerpt, index: result.index });
    return true;
  }
  if (request.action === 'dismissExcerpt') {
    if (request.excerptIndex !== undefined) {
      excerptDismissed.add(request.excerptIndex);
    }
    sendResponse({ success: true });
    return true;
  }
});
