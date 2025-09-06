// 对比用户提供的汉字列表与现有汉字库
const fs = require('fs');

// 读取现有汉字库
const characterInfo = JSON.parse(fs.readFileSync('CharacterInfo.json', 'utf8'));
const existingCharacters = Object.keys(characterInfo.characterDB);

// 用户提供的汉字列表
const userCharacters = [
  '屮', '屯', '生', '荣', '早', '莫', '禾', '丰', '毛', '垂', '卉', '木', '林', '森',
  '杳', '杲', '本', '末', '未', '杀', '叶', '华', '花', '果', '朱', '人', '长', '休',
  '朵', '大', '小', '立', '夫', '交', '尸', '目', '直', '眉', '首', '面', '泪', '相',
  '想', '耳', '自', '咱', '心', '息', '口', '曰', '甘', '今', '含', '吟', '香', '金',
  '牙', '芽', '齿', '舌', '甜', '手', '看', '力', '术', '又', '右', '有', '刍', '工',
  '左', '功', '止', '正', '天', '一', '丘', '艸', '春', '林', '明', '炎', '吕', '侣',
  '二', '上', '下', '从', '比', '北', '化'
];

console.log('现有汉字库包含的汉字数量:', existingCharacters.length);
console.log('用户提供的汉字数量:', userCharacters.length);

// 找出不在现有库中的汉字
const missingCharacters = userCharacters.filter(char => !existingCharacters.includes(char));

// 找出已存在的汉字
const existingInUser = userCharacters.filter(char => existingCharacters.includes(char));

console.log('\n=== 对比结果 ===');
console.log('\n已存在于汉字库中的汉字 (' + existingInUser.length + '个):');
console.log(existingInUser.join(', '));

console.log('\n不在现有汉字库中的汉字 (' + missingCharacters.length + '个):');
console.log(missingCharacters.join(', '));

// 按类别分组缺失的汉字
const categories = {
  '植物相关': ['屮', '屯', '生', '荣', '早', '莫', '丰', '垂', '卉', '杳', '杲', '本', '末', '未', '杀', '华', '朱', '朵', '芽', '艸', '春'],
  '人体相关': ['长', '休', '夫', '交', '尸', '直', '眉', '首', '面', '泪', '相', '想', '自', '咱', '息', '曰', '甘', '今', '含', '吟', '香', '牙', '齿', '舌', '甜', '看'],
  '动作相关': ['术', '又', '有', '刍', '工', '功', '正'],
  '其他': ['丘', '明', '炎', '吕', '侣', '从', '比', '化']
};

console.log('\n=== 缺失汉字分类 ===');
for (const [category, chars] of Object.entries(categories)) {
  const missing = chars.filter(char => missingCharacters.includes(char));
  if (missing.length > 0) {
    console.log(`\n${category} (${missing.length}个):`);
    console.log(missing.join(', '));
  }
}

// 保存结果到文件
const result = {
  existingCharacters: existingInUser,
  missingCharacters: missingCharacters,
  categorizedMissing: {}
};

for (const [category, chars] of Object.entries(categories)) {
  const missing = chars.filter(char => missingCharacters.includes(char));
  if (missing.length > 0) {
    result.categorizedMissing[category] = missing;
  }
}

fs.writeFileSync('character_comparison_result.json', JSON.stringify(result, null, 2));
console.log('\n结果已保存到 character_comparison_result.json');