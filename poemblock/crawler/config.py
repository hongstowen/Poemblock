# Default poets to crawl.
# Each entry represents one poet whose poems will be scraped.
# For Chinese poets: just the name, looked up via gushiwen.cn search.
# For English poets: name and slug (URL-friendly identifier on poetryfoundation.org).

CHINESE_POETS = [
    # ===== 先秦-魏晋南北朝 =====
    "屈原", "曹操", "曹植", "陶渊明", "谢灵运", "鲍照", "庾信",

    # ===== 唐代 =====
    "李白", "杜甫", "白居易", "王维", "李商隐",
    "杜牧", "孟浩然", "王昌龄", "刘禹锡", "岑参",
    "韩愈", "元稹", "李贺", "温庭筠", "陈子昂",
    "骆宾王", "王之涣", "贺知章", "张若虚", "高适",

    # ===== 宋辽金 =====
    "苏轼", "李清照", "辛弃疾", "柳永", "陆游",
    "王安石", "欧阳修", "秦观", "周邦彦", "姜夔",
    "范成大", "杨万里",

    # ===== 元代 =====
    "关汉卿", "马致远", "张可久", "乔吉",

    # ===== 明代 =====
    "高启", "于谦", "杨慎", "汤显祖", "唐寅",

    # ===== 清代 =====
    "纳兰性德", "袁枚", "赵翼", "龚自珍", "郑板桥", "黄景仁",

    # ===== 近现代 =====
    "徐志摩", "闻一多", "戴望舒", "林徽因",
    "余光中", "洛夫", "郑愁予", "舒婷", "顾城", "杨牧",

    # ===== 当代新诗（新增） =====
    "北岛", "海子", "西川", "于坚", "韩东",
    "张枣", "翟永明", "王小妮", "欧阳江河", "陈先发",
    "雷平阳", "张执浩", "李元胜", "余怒", "臧棣",
    "蓝蓝", "吕德安", "黄灿然", "孙文波", "萧开愚",
]

# 当代新锐诗人（用于扩展 shiku 以外的现代诗来源）
# 这些诗人较年轻，作品尚未被 shiku.org 完全收录
# 来源参考：zgsglt.com（中国诗歌论坛）、sgxh.org（诗歌学会）
MODERN_CHINESE_POETS = [
    # ===== 1980s 后诗人 =====
    "韩东", "于坚", "西川", "海子", "骆一禾",
    "张枣", "翟永明", "王小妮", "欧阳江河", "陈先发",
    "雷平阳", "张执浩", "李元胜", "余怒", "臧棣",
    "蓝蓝", "吕德安", "黄灿然", "孙文波",

    # ===== 1990s 后诗人 =====
    "尹丽川", "沈浩波", "朵渔", "严力", "杨键",
    "王寅", "陆忆敏", "韩博", "胡续冬", "廖伟棠",
    "颜峻", "凌越", "蒋浩", "静水", "曹疏影",

    # ===== 2000s 后 / 网络诗人 =====
    "张二棍", "刘年", "余秀华", "陈年喜", "王单单",
    "康雪", "离离", "灯灯", "张执浩", "李琦",
    "泉子", "胡弦", "路也", "辰水", "叶丽隽",
]

# 备用来源（尚未实现爬虫）：
# - zgsglt.com: 中国诗歌论坛，涵盖大量当代诗人作品
# - sgxh.org:  中国诗歌学会官网，有当代诗人专栏
# - baike.baidu.com: 可以从诗人百科页面整理代表作

