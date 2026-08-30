import { useCallback, useState } from "react";

export type NoticeTone = "success" | "warning" | "error";
export type Notice = { tone: NoticeTone; text: string } | null;
export type Notify = (tone: NoticeTone, text: string) => void;

export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const notify = useCallback<Notify>((tone, text) => setNotice({ tone, text }), []);
  const clearNotice = useCallback(() => setNotice(null), []);
  return { notice, notify, clearNotice };
}
