import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { config } from '../utils/config.js';
import { QAOrchestrator } from './qa-orchestrator.js';
import { AppContextSchema, TestConfigSchema, MCPRequest, MCPResponse } from '../types/index.js';

export class AutoTestMCPServer {
  private server: Server;
  private orchestrator: QAOrchestrator;

  constructor() {
    this.server = new Server(
      {
        name: 'autotest-qa-agent',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.orchestrator = new QAOrchestrator();
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getAvailableTools()
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        logger.info(`Executing tool: ${name}`, { args });
        
        switch (name) {
          case 'analyze_app_context':
            return await this.handleAnalyzeAppContext(args);
          case 'generate_test_strategy':
            return await this.handleGenerateTestStrategy(args);
          case 'execute_tests':
            return await this.handleExecuteTests(args);
          case 'analyze_test_results':
            return await this.handleAnalyzeTestResults(args);
          case 'get_test_status':
            return await this.handleGetTestStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private getAvailableTools(): Tool[] {
    return [
      {
        name: 'analyze_app_context',
        description: 'Analyze application context and determine testing requirements',
        inputSchema: {
          type: 'object',
          properties: {
            appType: {
              type: 'string',
              enum: ['web', 'mobile', 'hybrid'],
              description: 'Type of application to test'
            },
            platform: {
              type: 'string',
              enum: ['ios', 'android', 'web'],
              description: 'Target platform'
            },
            deploymentUrl: {
              type: 'string',
              description: 'URL for web apps or deployment endpoint'
            },
            appBundle: {
              type: 'string',
              description: 'Path to mobile app bundle (.app, .ipa, .apk)'
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of application features to test'
            },
            changes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['added', 'modified', 'deleted'] },
                  file: { type: 'string' },
                  description: { type: 'string' }
                },
                required: ['type', 'file', 'description']
              },
              description: 'Recent code changes that need testing'
            },
            testingScope: {
              type: 'string',
              enum: ['smoke', 'regression', 'full'],
              description: 'Scope of testing to perform'
            }
          },
          required: ['appType', 'features']
        }
      },
      {
        name: 'generate_test_strategy',
        description: 'Generate intelligent test strategy using Claude Code analysis',
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'object',
              description: 'Application context from analyze_app_context'
            },
            constraints: {
              type: 'object',
              properties: {
                timeLimit: { type: 'number', description: 'Maximum time for testing in minutes' },
                priorityFeatures: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'High priority features to focus on'
                }
              }
            }
          },
          required: ['context']
        }
      },
      {
        name: 'execute_tests',
        description: 'Execute the generated test strategy using appropriate testing engines',
        inputSchema: {
          type: 'object',
          properties: {
            strategy: {
              type: 'object',
              description: 'Test strategy from generate_test_strategy'
            },
            config: {
              type: 'object',
              properties: {
                browsers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Browsers to test (for web apps)'
                },
                devices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      platform: { type: 'string', enum: ['ios', 'android'] },
                      deviceName: { type: 'string' },
                      platformVersion: { type: 'string' }
                    }
                  },
                  description: 'Devices to test (for mobile apps)'
                },
                testTypes: {
                  type: 'array',
                  items: { type: 'string', enum: ['functional', 'visual', 'performance', 'accessibility'] },
                  description: 'Types of testing to perform'
                }
              }
            }
          },
          required: ['strategy']
        }
      },
      {
        name: 'analyze_test_results',
        description: 'Analyze test results using Claude Code and provide actionable recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            results: {
              type: 'object',
              description: 'Test suite results from execute_tests'
            },
            context: {
              type: 'object',
              description: 'Original application context'
            }
          },
          required: ['results', 'context']
        }
      },
      {
        name: 'get_test_status',
        description: 'Get current status of running tests',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Test session ID'
            }
          }
        }
      }
    ];
  }

  private async handleAnalyzeAppContext(args: any): Promise<any> {
    try {
      const context = AppContextSchema.parse(args);
      const analysis = await this.orchestrator.analyzeContext(context);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: analysis,
              message: 'Application context analyzed successfully'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGenerateTestStrategy(args: any): Promise<any> {
    try {
      const { context, constraints } = args;
      const strategy = await this.orchestrator.generateTestStrategy(context, constraints);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: strategy,
              message: 'Test strategy generated successfully'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Test strategy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleExecuteTests(args: any): Promise<any> {
    try {
      const { strategy, config: testConfig } = args;
      const results = await this.orchestrator.executeTests(strategy, testConfig);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: results,
              message: 'Tests executed successfully'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleAnalyzeTestResults(args: any): Promise<any> {
    try {
      const { results, context } = args;
      const analysis = await this.orchestrator.analyzeResults(results, context);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: analysis,
              message: 'Test results analyzed successfully'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Results analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGetTestStatus(args: any): Promise<any> {
    try {
      const { sessionId } = args;
      const status = await this.orchestrator.getTestStatus(sessionId);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: status,
              message: 'Test status retrieved successfully'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Status retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('AutoTest QA Agent MCP server started');
  }

  async stop(): Promise<void> {
    await this.server.close();
    logger.info('AutoTest QA Agent MCP server stopped');
  }
}