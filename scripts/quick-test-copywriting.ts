/**
 * 快速测试文案生成 - 女装版本
 */

const testFemaleCopywriting = async () => {
  const originalCopy = `姐妹们，这套真的太绝了！今年过年就穿这套出门拜年，亲戚朋友都夸好看。上衣是新中式盘扣设计，特别显气质，加棉的很暖和。裙子高腰的，遮小肚子还显腿长，简直小个子女生的福音，喜欢的姐妹千万别错过！#甜美穿搭 #温柔穿搭 #韩系穿搭`;

  console.log('测试女装文案生成');
  console.log('原始文案:', originalCopy.substring(0, 50) + '...\n');

  try {
    const response = await fetch('http://localhost:3001/api/generate-similar-copywriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalCopy,
        targetAudience: 'female'
      })
    });

    const data = await response.json();

    console.log('✅ 女装文案生成成功');
    console.log(`生成了 ${data.similarCopywriting.length} 个新文案\n`);

    data.similarCopywriting.forEach((copy: string, i: number) => {
      console.log(`文案 ${i + 1}:`, copy.substring(0, 60) + '...');
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
};

testFemaleCopywriting();
