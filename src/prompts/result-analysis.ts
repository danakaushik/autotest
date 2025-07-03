import { TestSuiteResult, AppContext } from '../types/index.js';

export class ResultAnalysisPrompts {
  /**
   * Build comprehensive result analysis prompt for Claude
   */
  static buildAnalysisPrompt(
    results: TestSuiteResult,
    context: AppContext
  ): string {
    const failureDetails = results.results
      .filter(result => result.status === 'failed' || result.status === 'error')
      .map(result => `- ${result.testName}: ${result.error || 'Unknown error'}`)
      .join('\n');

    const performanceData = results.results
      .filter(result => result.performance)
      .map(result => 
        `- ${result.testName}: ${result.duration}ms duration, ` +
        `Memory: ${result.performance?.memoryUsage || 'N/A'}, ` +
        `CPU: ${result.performance?.cpuUsage || 'N/A'}`
      )
      .join('\n');

    return `
You are a senior QA engineer analyzing test results. Provide a comprehensive analysis with actionable insights.

APPLICATION CONTEXT:
- Type: ${context.appType}
- Platform: ${context.platform || 'Cross-platform'}
- Features: ${context.features.join(', ')}
- Recent Changes: ${context.changes.length} modifications

TEST RESULTS SUMMARY:
- Total Tests: ${results.summary.total}
- Passed: ${results.summary.passed}
- Failed: ${results.summary.failed}
- Skipped: ${results.summary.skipped}
- Errors: ${results.summary.errors}
- Total Duration: ${Math.round(results.summary.duration / 1000)}s
- Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%

FAILED TESTS:
${failureDetails || 'No failed tests'}

PERFORMANCE DATA:
${performanceData || 'No performance data available'}

COVERAGE INFORMATION:
${results.coverage ? `
- Functional: ${results.coverage.functional}%
- Visual: ${results.coverage.visual}%
- Performance: ${results.coverage.performance}%
- Accessibility: ${results.coverage.accessibility}%
` : 'Coverage data not available'}

ARTIFACTS:
- Screenshots: ${results.artifacts?.screenshots?.length || 0}
- Videos: ${results.artifacts?.videos?.length || 0}
- Reports: ${results.artifacts?.reports?.length || 0}

Please provide a JSON response with this exact structure:
{
  "overallScore": <0-100>,
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "category": "functional|visual|performance|accessibility|usability",
      "description": "Clear description of the issue",
      "location": "Where the issue was found (optional)",
      "recommendation": "Specific action to fix this issue"
    }
  ],
  "improvements": [
    {
      "priority": "high|medium|low",
      "description": "What should be improved",
      "estimatedEffort": "small|medium|large",
      "codeChanges": ["specific file or area to modify"] // optional
    }
  ],
  "testCoverage": {
    "current": <percentage>,
    "recommended": <percentage>,
    "gaps": ["area1", "area2"]
  },
  "summary": "Comprehensive summary of the test results and next steps"
}

ANALYSIS GUIDELINES:
1. **Overall Score**: Base on success rate, performance, and coverage
   - 90-100: Excellent (few issues, good performance)
   - 80-89: Good (minor issues, acceptable performance)
   - 70-79: Fair (some issues, needs attention)
   - 60-69: Poor (significant issues, requires fixes)
   - <60: Critical (major issues, immediate action needed)

2. **Issue Severity**:
   - Critical: Blocks core functionality, security vulnerabilities
   - High: Affects major features, poor user experience
   - Medium: Minor functionality issues, performance problems
   - Low: UI inconsistencies, non-critical enhancements

3. **Issue Categories**:
   - Functional: Features not working as expected
   - Visual: UI/UX problems, layout issues
   - Performance: Slow loading, high resource usage
   - Accessibility: Missing alt text, keyboard navigation
   - Usability: Confusing workflows, poor error messages

4. **Improvement Priorities**:
   - High: Critical for next release, user impact
   - Medium: Important for user experience
   - Low: Nice to have, future enhancements

5. **Effort Estimation**:
   - Small: <1 day, minor code changes
   - Medium: 1-3 days, moderate changes
   - Large: >3 days, significant refactoring

SPECIFIC ANALYSIS AREAS:
- Identify patterns in failures (common causes, affected areas)
- Evaluate performance trends and bottlenecks
- Assess test coverage gaps and risks
- Recommend specific code improvements
- Suggest additional testing scenarios
- Highlight security or accessibility concerns
- Consider impact on user experience
- Provide actionable next steps for developers

Focus on being specific and actionable in your recommendations. Don't just identify problems - provide clear solutions.
`;
  }

