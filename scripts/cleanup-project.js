/**
 * 项目清理脚本
 * 删除开发过程中产生的临时文件、测试文件和过时文档
 * 
 * 使用方法：
 * node scripts/cleanup-project.js
 * 
 * 注意：此操作不可逆，请先备份重要文件！
 */

const fs = require('fs');
const path = require('path');

// 需要删除的文件列表
const FILES_TO_DELETE = [
    // 测试文件
    'test-add-api-config.js',
    'test-all-fixes.js',
    'test-api-configs-table.js',
    'test-api-connection-fix.js',
    'test-api-connection-nodejs.js',
    'test-config-display.js',
    'test-config-fix.js',
    'test-dev.bat',
    'test-dev.sh',
    'test-long-article.txt',
    'test-model-list.js',
    'test-rewrite-models.js',
    'test-rewrite-page-models.js',
    'test-system-config-refactor.js',
    
    // 备份文件
    'server.js.backup.1773251437800',
    
    // 临时文件
    'frontend-failover-history-component.jsx',
    '多API配置路由.js',
    
    // 开发启动脚本（保留生产用的）
    'start-dev.bat',
    'test-dev.bat',
    'test-dev.sh',
    
    // 可以合并的文档（功能重复）
    '生产环境部署-完成总结.md',  // 内容已包含在系统改进建议.md中
    '生产部署-快速开始.md',      // 内容已包含在生产环境部署指南.md中
    '文档导航.md',               // 用户可以直接看README
    '✅工作完成总结.md',         // 临时总结文档
    '部署检查清单.md',           // 内容已包含在生产环境部署指南.md中
    
    // 功能说明文档（可以合并到主文档）
    '数据看板时间过滤功能.md',
    '数据看板分页优化说明.md',
    '数据看板过滤修复完成.md',
    '监控仪表盘统计修复完成.md',
    '改写接口变量作用域修复.md',
    '故障转移策略说明.md',       // 内容已包含在负载均衡和故障转移-使用指南.md中
    '令牌负载均衡增强-实施方案.md', // 内容已包含在令牌节点配置功能完成.md中
    
    // AI节点管理相关（保留一个主文档即可）
    'AI节点管理-快速开始.md',
    'AI节点管理系统-完善总结.md',
    
    // 开发脚本（保留有用的）
    'scripts/integrate-rewrite-failover.js',
    'scripts/upgrade-token-load-balance.js',
    'scripts/init-database-v2.js',
    
    // 过时的开发文档
    '🎉令牌节点配置功能上线.md',
    '🎉项目完成通知.md',
    'AI节点管理系统-完整规划.md',
    'AI节点管理系统-实施路线图.md',
    'AI节点管理系统-当前进度.md',
    'AI节点管理系统-最终完成总结.md',
    'AI节点管理系统-阶段1-4总结.md',
    'AI节点管理系统-项目完成总结.md',
    'API实时健康检测功能完成.md',
    'API状态指示器功能完成.md',
    'API连接模型列表保存修复.md',
    'API配置字段修复完成.md',
    'API配置模型列表功能完成.md',
    'FRONTEND_CHANGES.md',
    'iflow平台兼容性说明.md',
    'iflow配置问题解决方案.md',
    'JavaScript语法错误修复完成.md',
    'JSON解析错误修复说明.md',
    'OpenAI兼容接口修复说明.md',
    'React前端7个页面全部完成.md',
    'React前端开发环境已启动.md',
    'React前端快速开始.md',
    'React功能优化完成说明.md',
    'React功能完善计划.md',
    'React对象渲染错误修复.md',
    'React重构完成说明.md',
    'README-测试指南.md',
    'README-现在开始.md',
    'SERVER_CHANGES.md',
    'Tailwind错误修复.md',
    'TASK_7_令牌节点配置完成总结.md',
    'TASK_9_完成总结.md',
    'Web界面模型列表说明.md',
    '上下文重叠分段策略说明.md',
    '个人中心页面修复完成.md',
    '令牌管理表格布局优化完成.md',
    '令牌节点配置-API节点显示修复.md',
    '令牌节点配置-功能对比.md',
    '令牌节点配置-可视化指南.md',
    '令牌节点配置-快速开始.md',
    '令牌节点配置增强完成.md',
    '令牌负载均衡增强-完成说明.md',
    '令牌配置界面优化完成.md',
    '令牌页面错误修复.md',
    '会话认证问题修复完成.md',
    '修复健康检查-立即执行.md',
    '修复对比图.md',
    '健康检查问题修复.md',
    '全新数据库初始化指南.md',
    '前端开发完成总结.md',
    '功能优化进展-简报.md',
    '外部API编辑界面优化完成.md',
    '外部API编辑界面超紧凑布局完成.md',
    '外部API配置保存失败问题修复.md',
    '外部API配置列表优化完成.md',
    '外部API配置更新说明.md',
    '多API配置功能说明.md',
    '失败原因显示功能完成.md',
    '如何测试改写页面模型列表.md',
    '如何清除localStorage.md',
    '完整启动指南.md',
    '导航结构对比.md',
    '常见问题快速修复.md',
    '开发环境测试指南.md',
    '开始使用React前端.md',
    '开始测试-一图看懂.md',
    '开始测试.md',
    '当前状态-2个页面完成.md',
    '快速升级数据库.md',
    '快速参考-配置修复.md',
    '快速测试指南.md',
    '快速测试步骤.md',
    '快速部署.md',
    '快速部署清单.md',
    '所有问题修复总结.md',
    '所有问题已解决-最终总结.md',
    '改写功能使用外部API配置完成.md',
    '改写功能配置问题修复总结.md',
    '改写模式配置修复说明.md',
    '改写页面模型列表功能完成.md',
    '改写页面模型列表完全动态化完成.md',
    '数据库V2-完整方案.md',
    '数据库V2升级指南.md',
    '数据库初始化成功.md',
    '数据库完全修复完成.md',
    '数据库改造完成说明.md',
    '数据库表结构修复完成.md',
    '数据库表缺失问题修复.md',
    '数据库迁移完成说明.md',
    '数据看板优化完成.md',
    '文本改写界面优化完成.md',
    '文本改写配置增强完成.md',
    '日志加载错误修复说明.md',
    '日志筛选和统计功能说明.md',
    '日志统计系统说明.md',
    '旧API配置清除完成.md',
    '本次更新总结.md',
    '模型列表保存问题修复.md',
    '模型列表功能完成.md',
    '模型列表显示优化完成.md',
    '模型列表显示功能说明.md',
    '模型搜索过滤功能说明.md',
    '测试指南.md',
    '测试改写功能修复.md',
    '测试模型列表保存.md',
    '测试状态圆点功能.md',
    '测试登录功能.md',
    '测试认证修复.md',
    '测试默认配置一致性.md',
    '清理完成.md',
    '状态圆点功能-快速参考.md',
    '状态圆点效果展示.md',
    '现在就开始测试.md',
    '用户数据迁移说明.md',
    '界面优化对比.md',
    '界面结构优化完成.md',
    '界面重新设计完成-简洁版.md',
    '界面重新设计完成.md',
    '登录系统-快速参考.md',
    '登录系统使用指南.md',
    '登录系统完成.md',
    '监控仪表板白屏问题修复.md',
    '立即体验新功能.md',
    '立即启动后端.md',
    '立即开始-数据库初始化.md',
    '立即测试-认证修复.md',
    '立即测试改写功能.md',
    '立即测试登录.md',
    '立即解除登录限制.md',
    '系统优化完成说明.md',
    '系统状态-全部就绪.md',
    '系统配置使用指南.md',
    '系统配置最终完成说明.md',
    '系统配置界面修复完成.md',
    '系统配置重构完成说明.md',
    '系统重构完成说明.md',
    '系统重构实施计划.md',
    '系统重构进度.md',
    '系统重构需求.md',
    '继续完善-下一步工作.md',
    '继续对话摘要.md',
    '自动分段改写功能说明.md',
    '表格测试连接自动更新模型列表.md',
    '解除登录限制.md',
    '认证修复-一图看懂.md',
    '语法错误修复完成.md',
    '调试默认配置加载.md',
    '通知系统优化完成.md',
    '速率限制优化完成.md',
    '配置显示undefined问题修复完成.md',
    '配置联动同步功能完成.md',
    '重启服务指南.md',
    '问题修复总结-会话认证.md',
    '问题已完全解决.md',
    '阶段1-AI节点管理快速优化完成.md',
    '阶段1-使用指南.md',
    '阶段1-界面对比.md',
    '阶段1-立即体验.md',
    '阶段2-优化说明.md',
    '阶段2-增强健康检测完成.md',
    '阶段2-显示位置说明.md',
    '阶段2-立即体验.md',
    '阶段3-完成通知.md',
    '阶段3-实施总结.md',
    '阶段3-快速参考.md',
    '阶段3-最终总结.md',
    '阶段3-立即体验.md',
    '阶段3-自动故障转移完成.md',
    '阶段3-集成示例.md',
    '阶段3-验收清单.md',
    '阶段4-负载均衡完成.md',
    '阶段4-负载均衡规划.md',
    '阶段5-监控统计完成.md',
    '阶段5-监控统计规划.md',
    '阶段6-前端集成规划.md',
    '阶段6-后端API完成.md',
    '阶段6-告警管理完成.md',
    '阶段6-故障转移历史完成.md',
    '阶段6-监控仪表板完成.md',
    '页面重构完成-3个页面.md',
    '项目交付文档.md',
    '验收清单-全部功能.md',
    '默认API配置和动态模型列表完成.md',
    '默认模型自动加载功能说明.md',
    '默认配置一致性修复完成.md',
    '默认配置加载最终修复.md',
    '默认配置加载问题修复.md',
    '默认配置同步流程图.md',
    '默认配置问题-快速参考.md'
];

