#!/bin/bash

# 甲骨文学习应用 - Gitee Pages 部署脚本
# 使用方法：chmod +x deploy-to-gitee.sh && ./deploy-to-gitee.sh

echo "🚀 开始部署甲骨文学习应用到 Gitee Pages..."

# 检查是否已初始化git仓库
if [ ! -d ".git" ]; then
    echo "📦 初始化 Git 仓库..."
    git init
fi

# 添加所有文件
echo "📁 添加项目文件..."
git add .

# 检查是否有变更
if git diff --staged --quiet; then
    echo "ℹ️  没有检测到文件变更，跳过提交"
else
    # 提交变更
    echo "💾 提交变更..."
    git commit -m "更新甲骨文学习应用 - $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 检查是否已添加远程仓库
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ 错误：未配置 Gitee 远程仓库"
    echo "请先执行以下命令配置远程仓库："
    echo "git remote add origin https://gitee.com/你的用户名/仓库名.git"
    exit 1
fi

# 推送到Gitee
echo "🌐 推送到 Gitee..."
if git push origin master; then
    echo "✅ 部署成功！"
    echo "📱 请访问 Gitee 仓库页面开启 Pages 服务"
    echo "🔗 访问地址将是：https://你的用户名.gitee.io/仓库名"
else
    echo "❌ 推送失败，请检查网络连接和仓库权限"
    exit 1
fi

echo "🎉 部署完成！"