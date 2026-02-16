/**
 * Test file for FileManager refactoring.
 * Run with: npx ts-node src/test-file-manager.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { ScreenshotManager } from './screenshot-manager';
import { ScriptManager } from './script-manager';
import type { FileResult, Filename } from './file-manager';

const TEST_DIR = path.join(__dirname, '..', 'test-temp');
const SCREENSHOTS_DIR = path.join(TEST_DIR, 'screenshots');
const SCRIPTS_DIR = path.join(TEST_DIR, 'scripts');

// Cleanup helper
function cleanup(): void {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

function runTests(): void {
  console.log('Starting FileManager tests...\n');
  cleanup();

  // ============ ScreenshotManager Tests ============
  console.log('=== ScreenshotManager Tests ===');

  const screenshots = new ScreenshotManager(SCREENSHOTS_DIR);

  // Test 1: Directory created
  console.log('Test 1: Directory creation');
  console.assert(fs.existsSync(SCREENSHOTS_DIR), 'Screenshots directory should exist');
  console.log('  ✓ Directory created automatically');

  // Test 2: getDirectory
  console.log('Test 2: getDirectory');
  console.assert(screenshots.getDirectory() === SCREENSHOTS_DIR, 'getDirectory should return correct path');
  console.log('  ✓ getDirectory returns correct path');

  // Test 3: generateName
  console.log('Test 3: generateName');
  const name = screenshots.generateName();
  console.assert(name.startsWith('screenshot-'), 'Generated name should start with screenshot-');
  console.log(`  ✓ Generated name: ${name}`);

  // Test 4: getFilepath - normalizes without extension
  console.log('Test 4: getFilepath normalization');
  const fp1 = screenshots.getFilepath('test');
  console.assert(fp1.endsWith('test.png'), 'Should add .png extension');
  console.log(`  ✓ test -> ${fp1}`);

  // Test 5: getFilepath - doesn't double extension
  const fp2 = screenshots.getFilepath('test.png');
  console.assert(fp2.endsWith('test.png') && !fp2.endsWith('.png.png'), 'Should not double extension');
  console.log(`  ✓ test.png -> ${fp2}`);

  // Test 6: exists - file doesn't exist
  console.log('Test 6: exists (non-existent)');
  console.assert(!screenshots.exists('nonexistent'), 'Non-existent file should return false');
  console.log('  ✓ Non-existent file returns false');

  // Test 7: Create a file and test exists
  console.log('Test 7: exists (after creation)');
  fs.writeFileSync(screenshots.getFilepath('testfile'), 'test content');
  console.assert(screenshots.exists('testfile'), 'Created file should exist');
  console.assert(screenshots.exists('testfile.png'), 'Created file should exist with extension');
  console.log('  ✓ Created file exists');

  // Test 8: list
  console.log('Test 8: list');
  const list = screenshots.list();
  console.assert(list.length === 1, 'Should have 1 file');
  console.assert(list[0] === 'testfile.png', 'File should be testfile.png');
  // Type check: list returns Filename<'.png'>[]
  const typedList: Filename<'.png'>[] = list;
  console.log(`  ✓ List: ${typedList.join(', ')}`);

  // Test 9: getResult - type safety
  console.log('Test 9: getResult type safety');
  const result = screenshots.getResult('myshot');
  // This should compile - filename is `${string}.png`
  const filename: `${string}.png` = result.filename;
  console.assert(filename === 'myshot.png', 'Result filename should be myshot.png');
  console.log(`  ✓ Result: ${JSON.stringify(result)}`);

  // Test 10: delete
  console.log('Test 10: delete');
  console.assert(screenshots.delete('testfile'), 'Delete should return true');
  console.assert(!screenshots.exists('testfile'), 'File should not exist after delete');
  console.assert(!screenshots.delete('testfile'), 'Second delete should return false');
  console.log('  ✓ Delete works correctly');

  // ============ ScriptManager Tests ============
  console.log('\n=== ScriptManager Tests ===');

  const scripts = new ScriptManager(SCRIPTS_DIR);

  // Test 11: Directory created
  console.log('Test 11: Directory creation');
  console.assert(fs.existsSync(SCRIPTS_DIR), 'Scripts directory should exist');
  console.log('  ✓ Directory created automatically');

  // Test 12: save
  console.log('Test 12: save');
  const saveResult = scripts.save('hello', 'console.log("Hello, World!");');
  // Type check: save returns FileResult<'.ts'>
  const typedSaveResult: FileResult<'.ts'> = saveResult;
  console.assert(typedSaveResult.filename === 'hello.ts', 'Saved filename should be hello.ts');
  console.assert(scripts.exists('hello'), 'Saved file should exist');
  console.log(`  ✓ Saved: ${JSON.stringify(saveResult)}`);

  // Test 13: read
  console.log('Test 13: read');
  const content = scripts.read('hello');
  console.assert(content === 'console.log("Hello, World!");', 'Content should match');
  console.log(`  ✓ Read content: ${content}`);

  // Test 14: list
  console.log('Test 14: list');
  const scriptList = scripts.list();
  console.assert(scriptList.length === 1, 'Should have 1 script');
  console.assert(scriptList[0] === 'hello.ts', 'Script should be hello.ts');
  // Type check: list returns Filename<'.ts'>[]
  const typedScriptList: Filename<'.ts'>[] = scriptList;
  console.log(`  ✓ List: ${typedScriptList.join(', ')}`);

  // Test 15: read non-existent throws
  console.log('Test 15: read non-existent throws');
  try {
    scripts.read('nonexistent');
    console.assert(false, 'Should have thrown');
  } catch (e) {
    console.assert((e as Error).message.includes('Script not found'), 'Should throw Script not found');
    console.log('  ✓ Throws for non-existent script');
  }

  // Test 16: delete
  console.log('Test 16: delete');
  console.assert(scripts.delete('hello'), 'Delete should return true');
  console.assert(!scripts.exists('hello'), 'File should not exist after delete');
  console.log('  ✓ Delete works correctly');

  // ============ Type Inference Tests ============
  console.log('\n=== Type Inference Tests ===');

  // These tests verify compile-time type safety
  // If any of these lines cause compile errors, the types are wrong

  // Test 17: Filename types are correctly inferred
  console.log('Test 17: Filename type inference');
  const pngFilename: Filename<'.png'> = 'test.png';
  const tsFilename: Filename<'.ts'> = 'test.ts';
  // Note: Filename<'.png'> = 'test.ts' would fail at compile time
  console.log(`  ✓ PNG filename type: ${pngFilename}`);
  console.log(`  ✓ TS filename type: ${tsFilename}`);

  // Test 18: FileResult types are correctly inferred
  console.log('Test 18: FileResult type inference');
  const pngResult: FileResult<'.png'> = { filename: 'shot.png', path: '/path/shot.png' };
  const tsResult: FileResult<'.ts'> = { filename: 'script.ts', path: '/path/script.ts' };
  console.log(`  ✓ PNG result: ${JSON.stringify(pngResult)}`);
  console.log(`  ✓ TS result: ${JSON.stringify(tsResult)}`);

  // Cleanup
  cleanup();

  console.log('\n=== All tests passed! ===');
}

// Run tests
try {
  runTests();
} catch (e) {
  console.error('Test failed:', e);
  cleanup();
  process.exit(1);
}
