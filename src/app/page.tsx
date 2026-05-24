"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: number;
  text: string;
  created_at: string;
  profiles:
    | {
        username: string;
      }
    | {
        username: string;
      }[]
    | null;
};

// ----------------------------------------
//  LOGIN FORM
// ----------------------------------------
function LoginForm({
  onSuccess,
  switchToRegister,
}: {
  onSuccess: () => void;
  switchToRegister: () => void;
}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    let email = login;

    if (!login.includes("@")) {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", login)
        .single();

      if (!data?.email) {
        alert("User not found");
        return;
      }
      email = data.email;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }
    onSuccess();
  }

  return (
    <div>
      <div className="mb-2">LOGIN:</div>

      <input
        className="bg-black border border-green-400 w-full p-2 mb-2"
        placeholder="email or username"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
      />

      <input
        className="bg-black border border-green-400 w-full p-2 mb-2"
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        className="cursor-pointer border border-green-400 w-full p-2 mb-2 hover:bg-green-400 hover:text-black transition"
        onClick={handleLogin}
      >
        ENTER
      </button>

      <button
        className="cursor-pointer text-green-300"
        onClick={switchToRegister}
      >
        register
      </button>
    </div>
  );
}
// ----------------------------------------
//  REGISTER FORM
// ----------------------------------------
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
    if (!email || !password || !username) {
      alert("fill all fields");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (!data.user) {
      alert("No user returned");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      username,
      email,
    });

    if (profileError) {
      console.log(profileError);
      alert(profileError.message);
      return;
    }

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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);

  const [authMode, setAuthMode] = useState<
    "loading" | "login" | "register" | "ok"
  >("loading");

  const MAX_LENGTH = 200;
  const lastMessageTimeRef = useRef(0);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Notification Permission
  useEffect(() => {
    Notification.requestPermission();
  }, []);
  useEffect(() => {
    document.title = hasNewMessage ? "☀ New Message" : "Kavun Chat";
  }, [hasNewMessage]);
  useEffect(() => {
    const resetTitle = () => setHasNewMessage(false);

    window.addEventListener("focus", resetTitle);

    return () => {
      window.removeEventListener("focus", resetTitle);
    };
  }, []);
  // Check Session
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
        profiles!messages_user_id_fkey (
          username
        )
      `,
        )
        .order("created_at", { ascending: true });

      if (data) {
        const formattedMessages: Message[] = (data as Message[]).map((msg) => ({
          id: msg.id,
          text: msg.text,
          created_at: msg.created_at,
          profiles: Array.isArray(msg.profiles)
            ? msg.profiles[0] || null
            : msg.profiles,
        }));

        setMessages(formattedMessages);
      }
    }

    getMessages();

    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const msg = payload.new;

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", msg.user_id)
            .single();

          console.log("PROFILE:", profile);
          console.log("PROFILE ERROR:", error);

          const newMessage: Message = {
            id: msg.id,
            text: msg.text,
            created_at: msg.created_at,
            profiles: profile
              ? {
                  username: profile.username,
                }
              : null,
          };

          setMessages((prev) => [...prev, newMessage]);

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (
            msg.user_id !== user?.id &&
            Notification.permission === "granted"
          ) {
            const audio = new Audio("/notify.mp3");

            setHasNewMessage(true);

            audio.play();

            new Notification("Kavun Chat", {
              body: msg.text,
              icon: "/icon.png",
            });
          }
        },
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setAuthMode("login");
  }
  async function sendMessage() {
    const now = Date.now();

    if (sending) return;
    if (now - lastMessageTimeRef.current < 1500) return;

    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > 200) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.text?.trim() === message.trim()) return;

    setSending(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSending(false);
      return;
    }

    await supabase.from("messages").insert({
      user_id: user.id,
      text: trimmed,
    });

    setMessage("");
    lastMessageTimeRef.current = now;
    setSending(false);
  }
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

  // ----------------------------------------
  //  MAIN CHAT
  // ----------------------------------------
  return (
    <main className="h-dvh bg-[url(/bg.png)] bg-center bg-contain text-green-400 p-4 flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">Kavun Chat</h1>
        <button
          onClick={logout}
          className="cursor-pointer border border-green-400 px-3 py-1 hover:bg-green-400 hover:text-black transition"
        >
          logout
        </button>
      </div>

      {/* CHAT */}
      <div className="border border-green-400 flex-1 mb-4 flex flex-col overflow-hidden bg-black/75">
        <div className="flex-1 overflow-y-auto p-2 hide-scrollbar font-mono text-sm">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-1 wrap-break-words">
              <span className="text-green-300">
                {Array.isArray(msg.profiles)
                  ? (msg.profiles[0]?.username ?? "Anon")
                  : (msg.profiles?.username ?? "Anon")}
              </span>
              <span className="text-green-500">: </span>
              <span className="text-green-100">{msg.text}</span>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* INPUT */}
      <div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-black border border-green-400 p-2 outline-none"
            placeholder="message..."
            value={message}
            maxLength={MAX_LENGTH}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />

          <button
            disabled={sending}
            className="cursor-pointer border border-green-400 px-4 hover:bg-green-400 hover:text-black transition"
            onClick={sendMessage}
          >
            send
          </button>
        </div>

        <div
          className={`text-xs ${
            message.length > 180 ? "text-red-400" : "text-green-500"
          }`}
        >
          {message.length} / {MAX_LENGTH}
        </div>
      </div>
    </main>
  );
}
