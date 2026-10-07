import { runPipeline } from '../pipeline.js';
import config from '../../formtrieb-tokens.config.js';

runPipeline(config).catch((err) => {
  console.error(err);
  process.exit(1);
});
