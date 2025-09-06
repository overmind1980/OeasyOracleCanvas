// 配置常量
const FONT_CONFIG = {
    primary: 'FangZhengOracle',
    secondary: 'ZhongYanYuan',
    tertiary: 'OeasyOracle'
};

const STYLE_CONFIG = {
    fontSize: 24,
    oracleColor: '#808080',
    brushColor: '#000000',
    backgroundColor: '#F5DEB3',
    brushSize: 18,  // 增加笔触大小，让画笔更粗更明显
    completionThreshold: 0.45  // 设置阈值为45%
};

// 坐标点类
class Point {
    constructor(x, y, pressure = null) {
        this.x = x;
        this.y = y;
        this.pressure = pressure;
    }
}

// 字符信息类
class Character {
    constructor(text, pronunciation, meaning, oracleForm) {
        this.text = text;
        this.pronunciation = pronunciation;
        this.meaning = meaning;
        this.oracleForm = oracleForm;
    }
}

// 绘制状态类
class DrawingState {
    constructor() {
        this.strokes = [];
        this.progress = 0;
        this.isCompleted = false;
    }
    
    reset() {
        this.strokes = [];
        this.progress = 0;
        this.isCompleted = false;
    }
}

// 应用状态管理类
class AppState {
    constructor() {
        this.currentChar = null;
        this.drawing = new DrawingState();
        this.inputText = '';
        this.showCelebration = false;
        this.fontLoaded = false;
        this.availableFont = null;
    }
}

// 字体加载器类
class FontLoader {
    constructor() {
        this.loadedFonts = new Set();
    }
    
    async loadFont(fontName) {
        try {
            if (this.loadedFonts.has(fontName)) {
                return true;
            }
            
            // 检查字体是否已经通过CSS加载
            await document.fonts.ready;
            
            // 使用document.fonts.check方法检查字体
            const fontSpec = `20px ${fontName}`;
            if (document.fonts.check(fontSpec)) {
                this.loadedFonts.add(fontName);
                console.log(`字体 ${fontName} 加载成功`);
                return true;
            }
            
            // 备用检测方法：测试字体渲染差异
            const testText = '甲骨文测试';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 使用默认字体测量
            ctx.font = '20px serif';
            const defaultWidth = ctx.measureText(testText).width;
            
            // 使用目标字体测量
            ctx.font = `20px ${fontName}, serif`;
            const targetWidth = ctx.measureText(testText).width;
            
            const isLoaded = Math.abs(defaultWidth - targetWidth) > 2;
            
            if (isLoaded) {
                this.loadedFonts.add(fontName);
                console.log(`字体 ${fontName} 通过备用方法加载成功`);
                return true;
            } else {
                // 静默处理，不显示警告
                return false;
            }
        } catch (error) {
            // 静默处理错误
            return false;
        }
    }
    
    getFontPriority() {
        return [FONT_CONFIG.primary, FONT_CONFIG.secondary, FONT_CONFIG.tertiary];
    }
    
    // 检测特定字符是否存在于某个字体中
    async checkCharacterInFont(character, fontName) {
        // 确保字体已加载
        if (!await this.loadFont(fontName)) {
            return false;
        }
        
        // 创建临时canvas来检测字符
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 200;
        
        // 清除画布
        ctx.clearRect(0, 0, 200, 200);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);
        
        // 使用目标字体绘制字符
        ctx.font = `72px "${fontName}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';
        ctx.fillText(character, 100, 100);
        
        // 获取目标字体的像素数据
        const targetImageData = ctx.getImageData(0, 0, 200, 200);
        
        // 清除画布，使用fallback字体绘制相同字符
        ctx.clearRect(0, 0, 200, 200);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);
        
        ctx.font = `72px serif`; // 使用系统默认字体
        ctx.fillStyle = 'black';
        ctx.fillText(character, 100, 100);
        
        // 获取fallback字体的像素数据
        const fallbackImageData = ctx.getImageData(0, 0, 200, 200);
        
        // 比较两个图像数据
        const targetData = targetImageData.data;
        const fallbackData = fallbackImageData.data;
        
        let differences = 0;
        let totalPixels = 0;
        
        for (let i = 0; i < targetData.length; i += 4) {
            const targetAlpha = targetData[i + 3];
            const fallbackAlpha = fallbackData[i + 3];
            
            // 只比较有内容的像素
            if (targetAlpha > 0 || fallbackAlpha > 0) {
                totalPixels++;
                
                const targetR = targetData[i];
                const targetG = targetData[i + 1];
                const targetB = targetData[i + 2];
                
                const fallbackR = fallbackData[i];
                const fallbackG = fallbackData[i + 1];
                const fallbackB = fallbackData[i + 2];
                
                // 计算颜色差异
                const colorDiff = Math.abs(targetR - fallbackR) + 
                                Math.abs(targetG - fallbackG) + 
                                Math.abs(targetB - fallbackB) + 
                                Math.abs(targetAlpha - fallbackAlpha);
                
                if (colorDiff > 10) {
                    differences++;
                }
            }
        }
        
        // 如果差异像素超过总像素的3%，认为字体包含该字符
         const hasCharacter = totalPixels > 0 && (differences / totalPixels) > 0.03;
        
        console.log(`字体 ${fontName} 字符 '${character}' 检测: 总像素=${totalPixels}, 差异像素=${differences}, 差异率=${totalPixels > 0 ? (differences/totalPixels*100).toFixed(2) : 0}%, 结果=${hasCharacter}`);
        
        return hasCharacter;
    }
    
    // 获取字体对字符的适配分数（差异率百分比）
    async getCharacterScore(character, fontName) {
        console.log(`  📊 开始计算字体 ${fontName} 对字符 '${character}' 的适配分数`);
        
        // 确保字体已加载
        if (!await this.loadFont(fontName)) {
            console.log(`  ❌ 字体 ${fontName} 未加载，返回分数 0`);
            return 0;
        }
        
        // 创建临时canvas来检测字符
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 200;
        
        // 清除画布
        ctx.clearRect(0, 0, 200, 200);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);
        
        // 使用目标字体绘制字符
        ctx.font = `72px "${fontName}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';
        ctx.fillText(character, 100, 100);
        console.log(`  🎨 使用字体 ${fontName} 绘制字符 '${character}'`);
        
        // 获取目标字体的像素数据
        const targetImageData = ctx.getImageData(0, 0, 200, 200);
        
