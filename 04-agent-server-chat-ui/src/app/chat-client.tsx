"use client";

import { Chat } from "@cognipeer/chat-ui";
import "@cognipeer/chat-ui/styles.css";

// With two or more `models` on the agent, Chat shows the ModelPicker next to the send button by itself and sends the
// pick as `model` with every message. `showAnsweredWith` (default true) adds "Answered with <model>" under answers.
export default function ChatClient({ agentId }: { agentId: string }) {
  return (
    <div style={{ height: "100vh" }}>
      <Chat baseUrl="/api/agents" agentId={agentId} showAnsweredWith />
    </div>
  );
}
