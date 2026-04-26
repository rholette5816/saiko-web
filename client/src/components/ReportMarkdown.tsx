import type { ReactElement } from "react";

interface Props {
  markdown: string;
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet-list"; items: string[] }
  | { type: "numbered-list"; items: string[] };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2).trim());
        i += 1;
      }
      blocks.push({ type: "bullet-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "numbered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(text: string): ReactElement {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, idx) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={idx}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={idx}>{part}</span>
        ),
      )}
    </>
  );
}

function renderBlock(block: Block, index: number): ReactElement {
  if (block.type === "h1") {
    return <h1 key={index} className="font-poppins font-bold text-2xl mt-6 mb-3 uppercase tracking-wide text-[#0d0f13]">{renderInline(block.text)}</h1>;
  }
  if (block.type === "h2") {
    return <h2 key={index} className="font-poppins font-bold text-xl mt-5 mb-2 uppercase tracking-wide text-[#0d0f13]">{renderInline(block.text)}</h2>;
  }
  if (block.type === "h3") {
    return <h3 key={index} className="font-poppins font-bold text-lg mt-4 mb-2 text-[#0d0f13]">{renderInline(block.text)}</h3>;
  }
  if (block.type === "bullet-list") {
    return (
      <ul key={index} className="list-disc list-inside mb-3 text-[#0d0f13]">
        {block.items.map((item, idx) => (
          <li key={idx} className="mb-1">{renderInline(item)}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "numbered-list") {
    return (
      <ol key={index} className="list-decimal list-inside mb-3 text-[#0d0f13]">
        {block.items.map((item, idx) => (
          <li key={idx} className="mb-1">{renderInline(item)}</li>
        ))}
      </ol>
    );
  }
  return <p key={index} className="mb-3 text-[#0d0f13]">{renderInline(block.text)}</p>;
}

export function ReportMarkdown({ markdown }: Props) {
  const blocks = parseBlocks(markdown);
  return <div className="text-[#0d0f13] leading-relaxed">{blocks.map((block, idx) => renderBlock(block, idx))}</div>;
}
