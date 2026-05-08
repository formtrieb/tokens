import chokidar from 'chokidar';
import { runPipeline } from './pipeline.js';
import type { Config } from './types.js';

export async function startWatcher(config: Config): Promise<void> {
  console.log(`Watching ${config.paths.tokens} for changes…`);
  await runPipeline(config);

  let timer: NodeJS.Timeout | undefined;
  let pending = false;
  let running = false;

  const trigger = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await runPipeline(config);
      console.log(`✓ rebuilt at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        trigger();
      }
    }
  };

  const watcher = chokidar.watch(config.paths.tokens, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
  });

  watcher.on('all', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(trigger, 100);
  });
}
