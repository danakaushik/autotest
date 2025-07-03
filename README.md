# AutoTest QA Agent

An AI-powered QA automation system with hybrid testing capabilities using Appium, Maestro, and Playwright. Acts as a Claude Code MCP client, leveraging Claude Code's AI capabilities for intelligent test orchestration and analysis.

## Features

- 🤖 **Claude Code Integration**: Intelligent test strategy generation and result analysis
- 📱 **Mobile Testing**: iOS simulator and Android device support via Appium and Maestro
- 🌐 **Web Testing**: Cross-browser testing with Playwright
- 🔄 **Hybrid Approach**: Optimal tool selection based on app type and requirements
- 📊 **AI Analysis**: Comprehensive test result analysis with actionable recommendations
- 🎯 **Context-Aware**: Generates tests based on app changes and features
- 📸 **Rich Artifacts**: Screenshots, videos, and detailed logs

## Quick Start

### Prerequisites

- Node.js 18+ 
- Claude Code (with MCP support)
- Appium server (for mobile testing)
- Maestro CLI (for quick mobile tests)
- Playwright browsers (auto-installed)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository>
cd autotest-qa-agent
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Build the project:**
```bash
npm run build
```

4. **Start the MCP server:**
```bash
npm start
```

### Claude Code Integration

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "autotest-qa": {
      "command": "node",
      "args": ["/path/to/autotest-qa-agent/dist/index.js"],
      "description": "AI-powered QA automation with hybrid testing capabilities. Uses Claude Code MCP for AI operations."
    }
  }
}
```

> **Important**: The AutoTest QA Agent now operates as a Claude Code MCP client. No separate API key configuration is required - it uses Claude Code's built-in AI capabilities.

## Usage

### 1. Analyze App Context

```typescript
// In Claude Code
const context = {
  appType: 'mobile',
  platform: 'ios',
  features: ['login', 'dashboard', 'profile'],
  changes: [
    {
      type: 'modified',
      file: 'LoginViewController.swift',
      description: 'Updated login validation logic'
    }
  ],
  testingScope: 'smoke'
};

// Use the MCP tool
await analyzeAppContext(context);
```

### 2. Generate Test Strategy

```typescript
// Claude Code will analyze your app and generate optimal test strategy
const strategy = await generateTestStrategy(context, {
  timeLimit: 30, // minutes
  priorityFeatures: ['login', 'critical_flow']
});
```

### 3. Execute Tests

```typescript
// Run the generated tests
const results = await executeTests(strategy, {
  devices: [
    {
      platform: 'ios',
      deviceName: 'iPhone 15',
      platformVersion: '17.0'
    }
  ],
  testTypes: ['functional', 'visual']
});
```

### 4. Analyze Results

```typescript
// Get AI-powered analysis and recommendations
const analysis = await analyzeTestResults(results, context);
```

## Engine Selection Guide

### When to Use Each Engine

| App Type | Primary Engine | Use Case |
|----------|---------------|----------|
| **Mobile Native** | Appium | Complex flows, real devices, comprehensive testing |
| **Mobile Quick Tests** | Maestro | Smoke tests, fast feedback, simple flows |
| **Web Applications** | Playwright | Cross-browser, visual regression, modern web apps |
| **Hybrid Apps** | Playwright + Appium | Web components + native mobile features |

### Engine Capabilities

**Appium:**
- ✅ iOS and Android support
- ✅ Real device testing
- ✅ Complex gestures and interactions
- ✅ Rich WebDriver API
- ❌ Slower setup and execution

**Maestro:**
- ✅ Fast execution
- ✅ YAML-based (human-readable)
- ✅ Built-in flakiness tolerance
- ❌ iOS simulator only (no real devices)
- ❌ Limited complex logic

**Playwright:**
- ✅ Fast and reliable
- ✅ Built-in visual testing
- ✅ Cross-browser support
- ✅ Modern web app features
- ❌ Web applications only

## Configuration

### Environment Variables

```bash
# Claude Code Integration (enabled by default)
CLAUDE_CODE_INTEGRATION_ENABLED=true
CLAUDE_CODE_FALLBACK_MODE=true

