import { processAllThemes } from '../build/theme-processor.js';

processAllThemes().catch((err) => {
	console.error(err);
	process.exit(1);
});
