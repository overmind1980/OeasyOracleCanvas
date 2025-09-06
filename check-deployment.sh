#!/bin/bash

# 甲骨文学习应用 - 部署前检查脚本
# 使用方法：chmod +x check-deployment.sh && ./check-deployment.sh

echo "🔍 检查甲骨文学习应用部署准备情况..."
echo "==========================================="

# 检查必需文件
echo "📁 检查必需文件..."

required_files=("index.html" "char.html" "styles.css" "app.js")
missing_files=()

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - 存在"
    else
        echo "❌ $file - 缺失"
        missing_files+=("$file")
    fi
done

# 检查音频文件
echo "
🎵 检查音频文件..."
audio_dir="audio"
if [ -d "$audio_dir" ]; then
    echo "✅ audio目录 - 存在"
    audio_files=("bgm.mp3" "pass.mp3" "slash.mp3")
    for audio in "${audio_files[@]}"; do
        if [ -f "$audio_dir/$audio" ]; then
            size=$(du -h "$audio_dir/$audio" | cut -f1)
            echo "✅ $audio - 存在 ($size)"
        else
            echo "⚠️  $audio - 缺失（可选）"
        fi
    done
else
    echo "⚠️  audio目录 - 缺失（可选）"
fi

# 检查字体文件
echo "
🔤 检查字体文件..."
fonts_dir="fonts"
if [ -d "$fonts_dir" ]; then
    echo "✅ fonts目录 - 存在"
    font_count=$(find "$fonts_dir" -name "*.ttf" | wc -l)
    echo "📊 发现 $font_count 个字体文件"
    
    # 检查字体文件大小
    find "$fonts_dir" -name "*.ttf" -exec du -h {} \; | while read size file; do
        echo "   📄 $(basename "$file") - $size"
    done
else
    echo "❌ fonts目录 - 缺失"
    missing_files+=("fonts/")
fi

# 检查数据文件
echo "
📊 检查数据文件..."
data_files=("CharacterInfo.json" "pinyinToCharacterMap.json")
for data in "${data_files[@]}"; do
    if [ -f "$data" ]; then
        size=$(du -h "$data" | cut -f1)
        echo "✅ $data - 存在 ($size)"
    else
        echo "❌ $data - 缺失"
        missing_files+=("$data")
    fi
done

# 检查Git配置
echo "
🔧 检查Git配置..."
if [ -d ".git" ]; then
    echo "✅ Git仓库 - 已初始化"
    
    if git remote get-url origin > /dev/null 2>&1; then
        remote_url=$(git remote get-url origin)
        echo "✅ 远程仓库 - 已配置: $remote_url"
    else
        echo "⚠️  远程仓库 - 未配置"
        echo "   请运行: git remote add origin https://gitee.com/你的用户名/仓库名.git"
    fi
    
    # 检查Git用户配置
    if git config user.name > /dev/null && git config user.email > /dev/null; then
        user_name=$(git config user.name)
        user_email=$(git config user.email)
        echo "✅ Git用户 - 已配置: $user_name <$user_email>"
    else
        echo "⚠️  Git用户 - 未配置"
        echo "   请运行: git config --global user.name '你的姓名'"
        echo "   请运行: git config --global user.email '你的邮箱'"
    fi
else
    echo "⚠️  Git仓库 - 未初始化"
    echo "   请运行: git init"
fi

# 检查项目总大小
echo "
📏 检查项目大小..."
total_size=$(du -sh . | cut -f1)
echo "📦 项目总大小: $total_size"

# 检查大文件
echo "
🔍 检查大文件 (>10MB)..."
large_files=$(find . -type f -size +10M -not -path './.git/*' 2>/dev/null)
if [ -z "$large_files" ]; then
    echo "✅ 没有发现大文件"
else
    echo "⚠️  发现大文件:"
    echo "$large_files" | while read file; do
        size=$(du -h "$file" | cut -f1)
        echo "   📄 $file - $size"
    done
    echo "   建议压缩大文件以提高部署速度"
fi

# 总结
echo "
==========================================="
echo "📋 检查总结:"

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ 所有必需文件都存在"
    echo "🚀 项目已准备好部署！"
    echo "
下一步:"
    echo "1. 运行 ./deploy-to-gitee.sh 部署到Gitee Pages"
    echo "2. 或查看 '快速部署指南.md' 了解详细步骤"
else
    echo "❌ 发现 ${#missing_files[@]} 个问题需要解决:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    echo "
请解决上述问题后再次运行检查"
fi

echo "==========================================="