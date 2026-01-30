# 智能穿搭建议：爆款公式匹配器设计

## 日期
2026-01-30

## 背景

目前智能穿搭建议功能通过在 AI prompt 中嵌入爆款公式来引导推荐，但这种纯 AI 方法存在以下问题：
1. AI 可能不严格遵循公式逻辑
2. 难以调试和优化匹配准确性
3. 无法精确控制推荐结果的多样性
4. 难以追踪哪个公式被使用

## 解决方案：代码 + AI 混合方法

采用程序化公式匹配器 + AI 生成描述的混合方法：
- **程序化匹配器**：负责根据服装特征精确匹配最佳公式
- **AI 服务**：负责特征提取和自然语言生成

### 工作流程

```
上传图片
  ↓
AI 分析上装特征（type, length, fit, style, color）
  ↓
FormulaMatcher.match(topAnalysis) → 匹配最佳公式
  ↓
FormulaMatcher.generateRecommendation() → 生成结构化推荐
  ↓
AI 生成最终自然语言描述
```

### 优势

1. **可控性**：程序化逻辑保证公式严格应用
2. **可测试性**：可以用单元测试验证匹配逻辑
3. **可扩展性**：新增公式只需添加配置，不需重写 prompt
4. **可调试性**：可以追踪匹配分数和决策过程
5. **多样性控制**：可以精确控制随机性，避免重复

## 技术设计

### 1. 公式数据结构

```typescript
interface FormulaDefinition {
  id: string;
  name: string;

  // 上装匹配规则
  topRules: {
    types: string[];        // 服装类型，如 ["羽绒服", "down jacket"]
    lengths: string[];      // 长度，如 ["短款", "short"]
    styles: string[];       // 风格，如 ["休闲", "casual"]
    excludeTypes?: string[]; // 排除类型
  };

  // 推荐的下装
  bottomRecommendation: {
    types: string[];        // 下装类型，如 ["小黑裤", "鲨鱼裤"]
    colors: string[];       // 颜色，如 ["黑色", "深色"]
    fits: string[];         // 版型，如 ["修身", "紧身"]
    materials?: string[];   // 材质（可选）
  };

  // 搭配原则
  principle: string;
  styleEffect: string;

  // 评分权重
  weights: {
    typeMatch: number;      // 类型匹配权重，如 40
    lengthMatch: number;    // 长度匹配权重，如 30
    styleMatch: number;     // 风格匹配权重，如 20
    colorMatch: number;     // 颜色匹配权重，如 10
  };
}
```

### 2. 匹配算法

评分计算（总分 0-100）：

1. **提取特征**：从 AI 分析结果中提取 type, length, style, color
2. **计算部分分数**：
   - Type Match: 如果上装类型在 topRules.types 中 → 获得权重分数
   - Length Match: 如果长度在 topRules.lengths 中 → 获得权重分数
   - Style Match: 如果风格在 topRules.styles 中 → 获得权重分数
   - Color Match: 颜色匹配（可选）
3. **应用权重**：加权求和得到最终分数
4. **选择最佳匹配**：
   - 如果 score ≥ 60：使用该公式
   - 如果 score < 60：寻找相似公式（借用核心逻辑）
5. **生成推荐**：基于匹配公式的 bottomRecommendation 生成结构化推荐

### 3. 服务实现

