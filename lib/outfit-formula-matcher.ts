import {
  TopGarmentAnalysis,
  FormulaDefinition,
  FormulaMatchResult,
  BottomRecommendation,
} from './types';

interface ScoredFormula {
  formula: FormulaDefinition;
  score: number;
}

/**
 * 智能穿搭公式匹配器
 * 根据上装特征匹配最佳爆款公式，生成下装推荐
 */
export class OutfitFormulaMatcher {
  private formulas: FormulaDefinition[];

  constructor() {
    this.formulas = this.loadFormulas();
  }

  /**
   * 匹配最佳公式
   */
  match(topAnalysis: TopGarmentAnalysis): FormulaMatchResult {
    const scores: ScoredFormula[] = this.formulas.map(formula => ({
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
   * 生成下装推荐（包含内搭，如果公式需要的话）
   */
  generateRecommendation(matchResult: FormulaMatchResult): BottomRecommendation {
    const { bottomRecommendation, innerLayerRecommendation } = matchResult.matchedFormula;

    // 从推荐列表中随机选择下装
    const selectedType = this.randomSelect(bottomRecommendation.types);
    const selectedColor = this.randomSelect(bottomRecommendation.colors);
    const selectedFit = this.randomSelect(bottomRecommendation.fits);

    const recommendation: BottomRecommendation = {
      type: selectedType,
      color: selectedColor,
      fit: selectedFit,
      material: bottomRecommendation.materials?.[0],
      formulaName: matchResult.matchedFormula.name,
      principle: matchResult.matchedFormula.principle
    };

    // 如果公式需要内搭（如马甲、西装），添加内搭推荐
    if (innerLayerRecommendation) {
      recommendation.innerLayer = {
        type: this.randomSelect(innerLayerRecommendation.types),
        color: this.randomSelect(innerLayerRecommendation.colors),
        fit: this.randomSelect(innerLayerRecommendation.fits),
        material: innerLayerRecommendation.materials?.[0]
      };
    }

    return recommendation;
  }

  /**
   * 计算匹配分数
   */
  private calculateScore(formula: FormulaDefinition, analysis: TopGarmentAnalysis): number {
    let score = 0;
    const { topRules, weights } = formula;

    // 排除类型检查 - 如果命中排除类型，立即返回 0 分
    if (topRules.excludeTypes && this.matchesAny(analysis.type, topRules.excludeTypes)) {
      return 0;
    }

    // 类型匹配
    if (this.matchesAny(analysis.type, topRules.types)) {
      score += weights.typeMatch;
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
          types: ['羽绒服', 'down jacket', 'puffer', 'puffer jacket', '棉服', '棉衣'],
          lengths: ['短款', 'short', 'cropped', '短'],
          styles: ['休闲', 'casual', 'sporty', '运动', '日常'],
          excludeTypes: ['马甲', 'vest', 'gilet']
        },
        bottomRecommendation: {
          types: ['小黑裤', '鲨鱼裤', '紧身裤', '修身裤', 'skinny pants', 'leggings'],
          colors: ['黑色', 'black', '深色', 'dark'],
          fits: ['修身', 'tight', '紧身', 'fitted', 'slim'],
          materials: ['弹力面料', 'stretch fabric', '莱卡']
        },
        principle: '利用上半身的蓬松感对比下半身的紧致感，打造筷子腿效果',
        styleEffect: '显腿长、显腿细',
        weights: { typeMatch: 40, lengthMatch: 30, styleMatch: 20, colorMatch: 10 }
      },

      // 公式二：羽绒马甲 + 内搭 + 撞色/同色紧身打底
      {
        id: 'formula-2',
        name: '羽绒马甲 + 紧身打底衫 + 紧身裤',
        topRules: {
          types: ['马甲', 'vest', 'gilet', '羽绒马甲', 'puffer vest', '背心'],
          lengths: ['常规', 'regular', '标准', '中长'],
          styles: ['休闲', 'casual', 'sporty', '运动', 'athleisure']
        },
        bottomRecommendation: {
          types: ['紧身裤', 'leggings', '瑜伽裤', 'yoga pants', '鲨鱼裤', '打底裤'],
          colors: ['黑色', 'black', '深灰', 'dark grey', '米白', 'beige'],
          fits: ['紧身', 'tight', '修身', 'fitted'],
          materials: ['德绒', 'velvet', '弹力面料']
        },
        // 马甲必须有内搭
        innerLayerRecommendation: {
          types: ['紧身打底衫', '高领打底衫', '修身长袖T恤', '薄款针织衫', '紧身上衣'],
          colors: ['白色', 'white', '黑色', 'black', '灰色', 'grey', '米色', 'beige'],
          fits: ['紧身', 'tight', '修身', 'fitted'],
          materials: ['棉质', 'cotton', '德绒', '弹力面料']
        },
        principle: '露出手臂线条，减轻冬季穿搭的厚重感，显得轻盈运动',
        styleEffect: '轻盈、运动、显瘦',
        weights: { typeMatch: 45, lengthMatch: 15, styleMatch: 30, colorMatch: 10 }
      },

      // 公式三：短款皮草/毛绒外套 + 紧身牛仔裤 + 短靴
      {
        id: 'formula-3',
        name: '短款皮草/毛绒外套 + 紧身牛仔裤',
        topRules: {
          types: ['皮草', 'fur', '毛绒外套', 'fluffy jacket', 'teddy coat', 'sherpa', '毛毛外套', '羊羔绒'],
          lengths: ['短款', 'short', 'cropped', '短'],
          styles: ['精致', 'elegant', '温柔', 'feminine', 'luxe', '优雅', '甜美']
        },
        bottomRecommendation: {
          types: ['紧身牛仔裤', 'skinny jeans', '修身牛仔裤', 'slim jeans', '小脚牛仔裤'],
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
          types: ['针织衫', 'knit', 'sweater', '罗纹针织', 'ribbed knit', '毛衣', '打底衫'],
          lengths: ['常规', 'regular', '短款', 'cropped', '修身'],
          styles: ['休闲', 'casual', '运动', 'sporty', 'athleisure', '简约', '基础款']
        },
        bottomRecommendation: {
          types: ['瑜伽裤', 'yoga pants', '运动裤', 'athletic pants', 'leggings', '健身裤'],
          colors: ['浅灰', 'light grey', '莫兰迪色', 'muted tones', '米色', 'beige', '奶白'],
          fits: ['修身', 'fitted', '紧身', 'tight'],
          materials: ['弹力面料', 'stretch', '速干面料']
        },
        principle: '强调身材曲线，上深下浅配色打破沉闷',
        styleEffect: '健康美、运动风、清新',
        weights: { typeMatch: 35, lengthMatch: 15, styleMatch: 30, colorMatch: 20 }
      },

      // 公式五：oversized卫衣/毛衣 + 紧身裤（通用休闲公式）
      {
        id: 'formula-5',
        name: 'Oversized卫衣/毛衣 + 紧身裤',
        topRules: {
          types: ['卫衣', 'hoodie', 'sweatshirt', '毛衣', 'sweater', '套头衫'],
          lengths: ['常规', 'regular', '中长', 'oversized', '宽松'],
          styles: ['休闲', 'casual', '街头', 'street', '运动', 'sporty']
        },
        bottomRecommendation: {
          types: ['紧身裤', 'leggings', '小脚裤', 'skinny pants', '瑜伽裤', '鲨鱼裤'],
          colors: ['黑色', 'black', '深灰', 'charcoal', '藏蓝', 'navy'],
          fits: ['紧身', 'tight', '修身', 'fitted'],
          materials: ['弹力面料', '棉质', 'cotton blend']
        },
        principle: '上松下紧，平衡比例，显腿细长',
        styleEffect: '休闲舒适、显瘦',
        weights: { typeMatch: 35, lengthMatch: 25, styleMatch: 30, colorMatch: 10 }
      },

      // 公式六：西装外套 + 内搭 + 阔腿裤/直筒裤（通勤公式）
      {
        id: 'formula-6',
        name: '西装外套 + 衬衫/针织衫 + 阔腿裤',
        topRules: {
          types: ['西装', 'blazer', 'suit jacket', '西装外套', '小西装'],
          lengths: ['常规', 'regular', '中长', '短款'],
          styles: ['正式', 'formal', '职业', 'business', '通勤', 'office']
        },
        bottomRecommendation: {
          types: ['阔腿裤', 'wide-leg pants', '直筒裤', 'straight pants', '西裤', 'dress pants'],
          colors: ['黑色', 'black', '深灰', 'charcoal', '米色', 'beige', '卡其'],
          fits: ['宽松', 'loose', '直筒', 'straight', '高腰'],
          materials: ['西装面料', '垂坠面料', 'draping fabric']
        },
        // 西装需要内搭
        innerLayerRecommendation: {
          types: ['白衬衫', '丝绸衬衫', '修身T恤', '薄款针织衫', '吊带背心'],
          colors: ['白色', 'white', '黑色', 'black', '米色', 'cream', '浅蓝', 'light blue'],
          fits: ['修身', 'fitted', '适中', 'regular'],
          materials: ['棉质', 'cotton', '丝绸', 'silk', '雪纺', 'chiffon']
        },
        principle: '上下协调，干练利落，拉长比例',
        styleEffect: '职业、干练、气场强',
        weights: { typeMatch: 40, lengthMatch: 20, styleMatch: 30, colorMatch: 10 }
      }
    ];
  }

  /**
   * 检查是否匹配任一关键词
   */
  private matchesAny(text: string, keywords: string[]): boolean {
    if (!text) return false;
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

  /**
   * 获取所有公式（用于调试）
   */
  getFormulas(): FormulaDefinition[] {
    return this.formulas;
  }

  /**
   * 获取匹配详情（用于调试）
   */
  getMatchDetails(topAnalysis: TopGarmentAnalysis): { formula: FormulaDefinition; score: number }[] {
    return this.formulas.map(formula => ({
      formula,
      score: this.calculateScore(formula, topAnalysis)
    })).sort((a, b) => b.score - a.score);
  }
}

// 导出单例
export const outfitFormulaMatcher = new OutfitFormulaMatcher();
