"use client";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
type Loader = {
  (modules: string[], success: () => void, error: (e: unknown) => void): void;
  config: (v: { paths: { vs: string } }) => void;
};
type EditorWindow = Window & { require?: Loader; monaco?: typeof Monaco };
let pending: Promise<typeof Monaco> | undefined;
function loadEditor() {
  if (!pending)
    pending = new Promise<typeof Monaco>((resolve, reject) => {
      const w = window as unknown as EditorWindow;
      const boot = () => {
        if (!w.require) {
          reject(Error("Local Monaco loader unavailable"));
          return;
        }
        w.require.config({ paths: { vs: "/api/bots/editor/vs" } });
        w.require(
          ["vs/editor/editor.main"],
          () =>
            w.monaco
              ? resolve(w.monaco)
              : reject(Error("Monaco did not initialize")),
          reject,
        );
      };
      if (w.monaco) return resolve(w.monaco);
      if (w.require) return boot();
      const script = document.createElement("script");
      script.src = "/api/bots/editor/vs/loader.js";
      script.onload = boot;
      script.onerror = () =>
        reject(Error("Could not load local Monaco assets"));
      document.head.append(script);
    });
  return pending;
}
export function ScriptEditor({
  code,
  onChange,
}: {
  code: string;
  onChange: (value: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    change = useRef(onChange),
    latest = useRef(code);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    change.current = onChange;
    latest.current = code;
  }, [code, onChange]);
  useEffect(() => {
    let canceled = false,
      editor: Monaco.editor.IStandaloneCodeEditor | undefined,
      subscription: Monaco.IDisposable | undefined;
    loadEditor()
      .then((m) => {
        if (canceled || !container.current) return;
        editor = m.editor.create(container.current, {
          value: latest.current,
          language: "javascript",
          theme: "vs",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 12,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          ariaLabel: "JavaScript strategy source",
          tabSize: 2,
        });
        subscription = editor.onDidChangeModelContent(() =>
          change.current(editor!.getValue()),
        );
        setReady(true);
      })
      .catch(() => {
        if (!canceled)
          setError(
            "Monaco could not initialize. The accessible source editor below remains fully usable.",
          );
      });
    return () => {
      canceled = true;
      subscription?.dispose();
      const model = editor?.getModel();
      editor?.dispose();
      model?.dispose();
    };
  }, []);
  return (
    <div className="bt-editor">
      <div
        ref={container}
        style={{ height: 360, display: ready ? "block" : "none" }}
        data-testid="monaco-strategy-editor"
      />
      {!ready && (
        <>
          <p className="bt-muted" role="status">
            {error || "Loading locally hosted Monaco editor…"}
          </p>
          <label className="bt-field">
            JavaScript strategy source
            <textarea
              aria-label="JavaScript strategy source"
              className="form-control bt-source"
              value={code}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
            />
          </label>
        </>
      )}
      <small className="bt-muted">
        Source is stored as text, never evaluated in this browser. Editor
        diagnostics are not a security or profitability review.
      </small>
    </div>
  );
}
