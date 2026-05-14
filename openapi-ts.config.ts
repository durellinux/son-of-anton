import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'tsp-output/@typespec/openapi3/openapi.yaml',
  output: 'src/api',
  plugins: [
    {
      name: '@hey-api/typescript',
      enums: 'typescript',
    },
    'fastify',
  ],
});
