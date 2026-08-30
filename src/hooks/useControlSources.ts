import { useEffect, useRef, useState } from "react";
import {
  addControlSource,
  listControlSources,
  setControlSourceEnabled,
  testControlSource,
  type ControlSource
} from "../api";
import { initialSources } from "../constants";
import type { Notify } from "./useNotice";

export type SourceDraft = { name: string; url: string };

export function useControlSources({ notify }: { notify: Notify }) {
  const [sources, setSources] = useState<ControlSource[]>(initialSources);
  const [testingSourceIds, setTestingSourceIds] = useState<ReadonlySet<string>>(() => new Set());
  const testingSourceIdsRef = useRef(new Set<string>());

  useEffect(() => {
    void listControlSources().then(setSources).catch(() => undefined);
  }, []);

  const addSource = async (draft: SourceDraft): Promise<boolean> => {
    const name = draft.name.trim();
    const indexUrl = draft.url.trim();
    if (!name || !indexUrl.startsWith("https://")) {
      notify("error", "请输入名称和 HTTPS 索引地址。");
      return false;
    }
    try {
      const source = await addControlSource({ name, indexUrl });
      setSources((items) => [...items, source]);
      notify("success", "控件源已保存为停用状态，请测试连接后再启用。");
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "控件源保存失败，请稍后重试。";
      notify("error", message);
      return false;
    }
  };

  const testSource = async (id: string): Promise<void> => {
    if (testingSourceIdsRef.current.has(id)) return;
    testingSourceIdsRef.current.add(id);
    setTestingSourceIds(new Set(testingSourceIdsRef.current));
    try {
      const report = await testControlSource(id);
      const latestSources = await listControlSources().catch(() => null);
      if (latestSources) setSources(latestSources);
      notify("success", `${report.message} 共发现 ${report.addonCount ?? 0} 个插件。`);
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "控件源连接失败。";
      notify("error", message);
    } finally {
      testingSourceIdsRef.current.delete(id);
      setTestingSourceIds(new Set(testingSourceIdsRef.current));
    }
  };

  const toggleSource = (source: ControlSource) => {
    void setControlSourceEnabled(source.id, !source.enabled).then(setSources).catch(() => {
      setSources((items) => items.map((item) => item.id === source.id ? { ...item, enabled: !item.enabled } : item));
      notify("warning", "控件源状态仅在当前界面更新，稍后请重试保存。");
    });
  };

  return { sources, testingSourceIds, addSource, testSource, toggleSource };
}
