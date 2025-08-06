import type { 
  Holding, 
  Portfolio, 
  TokenFilterResult, 
  DeFiPositionType
} from '../types/portfolio';

// === DeFi Token Pattern Definitions ===

interface DeFiPattern {
  pattern: RegExp;
  confidence: number;
  category: DeFiPositionType;
  description: string;
  protocol?: string;
  priority: number; // Higher number = higher priority
}

const DEFI_PATTERNS: DeFiPattern[] = [
  // SaucerSwap specific patterns (highest confidence)
  {
    pattern: /^SSV2-LP$/i,
    confidence: 1.0,
    category: 'pool_v2',
    description: 'SaucerSwap V2 LP token',
    protocol: 'saucerswap',
    priority: 100
  },
  {
    pattern: /^ssLP-[\w]+-[\w]+$/i,
    confidence: 1.0,
    category: 'pool_v1',
    description: 'SaucerSwap V1 LP token',
    protocol: 'saucerswap',
    priority: 100
  },
  {
    pattern: /^xSAUCE$/i,
    confidence: 1.0,
    category: 'vault',
    description: 'SaucerSwap xSAUCE vault token',
    protocol: 'saucerswap',
    priority: 100
  },
  
  // Generic LP patterns (high confidence)
  {
    pattern: /^[\w]+-[\w]+-LP$/i,
    confidence: 0.95,
    category: 'pool_v1',
    description: 'Standard LP token format',
    priority: 90
  },
  {
    pattern: /.*-LP$/i,
    confidence: 0.9,
    category: 'pool_v1',
    description: 'Generic LP token',
    priority: 80
  },
  
  // Farm and staking patterns
  {
    pattern: /.*-FARM$/i,
    confidence: 0.85,
    category: 'farm',
    description: 'Farm staking token',
    priority: 85
  },
  {
    pattern: /^st[\w]+$/i,
    confidence: 0.7,
    category: 'staking',
    description: 'Possible staking token (st prefix)',
    priority: 70
  },
  {
    pattern: /^x[\w]+$/i,
    confidence: 0.6,
    category: 'vault',
    description: 'Possible vault token (x prefix)',
    priority: 60
  },
  
  // Compound/lending patterns
  {
    pattern: /^c[\w]+$/i,
    confidence: 0.65,
    category: 'lending',
    description: 'Possible compound-style lending token',
    priority: 65
  }
];

// === Additional validation patterns ===

const KNOWN_REGULAR_TOKENS = new Set([
  'HBAR', 'USDC', 'USDT', 'PACK', 'SAUCE', 'DOVU', 'KARATE', 'JAM', 'HGG', 'HST',
  'BTC', 'ETH', 'MATIC', 'LINK', 'UNI', 'AAVE'
]);

const SUSPICIOUS_PATTERNS = [
  /test/i,
  /demo/i,
  /sample/i
];

// === Core Filtering Functions ===

/**
 * Analyzes a single token to determine if it's a DeFi token
 */
