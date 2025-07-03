#!/usr/bin/env node

import { AutoTestMCPServer } from './core/mcp-server.js';
import logger from './utils/logger.js';
import { config } from './utils/config.js';

async function main() {
  try {
    logger.info('Starting AutoTest QA Agent MCP Server', {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform
    });

    // Validate configuration
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    // Create and start MCP server
    const server = new AutoTestMCPServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    // Start the server
    await server.start();
    
    logger.info('AutoTest QA Agent MCP Server is running');
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    logger.error('Failed to start AutoTest QA Agent:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}