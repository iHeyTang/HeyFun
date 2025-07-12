import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:5172/openapi.json',
  output: 'src/server',
  plugins: [{ name: '@hey-api/client-next', runtimeConfigPath: './src/hey-api.ts' }],
});
