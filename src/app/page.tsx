"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: number;
  username: string;
  text: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("anon");

  // Autoscroll down
  const chatRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // Loading + realtime
  useEffect(() => {
    async function getMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data);
      }
    }

    getMessages();

    const channel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        },
      )
      .subscribe(() => {});

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function sendMessage() {
    if (!message.trim()) return;

    await supabase.from("messages").insert({
      username,
      text: message,
    });

    setMessage("");
  }

  // ----------------------------------------
  //  MAIN CHAT
  // ----------------------------------------
  return (
    <main className="h-dvh bg-black text-green-400 p-4 flex flex-col overflow-hidden">
      <h1 className="text-2xl mb-4">Kavun Chat</h1>

      <input
        className="bg-black border border-green-400 p-2 mb-4"
        placeholder="username..."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      {/* CHAT CONTAINER */}
      <div className="border border-green-400 flex-1 mb-4 flex flex-col overflow-hidden">
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-2 pr-3 hide-scrollbar font-mono text-sm leading-relaxed"
        >
          {messages.map((msg) => (
            <div key={msg.id} className="mb-1 wrap-break-words">
              <span className="text-green-300">{msg.username}</span>
              <span className="text-green-500">: </span>
              <span className="text-green-100">{msg.text}</span>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* INPUT CONTAINER */}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-black border border-green-400 p-2 outline-none"
          placeholder="message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />

        <button className="border border-green-400 px-4" onClick={sendMessage}>
          send
        </button>
      </div>
    </main>
  );
}
