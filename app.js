// 配置常量
const FONT_CONFIG = {
    primary: 'FangZhengOracle',
    secondary: 'HYChenTiJiaGuWen',
    tertiary: 'ZhongYanYuan'
};

const STYLE_CONFIG = {
    fontSize: 24,
    oracleColor: '#808080',
    brushColor: '#000000',
    backgroundColor: '#F5DEB3',
    brushSize: 12,  // 笔触大小，与drawBrushStroke中的lineWidth保持一致
    completionThreshold: 0.5  // 降低阈值到50%以便测试
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
    
    async getAvailableFont() {
        const fonts = this.getFontPriority();
        
        for (const font of fonts) {
            const loaded = await this.loadFont(font);
            if (loaded) {
                return font;
            }
        }
        
        console.warn('所有甲骨文字体都不可用，使用默认字体');
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
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
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
        
        // 立即绘制一个点，确保画笔落下时有即时反馈
        const isInOracleArea = this.isPointInOracleText(pos.x, pos.y);
        if (isInOracleArea) {
            // 绘制一个小圆点作为起始点
            this.ctx.fillStyle = STYLE_CONFIG.brushColor;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
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
        if (this.currentStroke.length > 1) {
            appState.drawing.strokes.push([...this.currentStroke]);
            this.updateProgress();
        }
        this.currentStroke = [];
    }
    
    drawBrushStroke(points) {
        if (!points || points.length < 2) return;
        
        this.ctx.strokeStyle = STYLE_CONFIG.brushColor;
        this.ctx.lineWidth = 12; // 增加笔触粗细
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
        this.ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
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
        
        // 使字体尽可能大，充满整个画布
        let fontSizeRatio = 0.8; // 增大字体比例到80%
        if (window.innerWidth <= 480) {
            fontSizeRatio = 0.75; // 小屏幕设备稍小但仍然很大
        } else if (window.innerWidth <= 768) {
            fontSizeRatio = 0.78; // 中等屏幕设备
        }
        
        const fontSize = Math.min(canvasWidth, canvasHeight) * fontSizeRatio;
        
        // 计算闪烁透明度 (时隐时现效果)
        const time = Date.now() / 1000;
        const flickerOpacity = 0.7 + 0.3 * (Math.sin(time * 2) + 1) / 2; // 0.7-1.0之间变化，提高基础透明度
        
        // 确保使用甲骨文字体
        this.ctx.font = `${fontSize}px "${font}", "FangZhengOracle", "HYChenTiJiaGuWen", "ZhongYanYuan", serif`;
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
        
        // 设置临时canvas尺寸
        tempCanvas.width = this.oracleTextBounds.width;
        tempCanvas.height = this.oracleTextBounds.height;
        
        // 获取字体信息
        const fontSize = this.oracleTextBounds.height;
        tempCtx.font = this.ctx.font;
        tempCtx.fillStyle = 'white';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        
        // 在临时canvas上绘制文字
        tempCtx.fillText(
            appState.currentChar.oracleForm,
            tempCanvas.width / 2,
            tempCanvas.height / 2
        );
        
        // 计算非透明像素数量
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        let pixelCount = 0;
        
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] > 0) { // alpha通道大于0表示非透明
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
        
        // 设置canvas尺寸为甲骨文字体区域
        const width = this.oracleTextBounds.width;
        const height = this.oracleTextBounds.height;
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
        
        // 调整坐标系，使其相对于甲骨文字体区域
        strokeCtx.translate(-this.oracleTextBounds.x, -this.oracleTextBounds.y);
        
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
        
        // 4. 计算重叠的像素数量（只有在甲骨文字体像素存在的地方才计算笔画覆盖）
        let coveragePixels = 0;
        
        for (let i = 0; i < oracleImageData.data.length; i += 4) {
            const oracleAlpha = oracleImageData.data[i + 3]; // 甲骨文字体的alpha通道
            const strokeAlpha = strokeImageData.data[i + 3]; // 笔画的alpha通道
            
            // 只有当甲骨文字体像素存在且笔画也覆盖了该像素时才计数
            if (oracleAlpha > 0 && strokeAlpha > 0) {
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
        const percentage = Math.round(appState.drawing.progress * 100);
        console.log(`书写进度: ${percentage}%`);
        
        // 在画布右上角绘制进度百分比
        this.drawProgressOnCanvas(percentage);
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
        
        // 播放庆祝音效
        this.playCelebrationSound();
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
        
        const font = await fontLoader.getAvailableFont();
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
        // 简化的字符信息数据库
        this.characterDB = {
            '人': { pronunciation: 'rén', meaning: '人类、人民', oracleForm: '人' },
            '大': { pronunciation: 'dà', meaning: '大的、巨大', oracleForm: '大' },
            '小': { pronunciation: 'xiǎo', meaning: '小的、微小', oracleForm: '小' },
            '山': { pronunciation: 'shān', meaning: '山峰、高山', oracleForm: '山' },
            '水': { pronunciation: 'shuǐ', meaning: '水、液体', oracleForm: '水' },
            '火': { pronunciation: 'huǒ', meaning: '火焰、燃烧', oracleForm: '火' },
            '土': { pronunciation: 'tǔ', meaning: '土地、泥土', oracleForm: '土' },
            '木': { pronunciation: 'mù', meaning: '树木、木材', oracleForm: '木' },
            '金': { pronunciation: 'jīn', meaning: '金属、黄金', oracleForm: '金' },
            '日': { pronunciation: 'rì', meaning: '太阳、日子', oracleForm: '日' },
            '月': { pronunciation: 'yuè', meaning: '月亮、月份', oracleForm: '月' },
            '天': { pronunciation: 'tiān', meaning: '天空、上天', oracleForm: '天' },
            '地': { pronunciation: 'dì', meaning: '大地、地面', oracleForm: '地' },
            '目': { pronunciation: 'mù', meaning: '眼睛、目标', oracleForm: '目' }
        };
    }
    
    getCharacterInfo(char) {
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
    const pronunciationEl = document.getElementById('pronunciation');
    const meaningEl = document.getElementById('meaning');
    
    // 初始化Canvas绘制
    canvasDrawing = new CanvasDrawing(canvas);
    
    // 加载字体
    console.log('正在加载甲骨文字体...');
    appState.availableFont = await fontLoader.getAvailableFont();
    appState.fontLoaded = true;
    console.log(`使用字体: ${appState.availableFont}`);
    
    // 绑定事件
    textInput.addEventListener('input', handleTextInput);
    clearBtn.addEventListener('click', handleClear);
    
    // 处理URL参数（如果存在）
    const urlParams = new URLSearchParams(window.location.search);
    const charParam = urlParams.get('c');
    if (charParam) {
        textInput.value = charParam;
        // 触发输入事件处理
        const event = new Event('input', { bubbles: true });
        textInput.dispatchEvent(event);
    }
    
    console.log('甲骨文学习应用初始化完成');
}

// 处理文本输入
function handleTextInput(e) {
    const text = e.target.value.trim();
    
    if (text) {
        // 检查是否需要更新（文本不同或者当前没有字符）
        if (text !== appState.inputText || !appState.currentChar) {
            appState.inputText = text;
            const lastChar = text[text.length - 1];
            
            // 获取字符信息
            const charInfo = characterInfo.getCharacterInfo(lastChar);
            appState.currentChar = new Character(
                lastChar,
                charInfo.pronunciation,
                charInfo.meaning,
                charInfo.oracleForm
            );
            
            // 更新UI
            updateCharacterDisplay();
            
            // 绘制甲骨文
            if (appState.fontLoaded) {
                canvasDrawing.drawOracleText(charInfo.oracleForm, appState.availableFont);
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

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);