// 需要保留的核心文档
const KEEP_FILES = [
    // === 核心必读文档 ===
    'README.md',                                    // 项目总览
    '系统改进建议.md',                              // 系统评估（必须保留）⭐
    
    // === 部署文档 ===
    '生产部署-README.md',                          // 生产部署总览
    '生产环境部署指南.md',                         // 完整部署步骤
    '运维快速参考.md',                             // 运维手册
    'Linux部署教程.md',                            // Linux部署
    'React前端部署指南.md',                        // 前端部署
    '数据库部署指南.md',                           // 数据库配置
    
    // === 功能使用文档 ===
    '快速开始.md',                                 // 快速上手
    'AI服务快速配置.md',                           // AI配置
    'AI节点管理系统-README.md',                    // 节点管理
    '负载均衡和故障转移-使用指南.md',              // 负载均衡
    '故障转移功能说明.md',                         // 故障转移
    '令牌节点配置功能完成.md',                     // 令牌管理
    '文本改写功能使用指南.md',                     // 改写功能
    
    // === 配置说明文档 ===
    '环境配置说明.md',                             // 环境变量
    '安全配置说明.md',                             // 安全配置
    '反向代理配置说明.md',                         // Nginx配置
    'Web配置说明.md',                              // Web界面
    'AI接口兼容说明.md',                           // API兼容
    'AI检测说明.md',                               // AI检测
    '5118格式说明.md',                             // 5118格式
    'compact参数使用指南.md',                      // 紧凑模式
    'iflow配置使用指南.md',                        // iflow配置
    '小旋风配置教程.md',                           // 小旋风配置
    '小旋风API接口文档.md',                        // API文档
    
    // === 参考文档 ===
    'Node.js版本兼容性说明.md',                    // Node版本
    'Windows日志查看指南.md',                      // 日志查看
    'SEO养站优化指南.md',                          // SEO优化
    '模型名称对照表.md',                           // 模型对照
    '如何自定义改写模式.md',                       // 自定义模式
    '增强的API识别机制说明.md',                    // API识别
    '手动API类型选择功能说明.md',                  // API类型
    '认证系统说明.md',                             // 认证系统
    'API中转说明.md',                              // API中转
    'API健康检测-快速参考.md',                     // 健康检测
    '完善工作总结.md',                             // 工作总结
    '多API配置-快速部署.md'                        // 多API配置
];