        // 清除画布，使用fallback字体绘制相同字符
        ctx.clearRect(0, 0, 200, 200);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);
        
        ctx.font = `72px serif`; // 使用系统默认字体
        ctx.fillStyle = 'black';
        ctx.fillText(character, 100, 100);
        console.log(`  🎨 使用默认字体 serif 绘制字符 '${character}'`);
        
        // 获取fallback字体的像素数据
        const fallbackImageData = ctx.getImageData(0, 0, 200, 200);
        
        // 比较两个图像数据
        const targetData = targetImageData.data;
        const fallbackData = fallbackImageData.data;
        
        let differences = 0;
        let totalPixels = 0;
        
        for (let i = 0; i < targetData.length; i += 4) {
            const targetAlpha = targetData[i + 3];
            const fallbackAlpha = fallbackData[i + 3];
            
            // 只比较有内容的像素
            if (targetAlpha > 0 || fallbackAlpha > 0) {
                totalPixels++;
                
                const targetR = targetData[i];
                const targetG = targetData[i + 1];
                const targetB = targetData[i + 2];
                
                const fallbackR = fallbackData[i];
                const fallbackG = fallbackData[i + 1];
                const fallbackB = fallbackData[i + 2];
                
                // 计算颜色差异
                const colorDiff = Math.abs(targetR - fallbackR) + 
                                Math.abs(targetG - fallbackG) + 
                                Math.abs(targetB - fallbackB) + 
                                Math.abs(targetAlpha - fallbackAlpha);
                
                if (colorDiff > 10) {
                    differences++;
                }
            }
        }
        
        // 返回差异率百分比作为分数
        const score = totalPixels > 0 ? (differences / totalPixels) * 100 : 0;
        console.log(`  📈 像素分析结果: 总像素=${totalPixels}, 差异像素=${differences}, 分数=${score.toFixed(2)}%`);
        
        return score;
    }
    
    // 为特定字符获取可用字体
    async getAvailableFontForCharacter(character) {
        const fonts = this.getFontPriority();
        
        console.log(`\n=== 开始为字符 '${character}' 检测字体 ===`);
        console.log('字体优先级顺序:', fonts);
        
        // 特殊处理："手"字强制使用OeasyOracle字体
        if (character === '手') {
            console.log('🎯 检测到"手"字，强制使用OeasyOracle字体');
            const targetFont = 'OeasyOracle';
            const fontLoaded = await this.loadFont(targetFont);
            if (fontLoaded) {
                console.log(`✅ 强制选择字体: ${targetFont} ("手"字专用)`);
                console.log(`=== 字体检测完成 ===\n`);
                return targetFont;
            } else {
                console.log(`❌ OeasyOracle字体加载失败，继续常规检测流程`);
            }
        }
        
        // 特殊处理："金"字强制使用甲骨文字体
        if (character === '金') {
            console.log('🎯 检测到"金"字，强制使用甲骨文字体');
            // 按优先级尝试甲骨文字体
            const oracleFonts = ['FangZhengOracle', 'ZhongYanYuan', 'OeasyOracle'];
            for (const font of oracleFonts) {
                const fontLoaded = await this.loadFont(font);
                if (fontLoaded) {
                    const score = await this.getCharacterScore(character, font);
                    console.log(`字体 ${font} 对"金"字的适配分数: ${score.toFixed(2)}%`);
                    if (score > 0.5) { // 降低阈值确保甲骨文字体被使用
                        console.log(`✅ 强制选择字体: ${font} ("金"字专用)`);
                        console.log(`=== 字体检测完成 ===\n`);
                        return font;
                    }
                }
            }
            console.log(`⚠️ 所有甲骨文字体都不适合"金"字，使用第一个可用的甲骨文字体`);
            // 如果分数都很低，仍然强制使用第一个可用的甲骨文字体
            for (const font of oracleFonts) {
                if (await this.loadFont(font)) {
                    console.log(`✅ 强制选择字体: ${font} ("金"字专用，忽略分数)`);
                    console.log(`=== 字体检测完成 ===\n`);
                    return font;
                }
            }
        }
        
        // 特殊处理："地"字强制使用甲骨文字体
        if (character === '地') {
            console.log('🎯 检测到"地"字，强制使用甲骨文字体');
            // 按优先级尝试甲骨文字体
            const oracleFonts = ['FangZhengOracle', 'ZhongYanYuan', 'OeasyOracle'];
            for (const font of oracleFonts) {
                const fontLoaded = await this.loadFont(font);
                if (fontLoaded) {
                    const score = await this.getCharacterScore(character, font);
                    console.log(`字体 ${font} 对"地"字的适配分数: ${score.toFixed(2)}%`);
                    if (score > 0.1) { // 使用更低的阈值
                        console.log(`✅ 强制选择字体: ${font} ("地"字专用)`);
                        console.log(`=== 字体检测完成 ===\n`);
                        return font;
                    }
                }
            }
            console.log(`⚠️ 所有甲骨文字体都不适合"地"字，使用第一个可用的甲骨文字体`);
            // 如果分数都很低，仍然强制使用第一个可用的甲骨文字体
            for (const font of oracleFonts) {
                if (await this.loadFont(font)) {
                    console.log(`✅ 强制选择字体: ${font} ("地"字专用，忽略分数)`);
                    console.log(`=== 字体检测完成 ===\n`);
                    return font;
                }
            }
        }

        // 特殊处理："马"字强制使用甲骨文字体
        if (character === '马') {
            console.log('🎯 检测到"马"字，强制使用甲骨文字体');
            // 直接尝试OeasyOracle字体，因为它通常包含更多甲骨文字符
            const oracleFonts = ['OeasyOracle', 'FangZhengOracle', 'ZhongYanYuan', 'HYChenTiJiaGuWen'];
            for (const font of oracleFonts) {
                const fontLoaded = await this.loadFont(font);
                if (fontLoaded) {
                    console.log(`✅ 强制选择字体: ${font} ("马"字专用，完全忽略适配分数)`);
                    console.log(`=== 字体检测完成 ===\n`);
                    return font;
                }
            }
            console.log(`⚠️ 所有甲骨文字体都无法加载，使用默认字体`);
        }

        // 特殊处理："甲"字强制使用甲骨文字体
        if (character === '甲') {
            console.log('🎯 检测到"甲"字，强制使用甲骨文字体');
            // 直接尝试甲骨文字体，优先使用OeasyOracle
            const oracleFonts = ['OeasyOracle', 'FangZhengOracle', 'ZhongYanYuan', 'HYChenTiJiaGuWen'];
            for (const font of oracleFonts) {
                const fontLoaded = await this.loadFont(font);
                if (fontLoaded) {
                    console.log(`✅ 强制选择字体: ${font} ("甲"字专用，完全忽略适配分数)`);
                    console.log(`=== 字体检测完成 ===\n`);
                    return font;
                }
            }
            console.log(`⚠️ 所有甲骨文字体都无法加载，使用默认字体`);
        }
        
        // 按优先级顺序检查字体，返回第一个可用的字体
        for (let i = 0; i < fonts.length; i++) {
            const font = fonts[i];
            console.log(`\n检测字体 ${i + 1}/${fonts.length}: ${font}`);
            
            // 检查字体是否已加载
            const fontLoaded = await this.loadFont(font);
            console.log(`字体 ${font} 加载状态:`, fontLoaded);
            
            if (!fontLoaded) {
                console.log(`字体 ${font} 加载失败，跳过`);
                continue;
            }
            
            const score = await this.getCharacterScore(character, font);
            console.log(`字体 ${font} 对字符 '${character}' 的适配分数: ${score.toFixed(2)}%`);
            
            // 设置字体适配阈值（降低阈值让更多汉字使用甲骨文字体）
            const threshold = 0.1; // 大幅降低阈值以确保甲骨文字体能被使用
            
            // 如果字体有一定的适配度，就使用它（按优先级顺序）
            if (score > threshold) {
                console.log(`✅ 选择字体: ${font} (分数: ${score.toFixed(2)}%)`);
                console.log(`=== 字体检测完成 ===\n`);
                return font;
            } else {
                console.log(`❌ 字体 ${font} 分数过低 (${score.toFixed(2)}%)，继续检测下一个字体`);
            }
        }
        
        console.log(`\n⚠️ 所有甲骨文字体都不适合字符 '${character}'，使用默认字体 serif`);
        console.log(`=== 字体检测完成 ===\n`);
        // 如果所有甲骨文字体都不包含该字符，返回默认字体
        return 'serif';
    }
    
    async getAvailableFont() {
        const fonts = this.getFontPriority();
        
        for (const font of fonts) {
            if (await this.loadFont(font)) {
                return font;
            }
        }
        
        // 如果所有字体都加载失败，返回默认字体
        return 'serif';
    }
}

// Canvas绘制类
class CanvasDrawing {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isDrawing = false;
        this.isHoverDrawing = false; // 新增：光标悬停绘制模式
        this.currentStroke = [];
        this.oracleTextBounds = null;
        this.animationId = null;
        this.lastDrawPoint = null; // 记录上一个绘制点
        this.drawThrottle = 0; // 绘制节流计时器
        this.drawThrottleDelay = 16; // 约60fps的绘制频率
        this.setupCanvas();
        this.bindEvents();
        this.startFlickerAnimation();
        
