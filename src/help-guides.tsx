import type { ReactNode } from "react";

import customSources from "../docs/user-guide/custom-sources.md?raw";
import manageAddons from "../docs/user-guide/manage-addons.md?raw";
import permissions from "../docs/user-guide/permissions.md?raw";
import quickStart from "../docs/user-guide/quick-start.md?raw";
import troubleshooting from "../docs/user-guide/troubleshooting.md?raw";

export type HelpGuide = {
  id: string;
  title: string;
  content: string;
};

export const helpGuides: HelpGuide[] = [
  { id: "quick-start", title: "快速开始", content: quickStart },
  { id: "manage-addons", title: "管理插件", content: manageAddons },
  { id: "custom-sources", title: "添加自定义控件源", content: customSources },
  { id: "permissions", title: "恢复 WPS 目录访问权限", content: permissions },
  { id: "troubleshooting", title: "故障排除", content: troubleshooting }
];

const guideIdByFileName: Record<string, string> = {
  "quick-start.md": "quick-start",
  "manage-addons.md": "manage-addons",
  "custom-sources.md": "custom-sources",
  "permissions.md": "permissions",
  "troubleshooting.md": "troubleshooting"
};

function renderInline(text: string, onNavigate: (id: string) => void): ReactNode[] {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (!link) return part;
    const [, label, href] = link;
    const guideId = guideIdByFileName[href.replace(/^\.\//, "")];
    if (guideId) {
      return <button key={index} type="button" onClick={() => onNavigate(guideId)} className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 dark:text-brand-300">{label}</button>;
    }
    return <a key={index} href={href} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 dark:text-brand-300">{label}</a>;
  });
}

export function MarkdownDocument({ content, onNavigate }: { content: string; onNavigate: (id: string) => void }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const [, hashes, text] = heading;
      const className = hashes.length === 1 ? "text-2xl font-bold tracking-tight" : hashes.length === 2 ? "mt-7 text-lg font-bold" : "mt-5 text-base font-bold";
      const Tag = (`h${hashes.length}`) as "h1" | "h2" | "h3";
      blocks.push(<Tag key={index} className={className}>{renderInline(text, onNavigate)}</Tag>);
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const start = ++index;
      while (index < lines.length && !lines[index].startsWith("```")) index += 1;
      blocks.push(<pre key={start} className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code data-language={language || undefined}>{lines.slice(start, index).join("\n")}</code></pre>);
      index += 1;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    if (ordered || unordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      const expression = isOrdered ? /^\d+\.\s+(.+)$/ : /^-\s+(.+)$/;
      while (index < lines.length) {
        const item = lines[index].match(expression);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      const Tag = isOrdered ? "ol" : "ul";
      blocks.push(<Tag key={index} className={`my-3 space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200 ${isOrdered ? "list-decimal" : "list-disc"}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, onNavigate)}</li>)}</Tag>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^```|^\d+\.\s+|^-\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={index} className="my-3 text-sm leading-7 text-slate-700 dark:text-slate-200">{renderInline(paragraph.join(" "), onNavigate)}</p>);
  }

  return <>{blocks}</>;
}
