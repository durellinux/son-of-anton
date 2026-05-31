import { execa } from 'execa';

async function poll(url: string) {
  while (true) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function main() {
  console.log('Starting restate-server and dev server...');
  const restateServer = execa('yarn', ['restate-server'], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
    detached: true,
  });

  const devServer = execa('yarn', ['run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
    detached: true,
  });

  const cleanup = () => {
    console.log('Shutting down servers...');
    if (restateServer.pid) {
      process.kill(-restateServer.pid, 'SIGTERM');
    }
    if (devServer.pid) {
      process.kill(-devServer.pid, 'SIGTERM');
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  console.log('Waiting for Restate Admin API and Daemon API to be ready...');

  await Promise.all([poll('http://localhost:9070/health'), poll('http://localhost:3000/health')]);

  console.log('Both services are ready. Registering service...');

  await execa(
    'npx',
    [
      '--yes',
      '@restatedev/restate',
      'deployments',
      'register',
      'http://localhost:9080',
      '--force',
      '--yes',
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    },
  );

  console.log('Service registered successfully.');

  try {
    await Promise.race([restateServer, devServer]);
  } catch (err) {
    console.error('A server exited with an error:', err);
    cleanup();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
