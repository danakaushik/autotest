import { TestConfig, TestResult } from '../types/index.js';

export interface TestFlow {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: number;
  engine: 'appium' | 'maestro' | 'playwright';
  steps: string[];
}

export interface BaseTestEngine {
  /**
   * Initialize the testing engine
   */
  initialize(config?: TestConfig): Promise<void>;

  /**
   * Execute a test flow
   */
  executeTestFlow(flow: TestFlow, config?: TestConfig): Promise<TestResult>;

  /**
   * Check if the engine is available/installed
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get engine health status
   */
  getHealthStatus(): Promise<{ status: string; details?: any }>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

export abstract class BaseEngine implements BaseTestEngine {
  protected isInitialized = false;
  protected config?: TestConfig;

  abstract initialize(config?: TestConfig): Promise<void>;
  abstract executeTestFlow(flow: TestFlow, config?: TestConfig): Promise<TestResult>;
  abstract isAvailable(): Promise<boolean>;
  abstract getHealthStatus(): Promise<{ status: string; details?: any }>;
  abstract cleanup(): Promise<void>;

  /**
   * Create a standardized test result
   */
  protected createTestResult(
    testName: string,
    engine: 'appium' | 'maestro' | 'playwright',
    status: 'passed' | 'failed' | 'skipped' | 'error',
    startTime: Date,
    endTime: Date,
    error?: string,
    screenshots?: string[],
    video?: string,
    logs?: string[],
    performance?: {
      memoryUsage?: number;
      cpuUsage?: number;
      loadTime?: number;
    }
  ): TestResult {
    return {
      testName,
      engine,
      status,
      duration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
      error,
      screenshots,
      video,
      logs,
      performance
    };
  }

  /**
   * Generate unique filename for artifacts
   */
  protected generateArtifactPath(type: 'screenshot' | 'video' | 'log', testName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const extension = type === 'screenshot' ? 'png' : type === 'video' ? 'mp4' : 'log';
    
    return `artifacts/${type}s/${sanitizedName}_${timestamp}.${extension}`;
  }

  /**
   * Delay utility for test execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse test steps into executable actions
   */
  protected parseTestSteps(steps: string[]): Array<{
    action: string;
    target?: string;
    value?: string;
    options?: any;
  }> {
    return steps.map(step => {
      const lowercaseStep = step.toLowerCase();
      
      // Common action patterns
      if (lowercaseStep.includes('launch') || lowercaseStep.includes('open')) {
        return { action: 'launch', target: this.extractTarget(step) };
      }
      
      if (lowercaseStep.includes('tap') || lowercaseStep.includes('click')) {
        return { action: 'tap', target: this.extractTarget(step) };
      }
      
      if (lowercaseStep.includes('type') || lowercaseStep.includes('enter')) {
        const [target, value] = this.extractInputValues(step);
        return { action: 'input', target, value };
      }
      
      if (lowercaseStep.includes('verify') || lowercaseStep.includes('assert')) {
        return { action: 'verify', target: this.extractTarget(step) };
      }
      
      if (lowercaseStep.includes('wait')) {
        const duration = this.extractWaitDuration(step);
        return { action: 'wait', value: duration.toString() };
      }
      
      if (lowercaseStep.includes('scroll')) {
        return { action: 'scroll', target: this.extractTarget(step) };
      }
      
      if (lowercaseStep.includes('swipe')) {
        return { action: 'swipe', target: this.extractTarget(step) };
      }
      
      // Default to custom action
      return { action: 'custom', target: step };
    });
  }

  /**
   * Extract target element from step description
   */
  private extractTarget(step: string): string {
    // Look for quoted strings first
    const quoted = step.match(/"([^"]+)"/);
    if (quoted) return quoted[1];
    
    // Look for common UI element patterns
    const elementPatterns = [
      /button[:\s]+([^,\s]+)/i,
      /field[:\s]+([^,\s]+)/i,
      /link[:\s]+([^,\s]+)/i,
      /element[:\s]+([^,\s]+)/i,
      /on[:\s]+([^,\s]+)/i
    ];
    
    for (const pattern of elementPatterns) {
      const match = step.match(pattern);
      if (match) return match[1];
    }
    
    // Return the step itself as target
    return step;
  }

  /**
   * Extract input target and value from step
   */
  private extractInputValues(step: string): [string, string] {
    // Pattern: "type 'value' into 'field'"
    const typePattern = /(?:type|enter)\s+"([^"]+)"\s+(?:into|in)\s+"([^"]+)"/i;
    const match = step.match(typePattern);
    
    if (match) {
      return [match[2], match[1]]; // [target, value]
    }
    
    // Fallback: split by common separators
    const parts = step.split(/(?:into|in|to)\s+/i);
    if (parts.length >= 2) {
      const value = parts[0].replace(/^(?:type|enter)\s+/i, '').replace(/"/g, '');
      const target = parts[1].replace(/"/g, '');
      return [target, value];
    }
    
    return [step, ''];
  }

  /**
   * Extract wait duration from step
   */
  private extractWaitDuration(step: string): number {
    const durationMatch = step.match(/(\d+)\s*(?:seconds?|secs?|ms|milliseconds?)?/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1], 10);
      // Assume seconds if no unit specified
      return step.toLowerCase().includes('ms') || step.toLowerCase().includes('millisecond') ? value : value * 1000;
    }
    
    // Default wait time
    return 3000; // 3 seconds
  }
}