        // 初始化粒子系统
        if (window.particleSystem) {
            console.log('正在初始化粒子系统...');
            window.particleSystem.init(canvas);
        } else {
            console.log('粒子系统不存在');
        }
    }
    
    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // 设置高DPI支持
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width *= dpr;
        this.canvas.height *= dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    bindEvents() {
        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        // 移除mouseenter/mouseleave，改为在mousemove中控制悬停绘制
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // 触摸事件
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const pos = this.getEventPos({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            
            console.log('=== 触屏开始事件触发 ===');
            console.log('触屏开始，位置:', pos.x, pos.y);
            console.log('粒子系统状态:', window.particleSystem);
            console.log('粒子系统是否存在:', !!window.particleSystem);
            
            // 开始粒子特效
            if (window.particleSystem) {
                console.log('触屏开始，启动粒子发射，位置:', pos.x, pos.y);
                console.log('粒子系统状态:', {
                    isActive: window.particleSystem.isActive,
                    particleCount: window.particleSystem.particles.length,
                    hasCanvas: !!window.particleSystem.particleCanvas,
                    hasContext: !!window.particleSystem.particleCtx
                });
                window.particleSystem.startEmission(pos.x, pos.y);
            } else {
                console.log('警告：window.particleSystem不存在');
            }
            
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const pos = this.getEventPos({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            
            // 更新粒子发射位置
            if (window.particleSystem && this.isDrawing) {
                console.log('触屏移动，更新粒子位置:', pos.x, pos.y);
                window.particleSystem.updatePosition(pos.x, pos.y);
            }
            
            // 直接处理触摸移动事件，确保绘制
            if (this.isDrawing || this.isHoverDrawing) {
                const point = new Point(pos.x, pos.y);
                const isInOracleArea = this.isPointInOracleText(pos.x, pos.y);
                
                if (this.isDrawing) {
                    this.currentStroke.push(point);
                    if (isInOracleArea && this.currentStroke.length > 1) {
                        this.drawBrushStroke([this.currentStroke[this.currentStroke.length - 2], point]);
                    }
                } else if (isInOracleArea && this.lastDrawPoint) {
                    const distance = Math.sqrt(
                        Math.pow(point.x - this.lastDrawPoint.x, 2) + 
                        Math.pow(point.y - this.lastDrawPoint.y, 2)
                    );
                    
                    if (distance > 2) { // 触摸设备使用更小的距离阈值
                        this.currentStroke.push(point);
                        this.drawBrushStroke([this.lastDrawPoint, point]);
                        this.lastDrawPoint = point;
                    }
                }
            }
            
            // 同时触发鼠标事件以保持兼容性
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // 停止粒子特效
            if (window.particleSystem) {
                console.log('触屏结束，停止粒子发射');
                window.particleSystem.stopEmission();
            }
            
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            
            // 停止粒子特效
            if (window.particleSystem) {
                console.log('触屏取消，停止粒子发射');
                window.particleSystem.stopEmission();
            }
            
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        // 窗口大小改变事件
        window.addEventListener('resize', () => {
            setTimeout(() => this.setupCanvas(), 100);
        });
    }
    
    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getEventPos(e);
        const point = new Point(pos.x, pos.y);
        this.currentStroke = [point];
        this.lastDrawPoint = point;
        
        console.log('=== 鼠标开始绘制事件触发 ===');
        console.log('鼠标开始绘制，位置:', pos.x, pos.y);
        
        // 开始粒子特效（鼠标事件）
        if (window.particleSystem) {
            console.log('鼠标开始绘制，启动粒子发射，位置:', pos.x, pos.y);
            window.particleSystem.startEmission(pos.x, pos.y);
        } else {
            console.log('警告：window.particleSystem不存在（鼠标事件）');
        }
        
        // 开始播放写字音效
        startWritingSound();
        
        // 立即绘制一个点，确保画笔落下时有即时反馈
        const isInOracleArea = this.isPointInOracleText(pos.x, pos.y);
        if (isInOracleArea) {
            // 绘制一个更大的圆点作为起始点
            this.ctx.fillStyle = STYLE_CONFIG.brushColor;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, STYLE_CONFIG.brushSize / 2, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }
    
    startHoverDrawing(e) {
        this.isHoverDrawing = true;
        const pos = this.getEventPos(e);
        this.lastDrawPoint = new Point(pos.x, pos.y);
        // 开始新的笔画
        this.currentStroke = [new Point(pos.x, pos.y)];
    }
    
    stopHoverDrawing() {
        if (this.isHoverDrawing) {
            this.isHoverDrawing = false;
            // 保存当前笔画
            if (this.currentStroke.length > 1) {
                appState.drawing.strokes.push([...this.currentStroke]);
                this.updateProgress();
            }
            this.currentStroke = [];
            this.lastDrawPoint = null;
        }
    }
    
    handleMouseMove(e) {
         // 移除节流限制，确保实时绘画响应
         const pos = this.getEventPos(e);
         const point = new Point(pos.x, pos.y);
         const isInOracleArea = this.isPointInOracleText(pos.x, pos.y);
         
         // 只有在鼠标按下时才进行绘制
         if (this.isDrawing && isInOracleArea) {
             // 更新粒子发射位置
             if (window.particleSystem) {
                 window.particleSystem.updatePosition(pos.x, pos.y);
             }
             
             if (this.lastDrawPoint) {
                 // 立即绘制每个移动点，不使用距离阈值限制
                 this.currentStroke.push(point);
                 this.drawBrushStroke([this.lastDrawPoint, point]);
                 this.lastDrawPoint = point;
             } else {
                 // 如果没有lastDrawPoint，直接添加点并设置为lastDrawPoint
                 this.currentStroke.push(point);
                 this.lastDrawPoint = point;
                 // 立即绘制起始点
                 this.drawSinglePoint(point);
             }
         }
     }
    
    draw(e) {
        // 保留原有方法以兼容其他调用
        this.handleMouseMove(e);
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        // 停止写字音效
        stopWritingSound();
        
        // 停止粒子发射
        if (window.particleSystem) {
            window.particleSystem.stopEmission();
        }
        
        if (this.currentStroke.length > 1) {
            appState.drawing.strokes.push([...this.currentStroke]);
            this.updateProgress();
        }
        this.currentStroke = [];
    }
    
    drawBrushStroke(points) {
        if (!points || points.length < 2) return;
        
        this.ctx.strokeStyle = STYLE_CONFIG.brushColor;
        this.ctx.lineWidth = STYLE_CONFIG.brushSize; // 使用配置中的笔触大小
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 2;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        this.ctx.lineTo(points[1].x, points[1].y);
        this.ctx.stroke();
        
        // 重置阴影设置
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    drawSinglePoint(point) {
        // 绘制单个点，用于起始点的立即显示
        this.ctx.fillStyle = STYLE_CONFIG.brushColor;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 2;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, STYLE_CONFIG.brushSize / 2, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 重置阴影设置
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    drawOracleText(text, font) {
        // 只清除画布，不重置笔触数据
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.classList.remove('oracle-text');
        
        if (!text) return;
        
        const centerX = this.canvas.width / (window.devicePixelRatio || 1) / 2;
        const centerY = this.canvas.height / (window.devicePixelRatio || 1) / 2;
        
        // 计算合适的字体大小 - 响应式适配
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 检测屏幕方向和尺寸，优化字体大小
        let fontSizeRatio = 0.8; // 默认字体比例
        
        console.log(`📱 屏幕尺寸检测: 宽度=${window.innerWidth}, 高度=${window.innerHeight}`);
        console.log(`🎨 画布尺寸: 宽度=${canvasWidth}, 高度=${canvasHeight}`);
        
        // 竖屏模式优化 - 让甲骨文字体更大
        if (window.innerHeight > window.innerWidth) {
            console.log(`📱 检测到竖屏模式`);
            // 竖屏模式：使用更大的字体比例，增大显示效果
            fontSizeRatio = 0.92;
            if (window.innerWidth <= 480) {
                fontSizeRatio = 0.88; // 小屏竖屏，增大字体
                console.log(`📱 小屏竖屏模式，字体比例: ${fontSizeRatio}`);
            } else if (window.innerWidth <= 768) {
                fontSizeRatio = 0.90; // 中屏竖屏，增大字体
                console.log(`📱 中屏竖屏模式，字体比例: ${fontSizeRatio}`);
            } else {
                console.log(`📱 大屏竖屏模式，字体比例: ${fontSizeRatio}`);
            }
        } else {
            console.log(`📱 检测到横屏模式`);
            // 横屏模式：保持原有逻辑
            if (window.innerWidth <= 480) {
                fontSizeRatio = 0.75;
                console.log(`📱 小屏横屏模式，字体比例: ${fontSizeRatio}`);
            } else if (window.innerWidth <= 768) {
                fontSizeRatio = 0.78;
                console.log(`📱 中屏横屏模式，字体比例: ${fontSizeRatio}`);
            } else {
                console.log(`📱 大屏横屏模式，字体比例: ${fontSizeRatio}`);
            }
        }
        
        // 在竖屏模式下，优先考虑画布的较小维度来确保字体适配
        let fontSize;
        if (window.innerHeight > window.innerWidth) {
            // 竖屏：使用宽度作为主要参考，增大高度系数让字体更大
            fontSize = Math.min(canvasWidth * fontSizeRatio, canvasHeight * 0.95);
            console.log(`📏 竖屏字体大小计算: min(${canvasWidth} * ${fontSizeRatio}, ${canvasHeight} * 0.95) = ${fontSize}`);
        } else {
            // 横屏：使用原有逻辑
            fontSize = Math.min(canvasWidth, canvasHeight) * fontSizeRatio;
            console.log(`📏 横屏字体大小计算: min(${canvasWidth}, ${canvasHeight}) * ${fontSizeRatio} = ${fontSize}`);
        }
        
        // 计算闪烁透明度 (时隐时现效果)
        const time = Date.now() / 1000;
        const flickerOpacity = 0.7 + 0.3 * (Math.sin(time * 2) + 1) / 2; // 0.7-1.0之间变化，提高基础透明度
        
        // 使用选定的最佳字体，如果没有指定则使用默认优先级
        if (font && font !== 'serif') {
            console.log(`🎨 使用指定字体绘制甲骨文: ${font}`);
            console.log(`📝 绘制字符: '${text}', 字体大小: ${fontSize}px`);
            console.log(`🎯 字体应用: "${font}", serif`);
            this.ctx.font = `${fontSize}px "${font}", serif`;
        } else {
            console.log('🎨 使用默认字体优先级顺序绘制甲骨文');
            console.log(`📝 绘制字符: '${text}', 字体大小: ${fontSize}px`);
            console.log(`🎯 字体应用: "FangZhengOracle", "ZhongYanYuan", "OeasyOracle", serif`);
            // 使用字体优先级顺序
            this.ctx.font = `${fontSize}px "FangZhengOracle", "ZhongYanYuan", "OeasyOracle", serif`;
        }
        // 使用高对比度的金黄色，与龟甲背景形成强烈对比
        this.ctx.fillStyle = `rgba(255, 215, 0, ${flickerOpacity})`; // 金黄色
        this.ctx.strokeStyle = `rgba(255, 140, 0, ${flickerOpacity})`; // 深橙色描边
        this.ctx.lineWidth = 4; // 增加描边宽度
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 添加阴影效果，增强可见性
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 3;
        this.ctx.shadowOffsetY = 3;
        
        // 添加闪动效果类
        this.canvas.classList.add('oracle-text');
        
        // 先填充再描边，增强显示效果
        this.ctx.fillText(text, centerX, centerY);
        
        // 清除阴影后再描边，避免描边也有阴影
        this.ctx.shadowColor = 'transparent';
        this.ctx.strokeText(text, centerX, centerY);
        
        // 计算文字边界用于书写检测
        const metrics = this.ctx.measureText(text);
        this.oracleTextBounds = {
            x: centerX - metrics.width / 2,
            y: centerY - fontSize / 2,
            width: metrics.width,
            height: fontSize
        };
        
        // 重绘已有的笔画
        this.redrawStrokes();
    }
    
    redrawStrokes() {
        // 重绘已保存的笔画
        appState.drawing.strokes.forEach(stroke => {
            for (let i = 1; i < stroke.length; i++) {
                this.drawBrushStroke([stroke[i-1], stroke[i]]);
            }
        });
        
        // 重绘当前正在绘制的笔画（实时绘画的关键）
        if (this.currentStroke && this.currentStroke.length > 1) {
            for (let i = 1; i < this.currentStroke.length; i++) {
                this.drawBrushStroke([this.currentStroke[i-1], this.currentStroke[i]]);
            }
        } else if (this.currentStroke && this.currentStroke.length === 1) {
            // 绘制单个起始点
            this.drawSinglePoint(this.currentStroke[0]);
        }
        
        // 重新绘制进度显示（确保在画布清除后仍然可见）
        if (appState.drawing.progress > 0) {
            const percentage = Math.round(appState.drawing.progress * 100);
            this.drawProgressOnCanvas(percentage);
        }
    }
    
    isPointInOracleText(x, y) {
        if (!this.oracleTextBounds) return false;
        
        return x >= this.oracleTextBounds.x && 
               x <= this.oracleTextBounds.x + this.oracleTextBounds.width &&
               y >= this.oracleTextBounds.y && 
               y <= this.oracleTextBounds.y + this.oracleTextBounds.height;
    }
    
    // 计算甲骨文字体的像素区域
    calculateOracleTextPixels() {
        if (!this.oracleTextBounds || !appState.currentChar) return 0;
        
        // 创建临时canvas来计算文字像素
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // 设置临时canvas尺寸，与笔画检测保持一致
        const padding = STYLE_CONFIG.brushSize;
        const width = this.oracleTextBounds.width + padding * 2;
        const height = this.oracleTextBounds.height + padding * 2;
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // 获取字体信息
        const fontSize = this.oracleTextBounds.height;
        tempCtx.font = this.ctx.font;
        tempCtx.fillStyle = 'white';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        
        // 在临时canvas上绘制文字
        tempCtx.fillText(
            appState.currentChar.oracleForm,
            width / 2,
            height / 2
        );
        
        // 计算非透明像素数量，使用与笔画检测相同的阈值
        const imageData = tempCtx.getImageData(0, 0, width, height);
        let pixelCount = 0;
        const alphaThreshold = 50; // 与笔画检测使用相同的阈值
        
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] > alphaThreshold) { // 使用相同的alpha阈值
                pixelCount++;
            }
        }
        
        return pixelCount;
    }
    
    // 计算笔画覆盖的像素区域（只计算与甲骨文字体重叠的部分）
    calculateStrokeCoveragePixels() {
        if (!this.oracleTextBounds || appState.drawing.strokes.length === 0 || !appState.currentChar) return 0;
        
        // 创建两个临时canvas：一个用于甲骨文字体，一个用于笔画
        const oracleCanvas = document.createElement('canvas');
        const oracleCtx = oracleCanvas.getContext('2d');
        const strokeCanvas = document.createElement('canvas');
        const strokeCtx = strokeCanvas.getContext('2d');
        
        // 设置canvas尺寸为甲骨文字体区域，增加一些边距以确保完整覆盖
        const padding = STYLE_CONFIG.brushSize;
        const width = this.oracleTextBounds.width + padding * 2;
        const height = this.oracleTextBounds.height + padding * 2;
        oracleCanvas.width = strokeCanvas.width = width;
        oracleCanvas.height = strokeCanvas.height = height;
        
        // 1. 在第一个canvas上绘制甲骨文字体
        const fontSize = this.oracleTextBounds.height;
        oracleCtx.font = this.ctx.font;
        oracleCtx.fillStyle = 'white';
        oracleCtx.textAlign = 'center';
        oracleCtx.textBaseline = 'middle';
        oracleCtx.fillText(
            appState.currentChar.oracleForm,
            width / 2,
            height / 2
        );
        
        // 2. 在第二个canvas上绘制笔画
        strokeCtx.strokeStyle = 'white';
        strokeCtx.fillStyle = 'white';
        strokeCtx.lineWidth = STYLE_CONFIG.brushSize;
        strokeCtx.lineCap = 'round';
        strokeCtx.lineJoin = 'round';
        
        // 调整坐标系，使其相对于甲骨文字体区域（考虑padding）
        strokeCtx.translate(-this.oracleTextBounds.x + padding, -this.oracleTextBounds.y + padding);
        
        // 绘制所有笔画
        appState.drawing.strokes.forEach(stroke => {
            if (stroke.length > 1) {
                strokeCtx.beginPath();
                strokeCtx.moveTo(stroke[0].x, stroke[0].y);
                for (let i = 1; i < stroke.length; i++) {
                    strokeCtx.lineTo(stroke[i].x, stroke[i].y);
                }
                strokeCtx.stroke();
            } else if (stroke.length === 1) {
                // 绘制单点
                strokeCtx.beginPath();
                strokeCtx.arc(stroke[0].x, stroke[0].y, STYLE_CONFIG.brushSize / 2, 0, 2 * Math.PI);
                strokeCtx.fill();
            }
        });
        
        // 3. 获取两个canvas的像素数据
        const oracleImageData = oracleCtx.getImageData(0, 0, width, height);
        const strokeImageData = strokeCtx.getImageData(0, 0, width, height);
        
        // 4. 计算重叠的像素数量（使用更宽松的阈值）
        let coveragePixels = 0;
        const alphaThreshold = 50; // 降低alpha阈值，使检测更敏感
        
        for (let i = 0; i < oracleImageData.data.length; i += 4) {
            const oracleAlpha = oracleImageData.data[i + 3]; // 甲骨文字体的alpha通道
            const strokeAlpha = strokeImageData.data[i + 3]; // 笔画的alpha通道
            
            // 使用更宽松的阈值来判断像素覆盖
            if (oracleAlpha > alphaThreshold && strokeAlpha > alphaThreshold) {
                coveragePixels++;
            }
        }
        
        return coveragePixels;
    }
    
    updateProgress() {
        if (!this.oracleTextBounds || !appState.currentChar) return;
        
        // 基于像素覆盖比例的进度计算
        const oracleTextPixels = this.calculateOracleTextPixels();
        const strokeCoveragePixels = this.calculateStrokeCoveragePixels();
        
        if (oracleTextPixels === 0) {
            appState.drawing.progress = 0;
        } else {
            // 计算覆盖比例，但限制最大值为1
            appState.drawing.progress = Math.min(strokeCoveragePixels / oracleTextPixels, 1);
        }
        
        // 更新进度显示
        this.updateProgressDisplay();
        
        // 添加调试信息
        console.log(`甲骨文像素: ${oracleTextPixels}, 覆盖像素: ${strokeCoveragePixels}, 覆盖比例: ${(appState.drawing.progress * 100).toFixed(1)}%, 阈值: ${(STYLE_CONFIG.completionThreshold * 100).toFixed(1)}%, 已完成: ${appState.drawing.isCompleted}`);
        
        // 检查是否达到完成阈值
        if (appState.drawing.progress >= STYLE_CONFIG.completionThreshold && !appState.drawing.isCompleted) {
            appState.drawing.isCompleted = true;
            console.log('触发撒花特效!');
            this.showCelebration();
        }
    }
    
    // 在画布上显示进度百分比
    updateProgressDisplay() {
        // 按新规则计算显示百分比：completionThreshold开方乘以10，四舍五入保留整数
        const displayPercentage = Math.round(Math.sqrt(STYLE_CONFIG.completionThreshold) * 10);
        console.log(`书写进度: ${displayPercentage}% (基于阈值${STYLE_CONFIG.completionThreshold}的开方计算)`);
        
        // 在画布右上角绘制进度百分比
        this.drawProgressOnCanvas(displayPercentage);
    }
    
    // 在画布上绘制进度百分比
    drawProgressOnCanvas(percentage) {
        const canvas = this.canvas;
        const ctx = this.ctx;
        
        // 保存当前绘制状态
        ctx.save();
        
        // 设置进度文字样式
        const fontSize = 24;
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = '#FFD700'; // 金黄色
        ctx.strokeStyle = '#FF8C00'; // 深橙色描边
        ctx.lineWidth = 2;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        
        // 添加阴影效果
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // 计算文字位置（右上角，留出边距）
        const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
        const margin = 20;
        const x = canvasWidth - margin;
        const y = margin;
        
        const progressText = `${percentage}%`;
        
        // 先填充再描边
        ctx.fillText(progressText, x, y);
        ctx.shadowColor = 'transparent'; // 清除阴影后描边
        ctx.strokeText(progressText, x, y);
        
        // 恢复绘制状态
        ctx.restore();
    }
    
    // 重置进度显示（已移除UI元素，保留方法避免报错）
    resetProgressDisplay() {
        // 进度显示UI已移除，此方法保留以避免调用错误
        console.log('书写进度已重置: 0%');
    }
    
    showCelebration() {
        // 创建撒花效果
        this.createConfetti();
        
        // 播放庆祝音效（使用新的音频文件）
        playCelebrationAudio();
    }
    
    // 播放庆祝音效
    playCelebrationSound() {
        try {
            // 使用Web Audio API创建庆祝音效
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 创建一系列音符来模拟庆祝音效
            const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            const duration = 0.15; // 每个音符持续时间
            
            frequencies.forEach((frequency, index) => {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                    oscillator.type = 'triangle'; // 使用三角波，声音更柔和
                    
                    // 设置音量包络
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + duration);
                }, index * 100); // 每个音符间隔100ms
            });
            
            // 添加一个更高音的装饰音
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(1568, audioContext.currentTime); // G6
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            }, 500);
            
        } catch (error) {
            console.log('音效播放失败，可能是浏览器不支持或用户未进行交互:', error);
            // 如果Web Audio API失败，尝试使用简单的beep音效
            this.playSimpleBeep();
        }
    }
    
    // 简单的beep音效作为备选方案
    playSimpleBeep() {
        try {
            // 创建一个简单的提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('无法播放音效:', error);
        }
    }
    
    // 创建丰富的撒花效果
    createConfetti() {
        // 增加撒花数量和多样性
        this.createCircleConfetti();
        this.createStarConfetti();
        this.createEmojiConfetti();
        this.createRectangleConfetti();
    }
    
    // 创建圆形彩纸
    createCircleConfetti() {
        const colors = ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF', '#FF69B4', '#9370DB', '#00CED1'];
        const confettiCount = 80; // 增加数量
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.bottom = '0px';
                const size = Math.random() * 8 + 6; // 6-14px
                confetti.style.width = size + 'px';
                confetti.style.height = size + 'px';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.borderRadius = '50%';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                confetti.style.boxShadow = '0 0 6px rgba(255, 255, 255, 0.8)';
                
                const duration = Math.random() * 2 + 3; // 3-5秒
                confetti.style.transition = `all ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
                
                document.body.appendChild(confetti);
                
                // 向上抛撒动画
                setTimeout(() => {
                    confetti.style.bottom = (window.innerHeight + 150) + 'px';
                    confetti.style.transform = `translateX(${(Math.random() - 0.5) * 300}px) rotate(${Math.random() * 720}deg) scale(0.3)`;
                    confetti.style.opacity = '0';
                }, 10);
                
                // 清理元素
                setTimeout(() => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                }, duration * 1000 + 500);
            }, i * 30); // 更快的间隔
        }
    }
    
    // 创建星形彩纸
    createStarConfetti() {
        const colors = ['#FFD700', '#FFA500', '#FF1493', '#00FF7F', '#1E90FF'];
        const confettiCount = 40;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.bottom = '0px';
                const size = Math.random() * 12 + 10; // 10-22px
                confetti.style.width = size + 'px';
                confetti.style.height = size + 'px';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                
                // 创建星形
                confetti.innerHTML = '★';
                confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.fontSize = size + 'px';
                confetti.style.textShadow = '0 0 8px rgba(255, 255, 255, 0.8)';
                
                const duration = Math.random() * 2.5 + 3.5; // 3.5-6秒
                confetti.style.transition = `all ${duration}s ease-out`;
                
                document.body.appendChild(confetti);
                
                // 向上抛撒动画
                setTimeout(() => {
                    confetti.style.bottom = (window.innerHeight + 200) + 'px';
                    confetti.style.transform = `translateX(${(Math.random() - 0.5) * 400}px) rotate(${Math.random() * 1080}deg) scale(0.2)`;
                    confetti.style.opacity = '0';
                }, 10);
                
                // 清理元素
                setTimeout(() => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                }, duration * 1000 + 500);
            }, i * 40);
        }
    }
    
    // 创建表情符号彩纸
    createEmojiConfetti() {
        const emojis = ['🎉', '🎊', '✨', '🌟', '💫', '🎈', '🎁', '🏆', '👏', '🥳'];
        const confettiCount = 30;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.bottom = '0px';
                const size = Math.random() * 16 + 20; // 20-36px
                confetti.style.fontSize = size + 'px';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                
                confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                
                const duration = Math.random() * 3 + 4; // 4-7秒
                confetti.style.transition = `all ${duration}s cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
                
                document.body.appendChild(confetti);
                
                // 向上抛撒动画
                setTimeout(() => {
                    confetti.style.bottom = (window.innerHeight + 100) + 'px';
                    confetti.style.transform = `translateX(${(Math.random() - 0.5) * 350}px) rotate(${Math.random() * 540}deg) scale(0.5)`;
                    confetti.style.opacity = '0';
                }, 10);
                
                // 清理元素
                setTimeout(() => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                }, duration * 1000 + 500);
            }, i * 60);
        }
    }
    
    // 创建矩形彩纸
    createRectangleConfetti() {
        const colors = ['#FF69B4', '#00CED1', '#FFD700', '#32CD32', '#FF6347', '#9370DB'];
        const confettiCount = 60;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.bottom = '0px';
                confetti.style.width = (Math.random() * 8 + 4) + 'px'; // 4-12px
                confetti.style.height = (Math.random() * 16 + 8) + 'px'; // 8-24px
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                confetti.style.borderRadius = '2px';
                confetti.style.boxShadow = '0 0 4px rgba(255, 255, 255, 0.6)';
                
                const duration = Math.random() * 2 + 3.5; // 3.5-5.5秒
                confetti.style.transition = `all ${duration}s ease-out`;
                
                document.body.appendChild(confetti);
                
                // 向上抛撒动画
                setTimeout(() => {
                    confetti.style.bottom = (window.innerHeight + 120) + 'px';
                    confetti.style.transform = `translateX(${(Math.random() - 0.5) * 280}px) rotate(${Math.random() * 900}deg) scale(0.4)`;
                    confetti.style.opacity = '0';
                }, 10);
                
                // 清理元素
                setTimeout(() => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                }, duration * 1000 + 500);
            }, i * 25);
        }
    }
    

    
    // 保留旧方法以防兼容性问题
    createPetal(container, emojis, colors) {
        const petal = document.createElement('div');
        petal.className = 'petal falling';
        
        // 随机选择花瓣样式
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        petal.textContent = emoji;
        petal.style.color = color;
        petal.style.left = Math.random() * 100 + '%';
        petal.style.fontSize = (Math.random() * 10 + 15) + 'px';
        
        // 随机动画延迟和持续时间
        const duration = Math.random() * 2 + 2; // 2-4秒
        const delay = Math.random() * 0.5; // 0-0.5秒延迟
        
        petal.style.animationDuration = `${duration}s, 1.5s`;
        petal.style.animationDelay = `${delay}s`;
        
        container.appendChild(petal);
        
        // 动画结束后移除花瓣
        setTimeout(() => {
            if (petal.parentNode) {
                petal.parentNode.removeChild(petal);
            }
        }, (duration + delay) * 1000);
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.classList.remove('oracle-text');
        appState.drawing.strokes = [];
        appState.drawing.progress = 0;
        appState.drawing.isCompleted = false;
        this.resetProgressDisplay();
    }
    
    // 开始闪烁动画
    startFlickerAnimation() {
        const animate = () => {
            if (appState.currentChar) {
                this.redrawOracleText();
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    // 停止闪烁动画
    stopFlickerAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // 重绘甲骨文字体（用于动画）
    async redrawOracleText() {
        if (!appState.currentChar) return;
        
        // 使用字符级别的字体检测
        const font = await fontLoader.getAvailableFontForCharacter(appState.currentChar.oracleForm);
        this.drawOracleText(appState.currentChar.oracleForm, font);
        this.redrawStrokes();
    }
    
    getWritingProgress() {
        return appState.drawing.progress;
    }
}

// 文字信息类
class CharacterInfo {
    constructor() {
        this.characterDB = null;
        this.isLoaded = false;
    }
    
    // 异步加载字符数据库
    async loadCharacterDB() {
        if (this.isLoaded) {
            return this.characterDB;
        }
        
        try {
            const response = await fetch('./CharacterInfo.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.characterDB = data.characterDB;
            this.isLoaded = true;
            console.log('字符数据库加载成功');
            return this.characterDB;
        } catch (error) {
            console.error('加载字符数据库失败:', error);
            // 如果加载失败，使用空对象作为备用
            this.characterDB = {};
            this.isLoaded = true;
            return this.characterDB;
        }
    }
    
    async getCharacterInfo(char) {
        // 确保数据已加载
        if (!this.isLoaded) {
            await this.loadCharacterDB();
        }
        
        const info = this.characterDB[char];
        if (info) {
            return {
                pronunciation: info.pronunciation,
                meaning: info.meaning,
                oracleForm: info.oracleForm
            };
        } else {
            return {
                pronunciation: '未知',
                meaning: '暂无信息',
                oracleForm: char // 如果没有甲骨文形态，使用原字符
            };
        }
    }
}

// 全局变量
let appState;
let fontLoader;
let canvasDrawing;
let characterInfo;

// 音频控制变量
let bgmAudio;
let passAudio;
let slashAudio;
let volumeSlider;
let volumeIcon;

// 应用初始化
async function initApp() {
    // 初始化各个组件
    appState = new AppState();
    fontLoader = new FontLoader();
    characterInfo = new CharacterInfo();
    
    // 获取DOM元素
    const canvas = document.getElementById('oracleCanvas');
    const textInput = document.getElementById('textInput');
    const clearBtn = document.getElementById('clearBtn');
    const backBtn = document.getElementById('backBtn');
    const pronunciationEl = document.getElementById('pronunciation');
    const meaningEl = document.getElementById('meaning');
    
    // 确保粒子系统已创建并初始化
    console.log('检查粒子系统状态:', window.particleSystem);
    if (window.particleSystem) {
        console.log('粒子系统已存在，准备初始化');
    } else {
        console.log('粒子系统不存在，创建新实例');
        window.particleSystem = new ParticleSystem();
    }
    
    // 初始化Canvas绘制
    canvasDrawing = new CanvasDrawing(canvas);
    
    // 确保粒子系统正确初始化
    if (window.particleSystem && canvas) {
        console.log('手动初始化粒子系统');
        window.particleSystem.init(canvas);
    }
    
    // 并行加载字体、字符数据库和拼音映射配置
    console.log('正在加载甲骨文字体、字符数据库和拼音映射配置...');
    const [availableFont] = await Promise.all([
        fontLoader.getAvailableFont(),
        characterInfo.loadCharacterDB(),
        loadPinyinMapping()
    ]);
    
    appState.availableFont = availableFont;
    appState.fontLoaded = true;
    console.log(`使用字体: ${appState.availableFont}`);
    
    // 绑定事件
    textInput.addEventListener('input', handleTextInput);
    clearBtn.addEventListener('click', handleClear);
    backBtn.addEventListener('click', handleBack);
    

    
    // 处理URL参数（如果存在）
    const urlParams = new URLSearchParams(window.location.search);
    const charParam = urlParams.get('char') || urlParams.get('c'); // 支持两种参数名
    if (charParam) {
        console.log('🔗 检测到URL参数中的汉字:', charParam);
        textInput.value = charParam;
        
        // 延迟处理，确保字体完全加载
        setTimeout(() => {
            console.log('🎯 开始处理URL参数字符显示');
            // 触发输入事件处理
            const event = new Event('input', { bubbles: true });
            textInput.dispatchEvent(event);
        }, 500); // 延迟500ms确保字体加载完成
        
        // 自动朗读汉字
        setTimeout(async () => {
            console.log('🔊 开始自动朗读URL参数字符:', charParam);
            await autoSpeakCharacter(charParam);
        }, 1000); // 延迟1秒确保页面完全加载
    }
    
    // 初始化音频功能（确保DOM完全加载后）
    initAudio();
    
    console.log('甲骨文学习应用初始化完成');
    

}

// 处理文本输入
async function handleTextInput(e) {
    const text = e.target.value.trim();
    
    if (text) {
        // 检查是否需要更新（文本不同或者当前没有字符）
        if (text !== appState.inputText || !appState.currentChar) {
            appState.inputText = text;
            const lastChar = text[text.length - 1];
            
            // 获取字符信息
            const charInfo = await characterInfo.getCharacterInfo(lastChar);
            appState.currentChar = new Character(
                lastChar,
                charInfo.pronunciation,
                charInfo.meaning,
                charInfo.oracleForm
            );
            
            // 更新UI
            updateCharacterDisplay();
            
            // 绘制甲骨文 - 使用字符级别的字体检测
            console.log(`🔍 字体加载状态检查: appState.fontLoaded = ${appState.fontLoaded}`);
            if (appState.fontLoaded) {
                console.log(`🎯 开始为字符 '${charInfo.oracleForm}' 进行字体检测`);
                // 为当前字符找到最合适的字体
                const bestFont = await fontLoader.getAvailableFontForCharacter(charInfo.oracleForm);
                console.log(`字符 '${charInfo.oracleForm}' 使用字体: ${bestFont}`);
                canvasDrawing.drawOracleText(charInfo.oracleForm, bestFont);
            } else {
                console.log(`⚠️ 字体未加载，跳过字体检测和绘制`);
            }
            
            // 重置绘制状态
            appState.drawing.reset();
        }
    } else {
        // 如果输入为空，清除所有内容
        appState.inputText = '';
        appState.currentChar = null;
        updateCharacterDisplay();
        canvasDrawing.clearCanvas();
    }
}

// 更新字符显示
function updateCharacterDisplay() {
    const pronunciationEl = document.getElementById('pronunciation');
    const meaningEl = document.getElementById('meaning');
    
    if (appState.currentChar) {
        pronunciationEl.textContent = `读音：${appState.currentChar.pronunciation}`;
        meaningEl.textContent = `含义：${appState.currentChar.meaning}`;
    } else {
        pronunciationEl.textContent = '读音：';
        meaningEl.textContent = '含义：';
    }
}

// 处理清除
function handleClear() {
    const textInput = document.getElementById('textInput');
    textInput.value = '';
    appState.inputText = '';
    appState.currentChar = null;
    appState.drawing.reset();
    
    updateCharacterDisplay();
    canvasDrawing.clearCanvas();
}

// 处理返回
function handleBack() {
    window.location.href = 'index.html';
}

// 拼音字母到汉字发音的映射表（将从JSON文件加载）
let pinyinToCharacterMap = {};

// 加载拼音映射配置文件
async function loadPinyinMapping() {
    try {
        // 添加时间戳参数防止缓存
        const response = await fetch(`./pinyinToCharacterMap.json?t=${Date.now()}`);
        if (response.ok) {
            const config = await response.json();
            console.log('成功加载拼音映射配置:', config);
            
            // 合并声母和韵母映射
            const mergedMapping = {
                ...config['声母映射'],
                ...config['韵母映射']
            };
            
            // 更新全局映射表
            pinyinToCharacterMap = { ...pinyinToCharacterMap, ...mergedMapping };
            console.log('更新后的拼音映射表:', pinyinToCharacterMap);
        } else {
            console.log('无法加载拼音映射配置文件，使用默认配置');
        }
    } catch (error) {
        console.log('加载拼音映射配置出错，使用默认配置:', error);
    }
}

// 拼音分解函数（混合策略：辅音映射汉字，元音直接发音）
function decomposePinyin(pinyin, character = '') {
    console.log('=== 拼音分解函数（混合发音策略）===');
    console.log('输入拼音:', pinyin, '汉字:', character);
    
    // 特殊处理"日"字：直接发音，不需要拼音分解
    if (character === '日') {
        console.log('特殊处理"日"字：直接发音，不分解拼音');
        return []; // 返回空数组，只朗读"日"字本身
    }
    
    // 检查拼音映射配置是否已加载
    if (!pinyinToCharacterMap || Object.keys(pinyinToCharacterMap).length === 0) {
        console.log('警告：pinyinToCharacterMap未加载，使用默认映射');
        // 提供基本的声母映射作为后备
        pinyinToCharacterMap = {
            "b": "波", "p": "坡", "m": "摸", "f": "佛",
            "d": "得", "t": "特", "n": "讷", "l": "了",
            "g": "哥", "k": "科", "h": "喝", "j": "基",
            "q": "欺", "x": "西", "zh": "知", "ch": "蚩",
            "sh": "狮", "r": "儿", "z": "资", "c": "雌",
            "s": "思", "y": "衣", "w": "乌"
        };
    }
    
    // 新的拼音分解策略：
    // 辅音（声母）：映射到汉字（如 l→了、m→摸等）
    // 元音（韵母）：直接发音带声调拼音字母（如 ǐ、á、ù等）
    
    let result = [];
    let originalPinyin = pinyin.toLowerCase();
    
    console.log('开始分解拼音:', originalPinyin);
    
    // 分解声母和韵母
    let shengmu = '';
    let yunmu = '';
    
    // 识别声母（按长度从长到短匹配）
    const shengmuList = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
    
    for (let sm of shengmuList) {
        if (originalPinyin.startsWith(sm)) {
            shengmu = sm;
            yunmu = originalPinyin.substring(sm.length);
            break;
        }
    }
    
    // 如果没有找到声母，整个就是韵母
    if (!shengmu) {
        yunmu = originalPinyin;
    }
    
    console.log('声母:', shengmu, '韵母:', yunmu);
    
    // 添加声母（辅音映射到汉字）
    if (shengmu) {
        const shengmuMapping = pinyinToCharacterMap[shengmu];
        if (shengmuMapping) {
            result.push(shengmuMapping);
            console.log('添加声母映射:', shengmu, '→', shengmuMapping);
        } else {
            // 如果没有找到映射，使用原始声母
            result.push(shengmu);
            console.log('未找到声母映射，使用原始:', shengmu);
        }
    }

    // 处理韵母（优先使用汉字映射，确保正确发音）
    if (yunmu) {
        // 特殊处理j/q/x+u的发音规则：u要发成ü音
        if (['j', 'q', 'x'].includes(shengmu) && yunmu.startsWith('u')) {
            console.log('检测到j/q/x+u组合，将u转换为ü音');
            // 将u替换为对应的ü
            const uToUMap = {
                'u': 'ü',
                'ū': 'ǖ', 
                'ú': 'ǘ',
                'ǔ': 'ǚ',
                'ù': 'ǜ'
            };
            
            // 找到u的声调并替换
            for (let [uTone, umlautTone] of Object.entries(uToUMap)) {
                if (yunmu.startsWith(uTone)) {
                    yunmu = yunmu.replace(uTone, umlautTone);
                    console.log('韵母转换:', yunmu);
                    break;
                }
            }
        }
        
        // 特殊处理：某些复合韵母需要作为整体发音，不能分解
        const wholeVowels = [
            // 二符号组合
            'uè', 'ūè', 'úè', 'ǔè', 'ùè', 'üe', 'ǖe', 'ǘe', 'ǚe', 'ǜe', 'ie', 'īe', 'íe', 'ǐe', 'ìe',
            'ai', 'āi', 'ái', 'ǎi', 'ài', 'ei', 'ēi', 'éi', 'ěi', 'èi',
            'ao', 'āo', 'áo', 'ǎo', 'ào', 'ou', 'ōu', 'óu', 'ǒu', 'òu',
            'ui', 'uī', 'uí', 'uǐ', 'uì', 'iu', 'iū', 'iú', 'iǔ', 'iù',
            'an', 'ān', 'án', 'ǎn', 'àn', 'en', 'ēn', 'én', 'ěn', 'èn',
            'in', 'īn', 'ín', 'ǐn', 'ìn', 'un', 'ūn', 'ún', 'ǔn', 'ùn',
            'ün', 'ǖn', 'ǘn', 'ǚn', 'ǜn', 'ang', 'āng', 'áng', 'ǎng', 'àng',
            'eng', 'ēng', 'éng', 'ěng', 'èng', 'ing', 'īng', 'íng', 'ǐng', 'ìng',
            'ong', 'ōng', 'óng', 'ǒng', 'òng', 'er', 'ér', 'ěr', 'èr',
            // 三符号组合（移除iao系列，让其分解为i+ao）
            // 'iao', 'iāo', 'iáo', 'iǎo', 'iào', // 注释掉，让其分解
            'uai', 'uāi', 'uái', 'uǎi', 'uài',
            'uei', 'uēi', 'uéi', 'uěi', 'uèi',
            'ian', 'iān', 'ián', 'iǎn', 'iàn',
            'uan', 'uān', 'uán', 'uǎn', 'uàn',
            'üan', 'ǖan', 'ǘan', 'ǚan', 'ǜan',
            'iang', 'iāng', 'iáng', 'iǎng', 'iàng',
            'uang', 'uāng', 'uáng', 'uǎng', 'uàng',
            'iong', 'iōng', 'ióng', 'iǒng', 'iòng'
        ];
        
        let processed = false;
        
        // 检查是否为需要整体发音的复合韵母
        for (let wholeVowel of wholeVowels) {
            if (yunmu === wholeVowel) {
                // 使用韵母映射表中的汉字，而不是拼音字母
                const yunmuMapping = pinyinToCharacterMap[yunmu];
                if (yunmuMapping) {
                    result.push(yunmuMapping);
                    console.log('添加整体韵母映射:', yunmu, '→', yunmuMapping);
                } else {
                    result.push(yunmu);
                    console.log('未找到韵母映射，使用原始:', yunmu);
                }
                processed = true;
                break;
            }
        }
        
        // 如果不是特殊的整体韵母，检查是否需要分解
        if (!processed) {
            // 处理其他复合韵母，如 "iǎo" -> "i" + "ǎo"
            const singleVowels = ['i', 'u', 'ü', 'a', 'o', 'e'];
            for (let vowel of singleVowels) {
                if (yunmu.startsWith(vowel) && yunmu.length > 1) {
                    // 添加第一个元音（转换为对应汉字）
                    const firstVowelChar = pinyinToCharacterMap[vowel] || vowel;
                    result.push(firstVowelChar);
                    console.log('添加第一个元音:', vowel, '->', firstVowelChar);
                    
                    // 处理剩余部分（优先使用汉字映射）
                    let remaining = yunmu.substring(vowel.length);
                    if (remaining) {
                        const remainingChar = pinyinToCharacterMap[remaining];
                        if (remainingChar) {
                            result.push(remainingChar);
                            console.log('添加剩余韵母映射:', remaining, '->', remainingChar);
                        } else {
                            // 如果没有找到映射，检查是否为带声调的单个字母
                            if (remaining.length === 1 && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(remaining)) {
                                // 直接使用带声调的字母查找映射
                                console.log('尝试查找带声调字母映射:', remaining);
                                result.push(remaining);
                                console.log('使用带声调原始字母:', remaining);
                            } else {
                                result.push(remaining);
                                console.log('未找到映射，使用原始:', remaining);
                            }
                        }
                    }
                    processed = true;
                    break;
                }
            }
        }
        
        // 如果都不匹配，直接添加整个韵母（优先使用汉字映射）
        if (!processed) {
            const yunmuChar = pinyinToCharacterMap[yunmu];
            if (yunmuChar) {
                result.push(yunmuChar);
                console.log('添加完整韵母映射:', yunmu, '->', yunmuChar);
            } else {
                // 如果没有找到映射，检查是否为带声调的单个字母
                if (yunmu.length === 1 && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(yunmu)) {
                    // 直接使用带声调的字母
                    console.log('使用带声调韵母:', yunmu);
                    result.push(yunmu);
                } else {
                    result.push(yunmu);
                    console.log('未找到映射，使用原始:', yunmu);
                }
            }
        }
    }
    
    console.log('最终分解结果:', result);
    return result;
}

// 语音合成功能（支持拼音分解朗读）
async function speakChinese(text) {
    console.log('=== 开始语音合成 ===');
    console.log('尝试朗读汉字:', text);
    console.log('文本长度:', text.length);
    console.log('文本编码:', encodeURIComponent(text));
    console.log('当前时间:', new Date().toISOString());
    
    // 检查浏览器是否支持语音合成
    if (!('speechSynthesis' in window)) {
        console.error('❌ 浏览器不支持语音合成');
        showSpeechError('浏览器不支持语音合成功能');
        return false;
    }
    
    // 检查语音引擎状态
    console.log('speechSynthesis当前状态:');
    console.log('- speaking:', speechSynthesis.speaking);
    console.log('- pending:', speechSynthesis.pending);
    console.log('- paused:', speechSynthesis.paused);
    
    // 获取可用语音列表
    const voices = speechSynthesis.getVoices();
    console.log('可用语音数量:', voices.length);
    if (voices.length === 0) {
        console.warn('⚠️ 语音列表为空，尝试等待语音加载...');
        // 等待语音加载
        speechSynthesis.onvoiceschanged = async () => {
            console.log('语音列表已更新，重新尝试');
            await performSpeechSynthesis(text);
        };
        // 设置超时，避免无限等待
        setTimeout(() => {
            if (speechSynthesis.getVoices().length === 0) {
                console.error('❌ 语音加载超时');
                showSpeechError('语音引擎加载失败');
            }
        }, 3000);
        return false;
    }
    
    return await performSpeechSynthesis(text);
}

// 执行语音合成的核心逻辑
async function performSpeechSynthesis(text) {
    console.log('执行语音合成核心逻辑:', text);
    
    try {
        // 停止当前正在播放的语音
        console.log('停止当前语音合成');
        speechSynthesis.cancel();
        
        // 确保characterInfo已初始化并加载数据
        if (!characterInfo) {
            console.log('characterInfo未初始化，创建新实例');
            characterInfo = new CharacterInfo();
        }
        
        if (!characterInfo.isLoaded) {
            console.log('字符数据库未加载，开始加载...');
            await characterInfo.loadCharacterDB();
            console.log('字符数据库加载完成');
        }
        
        // 等待一小段时间确保停止完成
        setTimeout(() => {
            console.log('延迟后继续语音合成流程');
            
            // 获取汉字的拼音信息
            let pinyinInfo = null;
            if (characterInfo && characterInfo.characterDB && characterInfo.characterDB[text]) {
                pinyinInfo = characterInfo.characterDB[text].pronunciation;
                console.log('✅ 找到拼音信息:', pinyinInfo);
            } else {
                console.log('❌ 未找到拼音信息');
                console.log('characterDB状态:', !!(characterInfo && characterInfo.characterDB));
                console.log('characterInfo对象存在:', !!characterInfo);
                if (characterInfo && characterInfo.characterDB) {
                    const availableChars = Object.keys(characterInfo.characterDB);
                    console.log('可用字符数量:', availableChars.length);
                    console.log('前10个可用字符:', availableChars.slice(0, 10));
                    console.log('是否包含目标字符:', availableChars.includes(text));
                }
            }
            
            if (pinyinInfo) {
                // 如果有拼音信息，先朗读拼音分解过程
                console.log('✅ 调用拼音分解朗读');
                speakPinyinDecomposition(text, pinyinInfo);
            } else {
                // 如果没有拼音信息，直接朗读汉字
                console.log('⚠️ 使用直接朗读汉字模式');
                speakText(text, 0.4);
            }
        }, 100);
        
        return true;
        
    } catch (error) {
        console.error('❌ 语音合成出错:', error);
        console.error('错误堆栈:', error.stack);
        showSpeechError('语音合成发生错误: ' + error.message);
        return false;
    }
}

// 拼音分解朗读函数 - 直接发音拼音字母
function speakPinyinDecomposition(character, pinyin) {
    console.log('=== 拼音分解朗读开始（直接拼音发音版本）===');
    console.log('汉字:', character, '拼音:', pinyin);
    console.log('speechSynthesis状态 - speaking:', speechSynthesis.speaking, 'pending:', speechSynthesis.pending);
    
    // 确保语音合成完全停止
    speechSynthesis.cancel();
    
    // 分解拼音
    const decomposed = decomposePinyin(pinyin, character);
    console.log('拼音分解结果:', decomposed);
    
    // 创建朗读序列：拼音分解 -> 汉字
    // 例如："去" -> ["七", "育", "去"]
    // 例如："六" -> ["了", "iù", "六"]
    // 最后必须发原汉字的音
    const sequence = [...decomposed, character];
    console.log('完整朗读序列:', sequence);
    console.log('注意：最后发音是原汉字:', character);
    
    let currentIndex = 0;
    
    function speakNext() {
        console.log(`--- 朗读进度: ${currentIndex + 1}/${sequence.length} ---`);
        console.log('当前speechSynthesis状态 - speaking:', speechSynthesis.speaking, 'pending:', speechSynthesis.pending);
        
        if (currentIndex >= sequence.length) {
            console.log('=== 拼音分解朗读完成 ===');
            return;
        }
        
        let textToSpeak = sequence[currentIndex];
        console.log('当前朗读内容:', textToSpeak);
        
        // 如果是带声调的拼音字母，尝试使用映射表中的汉字
        if (pinyinToCharacterMap && typeof textToSpeak === 'string' && textToSpeak.length === 1 && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(textToSpeak)) {
            const mappedChar = pinyinToCharacterMap[textToSpeak];
            if (mappedChar) {
                console.log(`使用映射汉字发音: ${textToSpeak} -> ${mappedChar}`);
                textToSpeak = mappedChar;
            } else {
                console.log(`未找到映射，使用原始拼音: ${textToSpeak}`);
            }
        }
        
        // 等待之前的语音完全停止
        if (speechSynthesis.speaking || speechSynthesis.pending) {
            console.log('等待语音合成停止...');
            setTimeout(speakNext, 100);
            return;
        }
        
        // 创建语音合成实例
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
        // 统一语音引擎选择策略：
        // 所有拼音组件（声母汉字、韵母拼音字母）和汉字都使用中文语音引擎
        // 这样可以确保声音统一，避免男女声混合
        
        utterance.lang = 'zh-CN';
        console.log(`使用中文语音引擎发音: ${textToSpeak}`);
        
        // 为了确保语音一致性，尝试指定特定的中文语音
        const voices = speechSynthesis.getVoices();
        const chineseVoices = voices.filter(voice => voice.lang.startsWith('zh'));
        if (chineseVoices.length > 0) {
            // 优先使用第一个中文语音，确保所有发音使用同一个语音引擎
            utterance.voice = chineseVoices[0];
            console.log(`指定语音: ${chineseVoices[0].name} (${chineseVoices[0].lang})`);
        }
        
        // 设置语音参数
        utterance.rate = 0.4; // 更慢的语速
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // 朗读开始事件
        utterance.onstart = () => {
            console.log('✓ 开始朗读:', textToSpeak);
        };
        
        // 朗读完成后继续下一个
        utterance.onend = () => {
            console.log('✓ 朗读完成:', textToSpeak);
            currentIndex++;
            // 添加停顿
            console.log('等待500ms后继续下一个...');
            setTimeout(speakNext, 500); // 500ms停顿，更流畅
        };
        
        utterance.onerror = (event) => {
            console.log('✗ 朗读出错:', textToSpeak, event.error);
            currentIndex++;
            setTimeout(speakNext, 500);
        };
        
        console.log('→ 调用speechSynthesis.speak:', textToSpeak);
        speechSynthesis.speak(utterance);
        
        // 检查是否成功添加到队列
        setTimeout(() => {
            console.log('语音添加后状态 - speaking:', speechSynthesis.speaking, 'pending:', speechSynthesis.pending);
        }, 50);
    }
    
    // 延迟一点开始朗读序列，确保之前的语音已经停止
    console.log('延迟200ms后开始朗读序列...');
    setTimeout(() => {
        console.log('开始执行朗读序列');
        speakNext();
    }, 200);
}

// 简单文本朗读函数
function speakText(text, rate = 0.6) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
        console.log('开始朗读:', text);
    };
    
    utterance.onend = () => {
        console.log('朗读完成:', text);
    };
    
    utterance.onerror = (event) => {
        console.log('朗读出错:', event.error);
    };
    
    speechSynthesis.speak(utterance);
}

// 自动朗读汉字（处理浏览器限制）
async function autoSpeakCharacter(char) {
    console.log('=== 自动朗读汉字开始 ===');
    console.log('准备自动朗读汉字:', char);
    console.log('当前页面URL:', window.location.href);
    console.log('是否HTTPS:', window.location.protocol === 'https:');
    console.log('speechSynthesis支持:', 'speechSynthesis' in window);
    
    // 检查Web Speech API支持
    if (!('speechSynthesis' in window)) {
        console.error('❌ 浏览器不支持Web Speech API');
        showSpeechError('浏览器不支持语音合成功能');
        return false;
    }
    
    // 检查语音引擎状态
    console.log('speechSynthesis状态:');
    console.log('- speaking:', speechSynthesis.speaking);
    console.log('- pending:', speechSynthesis.pending);
    console.log('- paused:', speechSynthesis.paused);
    
    // 获取可用语音列表
    const voices = speechSynthesis.getVoices();
    console.log('可用语音数量:', voices.length);
    if (voices.length > 0) {
        const chineseVoices = voices.filter(v => v.lang.startsWith('zh'));
        console.log('中文语音数量:', chineseVoices.length);
        if (chineseVoices.length > 0) {
            console.log('首选中文语音:', chineseVoices[0].name, chineseVoices[0].lang);
        }
    } else {
        console.warn('⚠️ 语音列表为空，可能还在加载中');
    }
    
    // 尝试直接朗读
    console.log('尝试直接朗读...');
    const success = await speakChinese(char);
    
    if (!success) {
        console.log('❌ 直接朗读失败，可能需要用户交互');
        setupUserInteractionTrigger(char);
        return false;
    }
    
    console.log('✅ 自动朗读启动成功');
    return true;
}

// 设置用户交互触发语音
function setupUserInteractionTrigger(char) {
    console.log('设置用户交互触发语音朗读');
    
    // 显示提示信息
    showSpeechPrompt('点击页面任意位置开始语音朗读');
    
    // 创建交互处理函数
    const speakOnInteraction = async function(event) {
        console.log('用户交互触发:', event.type);
        
        // 移除提示信息
        hideSpeechPrompt();
        
        // 尝试朗读
        const success = await speakChinese(char);
        if (success) {
            console.log('✅ 用户交互触发朗读成功');
        } else {
            console.error('❌ 用户交互触发朗读仍然失败');
            showSpeechError('语音朗读功能暂时不可用');
        }
        
        // 移除事件监听器
        document.removeEventListener('click', speakOnInteraction);
        document.removeEventListener('touchstart', speakOnInteraction);
        document.removeEventListener('keydown', speakOnInteraction);
    };
    
    // 添加事件监听器
    document.addEventListener('click', speakOnInteraction, { passive: true });
    document.addEventListener('touchstart', speakOnInteraction, { passive: true });
    document.addEventListener('keydown', speakOnInteraction, { passive: true });
    
    console.log('用户交互事件监听器已设置');
}

// 显示语音提示
function showSpeechPrompt(message) {
    // 移除已存在的提示
    hideSpeechPrompt();
    
    const prompt = document.createElement('div');
    prompt.id = 'speechPrompt';
    prompt.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 1000;
        pointer-events: none;
        animation: fadeIn 0.3s ease-in;
    `;
    prompt.textContent = message;
    
    // 添加CSS动画
    if (!document.getElementById('speechPromptStyle')) {
        const style = document.createElement('style');
        style.id = 'speechPromptStyle';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(prompt);
    console.log('显示语音提示:', message);
}

// 隐藏语音提示
function hideSpeechPrompt() {
    const prompt = document.getElementById('speechPrompt');
    if (prompt) {
        prompt.remove();
        console.log('隐藏语音提示');
    }
}

// 显示语音错误信息
function showSpeechError(message) {
    console.error('语音错误:', message);
    
    const error = document.createElement('div');
    error.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(220, 53, 69, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 1000;
    `;
    error.textContent = message;
    
    document.body.appendChild(error);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (error.parentNode) {
            error.remove();
        }
    }, 3000);
}

