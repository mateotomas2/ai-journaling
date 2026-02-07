/**
 * Pre-compiles Ajv validators for RxDB schemas to avoid runtime eval()
 * which violates Content Security Policy.
 *
 * This script generates standalone ES module code that can be imported
 * without requiring unsafe-eval in CSP.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import all schemas
import { settingsSchema } from '../src/services/db/schemas';
import { daySchema } from '../src/db/schemas/day.schema';
import { messageSchema } from '../src/db/schemas/message.schema';
import { summarySchema } from '../src/db/schemas/summary.schema';
import { noteSchema } from '../src/db/schemas/note.schema';
import { embeddingSchema } from '../src/db/schemas/embedding.schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '../src/db/validators');
const outputFile = join(outputDir, 'compiled.js');

// Configure Ajv with strict mode disabled and RxDB custom keywords
const ajv = new Ajv({
  strict: false,
  code: {
    source: true,
    esm: true,
  },
});

// Add RxDB-specific keywords that Ajv should ignore
const rxdbKeywords = [
  'version',
  'keyCompression',
  'primaryKey',
  'indexes',
  'encrypted',
  'final',
  'sharding',
  'internalIndexes',
  'attachments',
  'ref',
  'crdt',
];

for (const keyword of rxdbKeywords) {
  ajv.addKeyword(keyword);
}

// Add formats (date-time, email, uri, etc.)
addFormats(ajv);

// Schema definitions with IDs for standalone code generation
const schemaDefinitions = [
  { id: 'settings', name: 'validateSettings', schema: settingsSchema },
  { id: 'day', name: 'validateDay', schema: daySchema },
  { id: 'message', name: 'validateMessage', schema: messageSchema },
  { id: 'summary', name: 'validateSummary', schema: summarySchema },
  { id: 'note', name: 'validateNote', schema: noteSchema },
  { id: 'embedding', name: 'validateEmbedding', schema: embeddingSchema },
];

// Compile all schemas with $id for standalone code generation
const exportMap: Record<string, string> = {};

for (const { id, name, schema } of schemaDefinitions) {
  const schemaWithId = { ...schema, $id: id };
  ajv.compile(schemaWithId);
  exportMap[name] = id;
}

// Generate standalone code for all validators
let moduleCode = standaloneCode(ajv, exportMap);

// Post-process: Convert CommonJS require() calls to ESM imports
// Ajv generates code like: const func2 = require("ajv/dist/runtime/ucs2length").default;
// We need to convert this to ESM imports for browser compatibility

// Collect all require statements and convert to imports
const requireRegex = /const (\w+) = require\("([^"]+)"\)\.default;/g;
const imports: string[] = [];
let match: RegExpExecArray | null;

while ((match = requireRegex.exec(moduleCode)) !== null) {
  const [fullMatch, varName, modulePath] = match;
  imports.push(`import ${varName} from "${modulePath}";`);
}

// Remove require statements and add imports at the top
moduleCode = moduleCode.replace(requireRegex, '');
moduleCode = moduleCode.replace('"use strict";', '');

// Add imports at the beginning
if (imports.length > 0) {
  moduleCode = imports.join('\n') + '\n' + moduleCode;
}

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

// Write the compiled validators
writeFileSync(outputFile, moduleCode);

console.log(`✓ Compiled ${schemaDefinitions.length} validators to ${outputFile}`);
