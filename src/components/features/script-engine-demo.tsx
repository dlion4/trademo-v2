"use client";

import { useMemo, useState } from "react";

import { DemoLabel, DemoPanel } from "@/components/features/module-shell";
import type {
  SandboxApiDTO,
  SandboxLimitDTO,
} from "@/lib/api/types";

type TokenKind = "kw" | "str" | "num" | "com" | "fn" | "op" | "plain";

interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "if",
  "else",
  "return",
  "function",
  "null",
  "true",
  "false",
  "new",
  "for",
  "while",
]);

const BUILTINS = new Set([
  "onTick",
  "onResult",
  "onComplete",
  "getTicks",
  "getSMA",
  "getEMA",
  "getRSI",
  "getMACD",
  "getBollingerBands",
  "getStochastic",
  "getOpenContracts",
  "getBalance",
  "getHistory",
  "getLastResult",
  "log",
  "Math",
  "toFixed",
]);

/** Tiny deterministic JS tokenizer — enough for a syntax-highlighted preview. */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < line.length) {
    const rest = line.slice(index);

    const comment = /^\/\/.*/.exec(rest);
    if (comment) {
      tokens.push({ text: comment[0], kind: "com" });
      break;
    }

    const space = /^\s+/.exec(rest);
    if (space) {
      tokens.push({ text: space[0], kind: "plain" });
      index += space[0].length;
      continue;
    }

    const str = /^("[^"]*"|'[^']*')/.exec(rest);
    if (str) {
      tokens.push({ text: str[0], kind: "str" });
      index += str[0].length;
      continue;
    }

    const num = /^\d+(\.\d+)?/.exec(rest);
    if (num) {
      tokens.push({ text: num[0], kind: "num" });
      index += num[0].length;
      continue;
    }

    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word) {
      const text = word[0];
      const kind: TokenKind = KEYWORDS.has(text)
        ? "kw"
        : BUILTINS.has(text)
          ? "fn"
          : "plain";
      tokens.push({ text, kind });
      index += text.length;
      continue;
    }

    const op = /^[^\w\s]+/.exec(rest);
    if (op) {
      tokens.push({ text: op[0], kind: "op" });
      index += op[0].length;
      continue;
    }

    tokens.push({ text: rest[0], kind: "plain" });
    index += 1;
  }

  return tokens;
}

function CodeEditor({ fileName, code }: { fileName: string; code: string }) {
  const lines = useMemo(() => code.split("\n"), [code]);

  return (
    <div className="editor">
      <div className="editor__tabs">
        <button type="button" className="editor__tab is-active">
          {fileName}
        </button>
        <button type="button" className="editor__tab">
          martingale.js
        </button>
        <button type="button" className="editor__tab">
          oscar-grind.js
        </button>
        <button type="button" className="editor__tab">
          fixed-stake.js
        </button>
      </div>
      <div className="editor__scroll">
        <div className="editor__inner">
          <div className="editor__gutter">
            {lines.map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <div className="editor__code">
            {lines.map((line, index) => (
              <div key={index}>
                {tokenize(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={token.kind === "plain" ? undefined : `tok-${token.kind}`}>
                    {token.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScriptEngineDemo({
  demo,
}: {
  demo: Extract<import("@/lib/api/types").FeatureDemoDTO, { kind: "scriptEngine" }>;
}) {
  const [tab, setTab] = useState<"editor" | "api" | "safety">("editor");

  return (
    <DemoPanel title={`script-engine · ${demo.fileName}`}>
      <div className="editor__tabs mb-4">
        <button
          type="button"
          className={`editor__tab${tab === "editor" ? " is-active" : ""}`}
          onClick={() => setTab("editor")}
        >
          strategy.js
        </button>
        <button
          type="button"
          className={`editor__tab${tab === "api" ? " is-active" : ""}`}
          onClick={() => setTab("api")}
        >
          sandbox api
        </button>
        <button
          type="button"
          className={`editor__tab${tab === "safety" ? " is-active" : ""}`}
          onClick={() => setTab("safety")}
        >
          vm safety
        </button>
      </div>

      {tab === "editor" ? (
        <>
          <CodeEditor fileName={demo.fileName} code={demo.code} />
          <p className="demo__hint">
            Scripts return a trade decision object — <span className="mono">contract</span>,{" "}
            <span className="mono">stake</span>, <span className="mono">duration</span>,{" "}
            <span className="mono">durationUnit</span> — or <span className="mono">null</span> to skip
            the tick.
          </p>
        </>
      ) : null}

      {tab === "api" ? (
        <>
          <DemoLabel>Available inside the sandbox</DemoLabel>
          <div className="api">
            {demo.api.map((item: SandboxApiDTO) => (
              <div className="api__row" key={item.signature}>
                <span className="api__sig">{item.signature}</span>
                <span className="api__desc">{item.description}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "safety" ? (
        <>
          <DemoLabel>Sandbox hard limits</DemoLabel>
          <div className="limits">
            {demo.limits.map((limit: SandboxLimitDTO) => (
              <div className="limit" key={limit.key}>
                <div className="limit__value">{limit.value}</div>
                <div className="limit__key">{limit.label}</div>
              </div>
            ))}
          </div>
          <p className="demo__hint">
            Scripts run in an isolated-vm context with no filesystem, network or process access.
            Execution is aborted and the bot paused if a tick exceeds the time budget.
          </p>
        </>
      ) : null}
    </DemoPanel>
  );
}
