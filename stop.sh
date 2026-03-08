#!/bin/bash

echo "正在停止 SEO API 服务..."

# 查找并终止进程
pkill -f "node.*server.js"

echo "服务已停止"
