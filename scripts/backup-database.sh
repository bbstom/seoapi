#!/bin/bash

# 数据库备份脚本
# 用于定期备份 MySQL 数据库
# 
# 使用方法：
# 1. 修改下面的配置信息
# 2. chmod +x scripts/backup-database.sh
# 3. 添加到 crontab: 0 2 * * * /var/www/seoapi/scripts/backup-database.sh

# ========================================
# 配置信息（请修改为实际值）
# ========================================
DB_NAME="seoapi"
DB_USER="seoapi_user"
DB_PASS="your_password_here"  # 修改为实际密码
BACKUP_DIR="/var/backups/seoapi"
DATE=$(date +%Y%m%d_%H%M%S)

# ========================================
# 备份逻辑
# ========================================

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
echo "开始备份数据库: $DB_NAME"
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/seoapi_$DATE.sql.gz

# 检查备份是否成功
if [ $? -eq 0 ]; then
    echo "✓ 备份成功: seoapi_$DATE.sql.gz"
    
    # 删除30天前的备份
    find $BACKUP_DIR -name "seoapi_*.sql.gz" -mtime +30 -delete
    echo "✓ 已清理30天前的旧备份"
else
    echo "✗ 备份失败！"
    exit 1
fi

# 显示备份文件大小
BACKUP_SIZE=$(du -h $BACKUP_DIR/seoapi_$DATE.sql.gz | cut -f1)
echo "备份文件大小: $BACKUP_SIZE"

# 显示当前所有备份
echo ""
echo "当前所有备份文件："
ls -lh $BACKUP_DIR/seoapi_*.sql.gz

echo ""
echo "备份完成！"
