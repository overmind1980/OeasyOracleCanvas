// 配置常量
const FONT_CONFIG = {
    primary: 'FangZhengOracle',
    secondary: 'ZhongYanYuan',
    tertiary: 'OeasyOracle',
    quaternary: 'HYChenTiJiaGuWen'
};

const STYLE_CONFIG = {
    fontSize: 24,
    oracleColor: '#808080',
    brushColor: '#000000',
    backgroundColor: '#F5DEB3',
    brushSize: 24,  // 进一步增加笔触大小，让画笔更粗更明显
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
        return [FONT_CONFIG.primary, FONT_CONFIG.secondary, FONT_CONFIG.tertiary, FONT_CONFIG.quaternary];
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
    
    // 为字符获取可用字体 - 统一的甲骨文字体选择策略
    async getAvailableFontForCharacter(character) {
        const fonts = this.getFontPriority();
        
        console.log(`🔍 为字符 '${character}' 检测字体加载情况`);
        
        // 统一的甲骨文字体选择逻辑 - 按配置的优先级顺序选择第一个可用的字体
        for (let i = 0; i < fonts.length; i++) {
            const font = fonts[i];
            const fontLoaded = await this.loadFont(font);
            
            if (fontLoaded) {
                console.log(`✅ 字符 '${character}' 选择字体: ${font}`);
                return font;
            } else {
                console.log(`❌ 字符 '${character}' 字体 ${font} 加载失败`);
            }
        }
        
        console.warn(`❌ 字符 '${character}' 所有甲骨文字体都无法加载，使用第一个字体作为回退`);
        return FONT_CONFIG.primary;
    }
    
    async getAvailableFont() {
        const fonts = this.getFontPriority();
        
        for (const font of fonts) {
            if (await this.loadFont(font)) {
                return font;
            }
        }
        
        // 如果所有字体都加载失败，返回第一个甲骨文字体作为回退
        return FONT_CONFIG.primary;
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
        this.hasUserInteracted = false; // 用户交互标志，防止页面加载时意外触发庆祝
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
            
            // 开始播放写字音效（触摸事件）
            startWritingSound();
            
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
            
            // 直接处理触摸移动事件，确保绘制
            if (this.isDrawing || this.isHoverDrawing) {
                const point = new Point(pos.x, pos.y);
                const isInOracleArea = this.isPointInOracleText(pos.x, pos.y);
                
                if (this.isDrawing && isInOracleArea) {
                    this.currentStroke.push(point);
                    if (this.currentStroke.length > 1) {
                        this.drawBrushStroke([this.currentStroke[this.currentStroke.length - 2], point]);
                        
                        // 在实际绘制位置更新粒子发射位置
                        if (window.particleSystem) {
                            console.log('触屏移动绘制，更新粒子位置:', pos.x, pos.y);
                            window.particleSystem.updatePosition(pos.x, pos.y);
                        }
                        
                        // 确保写字音效在触摸移动时持续播放
                        if (slashAudio && slashAudio.paused) {
                            console.log('触屏移动绘制时重新启动写字音效');
                            startWritingSound();
                        }
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
                        
                        // 在实际绘制位置更新粒子发射位置
                        if (window.particleSystem) {
                            console.log('触屏悬停绘制，更新粒子位置:', pos.x, pos.y);
                            window.particleSystem.updatePosition(pos.x, pos.y);
                        }
                        
                        // 确保写字音效在触摸悬停绘制时持续播放
                        if (slashAudio && slashAudio.paused) {
                            console.log('触屏悬停绘制时重新启动写字音效');
                            startWritingSound();
                        }
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
            
            // 停止写字音效（触摸事件）
            stopWritingSound();
            
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
            
            // 停止写字音效（触摸事件）
            stopWritingSound();
            
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
        
        // 计算相对于canvas显示区域的坐标
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        // Firefox浏览器特殊处理：考虑页面滚动和缩放
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        
        // 获取canvas的实际显示尺寸
        const canvasDisplayWidth = this.canvas.offsetWidth;
        const canvasDisplayHeight = this.canvas.offsetHeight;
        
        // 获取canvas的内部尺寸（考虑设备像素比）
        const dpr = window.devicePixelRatio || 1;
        const canvasInternalWidth = this.canvas.width / dpr;
        const canvasInternalHeight = this.canvas.height / dpr;
        
        // 计算缩放比例
        const scaleX = canvasInternalWidth / canvasDisplayWidth;
        const scaleY = canvasInternalHeight / canvasDisplayHeight;
        
        // 应用缩放比例来修正坐标
        x = x * scaleX;
        y = y * scaleY;
        
        // Firefox特殊修正：处理触摸事件的坐标偏移
        if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
            // 检查是否为触摸事件（通过检查事件类型或触摸属性）
            const isTouchEvent = e.type && e.type.startsWith('touch');
            if (isTouchEvent || (e.clientX !== undefined && e.touches)) {
                // Firefox触摸事件坐标修正
                const computedStyle = window.getComputedStyle(this.canvas);
                const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
                const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
                const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
                
                x -= (paddingLeft + borderLeft);
                y -= (paddingTop + borderTop);
            }
        }
        
        return {
            x: x,
            y: y
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        this.hasUserInteracted = true; // 标记用户已开始交互
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
             if (this.lastDrawPoint) {
                 // 立即绘制每个移动点，不使用距离阈值限制
                 this.currentStroke.push(point);
                 this.drawBrushStroke([this.lastDrawPoint, point]);
                 this.lastDrawPoint = point;
                 
                 // 在实际绘制位置更新粒子发射位置
                 if (window.particleSystem) {
                     window.particleSystem.updatePosition(pos.x, pos.y);
                 }
                 
                 // 确保写字音效在鼠标移动时持续播放
                 if (slashAudio && slashAudio.paused) {
                     console.log('鼠标移动绘制时重新启动写字音效');
                     startWritingSound();
                 }
             } else {
                 // 如果没有lastDrawPoint，直接添加点并设置为lastDrawPoint
                 this.currentStroke.push(point);
                 this.lastDrawPoint = point;
                 // 立即绘制起始点
                 this.drawSinglePoint(point);
                 
                 // 在起始点位置更新粒子发射位置
                 if (window.particleSystem) {
                     window.particleSystem.updatePosition(pos.x, pos.y);
                 }
                 
                 // 确保写字音效在起始点播放
                 if (slashAudio && slashAudio.paused) {
                     console.log('鼠标移动起始点重新启动写字音效');
                     startWritingSound();
                 }
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
            fontSizeRatio = 1.1; // 增加到1.1
            if (window.innerWidth <= 480) {
                fontSizeRatio = 1.05; // 小屏竖屏，增大字体
                console.log(`📱 小屏竖屏模式，字体比例: ${fontSizeRatio}`);
            } else if (window.innerWidth <= 768) {
                fontSizeRatio = 1.08; // 中屏竖屏，增大字体
                console.log(`📱 中屏竖屏模式，字体比例: ${fontSizeRatio}`);
            } else {
                console.log(`📱 大屏竖屏模式，字体比例: ${fontSizeRatio}`);
            }
        } else {
            console.log(`📱 检测到横屏模式`);
            // 横屏模式：也增大字体
            if (window.innerWidth <= 480) {
                fontSizeRatio = 0.9; // 增加小屏横屏字体
                console.log(`📱 小屏横屏模式，字体比例: ${fontSizeRatio}`);
            } else if (window.innerWidth <= 768) {
                fontSizeRatio = 0.95; // 增加中屏横屏字体
                console.log(`📱 中屏横屏模式，字体比例: ${fontSizeRatio}`);
            } else {
                fontSizeRatio = 1.0; // 增加大屏横屏字体
                console.log(`📱 大屏横屏模式，字体比例: ${fontSizeRatio}`);
            }
        }
        
        // 在竖屏模式下，优先考虑画布的较小维度来确保字体适配
        let fontSize;
        if (window.innerHeight > window.innerWidth) {
            // 竖屏：使用宽度作为主要参考，进一步增大高度系数让字体更大
            fontSize = Math.min(canvasWidth * fontSizeRatio, canvasHeight * 0.98); // 增加到0.98
            console.log(`📏 竖屏字体大小计算: min(${canvasWidth} * ${fontSizeRatio}, ${canvasHeight} * 0.98) = ${fontSize}`);
        } else {
            // 横屏：使用更大的字体比例
            fontSize = Math.min(canvasWidth, canvasHeight) * fontSizeRatio;
            console.log(`📏 横屏字体大小计算: min(${canvasWidth}, ${canvasHeight}) * ${fontSizeRatio} = ${fontSize}`);
        }
        
        // 计算闪烁透明度 (时隐时现效果)
        const time = Date.now() / 1000;
        const flickerOpacity = 0.7 + 0.3 * (Math.sin(time * 2) + 1) / 2; // 0.7-1.0之间变化，提高基础透明度
        
        // 统一使用甲骨文字体优先级顺序
        const fontPriority = fontLoader.getFontPriority();
        const fontList = fontPriority.map(font => `"${font}"`).join(', ');
        console.log(`📝 绘制字符: '${text}', 字体大小: ${fontSize}px`);
        console.log(`🎯 字体应用: ${fontList}`);
        this.ctx.font = `${fontSize}px ${fontList}`;
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
    
    // 重新绘制文字（用于异步字体检测后的更新）
    redrawTextWithFont() {
        if (!appState.currentChar) return;
        
        const text = appState.currentChar.oracleForm;
        const centerX = this.canvas.width / (window.devicePixelRatio || 1) / 2;
        const centerY = this.canvas.height / (window.devicePixelRatio || 1) / 2;
        
        // 清除之前的文字区域
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 计算合适的字体大小 - 响应式适配
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 检测屏幕方向和尺寸，优化字体大小
        const isPortrait = canvasHeight > canvasWidth;
        const minDimension = Math.min(canvasWidth, canvasHeight);
        const maxDimension = Math.max(canvasWidth, canvasHeight);
        if (isPortrait) {
            // 竖屏模式：字体相对较大，适合手机竖屏使用
            fontSize = Math.min(minDimension * 0.6, maxDimension * 0.35, 280);
        } else {
            // 横屏模式：字体适中，适合平板和桌面使用
            fontSize = Math.min(minDimension * 0.5, maxDimension * 0.25, 240);
        }
        
        // 确保字体大小不会太小
        fontSize = Math.max(fontSize, 80);
        
        const fontPriority = fontLoader.getFontPriority();
        const fontList = fontPriority.map(font => `"${font}"`).join(', ');
        
        // 重新设置甲骨文字体
        this.ctx.font = `${fontSize}px ${fontList}`;
        
        // 计算闪烁透明度
        const time = Date.now() / 1000;
        const flickerOpacity = 0.7 + 0.3 * (Math.sin(time * 2) + 1) / 2;
        
        // 设置文字样式
        this.ctx.fillStyle = `rgba(255, 215, 0, ${flickerOpacity})`;
        this.ctx.strokeStyle = `rgba(255, 140, 0, ${flickerOpacity})`;
        this.ctx.lineWidth = 4;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 添加阴影效果
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 3;
        this.ctx.shadowOffsetY = 3;
        
        // 绘制文字
        this.ctx.fillText(text, centerX, centerY);
        this.ctx.shadowColor = 'transparent';
        this.ctx.strokeText(text, centerX, centerY);
        
        // 重新计算文字边界
        const metrics = this.ctx.measureText(text);
        const fontSize = parseFloat(this.ctx.font.match(/\d+/)[0]);
        this.oracleTextBounds = {
            x: centerX - metrics.width / 2,
            y: centerY - fontSize / 2,
            width: metrics.width,
            height: fontSize
        };
        
        // 重绘笔画
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
        if (!this.oracleTextBounds || !appState.currentChar) {
            console.log('🚫 updateProgress: 缺少必要条件，跳过进度更新');
            return;
        }
        
        // 检查是否有实际的绘制内容
        if (appState.drawing.strokes.length === 0) {
            console.log('🚫 updateProgress: 没有绘制内容，进度保持为0');
            appState.drawing.progress = 0;
            this.updateProgressDisplay();
            return;
        }
        
        // 基于像素覆盖比例的进度计算
        const oracleTextPixels = this.calculateOracleTextPixels();
        const strokeCoveragePixels = this.calculateStrokeCoveragePixels();
        
        console.log(`📊 进度计算详情: 甲骨文像素=${oracleTextPixels}, 覆盖像素=${strokeCoveragePixels}, 笔画数=${appState.drawing.strokes.length}`);
        
        if (oracleTextPixels === 0) {
            console.log('⚠️ 甲骨文像素为0，进度设为0');
            appState.drawing.progress = 0;
        } else if (strokeCoveragePixels === 0) {
            console.log('⚠️ 覆盖像素为0，进度设为0');
            appState.drawing.progress = 0;
        } else {
            // 计算覆盖比例，但限制最大值为1
            const rawProgress = strokeCoveragePixels / oracleTextPixels;
            appState.drawing.progress = Math.min(rawProgress, 1);
            console.log(`📈 计算进度: ${strokeCoveragePixels}/${oracleTextPixels} = ${rawProgress.toFixed(4)} -> ${appState.drawing.progress.toFixed(4)}`);
        }
        
        // 更新进度显示
        this.updateProgressDisplay();
        
        // 添加详细调试信息
        console.log(`📊 最终进度状态: 覆盖比例=${(appState.drawing.progress * 100).toFixed(1)}%, 阈值=${(STYLE_CONFIG.completionThreshold * 100).toFixed(1)}%, 已完成=${appState.drawing.isCompleted}`);
        
        // 检查是否达到完成阈值 - 添加严格的安全检查
        if (appState.drawing.progress >= STYLE_CONFIG.completionThreshold && 
            !appState.drawing.isCompleted && 
            appState.drawing.strokes.length > 0 && 
            strokeCoveragePixels > 0 &&
            oracleTextPixels > 0 &&
            appState.currentChar &&
            this.hasUserInteracted) { // 确保用户已经进行过交互
            appState.drawing.isCompleted = true;
            console.log('🎉 触发撒花特效! 条件满足: 进度达标 + 未完成 + 有笔画 + 有覆盖 + 用户已交互');
            this.showCelebration();
        } else if (appState.drawing.progress >= STYLE_CONFIG.completionThreshold) {
            console.log(`🚫 不触发撒花: 已完成=${appState.drawing.isCompleted}, 笔画数=${appState.drawing.strokes.length}, 覆盖像素=${strokeCoveragePixels}, 用户交互=${this.hasUserInteracted}`);
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
        
        // 设置进度文字样式 - 使用甲骨文字体
        const fontSize = 24;
        const fontPriority = fontLoader.getFontPriority();
        const fontList = fontPriority.map(font => `"${font}"`).join(', ');
        ctx.font = `bold ${fontSize}px ${fontList}, serif`;
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
        textInput.value = charParam;
        
        // 延迟处理，确保字体完全加载
        setTimeout(() => {
            // 触发输入事件处理
            const event = new Event('input', { bubbles: true });
            textInput.dispatchEvent(event);
        }, 500); // 延迟500ms确保字体加载完成
        
        // 自动朗读汉字
        setTimeout(async () => {
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
    // 如果有当前字符，保存其年龄组信息
    if (appState.currentChar && appState.currentChar.character) {
        // 年龄段汉字数据（与index.html保持一致）
        const ageCharacters = {
            2: ['一', '二', '三', '人', '大', '小', '目', '手', '日', '月'],
            3: ['四', '五', '六', '七', '八', '九', '十', '口', '耳', '心', '木', '火', '水', '土', '天', '上', '下', '金', '工', '厂'],
            4: ['牛', '马', '羊', '犬', '鸟', '虫', '父', '母', '子', '女', '田', '老', '入', '东', '西', '南', '北', '白', '电', '刀', '弓', '矢', '网', '石', '兄', '自', '牙', '爪', '内', '外'],
            5: ['户', '米', '禾', '豆', '瓜', '果', '花', '叶', '贝', '衣', '食', '行', '云', '雨', '雪', '风', '气', '力', '竹', '丝', '血', '骨', '肉', '皮', '毛', '身', '头', '足', '立', '见', '言', '止', '中', '弟', '青', '屮', '山', '川', '井', '鱼']
        };
        
        // 找到当前字符所属的年龄组
        const currentChar = appState.currentChar.character;
        let currentAge = null;
        for (const [age, characters] of Object.entries(ageCharacters)) {
            if (characters.includes(currentChar)) {
                currentAge = age;
                break;
            }
        }
        
        // 保存当前年龄组到localStorage
        if (currentAge) {
            localStorage.setItem('currentAge', currentAge);
            console.log(`返回时保存当前年龄组: ${currentAge}岁`);
        }
    }
    
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
    
            
            // 合并声母和韵母映射
            const mergedMapping = {
                ...config['声母映射'],
                ...config['韵母映射']
            };
            
            // 更新全局映射表
            pinyinToCharacterMap = { ...pinyinToCharacterMap, ...mergedMapping };
    
        } else {
    
        }
    } catch (error) {

    }
}

// 拼音分解函数（混合策略：辅音映射汉字，元音直接发音）
function decomposePinyin(pinyin, character = '') {

    

    
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

    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {

        // 等待语音加载
        speechSynthesis.onvoiceschanged = async () => {
    
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

    
    try {
        // 停止当前正在播放的语音
    
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
    
            
            // 获取汉字的拼音信息
            let pinyinInfo = null;
            if (characterInfo && characterInfo.characterDB && characterInfo.characterDB[text]) {
                pinyinInfo = characterInfo.characterDB[text].pronunciation;
    
            } else {
    
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

                speakPinyinDecomposition(text, pinyinInfo);
            } else {
                // 如果没有拼音信息，直接朗读汉字

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


    
    // 确保语音合成完全停止
    speechSynthesis.cancel();
    
    // 分解拼音
    const decomposed = decomposePinyin(pinyin, character);

    
    // 创建朗读序列：拼音分解 -> 汉字
    // 例如："去" -> ["七", "育", "去"]
    // 例如："六" -> ["了", "iù", "六"]
    // 最后必须发原汉字的音
    const sequence = [...decomposed, character];


    
    let currentIndex = 0;
    
    function speakNext() {
    
    
        
        if (currentIndex >= sequence.length) {
        
            return;
        }
        
        let textToSpeak = sequence[currentIndex];

        
        // 如果是带声调的拼音字母，尝试使用映射表中的汉字
        if (pinyinToCharacterMap && typeof textToSpeak === 'string' && textToSpeak.length === 1 && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(textToSpeak)) {
            const mappedChar = pinyinToCharacterMap[textToSpeak];
            if (mappedChar) {
                console.log(`使用映射汉字发音: ${textToSpeak} -> ${mappedChar}`);
                textToSpeak = mappedChar;
            } else {
    
            }
        }
        
        // 等待之前的语音完全停止
        if (speechSynthesis.speaking || speechSynthesis.pending) {
    
            setTimeout(speakNext, 100);
            return;
        }
        
        // 创建语音合成实例
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
        // 统一语音引擎选择策略：
        // 所有拼音组件（声母汉字、韵母拼音字母）和汉字都使用中文语音引擎
        // 这样可以确保声音统一，避免男女声混合
        
        utterance.lang = 'zh-CN';
        
        
        // 为了确保语音一致性，尝试指定特定的中文语音
        const voices = speechSynthesis.getVoices();
        const chineseVoices = voices.filter(voice => voice.lang.startsWith('zh'));
        if (chineseVoices.length > 0) {
            // 优先使用第一个中文语音，确保所有发音使用同一个语音引擎
            utterance.voice = chineseVoices[0];
            
        }
        
        // 设置语音参数
        utterance.rate = 0.4; // 更慢的语速
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // 朗读开始事件
        utterance.onstart = () => {

        };
        
        // 朗读完成后继续下一个
        utterance.onend = () => {

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
        
        
        speechSynthesis.speak(utterance);
        
        // 检查是否成功添加到队列
        setTimeout(() => {
    
        }, 50);
    }
    
    // 延迟一点开始朗读序列，确保之前的语音已经停止
    setTimeout(() => {
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

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        const chineseVoices = voices.filter(v => v.lang.startsWith('zh'));

    } else {

    }
    
    // 尝试直接朗读
    
    const success = await speakChinese(char);
    
    if (!success) {
        
        setupUserInteractionTrigger(char);
        return false;
    }
    
    
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
    console.log('🎵 初始化音频功能...');
    
    // 等待DOM完全准备好
    setTimeout(() => {
        // 获取音频元素
        console.log('🔍 开始获取音频元素...');
        console.log('DOM状态:', document.readyState);
        console.log('所有audio元素:', document.querySelectorAll('audio'));
        
        bgmAudio = document.getElementById('bgmAudio');
        passAudio = document.getElementById('passAudio');
        slashAudio = document.getElementById('slashAudio');
        volumeSlider = document.getElementById('volumeSlider');
        
        console.log('🎵 音频元素获取结果:');
        console.log('bgmAudio:', bgmAudio, bgmAudio ? '✅' : '❌');
        console.log('passAudio:', passAudio, passAudio ? '✅' : '❌');
        console.log('slashAudio:', slashAudio, slashAudio ? '✅' : '❌');
        console.log('volumeSlider:', volumeSlider, volumeSlider ? '✅' : '❌');
        
        // 检查音频文件路径
        if (bgmAudio) console.log('bgmAudio src:', bgmAudio.src);
        if (passAudio) console.log('passAudio src:', passAudio.src);
        if (slashAudio) console.log('slashAudio src:', slashAudio.src);
        
        if (!bgmAudio || !passAudio || !slashAudio) {
            console.error('❌ 音频元素未找到，检查HTML中的audio标签ID');
            console.error('缺失的元素:', {
                bgmAudio: !bgmAudio,
                passAudio: !passAudio,
                slashAudio: !slashAudio
            });
            return;
        }
        
        // 设置音频属性
        bgmAudio.loop = true;
        bgmAudio.preload = 'auto';
        passAudio.preload = 'auto';
        slashAudio.preload = 'auto';
        
        // Firefox特定的音频上下文处理
        let audioContext;
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        
        if (isFirefox && window.AudioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Firefox音频上下文已创建，状态:', audioContext.state);
            } catch (e) {
                console.log('音频上下文创建失败:', e);
            }
        }
        
        console.log('✅ 音频元素获取成功，设置属性完成');
        console.log('设备信息:', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isTablet: /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent),
            isFirefox: isFirefox
        });
    
    if (bgmAudio && volumeSlider) {
        // 从localStorage恢复音量设置
        const savedVolume = localStorage.getItem('oracleAudioVolume');
        const volume = savedVolume ? parseInt(savedVolume) : 50;
        
        // 设置音量
        volumeSlider.value = volume;
        bgmAudio.volume = volume / 100;
        if (passAudio) passAudio.volume = volume / 100;
        if (slashAudio) slashAudio.volume = volume / 100;
        
        console.log('恢复音量设置:', volume);
        
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent);
        
        console.log('设备检测结果:', { isMobile, isTablet });
        
        // 移动设备需要更严格的用户交互触发
        if (isMobile || isTablet) {
            console.log('检测到移动/平板设备，使用增强的音频播放策略');
            setupMobileAudioStrategy();
        } else {
            // 桌面设备尝试自动播放
            tryAutoPlayAudio();
        }
        
        // 音量滑块事件监听
        volumeSlider.addEventListener('input', function() {
            const volume = this.value / 100;
            bgmAudio.volume = volume;
            if (passAudio) passAudio.volume = volume;
            if (slashAudio) slashAudio.volume = volume;
            
            // 保存音量设置到localStorage
            localStorage.setItem('oracleAudioVolume', this.value);
            console.log('音量调整为:', volume);
        });
        
        console.log('音频初始化完成');
        
        // 音效测试函数已移除，避免页面加载时意外播放音效
     }
     }, 100); // 延迟100ms确保DOM完全加载
}

// 音效测试函数
function testAudioPlayback() {
    console.log('🧪 开始音效测试...');
    
    // 检查音频文件路径
    console.log('🔍 音频文件路径检查:');
    if (slashAudio) {
        console.log('slashAudio.src:', slashAudio.src);
        console.log('slashAudio.currentSrc:', slashAudio.currentSrc);
        console.log('slashAudio.readyState:', slashAudio.readyState);
        console.log('slashAudio.networkState:', slashAudio.networkState);
    }
    
    if (passAudio) {
        console.log('passAudio.src:', passAudio.src);
        console.log('passAudio.currentSrc:', passAudio.currentSrc);
        console.log('passAudio.readyState:', passAudio.readyState);
        console.log('passAudio.networkState:', passAudio.networkState);
    }
    
    // 测试slash音效
    console.log('🎵 测试slash音效...');
    if (slashAudio) {
        slashAudio.volume = 0.3;
        slashAudio.play().then(() => {
            console.log('✅ slash音效播放成功');
            setTimeout(() => slashAudio.pause(), 1000);
        }).catch(e => {
            console.error('❌ slash音效播放失败:', e);
        });
    }
    
    // 测试庆祝音效 - 已禁用，只有在达到完成度时才播放
    // setTimeout(() => {
    //     console.log('🎉 测试庆祝音效...');
    //     if (passAudio) {
    //         console.log('passAudio当前状态:', {
    //             volume: passAudio.volume,
    //             paused: passAudio.paused,
    //             readyState: passAudio.readyState,
    //             networkState: passAudio.networkState,
    //             src: passAudio.src,
    //             muted: passAudio.muted
    //         });
    //         
    //         // 确保音量不为0
    //         if (passAudio.volume === 0) {
    //             passAudio.volume = 0.3;
    //             console.log('设置庆祝音效音量为0.3');
    //         }
    //         
    //         passAudio.play().then(() => {
    //             console.log('✅ 庆祝音效测试播放成功');
    //         }).catch(e => {
    //             console.error('❌ 庆祝音效测试播放失败:', e);
    //         });
    //     } else {
    //         console.error('❌ passAudio元素不存在');
    //     }
    // }, 3000);
}

// 尝试自动播放音频（桌面设备）
function tryAutoPlayAudio() {
    console.log('🎵 尝试自动播放背景音乐...');
    console.log('bgmAudio元素存在，当前音量:', bgmAudio.volume);

    console.log('bgmAudio当前时间:', bgmAudio.currentTime);
    
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    
    // 立即尝试播放
    const attemptPlay = async () => {
        try {
            console.log('🚀 立即尝试播放音频...');
            const playPromise = bgmAudio.play();
            if (playPromise !== undefined) {
                await playPromise;
                console.log('✅ 背景音乐自动播放成功');
                return true;
            }
        } catch (error) {
            console.log('❌ 自动播放被阻止:', error.message);
            return false;
        }
        return false;
    };
    
    // Firefox特定的播放逻辑
    if (isFirefox) {
        console.log('检测到Firefox浏览器，使用增强播放策略');
        
        // 重新加载音频以确保Firefox兼容性
        bgmAudio.load();
        
        // 等待音频加载完成后播放
        const playFirefoxAudio = async () => {
            try {
                await new Promise((resolve, reject) => {
                    bgmAudio.addEventListener('canplaythrough', resolve, { once: true });
                    bgmAudio.addEventListener('error', reject, { once: true });
                    setTimeout(reject, 3000); // 3秒超时
                });
                
                const success = await attemptPlay();
                if (!success) {
                    setupUserInteractionTrigger();
                }
            } catch (error) {
                console.log('Firefox音频播放失败，设置用户交互触发:', error);
                setupUserInteractionTrigger();
            }
        };
        
        playFirefoxAudio();
    } else {
        // 其他浏览器的标准播放逻辑
        attemptPlay().then(success => {
            if (!success) {
                console.log('设置用户交互触发');
                setupUserInteractionTrigger();
            }
        });
    }
    
    // 多次延迟重试机制
    const retryDelays = [500, 1000, 2000];
    retryDelays.forEach(delay => {
        setTimeout(async () => {
            if (bgmAudio.paused) {
                console.log(`🔄 延迟${delay}ms后重试播放背景音乐...`);
                const success = await attemptPlay();
                if (!success && delay === 500) {
                    // 第一次重试失败时设置用户交互触发
                    setupUserInteractionTrigger();
                }
            }
        }, delay);
    });
}

// 设置移动设备音频策略
function setupMobileAudioStrategy() {
    console.log('设置移动设备音频播放策略');
    
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    
    // 创建音频上下文（如果需要）
    let audioContext = null;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('音频上下文创建成功，状态:', audioContext.state);
        
        // Firefox特定处理
        if (isFirefox) {
            console.log('Firefox移动设备音频策略激活');
        }
    } catch (e) {
        console.log('音频上下文创建失败:', e);
    }
    
    // 设置用户交互触发
    const playAudioOnInteraction = async function(event) {
        console.log('移动设备用户交互触发音频播放:', event.type);
        
        // 激活音频上下文
        if (audioContext && audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('音频上下文已激活');
            } catch (e) {
                console.log('音频上下文激活失败:', e);
            }
        }
        
        // Firefox特定的音频播放处理
        if (isFirefox && bgmAudio && bgmAudio.paused) {
            console.log('Firefox移动设备音频播放策略');
            try {
                // 重新加载音频
                bgmAudio.load();
                
                // 等待音频加载完成
                await new Promise((resolve, reject) => {
                    bgmAudio.addEventListener('canplaythrough', resolve, { once: true });
                    bgmAudio.addEventListener('error', reject, { once: true });
                    setTimeout(reject, 2000); // 2秒超时
                });
                
                // 播放音频
                await bgmAudio.play();
                console.log('Firefox背景音乐播放成功');
            } catch (e) {
                console.log('Firefox背景音乐播放失败:', e);
                // 重试机制
                setTimeout(() => {
                    bgmAudio.play().catch(e2 => console.log('Firefox背景音乐重试失败:', e2));
                }, 1000);
            }
        } else if (bgmAudio && bgmAudio.paused) {
            // 其他浏览器的标准播放逻辑
            console.log('尝试播放背景音乐...');
            bgmAudio.play().then(() => {
                console.log('背景音乐播放成功');
            }).catch(e => {
                console.log('背景音乐播放失败:', e);
                // 延迟重试
                setTimeout(() => {
                    bgmAudio.play().catch(e2 => console.log('背景音乐重试播放失败:', e2));
                }, 500);
            });
        }
        
        // 预加载其他音效
        if (passAudio) {
            passAudio.load();
            console.log('庆祝音效预加载完成');
        }
        if (slashAudio) {
            slashAudio.load();
            console.log('写字音效预加载完成');
        }
    };
    
    // 多种交互事件监听（移动设备专用）
    const interactionEvents = ['touchstart', 'touchend', 'click', 'tap'];
    interactionEvents.forEach(eventType => {
        document.addEventListener(eventType, playAudioOnInteraction, { once: true, passive: true });
    });
    
    // 页面可见性变化时重新激活音频
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && bgmAudio && bgmAudio.paused) {
            console.log('页面重新可见，尝试恢复背景音乐');
            bgmAudio.play().catch(e => console.log('页面可见时音乐播放失败:', e));
        }
    });
    
    console.log('移动设备音频策略设置完成');
}

// 设置用户交互触发（通用）
function setupUserInteractionTrigger() {
    
    
    let interactionTriggered = false;
    
    const playBgmOnInteraction = function(event) {
        if (interactionTriggered) return;
        interactionTriggered = true;
        
        console.log('👆 用户交互触发背景音乐播放:', event.type);
        if (bgmAudio && bgmAudio.paused) {
            bgmAudio.play().then(() => {
                console.log('✅ 交互触发播放成功');
            }).catch(e => {
                console.log('❌ 交互触发播放失败:', e);
                // 重试一次
                setTimeout(() => {
                    bgmAudio.play().catch(e2 => console.log('❌ 交互触发重试失败:', e2));
                }, 100);
            });
        }
        
        // 移除所有事件监听器
        interactionEvents.forEach(eventType => {
            document.removeEventListener(eventType, playBgmOnInteraction);
        });
    };
    
    // 更多种用户交互事件监听
    const interactionEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'mousemove', 'scroll'];
    interactionEvents.forEach(eventType => {
        document.addEventListener(eventType, playBgmOnInteraction, { once: true, passive: true });
    });
}

// 播放庆祝音效
function playCelebrationAudio() {
    console.log('🎉 尝试播放庆祝音效...');
    
    // 检查音频上下文状态
    if (window.AudioContext || window.webkitAudioContext) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🎵 音频上下文状态:', audioContext.state);
            
            // 如果音频上下文被暂停，尝试恢复
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('✅ 音频上下文已恢复');
                }).catch(e => {
                    console.error('❌ 音频上下文恢复失败:', e);
                });
            }
        } catch (e) {
            console.error('❌ 音频上下文检查失败:', e);
        }
    }
    
    // 检查用户交互状态
    console.log('👆 用户交互状态检查:', {
        hasUserInteracted: window.hasUserInteracted || false,
        documentHidden: document.hidden,
        visibilityState: document.visibilityState
    });
    
    if (passAudio) {
        console.log('✅ passAudio元素存在');
        console.log('📊 passAudio详细状态:', {
            volume: passAudio.volume,
            paused: passAudio.paused,
            currentTime: passAudio.currentTime,
            duration: passAudio.duration,
            readyState: passAudio.readyState,
            networkState: passAudio.networkState,
            src: passAudio.src,
            currentSrc: passAudio.currentSrc,
            muted: passAudio.muted,
            error: passAudio.error,
            ended: passAudio.ended
        });
        
        // 检查音频文件是否加载完成
        if (passAudio.readyState < 2) {
            console.log('⏳ 音频文件未完全加载，readyState:', passAudio.readyState);
            // 尝试重新加载
            passAudio.load();
            console.log('🔄 重新加载音频文件');
        }
    
        // 确保音量不为0
        if (passAudio.volume === 0) {
            const savedVolume = localStorage.getItem('oracleAudioVolume');
            const volume = savedVolume ? Math.max(parseInt(savedVolume), 30) : 50; // 确保最小音量为30
            passAudio.volume = volume / 100;
            console.log('🔊 庆祝音效音量为0，重新设置为:', passAudio.volume);
        }
        
        // 双重检查：如果音量仍然为0，强制设置为0.3
        if (passAudio.volume === 0) {
            passAudio.volume = 0.3;
            console.log('🔊 强制设置庆祝音效音量为0.3（双重检查）');
        }
        
        // 重置音频到开始位置
        passAudio.currentTime = 0;
        console.log('🔄 重置庆祝音频播放位置');
        
        // 检测移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent);
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        
        console.log('🔍 设备检测结果:', {
            isMobile,
            isTablet,
            isFirefox,
            userAgent: navigator.userAgent
        });
        
        // 统一的播放函数，包含更强的错误处理
        const attemptPlayCelebration = async (retryCount = 0) => {
            const maxRetries = 3;
            
            try {
                console.log(`🎵 尝试播放庆祝音效 (第${retryCount + 1}次)`);
                
                // 确保音频已准备好
                if (passAudio.readyState < 2) {
                    console.log('⏳ 等待音频加载完成...');
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('音频加载超时')), 3000);
                        passAudio.addEventListener('canplaythrough', () => {
                            clearTimeout(timeout);
                            resolve();
                        }, { once: true });
                        passAudio.load();
                    });
                }
                
                // 尝试播放
                const playPromise = passAudio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                    console.log('✅ 庆祝音效播放成功!');
                    return true;
                } else {
                    throw new Error('passAudio.play()返回undefined');
                }
                
            } catch (error) {
                console.error(`❌ 庆祝音效播放失败 (第${retryCount + 1}次):`, error);
                console.error('错误详情:', {
                    name: error.name,
                    message: error.message,
                    code: error.code
                });
                
                // 如果还有重试次数，则重试
                if (retryCount < maxRetries) {
                    const delay = (retryCount + 1) * 200; // 递增延迟
                    console.log(`⏳ ${delay}ms后重试...`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // 重新设置音频状态
                    passAudio.currentTime = 0;
                    if (passAudio.volume === 0) {
                        const savedVolume = localStorage.getItem('oracleAudioVolume');
                        const volume = savedVolume ? Math.max(parseInt(savedVolume), 30) : 50; // 确保最小音量为30
                        passAudio.volume = volume / 100;
                        // 双重检查
                        if (passAudio.volume === 0) {
                            passAudio.volume = 0.3;
                        }
                    }
                    
                    return attemptPlayCelebration(retryCount + 1);
                } else {
                    console.error('❌ 庆祝音效播放彻底失败，已达到最大重试次数');
                    return false;
                }
            }
        };
        
        // 执行播放
        attemptPlayCelebration();
    } else {
        console.error('❌ passAudio元素不存在');
    }
}

