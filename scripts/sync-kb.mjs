#!/usr/bin/env node
/**
 * Combines all individual Markdown fact cards in knowledge-base/cards/*.md
 * into a single knowledge-base/KNOWLEDGE_BASE.md file ready to upload
 * to any custom AI chatbot / RAG platform.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbDir = join(__dirname, '..', 'knowledge-base');
const cardsDir = join(kbDir, 'cards');
const outFile = join(kbDir, 'KNOWLEDGE_BASE.md');

const header = `# ცუცხვათის სკოლის ცოდნის ბაზა (ფაქტის ბარათები) | Tsutskhvati School Knowledge Base (Fact Cards)

> **მნიშვნელოვანი შენიშვნა / Important Notice:**  
> ეს დოკუმენტი წარმოადგენს **„მღვიმის დამხმარის“ (Cave Helper)** ერთადერთ ოფიციალურ წყაროს.  
> ამჟამინდელი სტატუსი: **სამუშაო ვერსია – მასწავლებლის შესამოწმებლად (Draft – For Teacher Review)**.  
> ყველა ველი, რომელიც მონიშნულია როგორც \`[მასწავლებლის შესავსები ...]\` ან \`[TEACHER TO VERIFY ...]\`, ჩათბოტმა უნდა ჩათვალოს ჯერ შეუვსებელ ინფორმაციად და უპასუხოს სტანდარტული ფრაზით, სანამ მასწავლებელი ზუსტ მონაცემს არ ჩაწერს.

---

`;

const files = readdirSync(cardsDir)
  .filter((f) => f.endsWith('.md'))
  .sort();

const sections = files.map((file) => readFileSync(join(cardsDir, file), 'utf8').trim());
writeFileSync(outFile, header + sections.join('\n\n---\n\n') + '\n', 'utf8');
console.log(`Synced ${files.length} fact cards -> ${outFile}`);

const jsonPath = join(kbDir, 'fact-cards.json');
const inlineJsPath = join(kbDir, 'fact-cards-inline.js');
const jsonRaw = readFileSync(jsonPath, 'utf8').trim();
writeFileSync(
  inlineJsPath,
  `// Auto-generated from fact-cards.json so index.html also works offline via file://\nwindow.__INLINE_FACT_CARDS__ = ${jsonRaw};\n`,
  'utf8'
);
console.log(`Synced offline fallback -> ${inlineJsPath}`);
