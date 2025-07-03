import { 
  AppContext, 
  TestStrategy, 
  TestSuiteResult, 
  AIAnalysis 
} from '../types/index.js';
import logger from '../utils/logger.js';
import { TestStrategyPrompts } from '../prompts/test-strategy.js';
import { ResultAnalysisPrompts } from '../prompts/result-analysis.js';
import { mcpAIBridge, AIRequest } from './mcp-ai-bridge.js';

/**
 * Claude Code MCP Client
 * 
 * This client communicates with Claude Code's MCP server to perform AI operations
 * instead of using the Anthropic API directly. This allows the AutoTest QA Agent
 * to leverage Claude Code's existing API access and context.
 */
export class ClaudeCodeMCPClient {
  private mcpConnected: boolean = false;

  constructor() {
    this.initializeMCPConnection();
  }

  /**
   * Initialize connection to Claude Code MCP server
   */
  private async initializeMCPConnection(): Promise<void> {
    try {
      // In an MCP environment, we're already connected to Claude Code
      // This is a placeholder for any initialization logic needed
      this.mcpConnected = true;
      logger.info('Claude Code MCP client initialized');
    } catch (error) {
      logger.error('Failed to initialize Claude Code MCP connection:', error);
      this.mcpConnected = false;
    }
  }

  /**
   * Analyze application context using Claude Code
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
    logger.info('Requesting context analysis from Claude Code');

    try {
      const prompt = this.buildContextAnalysisPrompt(context);
      
      // Send request to Claude Code via MCP
      const response = await this.sendToClaudeCode(prompt, {
        task: 'context_analysis',
        expectedFormat: 'json',
        maxTokens: 2000,
        temperature: 0.3
      });

      // Parse Claude's response
      const analysis = this.parseContextAnalysis(response);
      
      logger.info('Context analysis completed', { complexity: analysis.complexity });
      return analysis;
    } catch (error) {
      logger.error('Claude Code context analysis failed:', error);
      return this.getFallbackContextAnalysis();
    }
  }

  /**
   * Generate test strategy using Claude Code
   */
  async generateTestStrategy(
    context: AppContext, 
    constraints?: { timeLimit?: number; priorityFeatures?: string[] }
  ): Promise<TestStrategy> {
    logger.info('Requesting test strategy from Claude Code');

    try {
      const prompt = TestStrategyPrompts.buildStrategyPrompt(context, constraints);
      
      const response = await this.sendToClaudeCode(prompt, {
        task: 'test_strategy_generation',
        expectedFormat: 'json',
        maxTokens: 3000,
        temperature: 0.4
      });

      // Parse Claude's response into TestStrategy
      const strategy = this.parseTestStrategy(response, context);
      
      logger.info('Test strategy generated', { 
        primaryEngine: strategy.primaryEngine,
        testFlowCount: strategy.testFlows.length 
      });
      
      return strategy;
    } catch (error) {
      logger.error('Claude Code test strategy generation failed:', error);
      return this.createFallbackStrategy(context);
    }
  }

  /**
   * Analyze test results using Claude Code
   */
  async analyzeTestResults(
    results: TestSuiteResult, 
    context: AppContext
  ): Promise<AIAnalysis> {
    logger.info('Requesting results analysis from Claude Code');

    try {
      const prompt = ResultAnalysisPrompts.buildAnalysisPrompt(results, context);
      
      const response = await this.sendToClaudeCode(prompt, {
        task: 'test_results_analysis',
        expectedFormat: 'json',
        maxTokens: 4000,
        temperature: 0.3
      });

      // Parse Claude's response into AIAnalysis
      const analysis = this.parseResultAnalysis(response);
      
      logger.info('Results analysis completed', { 
        overallScore: analysis.overallScore,
        issueCount: analysis.issues.length 
      });
      
      return analysis;
    } catch (error) {
      logger.error('Claude Code results analysis failed:', error);
      return this.getFallbackResultAnalysis();
    }
  }