```typescript
// lib/outfit-formula-matcher.ts

export class OutfitFormulaMatcher {
  private formulas: FormulaDefinition[];

  constructor() {
    this.formulas = this.loadFormulas();
  }

  /**
   * 匹配最佳公式
   */
  match(topAnalysis: TopGarmentAnalysis): FormulaMatchResult {
    const scores = this.formulas.map(formula => ({
      formula,
      score: this.calculateScore(formula, topAnalysis)
    }));

    // 按分数排序
    scores.sort((a, b) => b.score - a.score);
    const bestMatch = scores[0];

    // 分数 >= 60 则使用，否则寻找相似公式
    if (bestMatch.score >= 60) {
      return {
        matchedFormula: bestMatch.formula,
        score: bestMatch.score,
        confidence: 'high'
      };
    }

    return this.findSimilarFormula(topAnalysis, scores);
  }

  /**
   * 生成下装推荐
   */
  generateRecommendation(matchResult: FormulaMatchResult): BottomRecommendation {
    const { bottomRecommendation } = matchResult.matchedFormula;

    // 从推荐列表中随机选择
    const selectedType = this.randomSelect(bottomRecommendation.types);
    const selectedColor = this.randomSelect(bottomRecommendation.colors);
    const selectedFit = this.randomSelect(bottomRecommendation.fits);

    return {
      type: selectedType,
      color: selectedColor,
      fit: selectedFit,
      material: bottomRecommendation.materials?.[0],
      formulaName: matchResult.matchedFormula.name,
      principle: matchResult.matchedFormula.principle
    };
  }

  /**
   * 计算匹配分数
   */
  private calculateScore(formula: FormulaDefinition, analysis: TopGarmentAnalysis): number {
    let score = 0;
    const { topRules, weights } = formula;

    // 类型匹配
    if (this.matchesAny(analysis.type, topRules.types)) {
      score += weights.typeMatch;
    }

    // 排除类型
    if (topRules.excludeTypes && this.matchesAny(analysis.type, topRules.excludeTypes)) {
      return 0; // 立即返回 0 分
    }

    // 长度匹配
    if (this.matchesAny(analysis.length, topRules.lengths)) {
      score += weights.lengthMatch;
    }

    // 风格匹配
    if (this.matchesAny(analysis.style, topRules.styles)) {
      score += weights.styleMatch;
    }

    return score;
  }

  /**
   * 寻找相似公式（借用核心逻辑）
   */
  private findSimilarFormula(analysis: TopGarmentAnalysis, scores: ScoredFormula[]): FormulaMatchResult {
    // 选择分数最高的公式，但标记为低置信度
    const similarMatch = scores[0];

    return {
      matchedFormula: similarMatch.formula,
      score: similarMatch.score,
      confidence: 'low',
      fallback: true
    };
  }

  /**
   * 加载公式定义
   */
  private loadFormulas(): FormulaDefinition[] {
    return [
      // 公式一：短款羽绒服 + 修身小黑裤/鲨鱼裤
      {
        id: 'formula-1',
        name: '短款羽绒服 + 修身小黑裤/鲨鱼裤',
        topRules: {
          types: ['羽绒服', 'down jacket', 'puffer', 'puffer jacket'],
          lengths: ['短款', 'short', 'cropped'],
          styles: ['休闲', 'casual', 'sporty', '运动'],
          excludeTypes: ['马甲', 'vest', 'gilet']
        },
        bottomRecommendation: {
          types: ['小黑裤', '鲨鱼裤', '紧身裤', 'skinny jeans', 'leggings', 'tight pants'],
          colors: ['黑色', 'black', '深色', 'dark'],
          fits: ['修身', 'tight', '紧身', 'fitted', 'slim'],
          materials: ['弹力面料', 'stretch fabric', '莱卡']
        },
        principle: '利用上半身的蓬松感对比下半身的紧致感，打造筷子腿效果',
        styleEffect: '显腿长、显腿细',
        weights: { typeMatch: 40, lengthMatch: 30, styleMatch: 20, colorMatch: 10 }
      },

      // 公式二：羽绒马甲 + 撞色/同色紧身打底
      {
        id: 'formula-2',
        name: '羽绒马甲 + 撞色/同色紧身打底',
        topRules: {
          types: ['马甲', 'vest', 'gilet', '羽绒马甲', 'puffer vest'],
          lengths: ['常规', 'regular', '标准'],
          styles: ['休闲', 'casual', 'sporty', '运动', 'athleisure']
        },
        bottomRecommendation: {
          types: ['紧身裤', 'leggings', '瑜伽裤', 'yoga pants', '鲨鱼裤', '打底裤'],
          colors: ['黑色', 'black', '深灰', 'dark grey', '米白', 'beige'],
          fits: ['紧身', 'tight', '修身', 'fitted'],
          materials: ['德绒', 'velvet', '弹力面料']
        },
        principle: '露出手臂线条，减轻冬季穿搭的厚重感，显得轻盈运动',
        styleEffect: '轻盈、运动、显瘦',
        weights: { typeMatch: 45, lengthMatch: 15, styleMatch: 30, colorMatch: 10 }
      },

      // 公式三：短款皮草/毛绒外套 + 紧身牛仔裤 + 短靴
      {
        id: 'formula-3',
        name: '短款皮草/毛绒外套 + 紧身牛仔裤 + 短靴',
        topRules: {
          types: ['皮草', 'fur', '毛绒外套', 'fluffy jacket', 'teddy coat', 'sherpa'],
          lengths: ['短款', 'short', 'cropped'],
          styles: ['精致', 'elegant', '温柔', 'feminine', 'luxe']
        },
        bottomRecommendation: {
          types: ['紧身牛仔裤', 'skinny jeans', '修身牛仔裤', 'slim jeans'],
          colors: ['深蓝', 'dark blue', '黑色', 'black', '深色', 'dark wash'],
          fits: ['紧身', 'tight', '修身', 'fitted', 'skinny'],
          materials: ['牛仔布', 'denim', '弹力牛仔']
        },
        principle: '材质混搭，上半身富贵温柔，下半身利落帅气',
        styleEffect: '精致、高级、避免暴发户感',
        weights: { typeMatch: 40, lengthMatch: 25, styleMatch: 25, colorMatch: 10 }
      },

      // 公式四：紧身罗纹针织衫 + 浅色瑜伽裤
      {
        id: 'formula-4',
        name: '紧身罗纹针织衫 + 浅色瑜伽裤',
        topRules: {
          types: ['针织衫', 'knit', 'sweater', '罗纹针织', 'ribbed knit'],
          lengths: ['常规', 'regular', '短款', 'cropped'],
          styles: ['休闲', 'casual', '运动', 'sporty', 'athleisure', '简约']
        },
        bottomRecommendation: {
          types: ['瑜伽裤', 'yoga pants', '运动裤', 'athletic pants', 'leggings'],
          colors: ['浅灰', 'light grey', '莫兰迪色', 'muted tones', '米色', 'beige'],
          fits: ['修身', 'fitted', '紧身', 'tight'],
          materials: ['弹力面料', 'stretch', '速干面料']
        },
        principle: '强调身材曲线，上深下浅配色打破沉闷',
        styleEffect: '健康美、运动风、清新',
        weights: { typeMatch: 35, lengthMatch: 15, styleMatch: 30, colorMatch: 20 }
      }
    ];
  }

  /**
   * 检查是否匹配任一关键词
   */
  private matchesAny(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * 随机选择一个元素
   */
  private randomSelect<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
```

