import { processAllThemes } from '../build/theme-processor.js';
import config from '../../formtrieb-tokens.config.js';

processAllThemes(config).catch((err) => {
	console.error(err);
	process.exit(1);
});
