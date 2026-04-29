/**
 * Test data fixtures for Pipeline Tags.
 */

export function generatePipelineName(prefix = 'test-pipeline'): string {
  return `${prefix}-${Date.now()}`;
}

export const PIPELINE_DATA = {
  basic: {
    name:        () => generatePipelineName('basic'),
    description: 'Basic smoke pipeline',
  },
  textAiAi: {
    name:        () => generatePipelineName('text-ai-ai'),
    description: 'Text → AI → AI supported pipeline',
    steps: [
      { type: 'Text', label: 'Step 1 - Text Input',    trigger: '' },
      { type: 'AI',   label: 'Step 2 - AI Process',    prompt: 'Summarize: {{chain_input}}' },
      { type: 'AI',   label: 'Step 3 - AI Refine',     prompt: 'Expand on: {{chain_input}}' },
    ],
  },
  apiAiAi: {
    name:        () => generatePipelineName('api-ai-ai'),
    description: 'API → AI → AI supported pipeline',
    steps: [
      { type: 'API', label: 'Step 1 - Fetch Data',     url: 'https://jsonplaceholder.typicode.com/todos/1' },
      { type: 'AI',  label: 'Step 2 - Process Output', prompt: 'Summarize: {{chain_input}}' },
      { type: 'AI',  label: 'Step 3 - Finalize',       prompt: 'Refine: {{chain_input}}' },
    ],
  },
};

export const PIPELINE_VALIDATION = {
  maxSteps:    3,
  minTimeout:  1,
  maxTimeout:  120,
  errorHandling: ['Stop', 'Continue', 'Retry'],
};

export const PIPELINE_INLINE_SYNTAX = {
  singleStep:     'trigger1>>',
  twoStep:        'step1>>step2>>',
  threeStep:      'step1>>step2>>step3>>',
  withSpaces:     'step1 >> step2 >>',
  invalid:        '>>badstart',
};