### 4. 类型定义

需要在 `lib/types.ts` 中添加：

```typescript
// 上装分析结果（从 AI 分析中提取）
export interface TopGarmentAnalysis {
  type: string;      // 服装类型
  length: string;    // 长度
  fit: string;       // 版型
  style: string;     // 风格
  color: string;     // 颜色
  material?: string; // 材质（可选）
}

// 公式匹配结果
export interface FormulaMatchResult {
  matchedFormula: FormulaDefinition;
  score: number;
  confidence: 'high' | 'low';
  fallback?: boolean;
}

// 下装推荐
export interface BottomRecommendation {
  type: string;
  color: string;
  fit: string;
  material?: string;
  formulaName: string;
  principle: string;
}
```

### 5. AI Service 集成

在 `lib/ai-service.ts` 中修改 `describeClothingWithSmartMatch` 方法：

```typescript
async describeClothingWithSmartMatch(imageUrl: string): Promise<string> {
  // 步骤 1: AI 提取上装特征
  const topAnalysis = await this.extractTopFeatures(imageUrl);

  // 步骤 2: 使用公式匹配器
  const matcher = new OutfitFormulaMatcher();
  const matchResult = matcher.match(topAnalysis);
  const recommendation = matcher.generateRecommendation(matchResult);

  // 步骤 3: AI 生成最终描述
  const finalDescription = await this.generateDescriptionWithRecommendation(
    imageUrl,
    topAnalysis,
    recommendation
  );

  return finalDescription;
}

/**
 * 提取上装特征
 */
private async extractTopFeatures(imageUrl: string): Promise<TopGarmentAnalysis> {
  const prompt = `分析这件上装的特征，严格按照 JSON 格式输出：
{
  "type": "服装类型（如：羽绒服、针织衫、衬衫等）",
  "length": "长度（短款/常规/中长/长款）",
  "fit": "版型（修身/宽松/oversized）",
  "style": "风格（休闲/正式/运动/精致等）",
  "color": "主色调",
  "material": "材质（可选）"
}`;

  const response = await this.callOpenRouter([
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageUrl } }
  ]);

  return JSON.parse(response);
}

/**
 * 根据推荐生成最终描述
 */
private async generateDescriptionWithRecommendation(
  imageUrl: string,
  topAnalysis: TopGarmentAnalysis,
  recommendation: BottomRecommendation
): Promise<string> {
  const prompt = `基于爆款公式"${recommendation.formulaName}"生成穿搭描述。