export const analyzeToken = (
  symbol: string, 
  tokenId: string, 
  amount: number = 0,
  usdValue: number = 0
): TokenFilterResult => {
  
  // Quick check for known regular tokens
  if (KNOWN_REGULAR_TOKENS.has(symbol.toUpperCase())) {
    return {
      symbol,
      tokenId,
      isDeFi: false,
      confidence: 1.0,
      reasons: ['Known regular token'],
      metadata: { amount, usdValue, patterns: [] }
    };
  }

  // Check against suspicious patterns (likely test tokens)
  const suspiciousReasons = SUSPICIOUS_PATTERNS
    .filter(pattern => pattern.test(symbol))
    .map(pattern => `Matches suspicious pattern: ${pattern.source}`);

  // Analyze against DeFi patterns
  const patternMatches = DEFI_PATTERNS
    .map(({ pattern, confidence, category, description, protocol, priority }) => ({
      match: pattern.test(symbol),
      pattern: pattern.source,
      confidence,
      category,
      description,
      protocol,
      priority
    }))
    .filter(result => result.match)
    .sort((a, b) => b.priority - a.priority); // Sort by priority

  if (patternMatches.length === 0) {
    return {
      symbol,
      tokenId,
      isDeFi: false,
      confidence: suspiciousReasons.length > 0 ? 0.8 : 1.0,
      reasons: suspiciousReasons.length > 0 
        ? ['No DeFi patterns detected', ...suspiciousReasons]
        : ['No DeFi patterns detected'],
      metadata: { amount, usdValue, patterns: [] }
    };
  }

  // Use the highest priority match
  const bestMatch = patternMatches[0];
  
  // Adjust confidence based on additional factors
  let adjustedConfidence = bestMatch.confidence;
  
  // Lower confidence for very small amounts (might be dust)
  if (usdValue > 0 && usdValue < 0.01) {
    adjustedConfidence *= 0.8;
  }
  
  // Lower confidence if suspicious patterns detected
  if (suspiciousReasons.length > 0) {
    adjustedConfidence *= 0.7;
  }

  // Compile all reasons
  const reasons = [
    bestMatch.description,
    ...patternMatches.slice(1).map(match => match.description),
    ...suspiciousReasons
  ];

  return {
    symbol,
    tokenId,
    isDeFi: adjustedConfidence > 0.8,
    confidence: adjustedConfidence,
    reasons,
    suggestedCategory: bestMatch.category,
    metadata: {
      amount,
      usdValue,
      patterns: patternMatches.map(m => m.pattern)
    }
  };
};

/**
 * Filters portfolio tokens into regular holdings and DeFi tokens
 */
export const filterPortfolioTokens = (portfolio: Portfolio): {
  regularHoldings: Holding[];
  defiTokens: Holding[];
  filterResults: TokenFilterResult[];
} => {
  const regularHoldings: Holding[] = [];
  const defiTokens: Holding[] = [];
  const filterResults: TokenFilterResult[] = [];

  portfolio.holdings.forEach(holding => {
    const analysis = analyzeToken(
      holding.symbol,
      holding.tokenId,
      holding.amount,
      holding.usd
    );
    
    filterResults.push(analysis);
    
    if (analysis.isDeFi) {
      defiTokens.push(holding);
    } else {
      regularHoldings.push(holding);
    }
  });

  return { regularHoldings, defiTokens, filterResults };
};

/**
 * Validates token filtering results and provides debugging info
 */
export const validateFilterResults = (
  filterResults: TokenFilterResult[]
): {
  isValid: boolean;
  highConfidenceDefi: TokenFilterResult[];
  lowConfidenceDefi: TokenFilterResult[];
  potentialFalsePositives: TokenFilterResult[];
  potentialFalseNegatives: TokenFilterResult[];
  summary: string;
} => {
  const highConfidenceDefi = filterResults.filter(r => r.isDeFi && r.confidence > 0.9);
  const lowConfidenceDefi = filterResults.filter(r => r.isDeFi && r.confidence <= 0.9);
  const potentialFalsePositives = filterResults.filter(r => 
    r.isDeFi && r.confidence < 0.85 && r.reasons.some(reason => 
      reason.includes('suspicious') || reason.includes('test')
    )
  );
  const potentialFalseNegatives = filterResults.filter(r => 
    !r.isDeFi && r.reasons.some(reason => 
      reason.includes('LP') || reason.includes('staking')
    )
  );

  const totalTokens = filterResults.length;
  const defiTokens = filterResults.filter(r => r.isDeFi).length;
  const regularTokens = totalTokens - defiTokens;

  const summary = `Analyzed ${totalTokens} tokens: ${regularTokens} regular, ${defiTokens} DeFi ` +
    `(${highConfidenceDefi.length} high confidence, ${lowConfidenceDefi.length} low confidence)`;

  return {
    isValid: potentialFalsePositives.length === 0,
    highConfidenceDefi,
    lowConfidenceDefi,
    potentialFalsePositives,
    potentialFalseNegatives,
    summary
  };
};

