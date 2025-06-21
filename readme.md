# 节奏医生谱面搜索 API 文档

## 基本请求地址
```
https://orchardb.fly.dev/typesense/collections/levels/documents/search
```

## 认证要求
所有请求必须包含以下HTTP头：
- `x-typesense-api-key`: 有效的Typesense API密钥

## 查询参数

| 参数名 | 说明 | 示例 | 是否必需 |
|-------|------|------|----------|
| `q` | 搜索查询字符串，可用于搜索谱面名称、作者等 | `rhythm` 或留空 | 必需 |
| `query_by` | 要搜索的字段列表，用逗号分隔 | `song,authors,artist,tags,description` | 必需 |
| `query_by_weights` | 各搜索字段的权重，数字越大权重越高 | `12,8,6,5,4` | 必需 |
| `facet_by` | 需要进行分面统计的字段，用于筛选功能 | `authors,tags,source,difficulty,artist` | 必需 |
| `per_page` | 每页返回的谱面数量 | `25` | 必需 |
| `max_facet_values` | 每个分面返回的最大值数量 | `10` | 必需 |
| `filter_by` | 过滤条件表达式 | `approval:=[10..20]` | 必需 |
| `page` | 页码，从1开始 | `1` | 必需 |
| `sort_by` | 结果排序字段和方向 | `_text_match:desc,indexed:desc,last_updated:desc` | 必需 |
| `num_typos` | 允许的拼写错误数量，按字段顺序设置 | `2,1,1,1,0` | 必需 |

## 默认参数

网页首次加载时，不输入任何搜索内容的默认请求参数如下：

```
q=&query_by=song%2C+authors%2C+artist%2C+tags%2C+description&query_by_weights=12%2C+8%2C+6%2C+5%2C+4&facet_by=authors%2Ctags%2Csource%2Cdifficulty%2Cartist&per_page=25&max_facet_values=10&filter_by=approval%3A%3D%5B10..20%5D&page=1&sort_by=_text_match%3Adesc%2Cindexed%3Adesc%2Clast_updated%3Adesc&num_typos=2%2C+1%2C+1%2C+1%2C+0
```

解码后的参数：
```
q=
query_by=song, authors, artist, tags, description
query_by_weights=12, 8, 6, 5, 4
facet_by=authors,tags,source,difficulty,artist
per_page=25
max_facet_values=10
filter_by=approval:=[10..20]
page=1
sort_by=_text_match:desc,indexed:desc,last_updated:desc
num_typos=2, 1, 1, 1, 0
```

## 字段说明

### song
谱面的歌曲名称。

### authors
谱面的制作者，即谁设计了这个节奏医生的谱面。

### artist
歌曲的原创音乐人或表演者。

### tags
谱面的标签，如风格、特点等分类信息。

### description
谱面的详细描述信息。

### source
谱面的来源，例如原创、移植等。

### difficulty
谱面的难度等级，用于标识谱面的挑战性。

### approval
谱面的审核评分或状态，范围通常为0-20，数值越高表示质量评价越高。

### indexed
谱面被收录到数据库的时间。

### last_updated
谱面的最后更新时间。

## 参数详解

### query_by
指定在哪些字段中搜索查询字符串。示例中搜索范围包括：歌曲名、谱面作者、音乐艺术家、标签和描述。

### query_by_weights
每个搜索字段的权重，数字越大权重越高。例如：歌曲名(12)比标签(5)有更高的匹配权重，这意味着匹配歌曲名的结果会更靠前显示。

### facet_by
用于聚合和筛选结果的字段。这些字段可用于在网站界面上创建分类筛选选项，例如按作者、标签或难度级别筛选谱面。

### filter_by
过滤条件表达式，支持范围查询、等值查询等。示例`approval:=[10..20]`表示只返回审批评分在10到20之间的高质量谱面。

### sort_by
结果排序顺序，格式为`字段:方向`。可以指定多个排序规则，按优先级依次应用。
- `_text_match:desc`: 首先按文本匹配度降序排列（最相关的在前）
- `indexed:desc`: 其次按收录时间降序排列（最新收录的在前）
- `last_updated:desc`: 最后按更新时间降序排列（最近更新的在前）

