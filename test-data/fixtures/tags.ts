/**
 * Test data fixtures for tag creation, validation, and edge cases.
 */

export function generateTrigger(prefix = 'smoke'): string {
  return `${prefix}${Date.now()}`.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const TAG_TYPES = ['Text', 'Form', 'AI', 'API', 'File'] as const;
export type TagType = typeof TAG_TYPES[number];

export const TEXT_TAGS = {
  valid: {
    trigger:     () => generateTrigger('texttag'),
    description: 'Smoke test text tag',
    content:     'Hello from automated test. {{name}} welcome!',
  },
  minimal: {
    trigger:     () => generateTrigger('min'),
    description: '',
    content:     'Min content',
  },
  maxContent: {
    trigger:     () => generateTrigger('maxtag'),
    description: 'Max content test',
    content:     'A'.repeat(500),
  },
};

export const AI_TAGS = {
  valid: {
    trigger:     () => generateTrigger('aitag'),
    description: 'AI smoke tag',
    prompt:      'Summarize the following text in 2 sentences: {{input}}',
  },
  translation: {
    trigger:     () => generateTrigger('translate'),
    description: 'Translation tag',
    prompt:      'Translate the following to French: {{text}}',
  },
};

export const API_TAGS = {
  valid: {
    trigger:     () => generateTrigger('apitag'),
    description: 'API smoke tag',
    url:         'https://jsonplaceholder.typicode.com/todos/1',
    method:      'GET',
  },
  post: {
    trigger:     () => generateTrigger('apipost'),
    description: 'API POST tag',
    url:         'https://jsonplaceholder.typicode.com/posts',
    method:      'POST',
  },
};

export const FORM_TAGS = {
  valid: {
    trigger:     () => generateTrigger('formtag'),
    description: 'Form smoke tag',
    formJson:    JSON.stringify({
      fields: [
        { name: 'name', type: 'text', label: 'Your Name', required: true },
        { name: 'email', type: 'email', label: 'Email', required: true },
      ],
    }),
  },
};

// Validation: INVALID trigger inputs
export const INVALID_TRIGGERS = {
  uppercase:    'UPPERCASE',
  withSpaces:   'has space',
  specialChars: 'has@special!',
  tooShort:     'ab',
  startNumber:  '123abc',
  empty:        '',
  withQuotes:   '"quoted"',
};

// Validation: VALID trigger inputs
export const VALID_TRIGGERS = {
  lowercase:      () => `validtrigger${Date.now()}`,
  withNumbers:    () => `trigger${Date.now()}`,
  withHyphen:     () => `valid-trigger-${Date.now()}`,
  withUnderscore: () => `valid_trigger_${Date.now()}`,
};

export const PIPELINE_TAG_COMBOS = {
  supported: [
    { steps: ['Text', 'AI', 'AI'],   label: 'Text → AI → AI (supported)' },
    { steps: ['API',  'AI', 'AI'],   label: 'API → AI → AI (supported)'  },
  ],
  limited: [
    { steps: ['API',  'API', 'AI'],  label: 'API → API → AI (limited)'   },
    { steps: ['Text', 'API', 'API'], label: 'Text → API → API (limited)' },
    { steps: ['API',  'API', 'API'], label: 'API → API → API (limited)'  },
  ],
};

export const GLOBAL_TAG_DATA = {
  free: {
    trigger:     () => `global${Date.now()}`,
    description: 'Free global tag for smoke',
    type:        'Text' as TagType,
    monetize:    false,
  },
  monetized: {
    trigger:     () => `paid${Date.now()}`,
    description: 'Paid global tag for smoke',
    type:        'Text' as TagType,
    monetize:    true,
    sellPrice:   '50',
  },
};

export const SECURE_TAG_DATA = {
  valid: {
    name:     'Test Website Login',
    username: 'testuser@example.com',
    website:  'https://example.com',
    password: 'TestPass@1234',
    notes:    'Automated test credential',
  },
  minimal: {
    name:     'Min Secure Tag',
    username: 'user@test.com',
    website:  'https://test.com',
    password: 'pass123',
    notes:    '',
  },
};
