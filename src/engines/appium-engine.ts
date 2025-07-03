import { remote } from 'webdriverio';
import { TestConfig, TestResult, AppiumCapabilities } from '../types/index.js';
import { BaseEngine, TestFlow } from './base-engine.js';
import { config } from '../utils/config.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class AppiumEngine extends BaseEngine {
  private driver: any;
  private capabilities: AppiumCapabilities = {
    platformName: 'iOS',
    deviceName: 'iPhone Simulator',
    automationName: 'XCUITest',
    noReset: true
  };

  async initialize(testConfig?: TestConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing Appium engine');

    try {
      // Configure capabilities based on test config
      if (testConfig?.devices && testConfig.devices.length > 0) {
        const device = testConfig.devices[0];
        this.capabilities = {
          ...this.capabilities,
          platformName: device.platform === 'ios' ? 'iOS' : 'Android',
          deviceName: device.deviceName,
          platformVersion: device.platformVersion,
          udid: device.udid,
          automationName: device.platform === 'ios' ? 'XCUITest' : 'UIAutomator2'
        };
      }

      // Configure for iOS by default
      if (this.capabilities.platformName === 'iOS') {
        this.capabilities.automationName = 'XCUITest';
        if (config.devices.iosSimulatorUdid) {
          this.capabilities.udid = config.devices.iosSimulatorUdid;
        }
      } else {
        this.capabilities.automationName = 'UIAutomator2';
        if (config.devices.androidDeviceName) {
          this.capabilities.deviceName = config.devices.androidDeviceName;
        }
      }

      // WebDriverIO options
      const options: any = {
        protocol: 'http',
        hostname: config.appium.host,
        port: config.appium.port,
        path: '/wd/hub',
        capabilities: this.capabilities,
        logLevel: 'warn',
        waitforTimeout: testConfig?.timeout || config.testing.defaultTimeout,
        connectionRetryCount: 3,
        connectionRetryTimeout: 10000
      };

      // Initialize WebDriver session
      this.driver = await remote(options);
      
      this.config = testConfig;
      this.isInitialized = true;
      
      logger.info('Appium engine initialized successfully', {
        platform: this.capabilities.platformName,
        device: this.capabilities.deviceName
      });
    } catch (error) {
      logger.error('Appium engine initialization failed:', error);
      throw new Error(`Appium initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeTestFlow(flow: TestFlow, testConfig?: TestConfig): Promise<TestResult> {
    const startTime = new Date();
    let screenshots: string[] = [];
    let logs: string[] = [];
    let error: string | undefined;
    let status: 'passed' | 'failed' | 'skipped' | 'error' = 'passed';

    logger.info(`Executing Appium test flow: ${flow.name}`);

    try {
      if (!this.isInitialized || !this.driver) {
        throw new Error('Appium engine not initialized');
      }

      // Parse and execute test steps
      const actions = this.parseTestSteps(flow.steps);
      
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        logs.push(`Step ${i + 1}: ${action.action} - ${action.target || action.value || ''}`);
        
        try {
          await this.executeAction(action, testConfig);
          
          // Take screenshot after critical actions
          if (['tap', 'input', 'verify'].includes(action.action)) {
            const screenshot = await this.takeScreenshot(flow.name, i);
            if (screenshot) screenshots.push(screenshot);
          }
          
          // Small delay between actions
          await this.delay(500);
        } catch (actionError) {
          logger.error(`Action failed: ${action.action}`, actionError);
          error = `Step ${i + 1} failed: ${actionError instanceof Error ? actionError.message : 'Unknown error'}`;
          status = 'failed';
          
          // Take failure screenshot
          const failureScreenshot = await this.takeScreenshot(flow.name, i, 'failure');
          if (failureScreenshot) screenshots.push(failureScreenshot);
          
          break;
        }
      }

      // Collect performance data
      const performance = await this.collectPerformanceData();

      const endTime = new Date();
      
      logger.info(`Appium test flow completed: ${flow.name}`, { status, duration: endTime.getTime() - startTime.getTime() });
      
      return this.createTestResult(
        flow.name,
        'appium',
        status,
        startTime,
        endTime,
        error,
        screenshots,
        undefined, // No video support yet
        logs,
        performance
      );
    } catch (error) {
      const endTime = new Date();
      logger.error(`Appium test flow error: ${flow.name}`, error);
      
      return this.createTestResult(
        flow.name,
        'appium',
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

  private async executeAction(action: any, testConfig?: TestConfig): Promise<void> {
    switch (action.action) {
      case 'launch':
        // App should already be launched during initialization
        await this.driver.getPageSource(); // Verify app is responsive
        break;

      case 'tap':
        await this.tapElement(action.target);
        break;

      case 'input':
        await this.inputText(action.target, action.value);
        break;

      case 'verify':
        await this.verifyElement(action.target);
        break;

      case 'wait':
        const duration = parseInt(action.value, 10) || 3000;
        await this.delay(duration);
        break;

      case 'scroll':
        await this.scrollToElement(action.target);
        break;

      case 'swipe':
        await this.performSwipe(action.target);
        break;

      case 'custom':
        logger.warn(`Custom action not implemented: ${action.target}`);
        break;

      default:
        logger.warn(`Unknown action: ${action.action}`);
    }
  }

  private async tapElement(selector: string): Promise<void> {
    try {
      // Try different selector strategies
      const strategies = [
        () => this.driver.$(`~${selector}`), // Accessibility ID
        () => this.driver.$(`[name="${selector}"]`), // Name
        () => this.driver.$(`**/XCUIElementTypeButton[\`label == "${selector}"\`]`), // iOS predicate
        () => this.driver.$(`android=new UiSelector().text("${selector}")`), // Android UiSelector
        () => this.driver.$(`//*[@text="${selector}"]`), // XPath text
        () => this.driver.$(`//*[contains(@label,"${selector}")]`) // XPath partial match
      ];

      let element;
      for (const strategy of strategies) {
        try {
          element = await strategy();
          if (await element.isExisting()) {
            break;
          }
        } catch (e) {
          // Try next strategy
        }
      }

      if (!element || !(await element.isExisting())) {
        throw new Error(`Element not found: ${selector}`);
      }

      await element.waitForDisplayed({ timeout: 5000 });
      await element.click();
      
      logger.debug(`Tapped element: ${selector}`);
    } catch (error) {
      throw new Error(`Failed to tap element "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async inputText(selector: string, text: string): Promise<void> {
    try {
      const element = await this.findElement(selector);
      await element.waitForDisplayed({ timeout: 5000 });
      
      // Clear existing text and input new text
      await element.clearValue();
      await element.setValue(text);
      
      logger.debug(`Input text "${text}" into element: ${selector}`);
    } catch (error) {
      throw new Error(`Failed to input text into "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyElement(selector: string): Promise<void> {
    try {
      const element = await this.findElement(selector);
      const isDisplayed = await element.isDisplayed();
      
      if (!isDisplayed) {
        throw new Error(`Element not visible: ${selector}`);
      }
      
      logger.debug(`Verified element: ${selector}`);
    } catch (error) {
      throw new Error(`Element verification failed "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async scrollToElement(selector: string): Promise<void> {
    try {
      const element = await this.findElement(selector);
      await element.scrollIntoView();
      
      logger.debug(`Scrolled to element: ${selector}`);
    } catch (error) {
      throw new Error(`Failed to scroll to element "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performSwipe(direction: string): Promise<void> {
    try {
      const { width, height } = await this.driver.getWindowSize();
      
      let startX, startY, endX, endY;
      
      switch (direction.toLowerCase()) {
        case 'up':
          startX = width / 2;
          startY = height * 0.8;
          endX = width / 2;
          endY = height * 0.2;
          break;
        case 'down':
          startX = width / 2;
          startY = height * 0.2;
          endX = width / 2;
          endY = height * 0.8;
          break;
        case 'left':
          startX = width * 0.8;
          startY = height / 2;
          endX = width * 0.2;
          endY = height / 2;
          break;
        case 'right':
          startX = width * 0.2;
          startY = height / 2;
          endX = width * 0.8;
          endY = height / 2;
          break;
        default:
          throw new Error(`Unknown swipe direction: ${direction}`);
      }

      await this.driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: startX, y: startY },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 300, x: endX, y: endY },
            { type: 'pointerUp', button: 0 }
          ]
        }
      ]);
      
      logger.debug(`Performed swipe: ${direction}`);
    } catch (error) {
      throw new Error(`Failed to perform swipe "${direction}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async findElement(selector: string): Promise<any> {
    // Try multiple selector strategies
    const strategies = [
      () => this.driver.$(`~${selector}`), // Accessibility ID
      () => this.driver.$(`[name="${selector}"]`), // Name
      () => this.driver.$(`**/XCUIElementTypeButton[\`label == "${selector}"\`]`), // iOS predicate
      () => this.driver.$(`android=new UiSelector().text("${selector}")`), // Android UiSelector
      () => this.driver.$(`//*[@text="${selector}"]`), // XPath text
      () => this.driver.$(`//*[contains(@label,"${selector}")]`) // XPath partial match
    ];

    for (const strategy of strategies) {
      try {
        const element = await strategy();
        if (await element.isExisting()) {
          return element;
        }
      } catch (e) {
        // Try next strategy
      }
    }

    throw new Error(`Element not found with any strategy: ${selector}`);
  }

  private async takeScreenshot(testName: string, stepIndex: number, type: string = 'step'): Promise<string | undefined> {
    try {
      if (!config.testing.screenshotOnFailure && type !== 'failure') {
        return undefined;
      }

      // Ensure screenshots directory exists
      const screenshotsDir = 'artifacts/screenshots';
      await fs.mkdir(screenshotsDir, { recursive: true });

      const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${type}_${stepIndex}_${Date.now()}.png`;
      const filepath = path.join(screenshotsDir, filename);

      const screenshot = await this.driver.takeScreenshot();
      await fs.writeFile(filepath, screenshot, 'base64');
      
      logger.debug(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error('Screenshot capture failed:', error);
      return undefined;
    }
  }

  private async collectPerformanceData(): Promise<any> {
    try {
      // Get basic performance data
      const logs = await this.driver.getLogs('performance');
      
      // Basic memory info (platform dependent)
      const capabilities = await this.driver.getCapabilities();
      
      return {
        memoryUsage: undefined, // Would need platform-specific implementation
        cpuUsage: undefined, // Would need platform-specific implementation
        loadTime: undefined // Could be calculated from logs
      };
    } catch (error) {
      logger.debug('Performance data collection failed:', error);
      return undefined;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Appium server is running
      const response = await fetch(`http://${config.appium.host}:${config.appium.port}/wd/hub/status`);
      return response.ok;
    } catch (error) {
      logger.debug('Appium server not available:', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{ status: string; details?: any }> {
    try {
      const response = await fetch(`http://${config.appium.host}:${config.appium.port}/wd/hub/status`);
      
      if (!response.ok) {
        return { status: 'unhealthy', details: 'Server not responding' };
      }

      const data = await response.json() as any;
      
      return {
        status: 'healthy',
        details: {
          ready: data.value?.ready || false,
          message: data.value?.message || 'Unknown',
          build: data.value?.build || {}
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
      if (this.driver) {
        await this.driver.deleteSession();
        this.driver = undefined;
      }
      
      this.isInitialized = false;
      logger.info('Appium engine cleanup completed');
    } catch (error) {
      logger.error('Appium cleanup error:', error);
      throw error;
    }
  }
}