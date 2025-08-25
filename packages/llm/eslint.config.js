import baseConfig from '../../packages/eslint-config/base.js';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**/*'],
  },
];
