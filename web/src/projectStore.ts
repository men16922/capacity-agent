import { useEffect, useRef, useState, type SetStateAction } from "react";
import {
  api,
  copy,
  parseProject,
  uid,
  type Project,
  type MigrationResult,
  type CalcResult,
  type OptimizationResult,
} from "./domain";
import { calculatedDraft, compactResult } from "./migrationState";
export const PROJECT_FILE_LIMIT = 20 * 1024 * 1024;
export function compactOptimization(
  result: OptimizationResult,
): OptimizationResult {
  const selected = result.migration?.candidates?.[0]?.instance_type;
  return {
    ...result,
    ...(result.migration
      ? { migration: compactResult(result.migration, selected ?? "") }
      : {}),
  };
}
export type ProjectRecord = {
  id: string;
  project: Project;
  revision: number;
  updatedAt: string;
};
const DB = "capacity-agent.projects.v2";
const LEGACY = "capacity-agent.workspace.v1";
let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("projects", { keyPath: "id" });
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
async function initialize() {
  const db = await database();
  const raw = localStorage.getItem(LEGACY);
  // Keep the legacy bytes intact. A transaction marker prevents repeated resurrection.
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["projects", "meta"], "readwrite");
    const marker = tx.objectStore("meta").get("legacyImported");
    marker.onsuccess = () => {
      if (marker.result) return;
      try {
        if (raw) {
          const p = parseProject(JSON.parse(raw));
          const existing = tx.objectStore("projects").get(p.id);
          existing.onsuccess = () => {
            if (!existing.result)
              tx.objectStore("projects").put({
                id: p.id,
                project: p,
                revision: 1,
                updatedAt: new Date().toISOString(),
              });
          };
        }
        tx.objectStore("meta").put(true, "legacyImported");
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        new Error(
          "기존 저장 형식을 읽지 못했습니다. 원본 저장값은 보존했습니다. 기존 JSON을 백업해 확인하세요.",
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
  return listProjects();
}
export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("projects").objectStore("projects").getAll();
    req.onsuccess = () => {
      try {
        resolve(
          req.result.map((r) => ({ ...r, project: parseProject(r.project) })),
        );
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
async function writeProject(
  project: Project,
  expected: number,
): Promise<ProjectRecord> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    let issue = "브라우저 저장 실패. JSON 백업 후 저장 공간을 확인하세요.";
    const record = {
      id: project.id,
      project: copy(project),
      revision: expected + 1,
      updatedAt: new Date().toISOString(),
    };
    const req = store.get(project.id);
    req.onsuccess = () => {
      if ((req.result?.revision ?? 0) !== expected) {
        issue =
          "다른 탭에서 이 프로젝트가 변경되었습니다. 현재 편집을 JSON으로 백업한 후 새로고침해 병합하세요. 덮어쓰기를 중지했습니다.";
        tx.abort();
      } else store.put(record);
    };
    tx.oncomplete = () => resolve(record);
    tx.onabort = () => reject(new Error(issue));
    tx.onerror = () => {};
  });
}
export async function verifyImport(input: Project): Promise<Project> {
  const next = copy(input);
  next.id = uid();
  for (const s of next.scenarios) {
    const r = await api<MigrationResult>("/api/migrate", s.request);
    if (
      r.status !== "complete" ||
      !r.candidates?.some((c) => c.instance_type === s.selected)
    )
      throw new Error(`${s.name}: 현재 엔진으로 이전안을 재현할 수 없습니다.`);
    s.result = compactResult(r, s.selected);
  }
  for (const c of next.calculations) {
    const r = await api<CalcResult>("/api/calculate", c.request);
    if (r.status !== "calculated")
      throw new Error(`${c.name}: 용량산정 입력·규칙을 확인하세요.`);
    c.result = r;
  }
  for (const s of next.optimizations ?? []) {
    const r = await api<OptimizationResult>("/api/optimize", s.request);
    if (r.status !== "complete")
      throw new Error(`${s.name}: 최적화 입력을 확인하세요.`);
    s.result = compactOptimization(r);
  }
  for (let i = 0; i < (next.migrationDrafts?.length ?? 0); i++) {
    const d = next.migrationDrafts![i];
    if (d.request)
      next.migrationDrafts![i] = {
        ...calculatedDraft(
          d.request,
          await api<MigrationResult>("/api/migrate", d.request),
          d.selected,
        ),
        plan: d.plan,
      };
  }
  return next;
}
export function useProjectLibrary() {
  const [records, setRecords] = useState<ProjectRecord[]>([]);
  const ref = useRef(records);
  const revisions = useRef(new Map<string, number>());
  const failures = useRef(new Set<string>());
  const chain = useRef(Promise.resolve());
  const pending = useRef(0);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>(
    {},
  );
  useEffect(() => {
    let disposed = false;
    initialize()
      .then((r) => {
        if (!disposed) {
          ref.current = r;
          setRecords(r);
          revisions.current = new Map(r.map((x) => [x.id, x.revision]));
          setReady(true);
        }
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      disposed = true;
      window.removeEventListener("beforeunload", warn);
    };
  }, []);
  function update(id: string, action: SetStateAction<Project>) {
    const old = ref.current.find((r) => r.id === id);
    if (!old || failures.current.has(id)) return;
    const project = typeof action === "function" ? action(old.project) : action;
    if (project.id !== id || project === old.project) return;
    const next = ref.current.map((r) =>
      r.id === id ? { ...r, project, updatedAt: new Date().toISOString() } : r,
    );
    ref.current = next;
    setRecords(next);
    pending.current++;
    setSaving(true);
    chain.current = chain.current
      .then(async () => {
        if (failures.current.has(id)) return;
        try {
          const saved = await writeProject(
            project,
            revisions.current.get(id) ?? 0,
          );
          revisions.current.set(id, saved.revision);
        } catch (e) {
          failures.current.add(id);
          setProjectErrors((p) => ({ ...p, [id]: (e as Error).message }));
        }
      })
      .finally(() => {
        pending.current--;
        setSaving(pending.current > 0);
      });
  }
  async function add(project: Project) {
    const saved = await writeProject(project, 0);
    revisions.current.set(project.id, saved.revision);
    ref.current = [...ref.current, saved];
    setRecords(ref.current);
  }
  return { records, ready, error, projectErrors, saving, update, add };
}
