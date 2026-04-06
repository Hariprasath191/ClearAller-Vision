import { useEffect, useRef, useState } from "react";
import { MessageCircleMore, SendHorizonal, X } from "lucide-react";
import { api } from "../lib/api";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

export function SafetyChatWidget({
  userId,
  profileIds,
  lens
}: {
  userId?: string;
  profileIds: string[];
  lens: "packaged-food" | "cosmetic";
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatScope, setChatScope] = useState<"selected" | "all">("all");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi! I'm answering for all saved profiles by default. Switch to 'Selected' above to narrow it. Ask me about any product, ingredient, or allergen."
    }
  ]);

  const historyRef = useRef<ChatMessage[]>(messages);
  historyRef.current = messages;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (!userId) {
      setMessages((m) => [...m,
        { role: "user", text: trimmed },
        { role: "assistant", text: "Your account is still loading — please wait a moment and try again." }
      ]);
      setInput("");
      return;
    }

    if (chatScope === "selected" && profileIds.length === 0) {
      setMessages((m) => [...m,
        { role: "user", text: trimmed },
        { role: "assistant", text: "No profiles selected on the page. Select a profile or switch to 'All profiles'." }
      ]);
      setInput("");
      return;
    }

    const updated = [...historyRef.current, { role: "user" as const, text: trimmed }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<{ reply: string }>("/api/chat", {
        userId,
        scope: chatScope,
        profileIds: chatScope === "selected" ? profileIds : [],
        messages: updated.slice(-10)
      });
      setMessages((m) => [...m, { role: "assistant", text: res.data.reply }]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't reach the AI service. Please try again.";
      setMessages((m) => [...m, { role: "assistant", text: msg }]);
    } finally {
      setLoading(false);
    }
  }

  const quickPrompts =
    lens === "cosmetic"
      ? ["Is this fragrance safe?", "Good for dry skin?", "Paraben-free alternatives?"]
      : ["Hidden gluten in this?", "Safe for nut allergy?", "What does moderate risk mean?"];

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col-reverse items-end gap-3 sm:bottom-6 sm:right-6">
      {/* FAB */}
      <button onClick={() => setOpen((o) => !o)} className="chat-fab" aria-label="Open safety chat">
        <MessageCircleMore size={17} />
        Safety chat
      </button>

      {/* Popup */}
      {open && (
        <div
          className="chat-popup animate-in"
          style={{
            width: "min(390px, calc(100vw - 2rem))",
            height: "min(560px, calc(100vh - 5rem))",
            maxHeight: "calc(100vh - 5rem)"
          }}
        >
          {/* Header */}
          <div className="chat-header">
            <div>
              <p className="eyebrow" style={{ marginBottom: 3 }}>Safety assistant</p>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--c-text)", lineHeight: 1 }}>
                AI chat · profile-aware
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                width: 30, height: 30, borderRadius: 7,
                border: "1px solid var(--c-border)",
                background: "var(--c-raised)",
                display: "grid", placeItems: "center",
                color: "var(--c-text-sub)", flexShrink: 0
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Scope selector */}
          <div className="chat-scope-bar">
            <p style={{ fontSize: "0.68rem", color: "var(--c-text-dim)", marginBottom: "0.375rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Answer scope
            </p>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button className={`scope-btn ${chatScope === "all" ? "active" : ""}`} onClick={() => setChatScope("all")}>
                All profiles
              </button>
              <button className={`scope-btn ${chatScope === "selected" ? "active" : ""}`} onClick={() => setChatScope("selected")}>
                Selected profiles
              </button>
            </div>
            {chatScope === "selected" && (
              <p style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "var(--c-text-dim)" }}>
                {profileIds.length
                  ? `${profileIds.length} profile${profileIds.length > 1 ? "s" : ""} selected`
                  : "No profiles selected on the page."}
              </p>
            )}
          </div>

          {/* Disclaimer */}
          <div style={{
            margin: "0.5rem 1rem 0",
            padding: "0.4rem 0.7rem",
            background: "var(--c-blue-bg)",
            border: "1px solid var(--c-blue-border)",
            borderRadius: 9,
            fontSize: "0.72rem",
            color: "var(--c-text-sub)",
            lineHeight: 1.55,
            flexShrink: 0
          }}>
            ⚕ Educational only. Severe reactions or treatment decisions require a licensed doctor.
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="bubble thinking">Thinking<span className="blink">…</span></div>}
            <div ref={endRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
              {quickPrompts.map((p) => (
                <button key={p} className="quick-chip" onClick={() => setInput(p)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="chat-input-row">
              <textarea
                className="chat-textarea"
                value={input}
                placeholder="Ask about a product or ingredient…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                className="chat-send-btn"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                aria-label="Send"
              >
                <SendHorizonal size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}