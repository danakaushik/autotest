import { 
  TestStrategy, 
  TestConfig, 
  TestSuiteResult, 
  TestResult 
} from '../types/index.js';
import { AppiumEngine } from '../engines/appium-engine.js';
import { MaestroEngine } from '../engines/maestro-engine.js';
import { PlaywrightEngine } from '../engines/playwright-engine.js';
import logger from '../utils/logger.js';

export class TestEngineManager {
  private appiumEngine: AppiumEngine;
  private maestroEngine: MaestroEngine;
  private playwrightEngine: PlaywrightEngine;

  constructor() {
    this.appiumEngine = new AppiumEngine();
    this.maestroEngine = new MaestroEngine();
    this.playwrightEngine = new PlaywrightEngine();
  }

  /**
   * Execute test strategy using appropriate engines
   */
  async executeTestStrategy(
    strategy: TestStrategy,
    config?: TestConfig
  ): Promise<TestSuiteResult> {
    const startTime = new Date();
    const results: TestResult[] = [];
    const artifacts = {
      screenshots: [] as string[],
      videos: [] as string[],
      reports: [] as string[]
    };

    logger.info('Starting test execution', {
      primaryEngine: strategy.primaryEngine,
      testFlowCount: strategy.testFlows.length
    });

    try {
      // Initialize engines
      await this.initializeEngines(config);

      // Execute test flows
      for (const flow of strategy.testFlows) {
        logger.info(`Executing test flow: ${flow.name}`, { engine: flow.engine });

        try {
          const engine = this.getEngine(flow.engine);
          const result = await engine.executeTestFlow(flow, config);
          
          results.push(result);

          // Collect artifacts
          if (result.screenshots) {
            artifacts.screenshots.push(...result.screenshots);
          }
          if (result.video) {
            artifacts.videos.push(result.video);
          }

          logger.info(`Test flow completed: ${flow.name}`, { 
            status: result.status,
            duration: result.duration 
          });

          // Short delay between tests
          await this.delay(1000);

        } catch (error) {
          logger.error(`Test flow failed: ${flow.name}`, error);
          
          // Create error result
          const errorResult: TestResult = {
            testName: flow.name,
            engine: flow.engine,
            status: 'error',
            duration: 0,
            startTime: new Date(),
            endTime: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          
          results.push(errorResult);
        }
      }

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      // Calculate summary
      const summary = {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        duration: totalDuration,
        startTime,
        endTime
      };

      // Calculate coverage (basic estimation)
      const coverage = this.calculateCoverage(results, strategy);

      const testSuiteResult: TestSuiteResult = {
        summary,
        results,
        coverage,
        artifacts
      };

      logger.info('Test execution completed', {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        duration: totalDuration
      });

      return testSuiteResult;

    } catch (error) {
      logger.error('Test execution failed:', error);
      throw new Error(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Cleanup engines
      await this.cleanupEngines();
    }
  }

  /**
   * Get appropriate testing engine
   */
  private getEngine(engineName: string) {
    switch (engineName) {
      case 'appium':
        return this.appiumEngine;
      case 'maestro':
        return this.maestroEngine;
      case 'playwright':
        return this.playwrightEngine;
      default:
        throw new Error(`Unknown engine: ${engineName}`);
    }
  }

  /**
   * Initialize all engines
   */
  private async initializeEngines(config?: TestConfig): Promise<void> {
    logger.info('Initializing test engines');

    try {
      // Initialize engines in parallel
      await Promise.all([
        this.appiumEngine.initialize(config),
        this.maestroEngine.initialize(config),
        this.playwrightEngine.initialize(config)
      ]);

      logger.info('All engines initialized successfully');
    } catch (error) {
      logger.error('Engine initialization failed:', error);
      throw new Error(`Engine initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup all engines
   */
  private async cleanupEngines(): Promise<void> {
    logger.info('Cleaning up test engines');

    try {
      await Promise.all([
        this.appiumEngine.cleanup().catch(e => logger.warn('Appium cleanup error:', e)),
        this.maestroEngine.cleanup().catch(e => logger.warn('Maestro cleanup error:', e)),
        this.playwrightEngine.cleanup().catch(e => logger.warn('Playwright cleanup error:', e))
      ]);

      logger.info('Engine cleanup completed');
    } catch (error) {
      logger.warn('Engine cleanup had issues:', error);
    }
  }

  /**
   * Calculate test coverage estimation
   */
  private calculateCoverage(results: TestResult[], strategy: TestStrategy): {
    functional: number;
    visual: number;
    performance: number;
    accessibility: number;
  } {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'passed').length;
    
    // Basic coverage calculation
    const baselineScore = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    // Estimate coverage by test types
    const functionalTests = results.filter(r => 
      r.testName.toLowerCase().includes('function') || 
      r.testName.toLowerCase().includes('core') ||
      r.testName.toLowerCase().includes('flow')
    );
    
    const visualTests = results.filter(r => 
      r.testName.toLowerCase().includes('visual') || 
      r.testName.toLowerCase().includes('ui') ||
      r.testName.toLowerCase().includes('interface')
    );
    
    const performanceTests = results.filter(r => 
      r.testName.toLowerCase().includes('performance') || 
      r.testName.toLowerCase().includes('load') ||
      r.performance
    );
    
    const accessibilityTests = results.filter(r => 
      r.testName.toLowerCase().includes('accessibility') || 
      r.testName.toLowerCase().includes('a11y')
    );

    return {
      functional: functionalTests.length > 0 ? 
        (functionalTests.filter(t => t.status === 'passed').length / functionalTests.length) * 100 : 
        baselineScore,
      visual: visualTests.length > 0 ? 
        (visualTests.filter(t => t.status === 'passed').length / visualTests.length) * 100 : 
        Math.max(baselineScore - 20, 0),
      performance: performanceTests.length > 0 ? 
        (performanceTests.filter(t => t.status === 'passed').length / performanceTests.length) * 100 : 
        Math.max(baselineScore - 30, 0),
      accessibility: accessibilityTests.length > 0 ? 
        (accessibilityTests.filter(t => t.status === 'passed').length / accessibilityTests.length) * 100 : 
        Math.max(baselineScore - 40, 0)
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check engine availability
   */
  async checkEngineAvailability(): Promise<{
    appium: boolean;
    maestro: boolean;
    playwright: boolean;
  }> {
    logger.info('Checking engine availability');

    const results = await Promise.allSettled([
      this.appiumEngine.isAvailable(),
      this.maestroEngine.isAvailable(),
      this.playwrightEngine.isAvailable()
    ]);

    return {
      appium: results[0].status === 'fulfilled' && results[0].value,
      maestro: results[1].status === 'fulfilled' && results[1].value,
      playwright: results[2].status === 'fulfilled' && results[2].value
    };
  }

  /**
   * Get engine health status
   */
  async getEngineHealth(): Promise<{
    appium: { status: string; details?: any };
    maestro: { status: string; details?: any };
    playwright: { status: string; details?: any };
  }> {
    logger.info('Getting engine health status');

    const [appiumHealth, maestroHealth, playwrightHealth] = await Promise.allSettled([
      this.appiumEngine.getHealthStatus(),
      this.maestroEngine.getHealthStatus(),
      this.playwrightEngine.getHealthStatus()
    ]);

    return {
      appium: appiumHealth.status === 'fulfilled' ? 
        appiumHealth.value : { status: 'error', details: appiumHealth.reason },
      maestro: maestroHealth.status === 'fulfilled' ? 
        maestroHealth.value : { status: 'error', details: maestroHealth.reason },
      playwright: playwrightHealth.status === 'fulfilled' ? 
        playwrightHealth.value : { status: 'error', details: playwrightHealth.reason }
    };
  }
}