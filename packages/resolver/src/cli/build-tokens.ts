import { runPipeline } from '../pipeline.js';
import config from '../../formtrieb-tokens.config.js';

runPipeline(config, { only: ['themes'] }).catch((err) => {
  console.error(err);
  process.exit(1);
});