ENGLISH_POETS = [  # <-- kept as alias for backward compatibility
    {"name": "Elizabeth Bishop", "slug": "elizabeth-bishop"},
    {"name": "Wallace Stevens", "slug": "wallace-stevens"},
    {"name": "W.H. Auden", "slug": "wh-auden"},
    {"name": "T.S. Eliot", "slug": "ts-eliot"},
    {"name": "Dylan Thomas", "slug": "dylan-thomas"},
    {"name": "William Blake", "slug": "william-blake"},
    {"name": "Percy Bysshe Shelley", "slug": "percy-bysshe-shelley"},
    {"name": "John Keats", "slug": "john-keats"},
    {"name": "Robert Frost", "slug": "robert-frost"},
    {"name": "Emily Dickinson", "slug": "emily-dickinson"},
    {"name": "Marianne Moore", "slug": "marianne-moore"},
    {"name": "Hart Crane", "slug": "hart-crane"},
    {"name": "Sylvia Plath", "slug": "sylvia-plath"},
    {"name": "Langston Hughes", "slug": "langston-hughes"},
    {"name": "William Wordsworth", "slug": "william-wordsworth"},
    {"name": "Samuel Taylor Coleridge", "slug": "samuel-taylor-coleridge"},
    {"name": "W.B. Yeats", "slug": "w-butler-yeats"},
    {"name": "Philip Larkin", "slug": "philip-larkin"},
    {"name": "E.E. Cummings", "slug": "ee-cummings"},
    {"name": "Mary Oliver", "slug": "mary-oliver"},
    {"name": "Billy Collins", "slug": "billy-collins"},
    {"name": "Ada Limón", "slug": "ada-limon"},
    {"name": "Ocean Vuong", "slug": "ocean-vuong"},
    {"name": "Louise Glück", "slug": "louise-gluck"},
    {"name": "Mark Doty", "slug": "mark-doty"},
    {"name": "Kay Ryan", "slug": "kay-ryan"},
    {"name": "Naomi Shihab Nye", "slug": "naomi-shihab-nye"},
    {"name": "Wendy Cope", "slug": "wendy-cope"},
    {"name": "Simon Armitage", "slug": "simon-armitage"},
    {"name": "Carol Ann Duffy", "slug": "carol-ann-duffy"},
    {"name": "Alice Oswald", "slug": "alice-oswald"},
    {"name": "Don Paterson", "slug": "don-paterson"},
    {"name": "Paul Muldoon", "slug": "paul-muldoon"},
    {"name": "Eavan Boland", "slug": "eavan-boland"},
    {"name": "John Burnside", "slug": "john-burnside"},
    {"name": "Gillian Clarke", "slug": "gillian-clarke"},
    {"name": "Andrew Motion", "slug": "andrew-motion"},
    {"name": "Ruth Padel", "slug": "ruth-padel"},
    {"name": "Terrance Hayes", "slug": "terrance-hayes"},
    {"name": "Tracy K. Smith", "slug": "tracy-k-smith"},
]

# PoetryFoundation poets (same as ENGLISH_POETS, more descriptive name)
POETRYFOUNDATION_POETS = ENGLISH_POETS

# Classic English poets for poetrydb.org (not in PoetryFoundation)
POETRYDB_POETS = [
    "Shakespeare", "William Wordsworth", "Walt Whitman",
    "William Blake", "Percy Bysshe Shelley", "John Keats",
    "Lord Byron", "Emily Dickinson", "Samuel Taylor Coleridge",
    "John Milton", "Geoffrey Chaucer", "Edgar Allan Poe",
    "Alfred Lord Tennyson", "Robert Browning", "Elizabeth Barrett Browning",
    "Henry Wadsworth Longfellow", "Ralph Waldo Emerson",
    "John Dryden", "Alexander Pope", "Andrew Marvell",
    "Matthew Arnold", "Gerard Manley Hopkins",
    "Christina Rossetti", "Dante Gabriel Rossetti",
    "Ben Jonson", "Christopher Marlowe", "Edmund Spenser",
    "Edward Lear", "Robert Burns", "Walter Scott",
    "Rupert Brooke", "Wilfred Owen", "Robert Graves",
    "Thomas Hardy", "A E Housman", "John Masefield",
    "William Morris", "Algernon Charles Swinburne",
    "Oliver Wendell Holmes", "James Russell Lowell",
    "Charlotte Bronte", "Anne Bronte", "Emily Bronte",
    "Edward Thomas", "Robert Louis Stevenson",
    "Oscar Wilde", "Lewis Carroll", "Rudyard Kipling",
    "William Cowper", "George Herbert", "John Donne",
    "Henry Vaughan", "Richard Crashaw",
]