/**
 * Creates a comprehensive analysis report for debugging
 */
export const createFilterReport = (
  filterResults: TokenFilterResult[]
): {
  report: string;
  statistics: {
    totalTokens: number;
    regularTokens: number;
    defiTokens: number;
    averageConfidence: number;
    patternDistribution: Record<string, number>;
  };
} => {
  const validation = validateFilterResults(filterResults);
  
  const totalTokens = filterResults.length;
  const defiResults = filterResults.filter(r => r.isDeFi);
  const regularResults = filterResults.filter(r => !r.isDeFi);
  
  const averageConfidence = filterResults.reduce((sum, r) => sum + r.confidence, 0) / totalTokens;
  
  // Count pattern usage
  const patternDistribution: Record<string, number> = {};
  filterResults.forEach(result => {
    result.metadata?.patterns?.forEach(pattern => {
      patternDistribution[pattern] = (patternDistribution[pattern] || 0) + 1;
    });
  });

  const report = `
=== DeFi Token Filter Report ===

${validation.summary}

High Confidence DeFi Tokens (${validation.highConfidenceDefi.length}):
${validation.highConfidenceDefi.map(r => 
  `  • ${r.symbol} (${(r.confidence * 100).toFixed(1)}%) - ${r.suggestedCategory}`
).join('\n')}

Low Confidence DeFi Tokens (${validation.lowConfidenceDefi.length}):
${validation.lowConfidenceDefi.map(r => 
  `  • ${r.symbol} (${(r.confidence * 100).toFixed(1)}%) - ${r.reasons[0]}`
).join('\n')}

${validation.potentialFalsePositives.length > 0 ? `
⚠️ Potential False Positives (${validation.potentialFalsePositives.length}):
${validation.potentialFalsePositives.map(r => 
  `  • ${r.symbol} - ${r.reasons.join(', ')}`
).join('\n')}
` : ''}

${validation.potentialFalseNegatives.length > 0 ? `
⚠️ Potential False Negatives (${validation.potentialFalseNegatives.length}):
${validation.potentialFalseNegatives.map(r => 
  `  • ${r.symbol} - ${r.reasons.join(', ')}`
).join('\n')}
` : ''}

Pattern Usage:
${Object.entries(patternDistribution)
  .sort(([,a], [,b]) => b - a)
  .map(([pattern, count]) => `  • ${pattern}: ${count} matches`)
  .join('\n')}
`.trim();

  return {
    report,
    statistics: {
      totalTokens,
      regularTokens: regularResults.length,
      defiTokens: defiResults.length,
      averageConfidence,
      patternDistribution
    }
  };
};

// === Utility Functions ===

/**
 * Helper to check if a token should be excluded from holder analysis
 */
export const shouldExcludeFromHolderAnalysis = (holding: Holding): boolean => {
  const analysis = analyzeToken(holding.symbol, holding.tokenId, holding.amount, holding.usd);
  return analysis.isDeFi && analysis.confidence > 0.8;
};

/**
 * Helper to get DeFi category display name
 */
export const getDeFiCategoryDisplayName = (category: DeFiPositionType): string => {
  const displayNames: Record<DeFiPositionType, string> = {
    'pool_v1': 'Liquidity Pool V1',
    'pool_v2': 'Liquidity Pool V2', 
    'farm': 'Yield Farm',
    'vault': 'Vault',
    'lending': 'Lending',
    'borrowing': 'Borrowing',
    'staking': 'Staking'
  };
  
  return displayNames[category] || category;
};

/**
 * Helper to create a pool symbol from token names
 */
export const createPoolSymbol = (token0?: string, token1?: string): string => {
  if (!token0 || !token1) return 'Unknown Pool';
  return `${token0}-${token1} LP`;
};