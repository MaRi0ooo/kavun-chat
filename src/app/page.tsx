"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: number;
  text: string;
  created_at: string;
  profiles: {
    username: string;
  }[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [authMode, setAuthMode] = useState<
    "loading" | "login" | "register" | "ok"
  >("loading");

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAuthMode("login");
      } else {
        setAuthMode("ok");
      }
    }

    checkSession();
  }, []);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Autoscroll
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
        .select(
          `
          id,
          text,
          created_at,
          profiles (
            username
          )
          `,
        )
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data as Message[]);
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
        () => {
          getMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function sendMessage() {
    const now = Date.now();

    // cooldown 1.5 sec
    if (now - lastMessageTime < 1500) return;

    // empty
    if (!message.trim()) return;

    // maxs length
    if (message.length > 200) return;

    // duplicate spam
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.text === message) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !message.trim()) return;

    await supabase.from("messages").insert({
      user_id: user.id,
      text: message,
    });

    setMessage("");
    setLastMessageTime(now);
  }

  function LoginForm({
    onSuccess,
    switchToRegister,
  }: {
    onSuccess: () => void;
    switchToRegister: () => void;
  }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function login() {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) onSuccess();
    }

    return (
      <div>
        <div className="mb-2">LOGIN:</div>

        <input
          className="bg-black border border-green-400 w-full p-2 mb-2"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="bg-black border border-green-400 w-full p-2 mb-2"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="border border-green-400 w-full p-2 mb-2"
          onClick={login}
        >
          ENTER
        </button>

        <button className="text-green-300" onClick={switchToRegister}>
          register
        </button>
      </div>
    );
  }

  //////////////////////////////////////////////////////////////// HTML ////////////////////////////////////////////////////////////////

  if (authMode !== "ok") {
    return (
      <main className="h-dvh bg-black text-green-400 p-4 font-mono flex items-center justify-center">
        <div className="border border-green-400 p-6 w-100px">
          <div className="mb-4 text-green-300">KAVUN CHAT TERMINAL v1.0</div>

          {authMode === "login" && (
            <LoginForm
              onSuccess={() => setAuthMode("ok")}
              switchToRegister={() => setAuthMode("register")}
            />
          )}

          {authMode === "register" && (
            <RegisterForm
              onSuccess={() => setAuthMode("ok")}
              switchToLogin={() => setAuthMode("login")}
            />
          )}
        </div>
      </main>
    );
  }

  function RegisterForm({
    onSuccess,
    switchToLogin,
  }: {
    onSuccess: () => void;
    switchToLogin: () => void;
  }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");

    async function register() {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error || !data.user) return;

      await supabase.from("profiles").insert({
        id: data.user.id,
        username,
      });

      onSuccess();
    }

    return (
      <div>
        <div className="mb-2">REGISTER:</div>

        <input
          className="bg-black border border-green-400 w-full p-2 mb-2"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="bg-black border border-green-400 w-full p-2 mb-2"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="bg-black border border-green-400 w-full p-2 mb-2"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="border border-green-400 w-full p-2 mb-2"
          onClick={register}
        >
          CREATE USER
        </button>

        <button className="text-green-300" onClick={switchToLogin}>
          login
        </button>
      </div>
    );
  }

  // ----------------------------------------
  //  MAIN CHAT
  // ----------------------------------------
  return (
    <main className="h-dvh bg-black text-green-400 p-4 flex flex-col overflow-hidden">
      <h1 className="text-2xl mb-4">Kavun Chat</h1>

      {/* CHAT */}
      <div className="border border-green-400 flex-1 mb-4 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 hide-scrollbar font-mono text-sm">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-1 wrap-break-words">
              <span className="text-green-300">
                {msg.profiles?.[0]?.username || "Anon"}
              </span>
              <span className="text-green-500">: </span>
              <span className="text-green-100">{msg.text}</span>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* INPUT */}
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
