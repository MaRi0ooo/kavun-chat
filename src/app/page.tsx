"use client";

import { useEffect, useState } from "react";
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
          console.log("REALTIME EVENT:", payload);
          setMessages((current) => [...current, payload.new as Message]);
        },
      )
      .subscribe((status) => {
        console.log("SUBSCRIBE STATUS:", status);
      });

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

  return (
    <main className="h-screen bg-indigo-800 text-green-400 p-4 flex flex-col">
      <h1 className="text-2xl mb-4">Kavun Chat</h1>

      <input
        className="bg-black border border-green-400 p-2 mb-4"
        placeholder="username..."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <div className="border border-green-400 flex-1 p-2 mb-4 overflow-y-auto">
        {messages.map((msg) => (
          <p key={msg.id}>
            {msg.username}: {msg.text}
          </p>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-black border border-green-400 p-2 outline-none"
          placeholder="message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
        />

        <button className="border border-green-400 px-4" onClick={sendMessage}>
          send
        </button>
      </div>
    </main>
  );
}
