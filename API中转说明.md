# API 中转说明

## 🌐 使用 api123.icu 中转

本系统默认使用 `https://api.api123.icu` 作为 Claude API 的中转地址。

### 为什么使用中转？

1. **解决网络访问问题** - 国内直接访问 Claude 官方 API 可能不稳定
2. **提高访问速度** - 中转服务器通常有更好的网络连接
3. **简化配置** - 无需配置代理或 VPN

### 配置说明

系统已经默认配置好了，无需额外设置。

如果你想使用其他中转地址或官方地址，可以修改 `.env` 文件：

```env
# 使用 api123.icu 中转（默认）
CLAUDE_BASE_URL=https://api.api123.icu

# 或使用官方地址
# CLAUDE_BASE_URL=https://api.anthropic.com

# 或使用其他中转
# CLAUDE_BASE_URL=https://your-proxy.com
```

### API Key 说明

使用 api123.icu 中转时，你仍然需要使用 Claude 官方的 API Key。

**获取 API Key：**

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 创建 API Key
4. 在本系统的"配置"页面输入 API Key

### 支持的模型

使用 api123.icu 中转支持所有 Claude 模型：

- Claude 3 Haiku
- Claude 3 Sonnet
- Claude 3 Opus
- Claude 4 Sonnet
- Claude 4 Opus

### 费用说明

- **中转服务** - api123.icu 通常免费或低成本
- **API 调用** - 按 Claude 官方价格计费
- **费用计算** - 根据使用的 tokens 数量计费

### 测试连接

启动服务后，可以通过以下方式测试连接：

1. **Web 界面测试**
   - 登录系统
   - 配置 Claude API Key
   - 在"文本改写"页面输入测试文本
   - 点击"开始改写"

2. **API 测试**
```bash
curl -X POST http://localhost:8000/api/rewrite \
  -H "Authorization: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"txt":"测试文本","mode":"standard"}'
```

### 常见问题

#### Q1: 中转服务稳定吗？

**A:** api123.icu 是一个常用的 Claude API 中转服务，通常比较稳定。如果遇到问题，可以切换到其他中转或官方地址。

#### Q2: 中转会影响响应速度吗？

**A:** 通常不会。中转服务器通常有更好的网络连接，可能比直连官方 API 更快。

#### Q3: 中转安全吗？

**A:** 使用知名的中转服务通常是安全的，但建议：
- 不要在中转服务中存储敏感信息
- 定期更换 API Key
- 监控 API 使用情况

#### Q4: 如何切换到官方 API？

**A:** 修改 `.env` 文件：
```env
CLAUDE_BASE_URL=https://api.anthropic.com
```
然后重启服务。

#### Q5: 可以使用自己的中转吗？

**A:** 可以。只需要在 `.env` 文件中设置你的中转地址：
```env
CLAUDE_BASE_URL=https://your-proxy.com
```

### 错误处理

如果遇到连接错误：

1. **检查网络连接**
```bash
curl https://api.api123.icu
```

2. **检查 API Key**
   - 确认 API Key 格式正确（sk-ant-...）
   - 确认 API Key 有效且有余额

3. **查看日志**
   - 服务器日志会显示详细的错误信息
   - 检查是否有网络超时或认证错误

4. **切换中转**
   - 如果 api123.icu 不可用，可以切换到其他中转
   - 或直接使用官方 API

### 性能优化

1. **选择合适的模型**
   - Haiku - 最快，适合简单改写
   - Sonnet - 平衡，推荐日常使用
   - Opus - 最强，适合复杂任务

2. **控制文本长度**
   - 建议单次改写不超过 5000 字符
   - 长文本可以分段改写

3. **合理使用缓存**
   - 相同内容不要重复改写
   - 可以保存常用的改写结果

### 监控和统计

系统会记录每次 API 调用的信息：

- 调用时间
- 使用的模型
- 输入/输出 tokens
- 响应时间
- 错误信息

可以在服务器日志中查看这些信息。

### 技术支持

如果遇到问题：

1. 查看服务器日志
2. 检查网络连接
3. 验证 API Key
4. 尝试切换中转地址

## 🎉 总结

系统已经配置好使用 api123.icu 中转，你只需要：

1. ✅ 获取 Claude API Key
2. ✅ 在 Web 界面配置 API Key
3. ✅ 开始使用

无需额外配置，开箱即用！🚀