### num_typos
为每个查询字段指定允许的拼写错误数量。值为0表示不允许拼写错误，对于不同长度的字段可设置不同的容错度。

## 示例请求
```http
GET https://orchardb.fly.dev/typesense/collections/levels/documents/search?q=rhythm&query_by=song,authors,artist&page=1&per_page=10
Headers:
  x-typesense-api-key: YOUR_API_KEY
```

## 响应格式
响应返回JSON格式，包含谱面搜索结果和分面统计信息。以下是主要字段的说明：

### 主要响应结构
```json
{
  "facet_counts": [...],  // 分面统计信息
  "found": 3946,          // 符合搜索条件的总记录数
  "hits": [...],          // 搜索结果列表
  "out_of": 5885,         // 索引中的总记录数
  "page": 1,              // 当前页码
  "request_params": {...}, // 请求参数
  "search_cutoff": false,  // 搜索是否被截断
  "search_time_ms": 229    // 搜索耗时(毫秒)
}
```

### facet_counts 分面统计
返回按请求的facet_by字段分组的统计信息，例如：
```json
{
  "counts": [
    {
      "count": 181,         // 该值的记录数
      "highlighted": "Xeno", // 高亮显示的值
      "value": "Xeno"        // 分面值
    },
    // 更多值...
  ],
  "field_name": "authors",  // 分面字段名
  "stats": {
    "total_values": 726     // 该字段的不同值总数
  }
}
```

### hits 搜索结果
返回匹配的谱面列表，每个谱面包含以下信息：
```json
{
  "document": {
    "approval": 10,                // 审核评分
    "artist": "Galactic Hole",     // 艺术家
    "authors": ["123wenhuaxu"],    // 谱面作者
    "description": "...",          // 描述
    "difficulty": 1,               // 难度等级
    "has_classics": true,          // 是否包含经典节拍
    "has_freetimes": true,         // 是否包含自由节拍
    "has_freezeshots": true,       // 是否包含冻结节拍
    "has_holds": false,            // 是否包含长按
    "has_oneshots": true,          // 是否包含单击
    "has_skipshots": false,        // 是否包含跳过
    "has_squareshots": false,      // 是否包含方块击打
    "has_window_dance": false,     // 是否包含窗口舞蹈
    "id": "lancer-f-jDMSk7rj2bV",  // 谱面ID
    "image": "https://...",        // 谱面图片URL
    "indexed": 1750370848,         // 索引时间戳
    "last_updated": 1750250560,    // 最后更新时间戳
    "max_bpm": 170.0,              // 最大BPM
    "min_bpm": 170.0,              // 最小BPM
    "seizure_warning": false,      // 是否有闪光警告
    "single_player": true,         // 是否支持单人模式
    "song": "lancer from deltarune raps", // 歌曲名称
    "source": "rdl",               // 来源
    "tags": ["meme", "short", ...], // 标签列表
    "two_player": false,           // 是否支持双人模式
    "url": "https://...",          // 下载URL
    "url2": "https://..."          // 备用下载URL
  },
  "highlight": {                   // 搜索高亮信息
    "artist": "Galactic Hole",
    "authors": ["123wenhuaxu"],
    "description": "...",
    "song": "lancer from deltarune raps",
    "tags": [...]
  },
  "text_match": 100,               // 文本匹配得分
  "text_match_info": {             // 匹配详细信息
    "best_field_score": "0",
    "best_field_weight": 12,
    "fields_matched": 4,
    "score": "100",
    "tokens_matched": 0
  }
}
```

### 特殊字段说明

#### document.has_* 字段
这些布尔字段表示谱面中包含的节奏类型，用于帮助玩家了解谱面玩法特点：
- `has_classics`: 经典节拍
- `has_freetimes`: 自由节拍
- `has_freezeshots`: 冻结节拍
- `has_holds`: 长按
- `has_oneshots`: 单击
- `has_skipshots`: 跳过
- `has_squareshots`: 方块击打
- `has_window_dance`: 窗口舞蹈

#### 谱面来源 (source)
- `rdl`: 来自Rhythm Doctor Level格式
- `yeoldesheet`: 来自旧格式谱面
- `prescriptions`: 官方预设谱面

#### 难度等级 (difficulty)
- `0`: 简单
- `1`: 中等
- `2`: 困难
- `3`: 专家
