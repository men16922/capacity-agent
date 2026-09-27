import { expect, type Page } from "@playwright/test";
export const legacy = "capacity-agent.workspace.v1";
export async function storedProjects(page: Page): Promise<any[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("capacity-agent.projects.v2", 1);
        req.onsuccess = () => {
          const db = req.result;
          const read = db
            .transaction("projects")
            .objectStore("projects")
            .getAll();
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
          read.onerror = () => reject(read.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}
export async function project(page: Page) {
  await expect(page.getByText("저장 중…", { exact: true })).toHaveCount(0);
  const id = decodeURIComponent(
    new URL(page.url()).hash.match(/^#project\/([^/]+)/)?.[1] ?? "",
  );
  const records = await storedProjects(page);
  return records.find((r) => r.id === id)?.project;
}
export async function seed(page: Page, data: any, route = "dashboard") {
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
    },
    { key: legacy, data },
  );
  await page.goto(`/#${route}`);
  await expect(page).toHaveURL(/#project\//);
}
export async function blank(page: Page) {
  await seed(page, {
    schemaVersion: 1,
    id: "empty-project",
    name: "빈 프로젝트",
    demo: false,
    assets: [],
    scenarios: [],
    calculations: [],
  });
}