// 开始写字音效
function startWritingSound() {
    console.log('🎵 尝试播放写字音效...');
    if (slashAudio) {
        console.log('✅ slashAudio元素存在');
        console.log('📊 slashAudio详细状态:', {
            volume: slashAudio.volume,
            paused: slashAudio.paused,
            currentTime: slashAudio.currentTime,
            duration: slashAudio.duration,
            readyState: slashAudio.readyState,
            networkState: slashAudio.networkState,
            src: slashAudio.src,
            muted: slashAudio.muted,
            loop: slashAudio.loop
        });
        
        slashAudio.currentTime = 0;
        slashAudio.loop = true;
        console.log('🔄 重置slash音频播放位置并设置循环');
        
        // 检测移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent);
        
        if (isMobile || isTablet) {
            console.log('📱 移动/平板设备播放写字音效');
            // 移动设备播放策略
            const tryPlayWriting = () => {
                const playPromise = slashAudio.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('✅ 移动设备写字音效播放成功');
                    }).catch(error => {
                        console.error('❌ 移动设备写字音效播放失败:', error);
                        // 移动设备上可能需要用户交互后才能播放
                        // 这里不重试，避免过多的错误日志
                    });
                } else {
                    console.error('❌ slashAudio.play()返回undefined');
                }
            };
            tryPlayWriting();
        } else {
            console.log('💻 桌面设备播放写字音效');
            // 桌面设备正常播放
            slashAudio.play().then(() => {
                console.log('✅ 桌面设备写字音效播放成功');
            }).catch(e => {
                console.error('❌ 桌面设备写字音效播放失败:', e);
            });
        }
    } else {
        console.error('❌ slashAudio元素不存在');
    }
}

