# 小旋风 API 接口文档

## 接口概述

本接口完全兼容小旋风伪原创 API 格式，支持 5118 标准返回格式。

---

## 接口信息

### API 名称
```
奶盘伪原创 API 示例
```
*可自定义名称*

### API 地址
```
http://your-server:8000/api/rewrite
```
*替换 `your-server` 为你的服务器地址*

### 请求方式
```
POST
```

---

## 请求参数

### 必填参数

#### 1. content / txt / {word}
**参数说明：** 要改写的文本内容

**参数名称：**
- `content` - 标准参数名
- `txt` - 5118 兼容参数名
- `{word}` - 小旋风变量（在 post 格式中使用）

**参数类型：** String

**是否必填：** 是 ✅

**长度限制：** 无限制（支持超长文本）

**示例：**
```
content=这是要改写的文本内容
txt=这是要改写的文本内容
{word}  （小旋风变量，自动替换为采集内容）
```

#### 2. Authorization / apikey / api_key
**参数说明：** API 认证密钥

**参数名称：**
- `Authorization` - HTTP Header 方式
- `apikey` - 5118 兼容参数名
- `api_key` - 标准参数名

**参数类型：** String

**是否必填：** 是 ✅

**格式：** `sk_` 开头的 64 位字符串

**获取方式：** 登录系统后在"配置"页面查看

**示例：**
```
Authorization: sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00
apikey=sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00
api_key=sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00
```

### 可选参数

#### 3. mode
**参数说明：** 改写模式

**参数类型：** String

**是否必填：** 否（默认使用用户配置的默认模式）

**可选值：**
- `standard` - 标准改写
- `humanlike` - 仿人类写作（推荐，反 AI 检测）⭐
- `mixed` - 混合改写（反 AI 检测）⭐
- `deep` - 深度重写（反 AI 检测）⭐
- `creative` - 创意改写
- `formal` - 正式改写
- `simple` - 简化改写
- `translate_cn` - 翻译改写
- `seo_spider` - SEO 蜘蛛优化 🎯
- `seo_fast` - SEO 快速改写 🎯
- `seo_deep` - SEO 深度优化 🎯
- 以及其他自定义模式

**示例：**
```
mode=humanlike
mode=seo_spider
```

#### 4. model
**参数说明：** AI 模型选择

**参数类型：** String

**是否必填：** 否（默认使用用户配置的默认模型）

**可选值：**
- `claude-haiku-4-5-20251001` - 最快速
- `claude-sonnet-4-5-20250929` - 推荐 ⭐
- `claude-sonnet-4-5-20250929-thinking` - 深入分析
- `claude-sonnet-4-6` - 最新版
- `claude-opus-4-5` - 强大
- `claude-opus-4-5-20251101-thinking` - 最强分析
- `claude-opus-4-6` - 顶级

**示例：**
```
model=claude-sonnet-4-5-20250929
```

#### 5. sim
**参数说明：** 是否返回相似度

**参数类型：** Integer

**是否必填：** 否

**可选值：**
- `1` - 返回相似度
- `0` - 不返回相似度（默认）

**示例：**
```
sim=1
```

#### 6. compact
**参数说明：** 是否压缩输出（用于小旋风长文本）

**参数类型：** Integer

**是否必填：** 否

**可选值：**
- `1` - 压缩输出（移除多余空格和换行）
- `0` - 正常输出（默认）

**用途：** 当改写结果过长导致小旋风无法接收时使用

**示例：**
```
compact=1
```

---

## 返回格式

### 成功返回（JSON 格式）

```json
{
    "errcode": "0",
    "errmsg": "",
    "data": "改写后的文本内容",
    "like": "0.5521"
}
```

### 返回字段说明

#### errcode
**字段说明：** 错误码

**类型：** String

**说明：**
- `"0"` - 成功
- 其他值 - 失败（见错误码说明）

#### errmsg
**字段说明：** 错误信息

**类型：** String

**说明：**
- 成功时为空字符串
- 失败时包含错误描述

#### data
**字段说明：** 改写后的内容

**类型：** String

**说明：**
- 成功时包含改写后的文本
- 失败时为空字符串

#### like
**字段说明：** 相似度（可选）

**类型：** String

**说明：**
- 仅当 `sim=1` 时返回
- 取值范围：0.0000 - 1.0000
- 值越小表示改写程度越大

---

## 错误码说明

| 错误码 | 错误信息 | 说明 |
|--------|---------|------|
| 0 | 成功 | 改写成功 |
| 100203 | API Key 无效 | API Key 错误或未授权 |
| 100202 | 请求缺少 apikey | 未提供 API Key |
| 200201 | 传进参数为空 | 文本内容为空 |
| 100301 | 改写失败 | AI 服务调用失败 |

---

## 小旋风配置示例

### 配置步骤

1. **打开小旋风伪原创设置**

2. **添加新的伪原创 API**

3. **填写配置信息：**

#### API 名称
```
奶盘伪原创 API
```

#### API 地址
```
http://your-server:8000/api/rewrite
```

#### post 格式
```
txt={word}&mode=humanlike&sim=1
```

**参数说明：**
- `txt={word}` - 必填，`{word}` 是小旋风变量
- `mode=humanlike` - 可选，改写模式
- `sim=1` - 可选，返回相似度

**其他可选参数：**
```
txt={word}&mode=seo_spider&model=claude-sonnet-4-5-20250929&sim=1
txt={word}&mode=deep&compact=1
```

#### Authorization
```
sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00
```
*替换为你的实际 API Key*

