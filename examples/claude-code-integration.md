# Claude Code Integration Examples

This document shows how to integrate the AutoTest QA Agent with Claude Code for automated testing workflows.

## Setup

### 1. MCP Configuration

Add to your Claude Code MCP configuration file:

```json
{
  "mcpServers": {
    "autotest-qa": {
      "command": "node",
      "args": ["/Users/your-username/autotest-qa-agent/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 2. Workspace Integration

Create a `.mcp.json` file in your project workspace:

```json
{
  "mcpServers": {
    "autotest-qa": {
      "command": "autotest-qa-agent",
      "description": "AI-powered QA automation with hybrid testing"
    }
  }
}
```

## Usage Examples

### Example 1: iOS App Testing

```typescript
// Context: Just implemented a new login feature
const appContext = {
  appType: 'mobile',
  platform: 'ios',
  deploymentUrl: undefined,
  appBundle: './build/MyApp.app',
  features: [
    'User Authentication',
    'Dashboard Navigation',
    'Profile Management',
    'Settings'
  ],
  changes: [
    {
      type: 'added',
      file: 'LoginViewController.swift',
      description: 'Added biometric authentication support'
    },
    {
      type: 'modified',
      file: 'AuthenticationService.swift',
      description: 'Updated token validation logic'
    }
  ],
  testingScope: 'smoke'
};

// Step 1: Analyze the app context
const analysis = await use_mcp_tool('autotest-qa', 'analyze_app_context', appContext);

console.log('Analysis:', analysis);
// Output: Complexity assessment, risk areas, testing priorities

// Step 2: Generate test strategy
const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
  context: appContext,
  constraints: {
    timeLimit: 15, // 15 minutes max
    priorityFeatures: ['User Authentication']
  }
});

console.log('Strategy:', strategy);
// Output: Primary engine (Appium), test flows, rationale

// Step 3: Execute tests
const testConfig = {
  devices: [
    {
      platform: 'ios',
      deviceName: 'iPhone 15',
      platformVersion: '17.0'
    }
  ],
  testTypes: ['functional', 'visual'],
  timeout: 30000,
  screenshotOnFailure: true
};

const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
  strategy: strategy.data,
  config: testConfig
});

console.log('Test Results:', results);

// Step 4: Analyze results and get recommendations
const analysis = await use_mcp_tool('autotest-qa', 'analyze_test_results', {
  results: results.data,
  context: appContext
});

console.log('AI Analysis:', analysis);
// Output: Issues found, improvement recommendations, next steps
```

### Example 2: Web Application Testing

```typescript
// Context: E-commerce checkout flow changes
const webAppContext = {
  appType: 'web',
  platform: 'web',
  deploymentUrl: 'https://staging.myapp.com',
  features: [
    'Product Catalog',
    'Shopping Cart',
    'Checkout Process',
    'Payment Integration',
    'User Account'
  ],
  changes: [
    {
      type: 'modified',
      file: 'checkout.component.ts',
      description: 'Updated payment form validation'
    },
    {
      type: 'added',
      file: 'express-checkout.component.ts',
      description: 'Added express checkout option'
    }
  ],
  testingScope: 'regression'
};

// Generate comprehensive test strategy
const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
  context: webAppContext,
  constraints: {
    timeLimit: 45,
    priorityFeatures: ['Checkout Process', 'Payment Integration']
  }
});

// Execute cross-browser tests
const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
  strategy: strategy.data,
  config: {
    browsers: ['chromium', 'firefox', 'webkit'],
    testTypes: ['functional', 'visual', 'accessibility'],
    timeout: 60000,
    screenshotOnFailure: true,
    videoRecording: true
  }
});

// Get detailed analysis
const analysis = await use_mcp_tool('autotest-qa', 'analyze_test_results', {
  results: results.data,
  context: webAppContext
});
```

### Example 3: Hybrid App Testing

```typescript
// Context: React Native app with web components
const hybridAppContext = {
  appType: 'hybrid',
  platform: 'ios',
  deploymentUrl: 'https://webview.myapp.com',
  appBundle: './build/MyHybridApp.app',
  features: [
    'Native Navigation',
    'Web Content Views',
    'Camera Integration',
    'Push Notifications',
    'Offline Sync'
  ],
  changes: [
    {
      type: 'modified',
      file: 'WebViewManager.swift',
      description: 'Updated JavaScript bridge security'
    },
    {
      type: 'modified',
      file: 'app.html',
      description: 'Updated web content styling'
    }
  ],
  testingScope: 'full'
};