// 音频初始化函数
function initAudio() {
    console.log('初始化音频功能...');
    
    // 等待DOM完全准备好
    setTimeout(() => {
        // 获取音频元素
        bgmAudio = document.getElementById('bgmAudio');
        passAudio = document.getElementById('passAudio');
        slashAudio = document.getElementById('slashAudio');
        volumeSlider = document.getElementById('volumeSlider');
        
        console.log('音频元素获取结果:');
        console.log('bgmAudio:', bgmAudio);
        console.log('passAudio:', passAudio);
        console.log('slashAudio:', slashAudio);
        console.log('volumeSlider:', volumeSlider);
    
    if (bgmAudio && volumeSlider) {
        // 从localStorage恢复音量设置
        const savedVolume = localStorage.getItem('oracleAudioVolume');
        const volume = savedVolume ? parseInt(savedVolume) : 50;
        
        // 设置音量
        volumeSlider.value = volume;
        bgmAudio.volume = volume / 100;
        
        console.log('恢复音量设置:', volume);
        
        // 尝试自动播放背景音乐
        console.log('bgmAudio元素存在，当前音量:', bgmAudio.volume);
        console.log('bgmAudio是否暂停:', bgmAudio.paused);
        console.log('bgmAudio当前时间:', bgmAudio.currentTime);
        
        const playPromise = bgmAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('背景音乐自动播放成功');
            }).catch(error => {
                console.log('自动播放被阻止，需要用户交互后播放:', error);
            });
        }
        
        // 音量滑块事件监听
        volumeSlider.addEventListener('input', function() {
            const volume = this.value / 100;
            bgmAudio.volume = volume;
            if (passAudio) passAudio.volume = volume;
            if (slashAudio) slashAudio.volume = volume;
            
            // 保存音量设置到localStorage
            localStorage.setItem('oracleAudioVolume', this.value);
        });
        

        
        // 确保用户交互后能播放音频
        const playBgmOnInteraction = function() {
            if (bgmAudio && bgmAudio.paused) {
                console.log('用户交互触发背景音乐播放');
                bgmAudio.play().catch(e => console.log('播放失败:', e));
            }
        };
        
        // 多种用户交互事件监听
        document.addEventListener('click', playBgmOnInteraction, { once: true });
        document.addEventListener('touchstart', playBgmOnInteraction, { once: true });
        document.addEventListener('keydown', playBgmOnInteraction, { once: true });
        
        console.log('音频初始化完成');
     }
     }, 100); // 延迟100ms确保DOM完全加载
}

