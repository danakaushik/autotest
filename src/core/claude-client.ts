import Anthropic from '@anthropic-ai/sdk';
import { 
  AppContext, 
  TestStrategy, 
  TestSuiteResult, 
  AIAnalysis 
} from '../types/index.js';
import { config } from '../utils/config.js';
import logger from '../utils/logger.js';
import { TestStrategyPrompts } from '../prompts/test-strategy.js';
import { ResultAnalysisPrompts } from '../prompts/result-analysis.js';

export class ClaudeAPIClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey
    });
  }

  /**
   * Analyze application context using Claude
   */
  async analyzeAppContext(context: AppContext): Promise<{
    complexity: 'low' | 'medium' | 'high';
    riskAreas: string[];
    testingPriorities: string[];
    recommendations: string[];
    estimatedEffort: {
      setup: number;
      execution: number;
      analysis: number;
    };
  }> {
    logger.info('Requesting context analysis from Claude');

    try {
      const prompt = this.buildContextAnalysisPrompt(context);
      
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse Claude's response
      const analysis = this.parseContextAnalysis(content.text);
      
      logger.info('Context analysis completed', { complexity: analysis.complexity });
      return analysis;
    } catch (error) {
      logger.error('Claude context analysis failed:', error);
      throw new Error(`Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate test strategy using Claude
   */
  async generateTestStrategy(
    context: AppContext, 
    constraints?: { timeLimit?: number; priorityFeatures?: string[] }
  ): Promise<TestStrategy> {
    logger.info('Requesting test strategy from Claude');

    try {
      const prompt = TestStrategyPrompts.buildStrategyPrompt(context, constraints);
      
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse Claude's response into TestStrategy
      const strategy = this.parseTestStrategy(content.text, context);
      
      logger.info('Test strategy generated', { 
        primaryEngine: strategy.primaryEngine,
        testFlowCount: strategy.testFlows.length 
      });
      
      return strategy;
    } catch (error) {
      logger.error('Claude test strategy generation failed:', error);
      throw new Error(`Test strategy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze test results using Claude
   */
  async analyzeTestResults(
    results: TestSuiteResult, 
    context: AppContext
  ): Promise<AIAnalysis> {
    logger.info('Requesting results analysis from Claude');

    try {
      const prompt = ResultAnalysisPrompts.buildAnalysisPrompt(results, context);
      
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse Claude's response into AIAnalysis
      const analysis = this.parseResultAnalysis(content.text);
      
      logger.info('Results analysis completed', { 
        overallScore: analysis.overallScore,
        issueCount: analysis.issues.length 
      });
      
      return analysis;
    } catch (error) {
      logger.error('Claude results analysis failed:', error);
      throw new Error(`Results analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build context analysis prompt
   */
  private buildContextAnalysisPrompt(context: AppContext): string {
    return `
As a QA expert, analyze this application context and provide insights for testing strategy:

Application Details:
- Type: ${context.appType}
- Platform: ${context.platform || 'Not specified'}
- Features: ${context.features.join(', ')}
- Testing Scope: ${context.testingScope}

Recent Changes:
${context.changes.map(change => 
  `- ${change.type.toUpperCase()}: ${change.file} - ${change.description}`
).join('\n')}

${context.deploymentUrl ? `Deployment URL: ${context.deploymentUrl}` : ''}
${context.appBundle ? `App Bundle: ${context.appBundle}` : ''}

Please provide a JSON response with the following structure:
{
  "complexity": "low|medium|high",
  "riskAreas": ["area1", "area2"],
  "testingPriorities": ["priority1", "priority2"],
  "recommendations": ["rec1", "rec2"],
  "estimatedEffort": {
    "setup": <minutes>,
    "execution": <minutes>,
    "analysis": <minutes>
  }
}

Focus on:
1. Identifying high-risk areas based on changes
2. Prioritizing testing based on feature criticality
3. Estimating realistic effort for each phase
4. Providing actionable recommendations
`;
  }

  /**
   * Parse context analysis response from Claude
   */
  private parseContextAnalysis(response: string): any {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!parsed.complexity || !parsed.riskAreas || !parsed.testingPriorities) {
        throw new Error('Invalid analysis structure from Claude');
      }

      return parsed;
    } catch (error) {
      logger.error('Failed to parse context analysis:', error);
      // Fallback analysis
      return {
        complexity: 'medium',
        riskAreas: ['User authentication', 'Data validation'],
        testingPriorities: ['Core functionality', 'User flows'],
        recommendations: ['Focus on critical paths', 'Include edge cases'],
        estimatedEffort: {
          setup: 15,
          execution: 30,
          analysis: 10
        }
      };
    }
  }

  /**
   * Parse test strategy response from Claude
   */
  private parseTestStrategy(response: string, context: AppContext): TestStrategy {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and structure as TestStrategy
      return {
        primaryEngine: parsed.primaryEngine || this.getDefaultEngine(context.appType),
        fallbackEngine: parsed.fallbackEngine,
        testFlows: parsed.testFlows || [],
        rationale: parsed.rationale || 'Generated test strategy based on application context'
      };
    } catch (error) {
      logger.error('Failed to parse test strategy:', error);
      // Fallback strategy
      return this.createFallbackStrategy(context);
    }
  }

  /**
   * Parse result analysis response from Claude
   */
  private parseResultAnalysis(response: string): AIAnalysis {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Failed to parse result analysis:', error);
      // Fallback analysis
      return {
        overallScore: 75,
        issues: [],
        improvements: [],
        testCoverage: {
          current: 70,
          recommended: 85,
          gaps: ['Edge cases', 'Error handling']
        },
        summary: 'Analysis completed with fallback data due to parsing error'
      };
    }
  }

  /**
   * Get default testing engine based on app type
   */
  private getDefaultEngine(appType: string): 'appium' | 'maestro' | 'playwright' {
    switch (appType) {
      case 'web':
        return 'playwright';
      case 'mobile':
        return 'appium';
      case 'hybrid':
        return 'playwright';
      default:
        return 'appium';
    }
  }

  /**
   * Create fallback test strategy
   */
  private createFallbackStrategy(context: AppContext): TestStrategy {
    return {
      primaryEngine: this.getDefaultEngine(context.appType),
      testFlows: [
        {
          name: 'Basic Functionality Test',
          description: 'Test core application functionality',
          priority: 'high' as const,
          estimatedDuration: 300, // 5 minutes
          engine: this.getDefaultEngine(context.appType),
          steps: [
            'Launch application',
            'Verify main interface loads',
            'Test primary user flow',
            'Verify data persistence'
          ]
        }
      ],
      rationale: 'Fallback strategy due to Claude parsing error'
    };
  }
}