  /**
   * Build prompt for failure pattern analysis
   */
  static buildFailurePatternPrompt(
    failedTests: any[],
    context: AppContext
  ): string {
    const failureGroups = failedTests.reduce((groups: any, test) => {
      const key = test.error?.split(':')[0] || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(test.testName);
      return groups;
    }, {});

    return `
Analyze these test failure patterns and identify root causes:

APPLICATION: ${context.appType} (${context.platform})

FAILURE GROUPS:
${Object.entries(failureGroups)
  .map(([error, tests]) => `${error}: ${(tests as string[]).join(', ')}`)
  .join('\n')}

DETAILED FAILURES:
${failedTests.map(test => 
  `- ${test.testName}: ${test.error}\n  Duration: ${test.duration}ms\n  Engine: ${test.engine}`
).join('\n\n')}

Provide analysis in this format:
{
  "patterns": [
    {
      "type": "Pattern name",
      "frequency": <count>,
      "affectedTests": ["test1", "test2"],
      "rootCause": "Likely cause",
      "recommendation": "How to fix"
    }
  ],
  "commonCauses": ["cause1", "cause2"],
  "quickFixes": ["fix1", "fix2"],
  "preventionStrategies": ["strategy1", "strategy2"]
}
`;
  }

  /**
   * Build prompt for performance analysis
   */
  static buildPerformanceAnalysisPrompt(
    results: TestSuiteResult,
    context: AppContext
  ): string {
    const performanceTests = results.results
      .filter(result => result.performance)
      .sort((a, b) => b.duration - a.duration);

    return `
Analyze performance test results and provide optimization recommendations:

APPLICATION: ${context.appType} (${context.platform})

PERFORMANCE RESULTS:
${performanceTests.map(test => `
- ${test.testName}:
  Duration: ${test.duration}ms
  Memory: ${test.performance?.memoryUsage || 'N/A'}
  CPU: ${test.performance?.cpuUsage || 'N/A'}
  Load Time: ${test.performance?.loadTime || 'N/A'}ms
`).join('')}

OVERALL TIMING:
- Total Duration: ${Math.round(results.summary.duration / 1000)}s
- Average per Test: ${Math.round(results.summary.duration / results.summary.total)}ms
- Slowest Test: ${performanceTests[0]?.testName || 'N/A'} (${performanceTests[0]?.duration || 0}ms)

Provide analysis in this format:
{
  "performanceScore": <0-100>,
  "bottlenecks": [
    {
      "area": "Component/feature name",
      "issue": "Performance problem description",
      "impact": "high|medium|low",
      "recommendation": "Specific optimization suggestion"
    }
  ],
  "metrics": {
    "averageLoadTime": <ms>,
    "p95Duration": <ms>,
    "memoryEfficiency": "good|fair|poor",
    "cpuEfficiency": "good|fair|poor"
  },
  "optimizations": [
    {
      "priority": "high|medium|low",
      "description": "What to optimize",
      "expectedImprovement": "Performance gain description"
    }
  ]
}
`;
  }

  /**
   * Build prompt for accessibility analysis
   */
  static buildAccessibilityAnalysisPrompt(
    results: TestSuiteResult,
    context: AppContext
  ): string {
    return `
Analyze test results for accessibility issues and compliance:

APPLICATION: ${context.appType} (${context.platform})

TEST RESULTS: ${results.summary.passed}/${results.summary.total} passed

ACCESSIBILITY CONSIDERATIONS:
- Screen reader compatibility
- Keyboard navigation
- Color contrast
- Alternative text for images
- Focus management
- ARIA labels and roles

Based on the test results and application type, provide analysis in this format:
{
  "accessibilityScore": <0-100>,
  "violations": [
    {
      "severity": "critical|high|medium|low",
      "guideline": "WCAG guideline reference",
      "description": "What's wrong",
      "location": "Where it was found",
      "remedy": "How to fix it"
    }
  ],
  "improvements": [
    {
      "area": "Component or feature",
      "enhancement": "Accessibility improvement",
      "impact": "Who this helps"
    }
  ],
  "compliance": {
    "wcagLevel": "A|AA|AAA",
    "currentCompliance": <percentage>,
    "targetCompliance": <percentage>
  }
}
`;
  }
}