import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { TestConfig, TestResult, MaestroFlow } from '../types/index.js';
import { BaseEngine, TestFlow } from './base-engine.js';
import { config } from '../utils/config.js';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

export class MaestroEngine extends BaseEngine {
  private tempDir = 'temp/maestro-flows';

  async initialize(testConfig?: TestConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing Maestro engine');

    try {
      // Check if Maestro CLI is available
      await execAsync(`${config.maestro.cliPath} --version`);
      
      // Create temp directory for Maestro flows
      await fs.mkdir(this.tempDir, { recursive: true });
      
      this.config = testConfig;
      this.isInitialized = true;
      
      logger.info('Maestro engine initialized successfully');
    } catch (error) {
      logger.error('Maestro engine initialization failed:', error);
      throw new Error(`Maestro initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeTestFlow(flow: TestFlow, testConfig?: TestConfig): Promise<TestResult> {
    const startTime = new Date();
    let screenshots: string[] = [];
    let logs: string[] = [];
    let error: string | undefined;
    let status: 'passed' | 'failed' | 'skipped' | 'error' = 'passed';

    logger.info(`Executing Maestro test flow: ${flow.name}`);

    try {
      if (!this.isInitialized) {
        throw new Error('Maestro engine not initialized');
      }

      // Generate Maestro YAML flow
      const yamlFlow = this.generateMaestroFlow(flow);
      const flowFile = await this.writeFlowFile(flow.name, yamlFlow);
      
      logs.push(`Generated Maestro flow: ${flowFile}`);
      logs.push(`Flow content:\n${yamlFlow}`);

      // Execute Maestro flow
      const result = await this.executeMaestroFlow(flowFile);
      
      if (result.exitCode !== 0) {
        status = 'failed';
        error = result.stderr || 'Maestro flow execution failed';
      }

      // Parse logs and collect screenshots
      logs.push(...result.stdout.split('\n').filter(line => line.trim()));
      logs.push(...result.stderr.split('\n').filter(line => line.trim()));

      // Collect screenshots from Maestro output
      screenshots = await this.collectScreenshots(flow.name, result.stdout);

      const endTime = new Date();
      
      logger.info(`Maestro test flow completed: ${flow.name}`, { 
        status, 
        duration: endTime.getTime() - startTime.getTime(),
        exitCode: result.exitCode 
      });
      
      return this.createTestResult(
        flow.name,
        'maestro',
        status,
        startTime,
        endTime,
        error,
        screenshots,
        undefined, // Maestro doesn't provide video
        logs
      );
    } catch (error) {
      const endTime = new Date();
      logger.error(`Maestro test flow error: ${flow.name}`, error);
      
      return this.createTestResult(
        flow.name,
        'maestro',
        'error',
        startTime,
        endTime,
        error instanceof Error ? error.message : 'Unknown error',
        screenshots,
        undefined,
        logs
      );
    }
  }

  private generateMaestroFlow(flow: TestFlow): string {
    const actions = this.parseTestSteps(flow.steps);
    
    // Start with basic app setup
    let yamlFlow = `# Generated Maestro flow for: ${flow.name}\n`;
    yamlFlow += `# Description: ${flow.description}\n\n`;

    // Add flow steps
    yamlFlow += `flows:\n`;
    yamlFlow += `  - name: "${flow.name}"\n`;
    yamlFlow += `    steps:\n`;

    for (const action of actions) {
      switch (action.action) {
        case 'launch':
          if (action.target) {
            yamlFlow += `      - launchApp:\n`;
            yamlFlow += `          appId: "${action.target}"\n`;
          } else {
            yamlFlow += `      - launchApp\n`;
          }
          break;

        case 'tap':
          yamlFlow += `      - tapOn:\n`;
          yamlFlow += `          text: "${action.target}"\n`;
          break;

        case 'input':
          if (action.target && action.value) {
            yamlFlow += `      - tapOn:\n`;
            yamlFlow += `          text: "${action.target}"\n`;
            yamlFlow += `      - inputText: "${action.value}"\n`;
          }
          break;

        case 'verify':
          yamlFlow += `      - assertVisible:\n`;
          yamlFlow += `          text: "${action.target}"\n`;
          break;

        case 'wait':
          const duration = parseInt(action.value || '3000', 10);
          yamlFlow += `      - waitForAnimationToEnd:\n`;
          yamlFlow += `          timeout: ${duration}\n`;
          break;

        case 'scroll':
          yamlFlow += `      - scroll\n`;
          break;

        case 'swipe':
          const direction = action.target || 'up';
          yamlFlow += `      - swipe:\n`;
          yamlFlow += `          direction: "${direction}"\n`;
          break;

        case 'custom':
          yamlFlow += `      # Custom action: ${action.target}\n`;
          yamlFlow += `      - tapOn: "${action.target}"\n`;
          break;

        default:
          yamlFlow += `      # Unknown action: ${action.action}\n`;
      }
    }

    return yamlFlow;
  }

  private async writeFlowFile(flowName: string, yamlContent: string): Promise<string> {
    const sanitizedName = flowName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `${sanitizedName}_${Date.now()}.yaml`;
    const filepath = path.join(this.tempDir, filename);
    
    await fs.writeFile(filepath, yamlContent, 'utf8');
    
    return filepath;
  }

  private async executeMaestroFlow(flowFile: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    try {
      // Execute Maestro test command
      const command = `${config.maestro.cliPath} test "${flowFile}"`;
      logger.debug(`Executing Maestro command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config?.timeout || config.testing.defaultTimeout,
        maxBuffer: 1024 * 1024 // 1MB buffer for output
      });

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0
      };
    } catch (error: any) {
      // exec throws for non-zero exit codes
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1
      };
    }
  }

  private async collectScreenshots(testName: string, maestroOutput: string): Promise<string[]> {
    const screenshots: string[] = [];
    
    try {
      // Maestro typically saves screenshots in ~/.maestro/tests/<timestamp>/
      // Parse output for screenshot references
      const screenshotPattern = /Screenshot saved to: (.+)/g;
      let match;
      
      while ((match = screenshotPattern.exec(maestroOutput)) !== null) {
        const sourcePath = match[1];
        
        // Copy screenshot to our artifacts directory
        const screenshotsDir = 'artifacts/screenshots';
        await fs.mkdir(screenshotsDir, { recursive: true });
        
        const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        const destPath = path.join(screenshotsDir, filename);
        
        try {
          await fs.copyFile(sourcePath, destPath);
          screenshots.push(destPath);
          logger.debug(`Screenshot copied: ${sourcePath} -> ${destPath}`);
        } catch (copyError) {
          logger.warn(`Failed to copy screenshot: ${sourcePath}`, copyError);
        }
      }

      // If no screenshots found in output, look for default Maestro screenshot location
      if (screenshots.length === 0 && config.testing.screenshotOnFailure) {
        const defaultScreenshot = await this.findLatestMaestroScreenshot();
        if (defaultScreenshot) {
          const screenshotsDir = 'artifacts/screenshots';
          await fs.mkdir(screenshotsDir, { recursive: true });
          
          const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_maestro_${Date.now()}.png`;
          const destPath = path.join(screenshotsDir, filename);
          
          await fs.copyFile(defaultScreenshot, destPath);
          screenshots.push(destPath);
        }
      }
    } catch (error) {
      logger.error('Screenshot collection failed:', error);
    }
    
    return screenshots;
  }

  private async findLatestMaestroScreenshot(): Promise<string | undefined> {
    try {
      const maestroDir = path.join(process.env.HOME || '', '.maestro', 'tests');
      const entries = await fs.readdir(maestroDir, { withFileTypes: true });
      
      // Find the most recent test directory
      const testDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => ({
          name: entry.name,
          path: path.join(maestroDir, entry.name)
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (timestamp)
      
      if (testDirs.length === 0) {
        return undefined;
      }
      
      // Look for screenshots in the latest directory
      const latestTestDir = testDirs[0].path;
      const files = await fs.readdir(latestTestDir);
      const pngFiles = files.filter(file => file.endsWith('.png'));
      
      if (pngFiles.length > 0) {
        return path.join(latestTestDir, pngFiles[0]);
      }
    } catch (error) {
      logger.debug('Could not find Maestro screenshots:', error);
    }
    
    return undefined;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${config.maestro.cliPath} --version`);
      return true;
    } catch (error) {
      logger.debug('Maestro CLI not available:', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{ status: string; details?: any }> {
    try {
      const { stdout } = await execAsync(`${config.maestro.cliPath} --version`);
      
      return {
        status: 'healthy',
        details: {
          version: stdout.trim(),
          cliPath: config.maestro.cliPath
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up temporary flow files
      const files = await fs.readdir(this.tempDir).catch(() => []);
      
      for (const file of files) {
        if (file.endsWith('.yaml')) {
          await fs.unlink(path.join(this.tempDir, file)).catch(() => {});
        }
      }
      
      this.isInitialized = false;
      logger.info('Maestro engine cleanup completed');
    } catch (error) {
      logger.error('Maestro cleanup error:', error);
      throw error;
    }
  }

  /**
   * Generate Maestro flow for specific test patterns
   */
  generateSpecializedFlow(pattern: 'login' | 'navigation' | 'form' | 'search', params: any): string {
    switch (pattern) {
      case 'login':
        return this.generateLoginFlow(params.username, params.password);
      case 'navigation':
        return this.generateNavigationFlow(params.screens);
      case 'form':
        return this.generateFormFlow(params.fields);
      case 'search':
        return this.generateSearchFlow(params.query, params.expectedResults);
      default:
        throw new Error(`Unknown flow pattern: ${pattern}`);
    }
  }

  private generateLoginFlow(username: string, password: string): string {
    return `
flows:
  - name: "Login Flow"
    steps:
      - launchApp
      - tapOn: "Login"
      - tapOn: "Username"
      - inputText: "${username}"
      - tapOn: "Password"
      - inputText: "${password}"
      - tapOn: "Sign In"
      - assertVisible: "Welcome"
`;
  }

  private generateNavigationFlow(screens: string[]): string {
    let flow = `
flows:
  - name: "Navigation Flow"
    steps:
      - launchApp
`;
    
    for (const screen of screens) {
      flow += `      - tapOn: "${screen}"\n`;
      flow += `      - assertVisible: "${screen}"\n`;
      flow += `      - waitForAnimationToEnd\n`;
    }
    
    return flow;
  }

  private generateFormFlow(fields: Array<{ name: string; value: string }>): string {
    let flow = `
flows:
  - name: "Form Flow"
    steps:
      - launchApp
`;
    
    for (const field of fields) {
      flow += `      - tapOn: "${field.name}"\n`;
      flow += `      - inputText: "${field.value}"\n`;
    }
    
    flow += `      - tapOn: "Submit"\n`;
    flow += `      - assertVisible: "Success"\n`;
    
    return flow;
  }

  private generateSearchFlow(query: string, expectedResults: string[]): string {
    let flow = `
flows:
  - name: "Search Flow"
    steps:
      - launchApp
      - tapOn: "Search"
      - inputText: "${query}"
      - pressKey: "Enter"
      - waitForAnimationToEnd
`;
    
    for (const result of expectedResults) {
      flow += `      - assertVisible: "${result}"\n`;
    }
    
    return flow;
  }
}