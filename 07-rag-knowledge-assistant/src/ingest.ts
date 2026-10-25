/** Ingest every local markdown file in ./docs into the RAG module. */
import { readdir, readFile } from 'node:fs/promises';
import { client, fail, loadState } from './config.js';

const docsDir = new URL('../docs/', import.meta.url);

async function main() {
  const { moduleKey } = await loadState();
  const files = (await readdir(docsDir)).filter((f) => f.endsWith('.md'));

  for (const fileName of files) {
    const content = await readFile(new URL(fileName, docsDir), 'utf8');
    const res = await client.rag.ingest(moduleKey, {
      fileName,
      content,
      metadata: { source: 'handbook', topic: fileName.replace(/\.md$/, '') },
    });
    console.log(`${fileName}: ${res.document.status}, ${res.chunkCount ?? res.document.chunkCount ?? '?'} chunks`);
  }

  // Ingestion is synchronous by default (the call returns once the document is indexed), so this loop
  // normally ends at once. It matters if you pass `async: true` to ingest.
  for (let i = 0; i < 30; i++) {
    const { documents } = await client.rag.listDocuments(moduleKey, { limit: 100 });
    const busy = documents.filter((d) => d.status === 'pending' || d.status === 'processing');
    const failed = documents.filter((d) => d.status === 'failed');
    if (failed.length) {
      for (const d of failed) console.error(`FAILED ${d.fileName}: ${d.errorMessage ?? 'unknown error'}`);
      process.exit(1);
    }
    if (!busy.length) {
      console.log(`\nAll ${documents.length} documents indexed. Next: npm run query`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error('Timed out waiting for indexing; check Knowledge Engine -> Documents.');
  process.exit(1);
}

main().catch(fail);
