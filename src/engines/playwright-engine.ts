import { chromium, firefox, webkit, Browser, BrowserContext, Page, devices } from 'playwright';
import { TestConfig, TestResult, PlaywrightConfig } from '../types/index.js';
import { BaseEngine, TestFlow } from './base-engine.js';
import { config } from '../utils/config.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class PlaywrightEngine extends BaseEngine {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();
  private videoDir = 'artifacts/videos';
  private screenshotDir = 'artifacts/screenshots';

  async initialize(testConfig?: TestConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing Playwright engine');

    try {
      // Create artifact directories
      await fs.mkdir(this.videoDir, { recursive: true });
      await fs.mkdir(this.screenshotDir, { recursive: true });

      // Initialize browsers based on config
      const browsersToLaunch = testConfig?.browsers || config.playwright.browsers;
      
      for (const browserName of browsersToLaunch) {
        await this.launchBrowser(browserName);
      }

      this.config = testConfig;
      this.isInitialized = true;
      
      logger.info('Playwright engine initialized successfully', {
        browsers: Array.from(this.browsers.keys())
      });
    } catch (error) {
      logger.error('Playwright engine initialization failed:', error);
      throw new Error(`Playwright initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeTestFlow(flow: TestFlow, testConfig?: TestConfig): Promise<TestResult> {
    const startTime = new Date();
    let screenshots: string[] = [];
    let logs: string[] = [];
    let error: string | undefined;
    let status: 'passed' | 'failed' | 'skipped' | 'error' = 'passed';
    let videoPath: string | undefined;

    logger.info(`Executing Playwright test flow: ${flow.name}`);

    try {
      if (!this.isInitialized) {
        throw new Error('Playwright engine not initialized');
      }

      // Use first available browser
      const browserName = Array.from(this.browsers.keys())[0];
      if (!browserName) {
        throw new Error('No browsers available');
      }

      const browser = this.browsers.get(browserName)!;
      
      // Create context with recording if enabled
      const contextOptions: any = {
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
      };

      if (config.testing.videoRecording) {
        contextOptions.recordVideo = {
          dir: this.videoDir,
          size: { width: 1280, height: 720 }
        };
      }

      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      // Set up page logging
      page.on('console', msg => logs.push(`Console: ${msg.text()}`));
      page.on('pageerror', err => logs.push(`Error: ${err.message}`));
      page.on('requestfailed', req => logs.push(`Request failed: ${req.url()}`));

      // Parse and execute test steps
      const actions = this.parseTestSteps(flow.steps);
      
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        logs.push(`Step ${i + 1}: ${action.action} - ${action.target || action.value || ''}`);
        
        try {
          await this.executeAction(page, action, testConfig);
          
          // Take screenshot after critical actions
          if (['tap', 'input', 'verify'].includes(action.action)) {
            const screenshot = await this.takeScreenshot(page, flow.name, i);
            if (screenshot) screenshots.push(screenshot);
          }
          
          // Small delay between actions
          await this.delay(500);
        } catch (actionError) {
          logger.error(`Action failed: ${action.action}`, actionError);
          error = `Step ${i + 1} failed: ${actionError instanceof Error ? actionError.message : 'Unknown error'}`;
          status = 'failed';
          
          // Take failure screenshot
          const failureScreenshot = await this.takeScreenshot(page, flow.name, i, 'failure');
          if (failureScreenshot) screenshots.push(failureScreenshot);
          
          break;
        }
      }

      // Collect performance data
      const performance = await this.collectPerformanceData(page);

      // Close context and collect video
      await context.close();
      
      if (config.testing.videoRecording) {
        videoPath = await this.collectVideo(flow.name);
      }

      const endTime = new Date();
      
      logger.info(`Playwright test flow completed: ${flow.name}`, { 
        status, 
        duration: endTime.getTime() - startTime.getTime(),
        browser: browserName 
      });
      
      return this.createTestResult(
        flow.name,
        'playwright',
        status,
        startTime,
        endTime,
        error,
        screenshots,
        videoPath,
        logs,
        performance
      );
    } catch (error) {
      const endTime = new Date();
      logger.error(`Playwright test flow error: ${flow.name}`, error);
      
      return this.createTestResult(
        flow.name,
        'playwright',
        'error',
        startTime,
        endTime,
        error instanceof Error ? error.message : 'Unknown error',
        screenshots,
        videoPath,
        logs
      );
    }
  }

  private async launchBrowser(browserName: string): Promise<void> {
    try {
      let browser: Browser;
      
      switch (browserName.toLowerCase()) {
        case 'chromium':
        case 'chrome':
          browser = await chromium.launch({
            headless: process.env.NODE_ENV === 'production',
            args: ['--no-sandbox', '--disable-dev-shm-usage']
          });
          break;
        case 'firefox':
          browser = await firefox.launch({
            headless: process.env.NODE_ENV === 'production'
          });
          break;
        case 'webkit':
        case 'safari':
          browser = await webkit.launch({
            headless: process.env.NODE_ENV === 'production'
          });
          break;
        default:
          throw new Error(`Unsupported browser: ${browserName}`);
      }

      this.browsers.set(browserName, browser);
      logger.debug(`Launched browser: ${browserName}`);
    } catch (error) {
      throw new Error(`Failed to launch ${browserName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeAction(page: Page, action: any, testConfig?: TestConfig): Promise<void> {
    switch (action.action) {
      case 'launch':
        if (action.target) {
          await page.goto(action.target, { waitUntil: 'networkidle' });
        }
        break;

      case 'tap':
        await this.clickElement(page, action.target);
        break;

      case 'input':
        await this.inputText(page, action.target, action.value);
        break;

      case 'verify':
        await this.verifyElement(page, action.target);
        break;

      case 'wait':
        const duration = parseInt(action.value, 10) || 3000;
        await this.delay(duration);
        break;

      case 'scroll':
        await this.scrollToElement(page, action.target);
        break;

      case 'swipe':
        // Convert swipe to scroll for web
        await this.performScroll(page, action.target);
        break;

      case 'custom':
        await this.executeCustomAction(page, action.target);
        break;

      default:
        logger.warn(`Unknown action: ${action.action}`);
    }
  }

  private async clickElement(page: Page, selector: string): Promise<void> {
    try {
      // Try different selector strategies
      const strategies = [
        () => page.locator(`[data-testid="${selector}"]`),
        () => page.locator(`text="${selector}"`),
        () => page.locator(`[aria-label="${selector}"]`),
        () => page.locator(`[title="${selector}"]`),
        () => page.locator(`button:has-text("${selector}")`),
        () => page.locator(`a:has-text("${selector}")`),
        () => page.locator(selector) // Direct selector
      ];

      let element;
      for (const strategy of strategies) {
        try {
          element = strategy();
          await element.first().waitFor({ timeout: 2000 });
          break;
        } catch (e) {
          // Try next strategy
        }
      }

      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      await element.first().click();
      logger.debug(`Clicked element: ${selector}`);
    } catch (error) {
      throw new Error(`Failed to click element "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async inputText(page: Page, selector: string, text: string): Promise<void> {
    try {
      const strategies = [
        () => page.locator(`[data-testid="${selector}"]`),
        () => page.locator(`[placeholder="${selector}"]`),
        () => page.locator(`[name="${selector}"]`),
        () => page.locator(`[aria-label="${selector}"]`),
        () => page.locator(`input:near(:text("${selector}"))`),
        () => page.locator(selector) // Direct selector
      ];

      let element;
      for (const strategy of strategies) {
        try {
          element = strategy();
          await element.first().waitFor({ timeout: 2000 });
          break;
        } catch (e) {
          // Try next strategy
        }
      }

      if (!element) {
        throw new Error(`Input element not found: ${selector}`);
      }

      await element.first().fill(text);
      logger.debug(`Input text "${text}" into element: ${selector}`);
    } catch (error) {
      throw new Error(`Failed to input text into "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyElement(page: Page, selector: string): Promise<void> {
    try {
      const strategies = [
        () => page.locator(`[data-testid="${selector}"]`),
        () => page.locator(`text="${selector}"`),
        () => page.locator(`[aria-label="${selector}"]`),
        () => page.locator(selector)
      ];

      let found = false;
      for (const strategy of strategies) {
        try {
          const element = strategy();
          await element.first().waitFor({ timeout: 2000 });
          const isVisible = await element.first().isVisible();
          if (isVisible) {
            found = true;
            break;
          }
        } catch (e) {
          // Try next strategy
        }
      }

      if (!found) {
        throw new Error(`Element not visible: ${selector}`);
      }
      
      logger.debug(`Verified element: ${selector}`);
    } catch (error) {
      throw new Error(`Element verification failed "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async scrollToElement(page: Page, selector: string): Promise<void> {
    try {
      const element = page.locator(selector).first();
      await element.scrollIntoViewIfNeeded();
      logger.debug(`Scrolled to element: ${selector}`);
    } catch (error) {
      throw new Error(`Failed to scroll to element "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performScroll(page: Page, direction: string): Promise<void> {
    try {
      const scrollDistance = 500;
      
      switch (direction.toLowerCase()) {
        case 'up':
          await page.keyboard.press('PageUp');
          break;
        case 'down':
          await page.keyboard.press('PageDown');
          break;
        case 'left':
          await page.keyboard.press('ArrowLeft');
          break;
        case 'right':
          await page.keyboard.press('ArrowRight');
          break;
        default:
          await page.mouse.wheel(0, scrollDistance);
      }
      
      logger.debug(`Performed scroll: ${direction}`);
    } catch (error) {
      throw new Error(`Failed to perform scroll "${direction}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCustomAction(page: Page, action: string): Promise<void> {
    try {
      // Parse custom actions
      if (action.includes('navigate')) {
        const url = action.split(' ').pop();
        if (url && url.startsWith('http')) {
          await page.goto(url, { waitUntil: 'networkidle' });
        }
      } else if (action.includes('refresh')) {
        await page.reload({ waitUntil: 'networkidle' });
      } else if (action.includes('back')) {
        await page.goBack();
      } else if (action.includes('forward')) {
        await page.goForward();
      } else {
        logger.warn(`Unknown custom action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Custom action failed "${action}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async takeScreenshot(page: Page, testName: string, stepIndex: number, type: string = 'step'): Promise<string | undefined> {
    try {
      if (!config.testing.screenshotOnFailure && type !== 'failure') {
        return undefined;
      }

      const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${type}_${stepIndex}_${Date.now()}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true
      });
      
      logger.debug(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error('Screenshot capture failed:', error);
      return undefined;
    }
  }

  private async collectVideo(testName: string): Promise<string | undefined> {
    try {
      // Find the most recent video file
      const files = await fs.readdir(this.videoDir);
      const videoFiles = files.filter(file => file.endsWith('.webm')).sort();
      
      if (videoFiles.length === 0) {
        return undefined;
      }

      const latestVideo = videoFiles[videoFiles.length - 1];
      const sourcePath = path.join(this.videoDir, latestVideo);
      
      // Rename with test name
      const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.webm`;
      const destPath = path.join(this.videoDir, filename);
      
      await fs.rename(sourcePath, destPath);
      
      logger.debug(`Video saved: ${destPath}`);
      return destPath;
    } catch (error) {
      logger.error('Video collection failed:', error);
      return undefined;
    }
  }

  private async collectPerformanceData(page: Page): Promise<any> {
    try {
      const metrics = await page.evaluate(() => {
        const navigation = (performance as any).getEntriesByType('navigation')[0] as any;
        const paint = (performance as any).getEntriesByType('paint') as any;
        
        return {
          loadTime: navigation?.loadEventEnd - navigation?.navigationStart || 0,
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.navigationStart || 0,
          firstPaint: paint.find((p: any) => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find((p: any) => p.name === 'first-contentful-paint')?.startTime || 0,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || undefined
        };
      });

      return {
        loadTime: metrics.loadTime,
        memoryUsage: metrics.memoryUsage,
        cpuUsage: undefined, // Not easily available in browser
        additionalMetrics: {
          domContentLoaded: metrics.domContentLoaded,
          firstPaint: metrics.firstPaint,
          firstContentfulPaint: metrics.firstContentfulPaint
        }
      };
    } catch (error) {
      logger.debug('Performance data collection failed:', error);
      return undefined;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to launch a browser briefly
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      return true;
    } catch (error) {
      logger.debug('Playwright not available:', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{ status: string; details?: any }> {
    try {
      const availableBrowsers = [];
      
      // Check each browser
      for (const browserName of ['chromium', 'firefox', 'webkit']) {
        try {
          const browser = browserName === 'chromium' ? chromium : 
                          browserName === 'firefox' ? firefox : webkit;
          
          const instance = await browser.launch({ headless: true });
          await instance.close();
          availableBrowsers.push(browserName);
        } catch (e) {
          // Browser not available
        }
      }

      return {
        status: availableBrowsers.length > 0 ? 'healthy' : 'unhealthy',
        details: {
          availableBrowsers,
          activeBrowsers: Array.from(this.browsers.keys()),
          isInitialized: this.isInitialized
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
      // Close all pages
      for (const page of this.pages.values()) {
        await page.close().catch(() => {});
      }
      this.pages.clear();

      // Close all contexts
      for (const context of this.contexts.values()) {
        await context.close().catch(() => {});
      }
      this.contexts.clear();

      // Close all browsers
      for (const browser of this.browsers.values()) {
        await browser.close().catch(() => {});
      }
      this.browsers.clear();
      
      this.isInitialized = false;
      logger.info('Playwright engine cleanup completed');
    } catch (error) {
      logger.error('Playwright cleanup error:', error);
      throw error;
    }
  }

  /**
   * Perform visual regression testing
   */
  async performVisualTesting(page: Page, testName: string, baseline?: string): Promise<{
    passed: boolean;
    difference?: number;
    screenshotPath: string;
  }> {
    try {
      const screenshotPath = path.join(this.screenshotDir, `${testName}_visual_${Date.now()}.png`);
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      // If baseline provided, compare with resemblejs
      if (baseline) {
        const resemblejs = await import('resemblejs');
        
        return new Promise((resolve) => {
          resemblejs.default(baseline)
            .compareTo(screenshotPath)
            .onComplete((data: any) => {
              resolve({
                passed: data.misMatchPercentage < 5, // 5% tolerance
                difference: parseFloat(data.misMatchPercentage),
                screenshotPath
              });
            });
        });
      }

      return {
        passed: true,
        screenshotPath
      };
    } catch (error) {
      throw new Error(`Visual testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}