function cleanupProject() {
    console.log('========================================');
    console.log('项目清理开始');
    console.log('========================================\n');
    
    let deletedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log('正在删除无用文件...\n');
    
    for (const file of FILES_TO_DELETE) {
        const filePath = path.join(__dirname, '..', file);
        
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`  ✓ 已删除: ${file}`);
                deletedCount++;
            } else {
                console.log(`  ⊘ 不存在: ${file}`);
                skippedCount++;
            }
        } catch (error) {
            console.error(`  ✗ 删除失败: ${file} - ${error.message}`);
            errorCount++;
        }
    }
    
    console.log('\n========================================');
    console.log('清理完成！');
    console.log('========================================\n');
    console.log(`已删除: ${deletedCount} 个文件`);
    console.log(`跳过: ${skippedCount} 个文件（不存在）`);
    console.log(`失败: ${errorCount} 个文件\n`);
    
    if (errorCount > 0) {
        console.log('⚠️  部分文件删除失败，请检查文件权限\n');
    }
    
    console.log('保留的核心文档（约35篇）：');
    console.log('  === 核心必读 ===');
    console.log('  - README.md');
    console.log('  - 系统改进建议.md ⭐');
    console.log('');
    console.log('  === 部署文档（8篇）===');
    console.log('  - 生产部署-README.md');
    console.log('  - 生产环境部署指南.md');
    console.log('  - 运维快速参考.md');
    console.log('  - Linux/React/数据库部署指南');
    console.log('');
    console.log('  === 功能文档（7篇）===');
    console.log('  - 快速开始、AI配置、节点管理');
    console.log('  - 负载均衡、故障转移、令牌管理');
    console.log('');
    console.log('  === 配置文档（12篇）===');
    console.log('  - 环境、安全、Nginx配置');
    console.log('  - AI接口、小旋风配置等');
    console.log('');
    console.log('  === 参考文档（8篇）===');
    console.log('  - Node版本、日志查看、SEO优化等\n');
    console.log('📚 总计保留约35篇核心文档，已删除100+个临时文件\n');
}

// 执行清理
if (require.main === module) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('⚠️  警告：此操作将删除大量开发过程中的临时文件和文档！');
    console.log('核心文档和使用指南将被保留。\n');
    
    readline.question('确认要继续吗？(yes/no): ', (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
            cleanupProject();
        } else {
            console.log('\n已取消清理操作。\n');
        }
        readline.close();
    });
}

module.exports = { cleanupProject };