// 播放庆祝音效
function playCelebrationAudio() {
    if (passAudio) {
        passAudio.currentTime = 0;
        passAudio.play().catch(e => console.log('庆祝音效播放失败:', e));
    }
}

// 开始写字音效
function startWritingSound() {
    console.log('尝试播放写字音效...');
    if (slashAudio) {
        console.log('slashAudio元素存在，开始播放');
        slashAudio.currentTime = 0;
        slashAudio.loop = true;
        slashAudio.play().then(() => {
            console.log('写字音效播放成功');
        }).catch(e => {
            console.log('写字音效播放失败:', e);
        });
    } else {
        console.log('slashAudio元素不存在');
    }
}

// 停止写字音效
function stopWritingSound() {
    if (slashAudio) {
        slashAudio.pause();
        slashAudio.currentTime = 0;
        slashAudio.loop = false;
    }
}

// 碳粉粒子类
class CarbonParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 1; // 水平速度，减慢
        this.vy = Math.random() * 0.5 + 0.2; // 垂直速度，减慢
        this.size = Math.random() * 1 + 0.75; // 粒子大小
        this.life = 8.0;                     // 增加生命值
        this.decay = Math.random() * 0.008 + 0.003; // 减慢衰减速度
        this.gravity = 0.05;                 // 减小重力，降落更慢
        this.alpha = 1.0;                    // 透明度
    }

    update() {
        // 应用重力
        this.vy += this.gravity;
        
        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        
        // 减少生命值
        this.life -= this.decay;
        
        // 更新透明度
        this.alpha = Math.max(0, this.life / 8.0);
        
        // 速度衰减
        this.vx *= 0.99;
        this.vy *= 0.99;
        
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // 绘制黑色平行四边形碳粉粒子
        ctx.fillStyle = `rgba(0, 0, 0, ${this.alpha})`; // 黑色，透明度随生命值变化
        
        // 绘制平行四边形
        const width = this.size * 2;
        const height = this.size * 1.5;
        const skew = width * 0.3; // 倾斜度
        
        ctx.beginPath();
        ctx.moveTo(this.x - width/2 + skew, this.y - height/2);
        ctx.lineTo(this.x + width/2 + skew, this.y - height/2);
        ctx.lineTo(this.x + width/2 - skew, this.y + height/2);
        ctx.lineTo(this.x - width/2 - skew, this.y + height/2);
        ctx.closePath();
        ctx.fill();
        
        // 添加轻微阴影效果
        ctx.shadowColor = `rgba(0, 0, 0, ${this.alpha * 0.3})`;
        ctx.shadowBlur = 1;
        ctx.shadowOffsetY = 1;
        
        ctx.restore();
    }
}