上装：${topAnalysis.type}（${topAnalysis.length}，${topAnalysis.style}风格）
推荐下装：${recommendation.type}（${recommendation.color}，${recommendation.fit}）
搭配原则：${recommendation.principle}

请生成自然、吸引人的穿搭描述，强调这个公式的优势。`;

  return await this.callOpenRouter([
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageUrl } }
  ]);
}
```

## 边缘情况处理

### 1. 所有公式分数都 < 60

**策略**：使用相似公式 fallback
- 选择分数最高的公式
- 标记 `confidence: 'low'` 和 `fallback: true`
- 记录日志，用于未来公式扩展

### 2. 多个公式分数接近

**策略**：优先类型匹配，添加随机性
- 首选类型匹配权重高的公式
- 在分数差距 < 5 时引入随机性，避免重复

### 3. AI 分析缺失特征

**策略**：使用默认值
- `length` 缺失 → 默认为 "常规"
- `fit` 缺失 → 默认为 "宽松"
- 降低匹配置信度

### 4. 排除类型命中

**策略**：立即返回 0 分
- 如公式一排除马甲（vest），如果检测到马甲则该公式得 0 分

## 测试策略

### 1. 单元测试

测试匹配算法的准确性：

```typescript
describe('OutfitFormulaMatcher', () => {
  it('should match formula-1 for short down jacket', () => {
    const analysis = {
      type: 'down jacket',
      length: 'short',
      style: 'casual',
      color: 'black'
    };

    const matcher = new OutfitFormulaMatcher();
    const result = matcher.match(analysis);

    expect(result.matchedFormula.id).toBe('formula-1');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  // 更多测试用例...
});
```

### 2. 集成测试

使用真实图片测试完整流程：
- 准备 10-20 张不同类型的上装图片
- 验证匹配结果是否符合预期
- 检查推荐的下装是否合理

### 3. A/B 测试

对比纯 AI 方法 vs 混合方法：
- 推荐多样性
- 用户满意度
- 生成结果的质量

## 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `lib/types.ts` | 新增 `TopGarmentAnalysis`, `FormulaMatchResult`, `BottomRecommendation` 接口 |
| `lib/outfit-formula-matcher.ts` | **新文件**，实现 `OutfitFormulaMatcher` 类 |
| `lib/ai-service.ts` | 修改 `describeClothingWithSmartMatch`，集成公式匹配器 |
| `lib/prompts.ts` | 简化 `SMART_OUTFIT_MATCHING_PROMPT`，移除嵌入的公式文本 |

## 预期效果

1. **更准确的公式匹配**：程序化逻辑确保公式严格应用
2. **更好的可追踪性**：可以记录每次匹配使用的公式和分数
3. **更易于调试**：可以单独测试匹配逻辑
4. **更易于扩展**：新增公式只需添加配置对象
5. **保持多样性**：通过随机选择机制避免重复推荐

## 下一步

1. 实现 `OutfitFormulaMatcher` 类
2. 更新类型定义
3. 修改 AI Service 集成代码
4. 编写单元测试
5. 使用真实图片进行集成测试
6. 根据测试结果调整权重和阈值
