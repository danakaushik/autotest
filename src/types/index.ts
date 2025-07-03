import { z } from 'zod';

// App Context Schema
export const AppContextSchema = z.object({
  appType: z.enum(['web', 'mobile', 'hybrid']),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  deploymentUrl: z.string().url().optional(),
  appBundle: z.string().optional(), // Path to .app, .ipa, .apk
  features: z.array(z.string()),
  changes: z.array(z.object({
    type: z.enum(['added', 'modified', 'deleted']),
    file: z.string(),
    description: z.string()
  })),
  testingScope: z.enum(['smoke', 'regression', 'full']).default('smoke')
});

export type AppContext = z.infer<typeof AppContextSchema>;

// Test Configuration Schema
export const TestConfigSchema = z.object({
  browsers: z.array(z.string()).optional(),
  devices: z.array(z.object({
    platform: z.enum(['ios', 'android']),
    deviceName: z.string(),
    platformVersion: z.string().optional(),
    udid: z.string().optional()
  })).optional(),
  testTypes: z.array(z.enum(['functional', 'visual', 'performance', 'accessibility'])),
  timeout: z.number().default(30000),
  screenshotOnFailure: z.boolean().default(true),
  videoRecording: z.boolean().default(false)
});

export type TestConfig = z.infer<typeof TestConfigSchema>;

// Test Strategy Schema
export const TestStrategySchema = z.object({
  primaryEngine: z.enum(['appium', 'maestro', 'playwright']),
  fallbackEngine: z.enum(['appium', 'maestro', 'playwright']).optional(),
  testFlows: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    estimatedDuration: z.number(),
    engine: z.enum(['appium', 'maestro', 'playwright']),
    steps: z.array(z.string())
  })),
  rationale: z.string()
});

export type TestStrategy = z.infer<typeof TestStrategySchema>;

// Test Results Schema
export const TestResultSchema = z.object({
  testName: z.string(),
  engine: z.enum(['appium', 'maestro', 'playwright']),
  status: z.enum(['passed', 'failed', 'skipped', 'error']),
  duration: z.number(),
  startTime: z.date(),
  endTime: z.date(),
  error: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  video: z.string().optional(),
  logs: z.array(z.string()).optional(),
  performance: z.object({
    memoryUsage: z.number().optional(),
    cpuUsage: z.number().optional(),
    loadTime: z.number().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export type TestResult = z.infer<typeof TestResultSchema>;

// Aggregated Results Schema
export const TestSuiteResultSchema = z.object({
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    errors: z.number(),
    duration: z.number(),
    startTime: z.date(),
    endTime: z.date()
  }),
  results: z.array(TestResultSchema),
  coverage: z.object({
    functional: z.number(),
    visual: z.number(),
    performance: z.number(),
    accessibility: z.number()
  }).optional(),
  artifacts: z.object({
    screenshots: z.array(z.string()),
    videos: z.array(z.string()),
    reports: z.array(z.string())
  }).optional()
});

export type TestSuiteResult = z.infer<typeof TestSuiteResultSchema>;

// AI Analysis Schema
export const AIAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    category: z.enum(['functional', 'visual', 'performance', 'accessibility', 'usability']),
    description: z.string(),
    location: z.string().optional(),
    recommendation: z.string()
  })),
  improvements: z.array(z.object({
    priority: z.enum(['high', 'medium', 'low']),
    description: z.string(),
    estimatedEffort: z.enum(['small', 'medium', 'large']),
    codeChanges: z.array(z.string()).optional()
  })),
  testCoverage: z.object({
    current: z.number(),
    recommended: z.number(),
    gaps: z.array(z.string())
  }),
  summary: z.string()
});

export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;

// MCP Tool Request/Response Types
export interface MCPRequest {
  tool: string;
  arguments: Record<string, any>;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Engine-specific types
export interface AppiumCapabilities {
  platformName: string;
  platformVersion?: string;
  deviceName: string;
  app?: string;
  browserName?: string;
  automationName?: string;
  udid?: string;
  noReset?: boolean;
  fullReset?: boolean;
  newCommandTimeout?: number;
}

export interface MaestroFlow {
  appId: string;
  flows: Array<{
    name: string;
    steps: string[];
  }>;
}

export interface PlaywrightConfig {
  browser: string;
  headless: boolean;
  viewport: {
    width: number;
    height: number;
  };
  timeout: number;
}