# Appium
APPIUM_HOST=localhost
APPIUM_PORT=4723

# Maestro
MAESTRO_CLI_PATH=maestro

# Testing
DEFAULT_TEST_TIMEOUT=30000
SCREENSHOT_ON_FAILURE=true
VIDEO_RECORDING=false

# Devices
IOS_SIMULATOR_UDID=your_simulator_udid
ANDROID_DEVICE_NAME=your_device_name
```

### Device Setup

**iOS Simulator:**
```bash
# List available simulators
xcrun simctl list devices

# Set simulator UDID in .env
IOS_SIMULATOR_UDID=12345678-1234-1234-1234-123456789012
```

**Android Device:**
```bash
# Enable USB debugging
adb devices

# Set device name in .env
ANDROID_DEVICE_NAME=emulator-5554
```

## API Reference

### MCP Tools

#### `analyze_app_context`
Analyzes application context and determines testing requirements.

**Parameters:**
- `appType`: 'web' | 'mobile' | 'hybrid'
- `platform`: 'ios' | 'android' | 'web'
- `features`: string[] - Application features
- `changes`: Array of recent code changes
- `testingScope`: 'smoke' | 'regression' | 'full'

#### `generate_test_strategy`
Generates intelligent test strategy using Claude Code.

**Parameters:**
- `context`: Application context from analyze_app_context
- `constraints`: Optional time and priority constraints

#### `execute_tests`
Executes tests using the appropriate engines.

**Parameters:**
- `strategy`: Test strategy from generate_test_strategy
- `config`: Optional test configuration (browsers, devices, etc.)

#### `analyze_test_results`
Analyzes test results and provides recommendations.

**Parameters:**
- `results`: Test suite results from execute_tests
- `context`: Original application context

#### `get_test_status`
Gets current status of running tests.

**Parameters:**
- `sessionId`: Optional test session ID

## Architecture

```
Claude Code (AI Development Agent)
       ↓ (MCP Protocol)
┌─────────────────────────────────────┐
│    AutoTest QA Agent (MCP Client)   │
├─────────────────────────────────────┤
│  Context Parser & Results Aggregator│
├─────────────────────────────────────┤
│     ↑ AI Request Bridge ↑           │
│  Test Orchestration (→ Claude Code) │
│  AI Analysis Engine (→ Claude Code) │
├─────────────────────────────────────┤
│  Testing Engines (Direct Execution) │
│  ├─ Appium (Primary Mobile)         │
│  ├─ Maestro (Quick Mobile)          │
│  └─ Playwright (Web)                │
└─────────────────────────────────────┘
          ↑ Test Results ↓
    Mobile/Web Applications
```

### Key Architecture Changes:
- **Claude Code MCP Client**: No longer requires separate Anthropic API key
- **AI Request Bridge**: Routes AI processing requests to Claude Code
- **Fallback Mode**: Graceful degradation when Claude Code AI is unavailable
- **Direct Test Execution**: Engines run tests locally and report results

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run format
```

## Troubleshooting

### Common Issues

**1. Appium Connection Failed**
```bash
# Check if Appium server is running
curl http://localhost:4723/wd/hub/status

# Start Appium server
appium
```

**2. Maestro Not Found**
```bash
# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
maestro --version
```

**3. iOS Simulator Issues**
```bash
# List simulators
xcrun simctl list devices

# Boot simulator
xcrun simctl boot "iPhone 15"
```

**4. Android Device Issues**
```bash
# Check devices
adb devices

# Enable USB debugging on device
# Settings > Developer Options > USB Debugging
```

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

Check logs:
```bash
tail -f logs/autotest-qa.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Issues: [GitHub Issues](https://github.com/danakaushik/autotest/issues)
- Repository: [GitHub](https://github.com/danakaushik/autotest)
- Claude Code Integration: See [INTEGRATION.md](./INTEGRATION.md) for detailed setup