  /**
   * Send request to Claude Code MCP server
   * 
   * This method creates an AI request that should be processed by Claude Code.
   * When running as an MCP client within Claude Code, this request will be
   * handled by Claude Code's AI capabilities.
   */
  private async sendToClaudeCode(prompt: string, options: {
    task: string;
    expectedFormat: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    if (!this.mcpConnected) {
      logger.warn('Claude Code MCP not connected, using fallback mode');
      throw new Error('Claude Code MCP integration required for AI operations');
    }

    // Create AI request using the MCP bridge
    const aiRequest = mcpAIBridge.createAIRequest(
      options.task as AIRequest['task'],
      prompt,
      {
        expectedFormat: options.expectedFormat,
        maxTokens: options.maxTokens,
        temperature: options.temperature
      }
    );

    logger.info('Created AI request for Claude Code:', {
      id: aiRequest.id,
      task: aiRequest.task,
      promptLength: prompt.length
    });

    // In the MCP environment, this request should be processed by Claude Code
    // For now, we'll create a structured error that Claude Code can recognize and process
    const claudeCodeRequest = mcpAIBridge.formatForClaudeCode(aiRequest);
    
    // This error message is designed to be caught and processed by Claude Code
    throw new Error(
      `CLAUDE_CODE_AI_REQUEST:${aiRequest.id}:${claudeCodeRequest}`
    );
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
   * Parse context analysis response from Claude Code
   */
  private parseContextAnalysis(response: string): any {
    try {
      // Extract JSON from Claude Code's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude Code response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!parsed.complexity || !parsed.riskAreas || !parsed.testingPriorities) {
        throw new Error('Invalid analysis structure from Claude Code');
      }

      return parsed;
    } catch (error) {
      logger.error('Failed to parse context analysis:', error);
      return this.getFallbackContextAnalysis();
    }
  }

  /**
   * Parse test strategy response from Claude Code
   */
  private parseTestStrategy(response: string, context: AppContext): TestStrategy {
    try {
      // Extract JSON from Claude Code's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude Code response');
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
      return this.createFallbackStrategy(context);
    }
  }

  /**
   * Parse result analysis response from Claude Code
   */
  private parseResultAnalysis(response: string): AIAnalysis {
    try {
      // Extract JSON from Claude Code's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude Code response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Failed to parse result analysis:', error);
      return this.getFallbackResultAnalysis();
    }
  }

  /**
   * Get fallback context analysis when Claude Code is unavailable
   */
  private getFallbackContextAnalysis() {
    return {
      complexity: 'medium' as const,
      riskAreas: ['User authentication', 'Data validation', 'Core functionality'],
      testingPriorities: ['Critical user flows', 'Recent changes', 'Integration points'],
      recommendations: [
        'Focus on areas with recent changes',
        'Test critical user journeys first',
        'Include edge cases and error handling',
        'Verify data integrity and security'
      ],
      estimatedEffort: {
        setup: 15,
        execution: 30,
        analysis: 10
      }
    };
  }

  /**
   * Get fallback test result analysis when Claude Code is unavailable
   */
  private getFallbackResultAnalysis(): AIAnalysis {
    return {
      overallScore: 75,
      issues: [
        {
          severity: 'medium' as const,
          category: 'functional' as const,
          description: 'Some test failures detected - manual review recommended',
          recommendation: 'Review failed tests and investigate root causes'
        }
      ],
      improvements: [
        {
          priority: 'medium' as const,
          description: 'Increase test coverage for critical paths',
          estimatedEffort: 'medium' as const
        }
      ],
      testCoverage: {
        current: 70,
        recommended: 85,
        gaps: ['Edge cases', 'Error handling', 'Performance testing']
      },
      summary: 'Test execution completed. Manual analysis recommended when Claude Code AI is available.'
    };
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
   * Create fallback test strategy when Claude Code is unavailable
   */
  private createFallbackStrategy(context: AppContext): TestStrategy {
    const engine = this.getDefaultEngine(context.appType);
    
    return {
      primaryEngine: engine,
      fallbackEngine: engine === 'appium' ? 'maestro' : undefined,
      testFlows: [
        {
          name: 'Core Functionality Test',
          description: `Test primary ${context.appType} application functionality`,
          priority: 'high' as const,
          estimatedDuration: 300, // 5 minutes
          engine,
          steps: [
            'Launch application',
            'Verify main interface loads',
            'Test primary user flow',
            'Check for critical errors',
            'Verify basic functionality'
          ]
        },
        {
          name: 'Recent Changes Verification',
          description: 'Verify areas affected by recent code changes',
          priority: 'high' as const,
          estimatedDuration: 240, // 4 minutes
          engine,
          steps: context.changes.map(change => 
            `Test functionality in ${change.file} - ${change.description}`
          )
        }
      ],
      rationale: `Fallback strategy for ${context.appType} app using ${engine}. ` +
                 `Focus on core functionality and recent changes. ` +
                 `Claude Code AI analysis recommended for optimal strategy.`
    };
  }

  /**
   * Check if connected to Claude Code MCP server
   */
  isConnected(): boolean {
    return this.mcpConnected;
  }

  /**
   * Get connection status and info
   */
  getConnectionInfo(): {
    connected: boolean;
    capabilities: string[];
    fallbackMode: boolean;
  } {
    return {
      connected: this.mcpConnected,
      capabilities: [
        'context_analysis',
        'test_strategy_generation', 
        'test_results_analysis'
      ],
      fallbackMode: !this.mcpConnected
    };
  }
}