// Strategy will use both Playwright (web components) and Appium (native)
const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
  context: hybridAppContext
});

const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
  strategy: strategy.data,
  config: {
    devices: [
      {
        platform: 'ios',
        deviceName: 'iPhone 15',
        platformVersion: '17.0'
      }
    ],
    browsers: ['webkit'], // For web components
    testTypes: ['functional', 'visual', 'performance']
  }
});
```

## Development Workflow Integration

### Continuous Testing Workflow

```typescript
// In your Claude Code workflow
async function deployAndTest(deploymentInfo: any) {
  // 1. Deploy the app
  await deployApp(deploymentInfo);
  
  // 2. Analyze what changed
  const context = {
    appType: deploymentInfo.appType,
    platform: deploymentInfo.platform,
    deploymentUrl: deploymentInfo.url,
    features: deploymentInfo.features,
    changes: await getRecentChanges(),
    testingScope: 'smoke'
  };
  
  // 3. Quick smoke tests
  const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
    context,
    constraints: { timeLimit: 10 }
  });
  
  const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
    strategy: strategy.data
  });
  
  // 4. Analyze and act on results
  const analysis = await use_mcp_tool('autotest-qa', 'analyze_test_results', {
    results: results.data,
    context
  });
  
  if (analysis.data.overallScore < 80) {
    // Fix critical issues automatically or notify team
    await handleCriticalIssues(analysis.data.issues);
  }
  
  return {
    testsPassed: results.data.summary.passed,
    testsTotal: results.data.summary.total,
    score: analysis.data.overallScore,
    recommendations: analysis.data.improvements
  };
}
```

### Feature Development Workflow

```typescript
async function testNewFeature(featureInfo: any) {
  // 1. Analyze feature complexity
  const context = {
    appType: featureInfo.appType,
    platform: featureInfo.platform,
    features: [featureInfo.featureName],
    changes: featureInfo.codeChanges,
    testingScope: 'regression'
  };
  
  const analysis = await use_mcp_tool('autotest-qa', 'analyze_app_context', context);
  
  // 2. Generate comprehensive test strategy
  const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
    context,
    constraints: {
      priorityFeatures: [featureInfo.featureName]
    }
  });
  
  // 3. Execute tests with appropriate coverage
  const testConfig = {
    testTypes: ['functional', 'visual'],
    screenshotOnFailure: true,
    timeout: analysis.data.estimatedEffort.execution * 1000
  };
  
  const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
    strategy: strategy.data,
    config: testConfig
  });
  
  // 4. Generate test report
  const report = await use_mcp_tool('autotest-qa', 'analyze_test_results', {
    results: results.data,
    context
  });
  
  return {
    feature: featureInfo.featureName,
    testResults: results.data,
    analysis: report.data,
    artifacts: results.data.artifacts
  };
}
```

## Monitoring and Status

### Check Test Status

```typescript
// Get current test status
const status = await use_mcp_tool('autotest-qa', 'get_test_status', {});

console.log('Active tests:', status.data.activeTests);
console.log('Queued tests:', status.data.queuedTests);
console.log('Completed tests:', status.data.completedTests);

// Get specific session status
const sessionStatus = await use_mcp_tool('autotest-qa', 'get_test_status', {
  sessionId: 'session_12345'
});
```

### Error Handling

```typescript
try {
  const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
    strategy: strategy.data
  });
} catch (error) {
  console.error('Test execution failed:', error);
  
  // Handle specific errors
  if (error.message.includes('Appium server not available')) {
    console.log('Starting Appium server...');
    await startAppiumServer();
    // Retry
  } else if (error.message.includes('Device not found')) {
    console.log('Available devices:', await listAvailableDevices());
  }
}
```

## Best Practices

1. **Start with Context Analysis**: Always analyze your app context first to get optimal test strategies.

2. **Use Appropriate Scope**: 
   - `smoke` for quick validation
   - `regression` for feature changes
   - `full` for major releases

3. **Monitor Test Performance**: Track test execution times and optimize strategies based on feedback.

4. **Handle Failures Gracefully**: Use the AI analysis to understand and fix issues systematically.

5. **Leverage Artifacts**: Use screenshots and videos for debugging and documentation.

6. **Continuous Integration**: Integrate with your CI/CD pipeline for automated testing on every deployment.