**注意：** 
- 个别接口需要设置这个，如 5118 这类就放 apikey
- 本系统支持两种方式，推荐使用 Authorization

#### 成功标志
```
result=1
```

**格式说明：**
- 键名 = 键值
- 如：`result=1`
- 没有则留空

**本系统返回：**
```
errcode=0
```

#### 返回错误的字段
```
message
```

**说明：** 返回具体错误的字段，如：`message`

**本系统返回：**
```
errmsg
```

#### 伪原创后的内容字段
```
content
```

**说明：** 返回伪原创后的内容字段，如：`content`

**本系统返回：**
```
data
```

---

## 完整配置示例

### 示例 1：基础配置（推荐）

```
API 名称: 奶盘伪原创 API
API 地址: http://your-server:8000/api/rewrite
post 格式: txt={word}&mode=humanlike&sim=1
Authorization: sk_your_api_key_here
成功标志: errcode=0
返回错误的字段: errmsg
伪原创后的内容字段: data
```

### 示例 2：SEO 优化配置

```
API 名称: 奶盘 SEO 改写
API 地址: http://your-server:8000/api/rewrite
post 格式: txt={word}&mode=seo_spider&sim=1
Authorization: sk_your_api_key_here
成功标志: errcode=0
返回错误的字段: errmsg
伪原创后的内容字段: data
```

### 示例 3：长文本配置

```
API 名称: 奶盘长文本改写
API 地址: http://your-server:8000/api/rewrite
post 格式: txt={word}&mode=humanlike&compact=1
Authorization: sk_your_api_key_here
成功标志: errcode=0
返回错误的字段: errmsg
伪原创后的内容字段: data
```

---

## cURL 测试示例

### 基础测试

```bash
curl -X POST http://your-server:8000/api/rewrite \
  -H "Content-Type: application/json" \
  -H "Authorization: sk_your_api_key_here" \
  -d '{"txt":"这是要改写的文本内容","sim":1}'
```

### 指定模式测试

```bash
curl -X POST http://your-server:8000/api/rewrite \
  -H "Content-Type: application/json" \
  -H "Authorization: sk_your_api_key_here" \
  -d '{"txt":"这是要改写的文本内容","mode":"humanlike","sim":1}'
```

### 表单格式测试（小旋风格式）

```bash
curl -X POST http://your-server:8000/api/rewrite \
  -H "Authorization: sk_your_api_key_here" \
  -d "txt=这是要改写的文本内容&mode=humanlike&sim=1"
```

### 压缩输出测试（长文本）

```bash
curl -X POST http://your-server:8000/api/rewrite \
  -H "Authorization: sk_your_api_key_here" \
  -d "txt=这是一篇很长的文本内容...&mode=humanlike&compact=1"
```

**说明：**
- `compact=1` 会移除多余的空格和换行
- 适用于小旋风长文本场景
- 可以减小响应体积 30-50%

---

## 常见问题

### Q1: 小旋风提示"接口返回错误"？

**A:** 检查以下几点：
1. API 地址是否正确
2. Authorization 是否填写了正确的 API Key
3. 成功标志是否设置为 `errcode=0`
4. 返回字段是否设置为 `data`

### Q2: 小旋风提示"返回内容为空"？

**A:** 检查：
1. "伪原创后的内容字段" 是否设置为 `data`
2. 查看服务器日志确认是否成功改写
3. 检查原文本是否为空

### Q3: 长文本改写失败？

**A:** 
1. 在 post 格式中添加 `compact=1` 参数
2. 或在小旋风中限制采集文本长度为 800-1000 字符
3. 详见：[小旋风长文本问题解决方案.md](./小旋风长文本问题解决方案.md)

### Q4: 如何获取 API Key？

**A:** 
1. 登录系统：http://your-server:8000
2. 进入"配置"页面
3. 复制显示的 API Key

### Q5: 可以同时使用多个改写模式吗？

**A:** 
不可以，每次请求只能指定一个 mode。但可以在小旋风中配置多个 API，每个使用不同的模式。

### Q6: 相似度是什么意思？

**A:** 
- 相似度表示改写后的文本与原文的相似程度
- 值越小表示改写程度越大
- 通常 0.3-0.6 之间表示改写效果较好

---

## 参数对照表

### 小旋风 → 本系统

| 小旋风参数 | 本系统参数 | 说明 |
|-----------|-----------|------|
| {word} | txt / content | 文本内容 |
| apikey | Authorization | API Key |
| - | mode | 改写模式 |
| - | model | AI 模型 |
| - | sim | 返回相似度 |
| - | compact | 压缩输出 |

### 返回字段对照

| 小旋风字段 | 本系统字段 | 说明 |
|-----------|-----------|------|
| result | errcode | 成功标志 |
| message | errmsg | 错误信息 |
| content | data | 改写内容 |
| - | like | 相似度 |

---

## 技术支持

### 相关文档
- [小旋风配置教程.md](./小旋风配置教程.md) - 详细配置步骤
- [小旋风长文本问题解决方案.md](./小旋风长文本问题解决方案.md) - 长文本问题
- [小旋风问题诊断卡.txt](./小旋风问题诊断卡.txt) - 快速诊断
- [5118格式说明.md](./5118格式说明.md) - 5118 格式详解

### 联系方式
- 查看服务器日志获取详细错误信息
- 参考文档中的故障排查章节

---

**文档版本：** 1.0  
**更新时间：** 2026-03-09  
**适用版本：** SEO API v1.2.0
