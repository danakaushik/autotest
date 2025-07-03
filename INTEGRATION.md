# AutoTest QA Agent - Claude Code Integration Guide

## 🎯 Quick Setup for Claude Code

### 1. Add MCP Server to Claude Code

In your Claude Code workspace, create or update `.mcp.json`:

```json
{
  "mcpServers": {
    "autotest-qa": {
      "command": "node",
      "args": ["/Users/deepakkaushik/Documents/Projects/autotest/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 2. Usage in Claude Code

Now you can use the QA agent directly in your development workflow:

```javascript
// Example: Test an iOS app after making changes
const testResult = await use_mcp_tool('autotest-qa', 'analyze_app_context', {
  appType: 'mobile',
  platform: 'ios',
  features: ['login', 'dashboard', 'profile'],
  changes: [
    {
      type: 'modified',
      file: 'LoginViewController.swift',
      description: 'Added biometric authentication'
    }
  ],
  testingScope: 'smoke'
});

console.log('QA Analysis:', testResult);
```

## 🔧 Available Tools

### `analyze_app_context`
- **Purpose**: Analyze your app and get testing recommendations
- **Input**: App type, features, recent changes
- **Output**: Complexity analysis, risk areas, testing priorities

### `generate_test_strategy`
- **Purpose**: Generate optimal test strategy using AI
- **Input**: App context, time constraints, priority features
- **Output**: Test flows, engine selection, execution plan

### `execute_tests`
- **Purpose**: Run tests using the best testing engine for your app
- **Input**: Test strategy, device/browser configuration
- **Output**: Test results, screenshots, performance data

### `analyze_test_results`
- **Purpose**: Get AI-powered analysis of test results
- **Input**: Test results, app context
- **Output**: Issues found, recommendations, next steps

### `get_test_status`
- **Purpose**: Check current testing status
- **Input**: Optional session ID
- **Output**: Active/queued/completed test counts

## 🎬 Complete Workflow Example

```javascript
// 1. Development: You make changes to your app
// 2. Deployment: App is built and deployed

// 3. QA Analysis: Understand what needs testing
const context = {
  appType: 'mobile',
  platform: 'ios',
  appBundle: './build/MyApp.app',
  features: ['authentication', 'dashboard', 'settings'],
  changes: [
    {
      type: 'added',
      file: 'BiometricAuth.swift', 
      description: 'Added Touch ID and Face ID support'
    }
  ],
  testingScope: 'regression'
};

const analysis = await use_mcp_tool('autotest-qa', 'analyze_app_context', context);

// 4. Test Strategy: Generate optimal test plan
const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
  context,
  constraints: {
    timeLimit: 20, // 20 minutes max
    priorityFeatures: ['authentication']
  }
});

// 5. Test Execution: Run the tests
const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
  strategy: strategy.data,
  config: {
    devices: [{
      platform: 'ios',
      deviceName: 'iPhone 15',
      platformVersion: '17.0'
    }],
    testTypes: ['functional', 'visual'],
    screenshotOnFailure: true
  }
});

// 6. Results Analysis: Get AI insights
const insights = await use_mcp_tool('autotest-qa', 'analyze_test_results', {
  results: results.data,
  context
});

// 7. Action: Fix issues and iterate
console.log(`Tests: ${results.data.summary.passed}/${results.data.summary.total} passed`);
console.log(`Overall Score: ${insights.data.overallScore}/100`);
console.log('Issues to fix:', insights.data.issues);
console.log('Recommendations:', insights.data.improvements);
```

## 🚀 Development Integration Patterns

### Pattern 1: Pre-Commit Testing
```javascript
// Run before committing code
async function preCommitTest(changedFiles) {
  const context = {
    appType: 'web',
    deploymentUrl: 'http://localhost:3000',
    features: await extractFeaturesFromFiles(changedFiles),
    changes: changedFiles.map(file => ({
      type: 'modified',
      file: file.path,
      description: file.summary
    })),
    testingScope: 'smoke'
  };
  
  const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
    context,
    constraints: { timeLimit: 5 } // Quick smoke test
  });
  
  return await use_mcp_tool('autotest-qa', 'execute_tests', {
    strategy: strategy.data
  });
}
```

### Pattern 2: Feature Validation
```javascript
// Test new feature thoroughly
async function validateFeature(featureName, testScope = 'full') {
  const context = {
    appType: 'mobile',
    platform: 'ios',
    features: [featureName],
    changes: await getFeatureChanges(featureName),
    testingScope: testScope
  };
  
  // Get comprehensive test strategy
  const strategy = await use_mcp_tool('autotest-qa', 'generate_test_strategy', {
    context,
    constraints: {
      priorityFeatures: [featureName]
    }
  });
  
  // Execute with full coverage
  const results = await use_mcp_tool('autotest-qa', 'execute_tests', {
    strategy: strategy.data,
    config: {
      testTypes: ['functional', 'visual', 'performance', 'accessibility']
    }
  });
  
  // Get detailed analysis
  return await use_mcp_tool('autotest-qa', 'analyze_test_results', {
    results: results.data,
    context
  });
}
```

### Pattern 3: Continuous Monitoring
```javascript
// Monitor app health continuously
async function healthCheck() {
  const status = await use_mcp_tool('autotest-qa', 'get_test_status');
  
  if (status.data.activeTests === 0) {
    // No tests running, start health check
    const context = {
      appType: 'web',
      deploymentUrl: 'https://production.myapp.com',
      features: ['core-functionality'],
      changes: [],
      testingScope: 'smoke'
    };
    
    return await quickSmokeTest(context);
  }
  
  return status;
}
```

## 🛠️ Engine Selection Guide

The QA agent automatically selects the best testing engine based on your app:

- **Appium**: Mobile apps requiring complex interactions or real device testing
- **Maestro**: Mobile apps needing fast feedback and simple UI flows  
- **Playwright**: Web applications with modern features and cross-browser needs

You can influence selection by specifying app type and platform in your context.

## 📊 Results and Analytics

Each test run provides:

- **Pass/Fail Status**: Clear test results with failure details
- **Screenshots**: Visual evidence of issues and test progression
- **Performance Data**: Load times, memory usage, responsiveness metrics
- **AI Analysis**: Intelligent insights and improvement recommendations
- **Artifacts**: Videos, logs, and detailed reports for debugging

## 🔄 Iterative Improvement

The AI learns from your testing patterns and provides increasingly better:

- Test strategy recommendations
- Issue prioritization
- Performance optimization suggestions
- Coverage gap identification

## 📞 Support

- **Configuration Issues**: Check `.env` file and MCP setup
- **Test Failures**: Review logs in `logs/autotest-qa.log`
- **Engine Problems**: Verify Appium, Maestro, and Playwright installations
- **API Errors**: Ensure ANTHROPIC_API_KEY is correctly configured

Your AutoTest QA Agent is ready to revolutionize your testing workflow! 🚀