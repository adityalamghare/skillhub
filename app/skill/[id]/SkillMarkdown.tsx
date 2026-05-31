"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function SkillMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-6 text-gray-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const isBlock = !!match;
            return isBlock ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-md text-xs my-3"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className="px-1 py-0.5 rounded bg-gray-100 text-orange-700 text-[0.85em] font-mono" {...props}>
                {children}
              </code>
            );
          },
          h1: ({ children }) => <h1 className="text-lg font-semibold mt-5 mb-2 text-gray-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 text-gray-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-gray-900">{children}</h3>,
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li className="ml-2">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-300 pl-4 italic text-gray-600 my-3">{children}</blockquote>
          ),
          hr: () => <hr className="border-gray-200 my-4" />,
          a: ({ href, children }) => (
            <a href={href} className="text-indigo-600 underline hover:text-indigo-800" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