// 停止写字音效
function stopWritingSound() {
    console.log('停止写字音效...');
    if (slashAudio) {
        console.log('停止写字音效播放');
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
        this.size = Math.random() * 1.5 + 1.0; // 减小粒子大小，范围1.0-2.5px
        this.life = 8.0;                     // 增加生命值
        this.decay = Math.random() * 0.008 + 0.003; // 减慢衰减速度
        this.gravity = 0.05;                 // 减小重力，降落更慢
        this.alpha = 0.7;                    // 降低初始透明度，让粒子更透明
        this.maxAlpha = 0.7;                 // 最大透明度限制
    }

    update() {
        // 应用重力
        this.vy += this.gravity;
        
        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        
        // 减少生命值
        this.life -= this.decay;
        
        // 更新透明度，使用最大透明度限制
        this.alpha = Math.max(0, (this.life / 8.0) * this.maxAlpha);
        
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

        // 获取Canvas的显示尺寸进行边界检查
        const canvasWidth = this.particleCanvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.particleCanvas.height / (window.devicePixelRatio || 1);
        
        // 边界检查和调试信息
        const isInBounds = x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight;
        
        console.log('粒子生成详情:', {
            原始坐标: {x, y},
            Canvas尺寸: {width: canvasWidth, height: canvasHeight},
            是否在边界内: isInBounds,
            粒子Canvas存在: !!this.particleCanvas,
            粒子Context存在: !!this.particleCtx
        });
        
        // 即使超出边界也创建粒子，因为粒子可能会移动到可见区域
        const particleX = x;
        const particleY = y;

        // 创建多个粒子，减少数量以降低浓度
        const particleCount = 2 + Math.floor(Math.random() * 3); // 减少粒子数量
        
        for (let i = 0; i < particleCount; i++) {
            const offsetX = (Math.random() - 0.5) * 12; // 减少偏移范围
            const offsetY = (Math.random() - 0.5) * 12;
            const particle = new CarbonParticle(particleX + offsetX, particleY + offsetY);
            this.particles.push(particle);
        }
        
        console.log('粒子创建完成，当前粒子总数:', this.particles.length);
        
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
        if (!this.particleCtx) {
            console.log('drawFrame: particleCtx不存在');
            return;
        }
        
        const canvasWidth = this.particleCanvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.particleCanvas.height / (window.devicePixelRatio || 1);
        
        // 清除画布
        this.particleCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // 更新和绘制所有粒子
        let aliveCount = 0;
        let visibleCount = 0;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const isAlive = particle.update();
            
            if (isAlive) {
                // 检查粒子是否在可见区域内
                const isVisible = particle.x >= -50 && particle.x <= canvasWidth + 50 && 
                                particle.y >= -50 && particle.y <= canvasHeight + 50;
                
                if (isVisible) {
                    particle.draw(this.particleCtx);
                    visibleCount++;
                }
                aliveCount++;
            } else {
                // 移除死亡的粒子
                this.particles.splice(i, 1);
            }
        }
        
        // 定期输出调试信息
        if (this.particles.length > 0 && Math.random() < 0.1) {
            console.log('粒子状态:', {
                总粒子数: this.particles.length,
                存活粒子数: aliveCount,
                可见粒子数: visibleCount,
                Canvas尺寸: {width: canvasWidth, height: canvasHeight}
            });
        }
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