// 粒子特效系统
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.isActive = false;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.particleCanvas = null;
        this.particleCtx = null;
    }

    init(canvas) {
        this.canvas = canvas;
        
        // 创建专门用于粒子的Canvas层
        this.particleCanvas = document.createElement('canvas');
        
        // 获取主Canvas的实际显示尺寸和位置
        const rect = canvas.getBoundingClientRect();
        const canvasStyle = window.getComputedStyle(canvas);
        const dpr = window.devicePixelRatio || 1;
        
        // 设置粒子Canvas的尺寸与主Canvas一致
        this.particleCanvas.width = rect.width * dpr;
        this.particleCanvas.height = rect.height * dpr;
        this.particleCanvas.style.width = rect.width + 'px';
        this.particleCanvas.style.height = rect.height + 'px';
        this.particleCanvas.style.position = 'absolute';
        
        // 使用相对定位，直接覆盖在主Canvas上
        this.particleCanvas.style.position = 'absolute';
        this.particleCanvas.style.top = '0';
        this.particleCanvas.style.left = '0';
        this.particleCanvas.style.pointerEvents = 'none';
        this.particleCanvas.style.zIndex = '1002'; // 确保在其他元素之上
        this.particleCanvas.style.background = 'transparent';
        
        // 添加到画布容器，使用相对定位
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(this.particleCanvas);
        this.particleCtx = this.particleCanvas.getContext('2d');
        
        // 设置高DPI支持
        this.particleCtx.scale(dpr, dpr);
        
        console.log('粒子系统初始化完成');
        console.log('主Canvas尺寸:', canvas.width, 'x', canvas.height);
        console.log('粒子Canvas尺寸:', this.particleCanvas.width, 'x', this.particleCanvas.height);
        console.log('显示尺寸:', rect.width, 'x', rect.height);
        console.log('DPR:', dpr);
        console.log('粒子Canvas已添加到DOM，z-index:', this.particleCanvas.style.zIndex);
        console.log('粒子Canvas位置:', {
            top: this.particleCanvas.style.top,
            left: this.particleCanvas.style.left,
            position: this.particleCanvas.style.position,
            zIndex: this.particleCanvas.style.zIndex,
            pointerEvents: this.particleCanvas.style.pointerEvents
        });
        console.log('主Canvas位置:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
        });
        
        // 移除调试边框
        this.particleCanvas.style.border = 'none';
        console.log('粒子Canvas样式设置完成');
    }

    createParticle(x, y) {
        if (!this.particleCtx) {
            console.log('粒子系统错误：particleCanvas未初始化');
            return;
        }

        // 创建多个粒子
        const particleCount = 3 + Math.floor(Math.random() * 4);
        
        for (let i = 0; i < particleCount; i++) {
            const offsetX = (Math.random() - 0.5) * 15;
            const offsetY = (Math.random() - 0.5) * 15;
            const particle = new CarbonParticle(x + offsetX, y + offsetY);
            this.particles.push(particle);
        }
        
        // 立即绘制一帧以确保粒子可见
        this.drawFrame();
    }

    startEmission(x, y) {
        if (this.isActive) {
            return;
        }
        
        this.isActive = true;
        this.currentX = x;
        this.currentY = y;
        
        // 立即创建第一批粒子
        this.createParticle(x, y);
        
        // 开始动画循环
        this.animate();
        
        // 开始发射粒子
        this.emissionInterval = setInterval(() => {
            if (this.isActive && this.currentX !== undefined && this.currentY !== undefined) {
                this.createParticle(this.currentX, this.currentY);
            }
        }, 30); // 更频繁的粒子发射
    }

    stopEmission() {
        this.isActive = false;
        
        if (this.emissionInterval) {
            clearInterval(this.emissionInterval);
            this.emissionInterval = null;
        }
    }

    updatePosition(x, y) {
        this.currentX = x;
        this.currentY = y;
    }

    drawFrame() {
        if (!this.particleCtx) return;
        
        // 清除画布
        this.particleCtx.clearRect(0, 0, this.particleCanvas.width / (window.devicePixelRatio || 1), this.particleCanvas.height / (window.devicePixelRatio || 1));
        
        // 更新和绘制所有粒子
        let aliveCount = 0;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const isAlive = particle.update();
            
            if (isAlive) {
                particle.draw(this.particleCtx);
                aliveCount++;
            } else {
                // 移除死亡的粒子
                this.particles.splice(i, 1);
            }
        }
        
        // 粒子绘制完成
    }
    
    animate() {
        this.drawFrame();
        
        // 继续动画循环
        if (this.isActive || this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            console.log('粒子动画循环结束');
        }
    }
}

// 创建全局粒子系统实例
const particleSystem = new ParticleSystem();
// 绑定到window对象供触摸事件使用
window.particleSystem = particleSystem;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);