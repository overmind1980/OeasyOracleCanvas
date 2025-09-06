# 甲骨文学习应用

一个交互式的甲骨文字符学习平台，支持拼音分解发音和语音合成功能。

## 功能特性

- 🔤 **甲骨文字符展示**：使用专业甲骨文字体显示古文字
- 🎵 **拼音分解发音**：智能拼音分解，支持声母韵母分别发音
- 🔊 **语音合成**：使用Web Speech API实现中文语音合成
- 📱 **响应式设计**：支持桌面和移动设备
- 🎯 **声调区分**：准确区分四声调发音

## 技术栈

- **前端**：HTML5, CSS3, JavaScript (ES6+)
- **语音**：Web Speech API
- **字体**：自定义甲骨文字体文件
- **部署**：Vercel静态托管

## 项目结构

```
oracle/
├── index.html              # 主页面
├── char.html               # 字符学习页面
├── app.js                  # 主要JavaScript逻辑
├── styles.css              # 样式文件
├── pinyinToCharacterMap.json # 拼音映射配置
├── CharacterInfo.json      # 字符信息数据
├── fonts/                  # 甲骨文字体文件
│   ├── FangZhengOracle.ttf

│   ├── OeasyOracle.ttf
│   └── ZhongYanYuan.ttf
├── audio/                  # 音频文件
│   ├── bgm.mp3
│   ├── pass.mp3
│   └── slash.mp3
└── test_*.html             # 测试页面
```

## 本地开发

1. 克隆项目到本地
2. 启动本地服务器：
   ```bash
   python3 -m http.server 8000
   ```
3. 访问 `http://localhost:8000`

## 部署

### Vercel部署

1. 安装Vercel CLI：
   ```bash
   npm install -g vercel
   ```

2. 登录Vercel：
   ```bash
   vercel login
   ```

3. 部署项目：
   ```bash
   vercel --prod
   ```

### 其他部署选项

- **GitHub Pages**：推送到GitHub仓库，启用Pages功能
- **Netlify**：拖拽项目文件夹到Netlify部署界面

## 核心功能说明

### 拼音分解发音

- **声母发音**：使用汉字映射，如 `l` → `了`
- **韵母发音**：直接发带声调的拼音字母，如 `ǐ`、`á`、`ù`
- **复合韵母**：支持二字符和三字符组合，如 `uè`、`iao`
- **声调区分**：四声调完整支持，准确区分发音

### 语音引擎

- 统一使用中文语音引擎
- 避免男女声混合问题
- 支持声调准确发音

## 浏览器兼容性

- Chrome 33+
- Firefox 49+
- Safari 14.1+
- Edge 14+

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进项目。