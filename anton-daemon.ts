import Fastify from 'fastify';
import { execa } from 'execa';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }
});

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function runAnton() {
  fastify.log.info('Starting Anton iteration...');
  try {
    const subprocess = execa('gemini', [
        '-p', 'use anton-main skill',
        '--approval-mode', 'yolo'
    ]);

      // Hook into the stream
      subprocess.stdout?.on('data', (chunk) => {
          const data = chunk.toString();
          try {
              process.stdout.write(data)
          } catch (e) {
              process.stderr.write("Error handling model output");
          }
      });

      // Hook into the stream
      subprocess.stderr?.on('data', (chunk) => {
          const data = chunk.toString();
          try {
              process.stderr.write(data)
          } catch (e) {
              process.stderr.write("Error handling model output");
          }
      });

    await subprocess;
    fastify.log.info('Anton finished successfully');
  } catch (error) {
    fastify.log.error('Anton failed to execute: %s', error);
  }
}

// Start the polling loop
function startPolling() {
  runAnton(); // Initial run
  setInterval(runAnton, POLL_INTERVAL);
}

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Son of Anton Daemon is running on port 3000');
    startPolling();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
