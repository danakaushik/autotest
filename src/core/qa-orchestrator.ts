import { 
  AppContext, 
  TestStrategy, 
  TestConfig, 
  TestSuiteResult, 
  AIAnalysis 
} from '../types/index.js';
import { ClaudeAPIClient } from './claude-client.js';
import { TestEngineManager } from './test-engine-manager.js';
import logger from '../utils/logger.js';

export class QAOrchestrator {
  private claudeClient: ClaudeAPIClient;
  private engineManager: TestEngineManager;
  private testSessions: Map<string, any> = new Map();

  constructor() {
    this.claudeClient = new ClaudeAPIClient();
    this.engineManager = new TestEngineManager();
  }

  /**
   * Analyze application context and prepare for testing
   */
  async analyzeContext(context: AppContext): Promise<{
    contextId: string;
    analysis: any;
    recommendations: string[];
  }> {
    logger.info('Analyzing application context', { appType: context.appType, platform: context.platform });

    try {
      // Generate unique context ID
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use Claude to analyze the context
      const analysis = await this.claudeClient.analyzeAppContext(context);

      // Store context for later use
      this.testSessions.set(contextId, {
        context,
        analysis,
        createdAt: new Date(),
        status: 'analyzed'
      });

      return {
        contextId,
        analysis,
        recommendations: analysis.recommendations || []
      };
    } catch (error) {
      logger.error('Context analysis failed:', error);
      throw new Error(`Failed to analyze context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate test strategy using Claude Code
   */
  async generateTestStrategy(
    context: AppContext, 
    constraints?: { timeLimit?: number; priorityFeatures?: string[] }
  ): Promise<{
    sessionId: string;
    strategy: TestStrategy;
    estimatedDuration: number;
  }> {
    logger.info('Generating test strategy', { appType: context.appType, constraints });

    try {
      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use Claude to generate test strategy
      const strategy = await this.claudeClient.generateTestStrategy(context, constraints);

      // Calculate estimated duration
      const estimatedDuration = strategy.testFlows.reduce(
        (total, flow) => total + flow.estimatedDuration, 
        0
      );

      // Store session
      this.testSessions.set(sessionId, {
        context,
        strategy,
        constraints,
        estimatedDuration,
        createdAt: new Date(),
        status: 'strategy_generated'
      });

      return {
        sessionId,
        strategy,
        estimatedDuration
      };
    } catch (error) {
      logger.error('Test strategy generation failed:', error);
      throw new Error(`Failed to generate test strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute tests using the appropriate testing engines
   */
  async executeTests(
    strategy: TestStrategy, 
    config?: TestConfig
  ): Promise<{
    sessionId: string;
    results: TestSuiteResult;
    artifacts: string[];
  }> {
    logger.info('Executing tests', { 
      primaryEngine: strategy.primaryEngine, 
      testFlowCount: strategy.testFlows.length 
    });

    try {
      // Generate execution session ID
      const sessionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update session status
      this.testSessions.set(sessionId, {
        strategy,
        config,
        startTime: new Date(),
        status: 'executing'
      });

      // Execute tests using the engine manager
      const results = await this.engineManager.executeTestStrategy(strategy, config);

      // Collect artifacts (screenshots, videos, reports)
      const artifacts = await this.collectTestArtifacts(sessionId, results);

      // Update session with results
      this.testSessions.set(sessionId, {
        ...this.testSessions.get(sessionId),
        results,
        artifacts,
        endTime: new Date(),
        status: 'completed'
      });

      return {
        sessionId,
        results,
        artifacts
      };
    } catch (error) {
      logger.error('Test execution failed:', error);
      throw new Error(`Failed to execute tests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze test results using Claude Code
   */
  async analyzeResults(
    results: TestSuiteResult, 
    context: AppContext
  ): Promise<{
    analysis: AIAnalysis;
    actionItems: string[];
    nextSteps: string[];
  }> {
    logger.info('Analyzing test results', { 
      totalTests: results.summary.total,
      passed: results.summary.passed,
      failed: results.summary.failed
    });

    try {
      // Use Claude to analyze results
      const analysis = await this.claudeClient.analyzeTestResults(results, context);

      // Extract action items and next steps
      const actionItems = analysis.improvements
        .filter(imp => imp.priority === 'high')
        .map(imp => imp.description);

      const nextSteps = analysis.issues
        .filter(issue => issue.severity === 'critical' || issue.severity === 'high')
        .map(issue => issue.recommendation);

      return {
        analysis,
        actionItems,
        nextSteps
      };
    } catch (error) {
      logger.error('Results analysis failed:', error);
      throw new Error(`Failed to analyze results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get status of a test session
   */
  async getTestStatus(sessionId?: string): Promise<{
    session?: any;
    activeTests: number;
    queuedTests: number;
    completedTests: number;
  }> {
    const activeSessions = Array.from(this.testSessions.values())
      .filter(session => session.status === 'executing');

    const queuedSessions = Array.from(this.testSessions.values())
      .filter(session => session.status === 'strategy_generated');

    const completedSessions = Array.from(this.testSessions.values())
      .filter(session => session.status === 'completed');

    const result = {
      activeTests: activeSessions.length,
      queuedTests: queuedSessions.length,
      completedTests: completedSessions.length,
      session: sessionId ? this.testSessions.get(sessionId) : undefined
    };

    return result;
  }

  /**
   * Collect test artifacts (screenshots, videos, reports)
   */
  private async collectTestArtifacts(sessionId: string, results: TestSuiteResult): Promise<string[]> {
    const artifacts: string[] = [];

    try {
      // Collect screenshots
      if (results.artifacts?.screenshots) {
        artifacts.push(...results.artifacts.screenshots);
      }

      // Collect videos
      if (results.artifacts?.videos) {
        artifacts.push(...results.artifacts.videos);
      }

      // Collect reports
      if (results.artifacts?.reports) {
        artifacts.push(...results.artifacts.reports);
      }

      logger.info(`Collected ${artifacts.length} artifacts for session ${sessionId}`);
      return artifacts;
    } catch (error) {
      logger.error('Failed to collect artifacts:', error);
      return [];
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanup(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.testSessions.entries()) {
      if (session.createdAt < oneDayAgo && session.status === 'completed') {
        this.testSessions.delete(sessionId);
        logger.info(`Cleaned up old session: ${sessionId}`);
      }
    }
  }
}