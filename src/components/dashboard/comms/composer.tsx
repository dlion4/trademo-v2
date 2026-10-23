"use client";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import {
  audiencePlan,
  messageSchema,
  personalize,
  safeHref,
  variables,
} from "@/lib/comms/model";
import {
  channels,
  type Audience,
  type CommsBundle,
  type MessageContent,
} from "@/lib/comms/types";
export type ComposeAction =
  "review" | "draft" | "schedule" | "template" | "preview";
export function RichText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] => {
    const pattern = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: ReactNode[] = [];
    let end = 0;
    for (const m of line.matchAll(pattern)) {
      parts.push(line.slice(end, m.index));
      parts.push(
        m[1] ? (
          <strong key={m.index}>{m[1]}</strong>
        ) : m[2] ? (
          <em key={m.index}>{m[2]}</em>
        ) : safeHref(m[4]) ? (
          <a
            key={m.index}
            href={m[4]}
            target={m[4].startsWith("https:") ? "_blank" : undefined}
            rel="noopener noreferrer"
          >
            {m[3]}
          </a>
        ) : (
          m[0]
        ),
      );
      end = m.index! + m[0].length;
    }
    parts.push(line.slice(end));
    return parts;
  };
  return (
    <div className="co-richtext">
      {text.split(/\n\n+/).map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^[-*] /.test(line)))
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.slice(2))}</li>
              ))}
            </ul>
          );
        if (lines.every((line) => /^\d+\. /.test(line)))
          return (
            <ol key={i}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        return <p key={i}>{inline(block)}</p>;
      })}
    </div>
  );
}
export function AudiencePicker({
  data,
  value,
  onChange,
}: {
  data: CommsBundle;
  value: Audience;
  onChange: (a: Audience) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <div className="co-audience">
      <label className="co-field">
        Recipient scope
        <select
          className="form-select"
          value={value.type}
          onChange={(e) =>
            onChange({ ...value, type: e.target.value as Audience["type"] })
          }
        >
          <option value="all">All investors</option>
          <option value="individual">Individual investors</option>
          <option value="packages">By package (union, no duplicates)</option>
        </select>
      </label>
      {value.type === "individual" && (
        <>
          <input
            className="form-control"
            aria-label="Find message recipient"
            placeholder="Find investor by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="co-recipient-list">
            {data.contacts
              .filter((c) =>
                `${c.name} ${c.id}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((c) => (
                <label className="co-check" key={c.id}>
                  <input
                    type="checkbox"
                    checked={value.ids.includes(c.id)}
                    onChange={() =>
                      onChange({
                        ...value,
                        ids: value.ids.includes(c.id)
                          ? value.ids.filter((id) => id !== c.id)
                          : [...value.ids, c.id],
                      })
                    }
                  />
                  <span>
                    {c.name}
                    <small>
                      {c.status.replaceAll("_", " ")} ·{" "}
                      {c.packages.join(", ") || "No active package"}
                    </small>
                  </span>
                </label>
              ))}
          </div>
          {!data.contacts.some((c) =>
            `${c.name} ${c.id}`.toLowerCase().includes(search.toLowerCase()),
          ) && (
            <small className="co-muted">
              No investor matches. Clear the search to restore the directory.
            </small>
          )}
        </>
      )}
      {value.type === "packages" && (
        <div className="co-package-options">
          {data.pools.map((p) => (
            <label className="co-check" key={p.code}>
              <input
                type="checkbox"
                checked={value.packages.includes(p.code)}
                onChange={() =>
                  onChange({
                    ...value,
                    packages: value.packages.includes(p.code)
                      ? value.packages.filter((c) => c !== p.code)
                      : [...value.packages, p.code],
                  })
                }
              />
              {p.code} · {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
export function ContentEditor({
  subject,
  body,
  onChange,
}: {
  subject: string;
  body: string;
  onChange: (patch: { subject?: string; body?: string }) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [link, setLink] = useState(false);
  const [href, setHref] = useState("");
  const [label, setLabel] = useState("");
  function insert(prefix: string, suffix = "") {
    const el = area.current,
      start = el?.selectionStart ?? body.length,
      end = el?.selectionEnd ?? body.length;
    onChange({
      body:
        body.slice(0, start) +
        prefix +
        body.slice(start, end) +
        suffix +
        body.slice(end),
    });
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(
        start + prefix.length,
        end + prefix.length,
      );
    });
  }
  return (
    <>
      <label className="co-field">
        Subject
        <input
          className="form-control"
          aria-label="Subject"
          minLength={3}
          maxLength={120}
          required
          value={subject}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
        <small>
          {subject.length}/120 · personalized subjects must also fit 120
          characters
        </small>
      </label>
      <div className="co-editor">
        <div className="co-editor-toolbar" aria-label="Message formatting">
          <button
            type="button"
            title="Bold selection"
            aria-label="Bold selection"
            onClick={() => insert("**", "**")}
          >
            <b>B</b>
          </button>
          <button
            type="button"
            title="Italic selection"
            aria-label="Italic selection"
            onClick={() => insert("_", "_")}
          >
            <i>I</i>
          </button>
          <button type="button" onClick={() => insert("\n- ")}>
            • List
          </button>
          <button type="button" onClick={() => insert("\n1. ")}>
            1. List
          </button>
          <button type="button" onClick={() => setLink(!link)}>
            Insert link
          </button>
          <span>Safe Markdown · no raw HTML</span>
        </div>
        {link && (
          <div className="co-link-editor">
            <input
              className="form-control"
              aria-label="Link label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <input
              className="form-control"
              aria-label="HTTPS or dashboard link"
              value={href}
              onChange={(e) => setHref(e.target.value)}
            />
            <button
              type="button"
              className="co-btn"
              disabled={
                !label.trim() || !safeHref(href) || /[\[\]\n]/.test(label)
              }
              onClick={() => {
                insert(`[${label}](${href})`);
                setLink(false);
                setHref("");
                setLabel("");
              }}
            >
              Insert link
            </button>
            <small>
              Use an HTTPS URL or a /dashboard/ route. No scripts, data URLs or
              tracking pixels.
            </small>
          </div>
        )}
        <label className="co-field co-editor-label">
          Message body
          <textarea
            aria-label="Message body"
            ref={area}
            className="form-control"
            rows={9}
            minLength={10}
            maxLength={10000}
            required
            value={body}
            onChange={(e) => onChange({ body: e.target.value })}
          />
        </label>
        <div className="co-variable-bar">
          <span>Personalize</span>
          {variables.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => insert(`{${v}}`)}
            >{`{${v}}`}</button>
          ))}
          <small>{body.length}/10,000</small>
        </div>
      </div>
    </>
  );
}
export function MessagePreview({
  data,
  content,
  contactId,
}: {
  data: CommsBundle;
  content: Pick<MessageContent, "subject" | "body" | "audience">;
  contactId: string;
}) {
  const c = data.contacts.find((c) => c.id === contactId) ?? data.contacts[0];
  let rendered: { subject: string; body: string } | null = null;
  let error = "";
  try {
    rendered = personalize(content.subject, content.body, c, content.audience);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to render content.";
  }
  if (!rendered)
    return (
      <div className="co-error" role="alert">
        {error}
      </div>
    );
  return (
    <article className="co-message-preview">
      <div>
        <span className="co-tag">PERSONALIZED PREVIEW</span>
        <small>{c.name} · synthetic context</small>
      </div>
      <h3>{rendered.subject}</h3>
      <RichText text={rendered.body} />
      <footer>
        Preview only. Financial variables are whole-investor totals, including
        in package-scoped messages. Package/start-date variables use the
        selected holding. Values are independent demo roster figures, not
        audited settlement data.
      </footer>
    </article>
  );
}
export function MessageComposer({
  data,
  defaults,
  onAction,
}: {
  data: CommsBundle;
  defaults: MessageContent;
  onAction: (v: MessageContent, action: ComposeAction) => void;
}) {
  const intent = useRef<ComposeAction>("review");
  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: messageSchema },
    onSubmit: ({ value }) => onAction(value, intent.current),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(s) => s.values}>
        {(v) => {
          const plan = audiencePlan(data, v);
          return (
            <>
              <div className="co-compose-grid">
                <div className="co-compose-targets">
                  <AudiencePicker
                    data={data}
                    value={v.audience}
                    onChange={(a) => form.setFieldValue("audience", a)}
                  />
                  <div className="co-channel-picker">
                    <span>Channels</span>
                    {channels.map((ch) => (
                      <label className="co-check" key={ch}>
                        <input
                          type="checkbox"
                          checked={v.channels.includes(ch)}
                          onChange={() =>
                            form.setFieldValue(
                              "channels",
                              v.channels.includes(ch)
                                ? v.channels.filter((c) => c !== ch)
                                : [...v.channels, ch],
                            )
                          }
                        />
                        <span>
                          {ch.replaceAll("_", " ")}
                          <small>
                            {data.channelConfig[ch].enabled
                              ? "Demo adapter enabled"
                              : "Adapter disabled — excluded"}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="co-recipient-summary">
                    <b>
                      {new Set(plan.rows.map((r) => r.contactId)).size} eligible
                      contacts
                    </b>
                    <span>{plan.rows.length} contact/channel pairs</span>
                    <small>
                      {plan.excluded.length} exclusions · consent and account
                      status enforced
                    </small>
                  </div>
                </div>
                <div className="co-compose-content">
                  <ContentEditor
                    subject={v.subject}
                    body={v.body}
                    onChange={(p) => {
                      if (p.subject !== undefined)
                        form.setFieldValue("subject", p.subject);
                      if (p.body !== undefined)
                        form.setFieldValue("body", p.body);
                    }}
                  />
                  <label className="co-check">
                    <input
                      type="checkbox"
                      checked={v.saveTemplate}
                      onChange={(e) =>
                        form.setFieldValue("saveTemplate", e.target.checked)
                      }
                    />
                    Also save this version as a new template
                  </label>
                  {v.saveTemplate && (
                    <label className="co-field mt-3">
                      New template name
                      <input
                        className="form-control"
                        aria-label="Subject"
                        minLength={3}
                        maxLength={60}
                        value={v.templateName}
                        onChange={(e) =>
                          form.setFieldValue("templateName", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.errors}>
        {(list) => (
          <div className="co-validation" role="status">
            {list.flat().map((e, i) => (
              <small className="text-loss" key={i}>
                {typeof e === "object" && e && "message" in e
                  ? String(e.message)
                  : String(e)}
              </small>
            ))}
          </div>
        )}
      </form.Subscribe>
      <div className="co-compose-footer">
        <span>
          Nothing leaves this browser workspace. Review audience and content
          before queuing a demo.
        </span>
        <div className="co-actions">
          {(
            [
              ["preview", "Personalized preview"],
              ["draft", "Save draft"],
              ["template", "Save as template"],
              ["schedule", "Schedule review"],
              ["review", "Review & queue"],
            ] as [ComposeAction, string][]
          ).map(([action, text]) => (
            <button
              type="submit"
              className={`co-btn ${action === "review" ? "co-primary" : ""}`}
              key={action}
              onClick={() => {
                intent.current = action;
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
