import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
delete config.ai;
writeFileSync('.wrangler-local.json',JSON.stringify(config));
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','.wrangler-local.json',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
child.on('exit',code=>process.exit(code||0));
