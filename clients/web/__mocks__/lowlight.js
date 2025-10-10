// Mock for lowlight library to work with Jest
// Lowlight uses ES modules which Jest has trouble with

const mockLowlight = {
  highlight: (language, code) => ({
    value: code,
    language: language || 'plaintext',
    relevance: 0,
    children: []
  }),
  highlightAuto: (code) => ({
    value: code,
    language: 'plaintext',
    relevance: 0,
    children: []
  }),
  register: jest.fn(),
  registered: jest.fn(() => []),
  registerAlias: jest.fn()
};

// Mock createLowlight function
const createLowlight = () => mockLowlight;

// Mock common grammars
const common = {};

module.exports = {
  createLowlight,
  common,
  all: {},
  grammars: {}
};
