import { ComponentInstruction } from '../types/enhancedMessage';

export interface ParsedResponse {
  text: string;
  components: ComponentInstruction[];
}

/**
 * Parses agent response text to extract component instructions
 * Supports multiple formats:
 * - [CHART_COMPONENT:{...}] - JSON format
 * - [CHART:type:props] - Simplified format
 * - [COMPONENT:type] - Basic format
 */
export const parseAgentResponse = (responseText: string): ParsedResponse => {
  const components: ComponentInstruction[] = [];
  let cleanText = responseText;

  // Pattern 1: Full JSON format [CHART_COMPONENT:{...}]
  const jsonPattern = /\[CHART_COMPONENT:(\{[^}]+\})\]/g;
  let match;
  
  while ((match = jsonPattern.exec(responseText)) !== null) {
    try {
      const instruction = JSON.parse(match[1]);
      const component: ComponentInstruction = {
        id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: instruction.type,
        props: instruction.props || {},
        position: instruction.position || 'below',
        title: instruction.title,
        height: instruction.height
      };
      
      if (isValidComponentType(component.type)) {
        components.push(component);
        cleanText = cleanText.replace(match[0], '');
      }
    } catch (err) {
      console.warn('Failed to parse chart instruction:', match[1], err);
    }
  }

  // Pattern 2: Simplified format [CHART:type:props]
  const simplePattern = /\[CHART:([^:]+):?([^\]]*)\]/g;
  
  while ((match = simplePattern.exec(responseText)) !== null) {
    const type = match[1].trim();
    const propsStr = match[2] ? match[2].trim() : '';
    
    if (isValidComponentType(type)) {
      let props = {};
      
      // Try to parse props as JSON, fall back to key=value pairs
      if (propsStr) {
        try {
          props = JSON.parse(propsStr);
        } catch {
          // Parse key=value pairs
          props = parseKeyValuePairs(propsStr);
        }
      }
      
      const component: ComponentInstruction = {
        id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        props,
        position: 'below',
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`
      };
      
      components.push(component);
      cleanText = cleanText.replace(match[0], '');
    }
  }

  // Pattern 3: Basic format [COMPONENT:type]
  const basicPattern = /\[COMPONENT:([^\]]+)\]/g;
  
  while ((match = basicPattern.exec(responseText)) !== null) {
    const type = match[1].trim();
    
    if (isValidComponentType(type)) {
      const component: ComponentInstruction = {
        id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        props: {},
        position: 'below',
        title: getDefaultTitle(type)
      };
      
      components.push(component);
      cleanText = cleanText.replace(match[0], '');
    }
  }

  // Pattern 4: Natural language hints for smart parsing
  const nlHints = [
    {
      pattern: /show(?:ing)?\s+(?:a\s+)?portfolio\s+(?:chart|breakdown|allocation)/i,
      type: 'portfolio-chart'
    },
    {
      pattern: /(?:risk|return|volatility)\s+analysis/i,
      type: 'returns-chart'
    },
    {
      pattern: /defi\s+(?:heatmap|opportunities|positions)/i,
      type: 'defi-heatmap'
    },
    {
      pattern: /correlation\s+(?:matrix|analysis)/i,
      type: 'correlation-matrix'
    },
    {
      pattern: /token\s+(?:holder|analysis|distribution)/i,
      type: 'token-analysis'
    }
  ];

  // Only apply NL hints if no explicit components were found
  if (components.length === 0) {
    for (const hint of nlHints) {
      if (hint.pattern.test(responseText)) {
        const component: ComponentInstruction = {
          id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: hint.type as any,
          props: {},
          position: 'below',
          title: getDefaultTitle(hint.type)
        };
        
        components.push(component);
        // Don't remove text for NL hints as they're part of natural description
        break; // Only add one auto-detected component
      }
    }
  }

  return {
    text: cleanText.trim(),
    components
  };
};

/**
 * Validates if a component type is supported
 */
const isValidComponentType = (type: string): boolean => {
  const validTypes = [
    'portfolio-chart',
    'returns-chart', 
    'defi-heatmap',
    'correlation-matrix',
    'token-analysis',
    'legacy-portfolio-chart'
  ];
  return validTypes.includes(type);
};

/**
 * Gets default title for component type
 */
const getDefaultTitle = (type: string): string => {
  const titles: Record<string, string> = {
    'portfolio-chart': 'Portfolio Allocation',
    'returns-chart': 'Returns & Volatility Analysis',
    'defi-heatmap': 'DeFi Opportunities',
    'correlation-matrix': 'Token Correlations',
    'token-analysis': 'Token Holder Analysis',
    'legacy-portfolio-chart': 'Portfolio Chart'
  };
  return titles[type] || 'Chart';
};

/**
 * Parses key=value pairs from string
 */
const parseKeyValuePairs = (str: string): Record<string, any> => {
  const props: Record<string, any> = {};
  const pairs = str.split(',');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(s => s.trim());
    if (key && value) {
      // Try to parse as number or boolean
      if (value === 'true') props[key] = true;
      else if (value === 'false') props[key] = false;
      else if (!isNaN(Number(value))) props[key] = Number(value);
      else props[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
    }
  }
  
  return props;
};

/**
 * Creates a component instruction manually
 */
export const createComponentInstruction = (
  type: string,
  props: Record<string, any> = {},
  options: Partial<ComponentInstruction> = {}
): ComponentInstruction => {
  return {
    id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: type as any,
    props,
    position: 'below',
    title: getDefaultTitle(type),
    ...options
  };
};

/**
 * Sanitizes and validates component instructions
 */
export const sanitizeComponentInstruction = (
  instruction: Partial<ComponentInstruction>
): ComponentInstruction | null => {
  if (!instruction.type || !isValidComponentType(instruction.type)) {
    return null;
  }

  return {
    id: instruction.id || `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: instruction.type as any,
    props: instruction.props || {},
    position: instruction.position || 'below',
    title: instruction.title || getDefaultTitle(instruction.type),
    height: instruction.height
  };
};

/**
 * Creates a formatted response that the agent can return
 */
export const formatChartResponse = (
  text: string,
  componentType: string,
  props: Record<string, any> = {},
  position: 'above' | 'below' | 'inline' = 'below'
): string => {
  const instruction = {
    type: componentType,
    props,
    position
  };
  
  return `${text}\n\n[CHART_COMPONENT:${JSON.stringify(instruction)}]`;
};

export default parseAgentResponse;