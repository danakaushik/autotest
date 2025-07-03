import dotenv from 'dotenv';
import { z } from 'zod';
import logger from './logger.js';

// Load environment variables
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  // Claude Code MCP Integration (no API key needed)
  claudeCodeIntegration: z.object({
    enabled: z.boolean().default(true),
    fallbackMode: z.boolean().default(true)
  }),
  
  // Appium Configuration
  appium: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(4723)
  }),
  
  // Maestro Configuration
  maestro: z.object({
    cliPath: z.string().default('maestro')
  }),
  
  // Playwright Configuration
  playwright: z.object({
    browsers: z.array(z.string()).default(['chromium'])
  }),
  
  // Testing Configuration
  testing: z.object({
    defaultTimeout: z.number().default(30000),
    screenshotOnFailure: z.boolean().default(true),
    videoRecording: z.boolean().default(false)
  }),
  
  // Device Configuration
  devices: z.object({
    iosSimulatorUdid: z.string().optional(),
    androidDeviceName: z.string().optional()
  }),
  
  // Logging
  logging: z.object({
    level: z.string().default('info'),
    file: z.string().default('logs/autotest-qa.log')
  })
});

type Config = z.infer<typeof ConfigSchema>;

// Parse and validate configuration
function loadConfig(): Config {
  const rawConfig = {
    claudeCodeIntegration: {
      enabled: process.env.CLAUDE_CODE_INTEGRATION !== 'false',
      fallbackMode: process.env.CLAUDE_CODE_FALLBACK !== 'false'
    },
    appium: {
      host: process.env.APPIUM_HOST || 'localhost',
      port: parseInt(process.env.APPIUM_PORT || '4723', 10)
    },
    maestro: {
      cliPath: process.env.MAESTRO_CLI_PATH || 'maestro'
    },
    playwright: {
      browsers: process.env.PLAYWRIGHT_BROWSERS?.split(',') || ['chromium']
    },
    testing: {
      defaultTimeout: parseInt(process.env.DEFAULT_TEST_TIMEOUT || '30000', 10),
      screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE === 'true',
      videoRecording: process.env.VIDEO_RECORDING === 'true'
    },
    devices: {
      iosSimulatorUdid: process.env.IOS_SIMULATOR_UDID,
      androidDeviceName: process.env.ANDROID_DEVICE_NAME
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || 'logs/autotest-qa.log'
    }
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    logger.error('Configuration validation failed:', error);
    throw new Error('Invalid configuration. Please check your environment variables.');
  }
}

// Export singleton configuration
export const config = loadConfig();

// Export schema for validation
export { ConfigSchema };
export type { Config };