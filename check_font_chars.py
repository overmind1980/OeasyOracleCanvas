#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from fontTools.ttLib import TTFont
import sys

def check_char_in_font(font_path, char):
    """检查字符是否存在于字体文件中"""
    try:
        font = TTFont(font_path)
        cmap = font.getBestCmap()
        char_code = ord(char)
        
        # 检查字符是否在字体的字符映射表中
        exists = char_code in cmap
        
        if exists:
            glyph_name = cmap[char_code]
            print(f"✅ {os.path.basename(font_path)}: 字符 '{char}' 存在 (Unicode: U+{char_code:04X}, Glyph: {glyph_name})")
        else:
            print(f"❌ {os.path.basename(font_path)}: 字符 '{char}' 不存在 (Unicode: U+{char_code:04X})")
            
        font.close()
        return exists
        
    except Exception as e:
        print(f"❌ {os.path.basename(font_path)}: 检查失败 - {str(e)}")
        return False

def main():
    # 要检查的字符
    test_char = '手'
    
    # 字体文件路径
    font_files = [
        'fonts/FangZhengOracle.ttf',
        'fonts/HYChenTiJiaGuWen.ttf', 
        'fonts/OeasyOracle.ttf',
        'fonts/ZhongYanYuan.ttf'
    ]
    
    print(f"检查字符 '{test_char}' 在各个甲骨文字体中的支持情况:\n")
    
    found_fonts = []
    
    for font_file in font_files:
        if os.path.exists(font_file):
            if check_char_in_font(font_file, test_char):
                found_fonts.append(font_file)
        else:
            print(f"❌ 字体文件不存在: {font_file}")
    
    print(f"\n总结:")
    if found_fonts:
        print(f"字符 '{test_char}' 在以下字体中存在:")
        for font in found_fonts:
            print(f"  - {font}")
    else:
        print(f"字符 '{test_char}' 在所有甲骨文字体中都不存在！")
        print("建议使用相似的甲骨文字符或检查字体文件。")

if __name__ == '__main__':
    main()