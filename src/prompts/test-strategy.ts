import { AppContext } from '../types/index.js';

export class TestStrategyPrompts {
  /**
   * Build comprehensive test strategy prompt for Claude
   */
  static buildStrategyPrompt(
    context: AppContext, 
    constraints?: { timeLimit?: number; priorityFeatures?: string[] }
  ): string {
    const timeConstraint = constraints?.timeLimit 
      ? `Time limit: ${constraints.timeLimit} minutes` 
      : 'No specific time constraint';
    
    const priorityFeatures = constraints?.priorityFeatures?.length 
      ? `Priority features: ${constraints.priorityFeatures.join(', ')}` 
      : 'No specific feature priorities';

    return `
You are a senior QA engineer creating a comprehensive test strategy. Based on the application context below, generate an optimal testing approach.

APPLICATION CONTEXT:
- Type: ${context.appType}
- Platform: ${context.platform || 'Cross-platform'}
- Testing Scope: ${context.testingScope}
- ${timeConstraint}
- ${priorityFeatures}

FEATURES TO TEST:
${context.features.map(feature => `- ${feature}`).join('\n')}

RECENT CHANGES:
${context.changes.map(change => 
  `- ${change.type.toUpperCase()}: ${change.file} - ${change.description}`
).join('\n')}

${context.deploymentUrl ? `Deployment URL: ${context.deploymentUrl}` : ''}
${context.appBundle ? `App Bundle: ${context.appBundle}` : ''}

AVAILABLE TESTING ENGINES:
1. **Appium**: Best for mobile apps, supports real devices, rich API, complex scenarios
   - Pros: Real device testing, comprehensive WebDriver API, mature ecosystem
   - Cons: Slower setup, requires more configuration
   - Use for: iOS/Android native apps, complex mobile flows, device-specific testing

2. **Maestro**: Fast mobile UI testing, YAML-based, simple setup
   - Pros: Quick execution, easy to write, built-in flakiness tolerance
   - Cons: iOS simulator only (no real devices), limited complex logic
   - Use for: Quick smoke tests, simple mobile UI flows, fast feedback

3. **Playwright**: Web application testing, visual regression, cross-browser
   - Pros: Fast, reliable, built-in visual testing, excellent for modern web apps
   - Cons: Web only, no mobile app support
   - Use for: Web applications, browser testing, visual regression

STRATEGY REQUIREMENTS:
1. Choose the PRIMARY engine based on app type and requirements
2. Optionally choose a FALLBACK engine for specific scenarios
3. Create detailed test flows with realistic time estimates
4. Prioritize tests based on risk and impact
5. Consider the testing scope (smoke/regression/full)

Please provide a JSON response with this exact structure:
{
  "primaryEngine": "appium|maestro|playwright",
  "fallbackEngine": "appium|maestro|playwright", // optional
  "testFlows": [
    {
      "name": "Flow Name",
      "description": "What this flow tests",
      "priority": "high|medium|low",
      "estimatedDuration": <seconds>,
      "engine": "appium|maestro|playwright",
      "steps": [
        "Detailed step 1",
        "Detailed step 2",
        "..."
      ]
    }
  ],
  "rationale": "Detailed explanation of why this strategy was chosen"
}

STRATEGY GUIDELINES:
- For mobile apps: Prefer Appium for comprehensive testing, Maestro for quick smoke tests
- For web apps: Use Playwright primarily
- For hybrid apps: Playwright for web components, Appium/Maestro for mobile components
- Always include both positive and negative test scenarios
- Estimate realistic durations (account for app loading, network delays, etc.)
- Prioritize critical user journeys and recent changes
- Include visual regression testing for UI-heavy features
- Consider accessibility testing for public-facing applications

EXAMPLE TEST FLOWS TO CONSIDER:
1. **Authentication Flow**: Login, logout, password reset
2. **Core Feature Flow**: Primary user journey through main features
3. **Data Entry Flow**: Form submission, validation, error handling
4. **Navigation Flow**: Menu navigation, deep linking, back button
5. **Visual Regression Flow**: UI consistency across screens
6. **Performance Flow**: Load times, responsiveness, memory usage
7. **Edge Cases Flow**: Network failures, low storage, interruptions

Generate a comprehensive strategy that balances thoroughness with efficiency.
`;
  }

  /**
   * Build prompt for test flow refinement
   */
  static buildFlowRefinementPrompt(
    originalStrategy: any,
    feedback: string
  ): string {
    return `
You are refining a test strategy based on feedback. Here's the original strategy and the feedback received:

ORIGINAL STRATEGY:
${JSON.stringify(originalStrategy, null, 2)}

FEEDBACK:
${feedback}

Please provide an updated strategy that addresses the feedback while maintaining the same JSON structure. Focus on:
1. Adjusting test priorities based on feedback
2. Modifying time estimates if needed
3. Adding or removing test flows as suggested
4. Updating the rationale to explain changes

Provide the updated strategy in the same JSON format.
`;
  }

  /**
   * Build prompt for engine selection guidance
   */
  static buildEngineSelectionPrompt(context: AppContext): string {
    return `
As a QA expert, recommend the best testing engine for this application:

APPLICATION CONTEXT:
- Type: ${context.appType}
- Platform: ${context.platform || 'Not specified'}
- Features: ${context.features.join(', ')}
- Scope: ${context.testingScope}

Consider these factors:
1. Application type and platform
2. Testing scope and requirements
3. Setup complexity vs. test coverage
4. Execution speed vs. feature richness
5. Team expertise and maintenance overhead

Provide recommendation in this format:
{
  "primaryEngine": "appium|maestro|playwright",
  "reasoning": "Detailed explanation",
  "alternatives": [
    {
      "engine": "engine_name",
      "useCase": "When to use this instead"
    }
  ],
  "tradeoffs": {
    "pros": ["advantage1", "advantage2"],
    "cons": ["limitation1", "limitation2"]
  }
}
`;
  }
}