import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'tsp-output/@typespec/openapi3/openapi.yaml',
  output: 'src/api',
  plugins: [ '@hey-api/sdk', '@hey-api/client-fetch',
    {
      name: '@hey-api/typescript',
      enums: 'typescript',
    },
    'fastify',
  ],
});
