/**
 * MCP AI Bridge
 * 
 * This module provides a bridge between the AutoTest QA Agent and Claude Code
 * for AI operations. When the QA agent needs AI analysis, it creates a request
 * that can be processed by Claude Code through the MCP protocol.
 */

export interface AIRequest {
  id: string;
  timestamp: string;
  task: 'context_analysis' | 'test_strategy_generation' | 'test_results_analysis';
  prompt: string;
  options: {
    expectedFormat: string;
    maxTokens: number;
    temperature: number;
  };
  context?: any;
}

export interface AIResponse {
  id: string;
  timestamp: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class MCPAIBridge {
  private pendingRequests: Map<string, AIRequest> = new Map();

  /**
   * Create an AI request that can be processed by Claude Code
   */
  createAIRequest(
    task: AIRequest['task'],
    prompt: string,
    options: AIRequest['options'],
    context?: any
  ): AIRequest {
    const id = `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request: AIRequest = {
      id,
      timestamp: new Date().toISOString(),
      task,
      prompt,
      options,
      context
    };

    this.pendingRequests.set(id, request);
    return request;
  }

  /**
   * Process AI request response from Claude Code
   */
  processAIResponse(response: AIResponse): void {
    const request = this.pendingRequests.get(response.id);
    if (request) {
      this.pendingRequests.delete(response.id);
    }
  }

  /**
   * Get pending AI requests (for debugging)
   */
  getPendingRequests(): AIRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Clear old pending requests
   */
  cleanupOldRequests(maxAgeMs: number = 5 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    for (const [id, request] of this.pendingRequests.entries()) {
      const requestTime = new Date(request.timestamp).getTime();
      if (requestTime < cutoff) {
        this.pendingRequests.delete(id);
      }
    }
  }

  /**
   * Format AI request for Claude Code MCP tool
   */
  formatForClaudeCode(request: AIRequest): string {
    return `
AutoTest QA Agent AI Request:

Task: ${request.task}
Request ID: ${request.id}
Timestamp: ${request.timestamp}

Expected Format: ${request.options.expectedFormat}
Max Tokens: ${request.options.maxTokens}
Temperature: ${request.options.temperature}

Prompt:
${request.prompt}

${request.context ? `Context: ${JSON.stringify(request.context, null, 2)}` : ''}

Please process this AI request and return the response in the expected format.
`;
  }
}

// Singleton instance for the MCP AI Bridge
export const mcpAIBridge = new MCPAIBridge();