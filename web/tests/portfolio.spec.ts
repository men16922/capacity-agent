import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import fixture from "../../examples/migration-portfolio-48.json" with { type: "json" };
const STORAGE = "capacity-agent.workspace.v1";
async function start(page: Page, data = fixture) {
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
    },
    { key: STORAGE, data },
  );
  await page.goto("/#migrate");
  await expect(
    page.getByRole("heading", { name: "AWS 이전 설계", exact: true }),
  ).toBeVisible();
}
async function project(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE,
  );
}
async function calculateAll(page: Page, count = 48) {
  await page
    .getByRole("button", {
      name: `검색 결과 ${count}개 전체 선택`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: `선택 ${count}개 산정`, exact: true })
    .click();
  await expect(page.getByText("일괄 산정 완료", { exact: true })).toBeVisible();
  await expect(
    page.getByText(`${count}/${count}개 처리`, { exact: false }),
  ).toBeVisible();
}
async function select(page: Page, name: string, option: string) {
  await page.getByRole("button", { name: new RegExp(`^${name} `) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function audit(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  });
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    r.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        detail: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}

test("48 assets: batch, pagination, detail candidate choice, common assumptions, CSV and verified JSON import", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await calculateAll(page);
  let p = await project(page);
  expect(p.migrationDrafts).toHaveLength(48);
  expect(
    p.migrationDrafts.every((d: any) => d.result.status === "complete"),
  ).toBe(true);
  expect(p.scenarios).toHaveLength(0); // Calculation is not human approval.
  expect(
    p.migrationDrafts.every((d: any) => d.result.candidates.length === 1),
  ).toBe(true);
  expect(JSON.stringify(p).length).toBeLessThan(2 * 1024 * 1024);
  await page.screenshot({
    path: info.outputPath("portfolio-48.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "다음 자산 페이지", exact: true })
    .click();
  await page.getByRole("link", { name: "app-034-batch", exact: true }).click();
  await expect(page).toHaveURL(/#migrate\/sample-034$/);
  await expect(
    page.getByRole("heading", { name: "app-034-batch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "검토 후 저장", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath("asset-detail.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "원본 사양", exact: true }).click();
  await expect(
    page.getByText("합성 테스트 자산 · 실제 고객/운영 데이터 아님", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "EC2 후보", exact: true }).click();
  const second = page.getByRole("radio").nth(1);
  await second.check();
  const selectedName = (await project(page)).migrationDrafts.find(
    (d: any) => d.assetId === "sample-034",
  ).selected;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "app-034-batch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "검토 후 저장", exact: true }),
  ).toBeEnabled();
  expect(
    (await project(page)).migrationDrafts.find(
      (d: any) => d.assetId === "sample-034",
    ).selected,
  ).toBe(selectedName);
  await page.getByRole("button", { name: "검토 후 저장", exact: true }).click();
  await page.getByRole("checkbox", { name: /입력 근거와 상대성능/ }).check();
  await page.getByRole("button", { name: "이전안 저장", exact: true }).click();
  await expect(page.locator("article.report h1")).toHaveText(
    "app-034-batch 이전안",
  );
  expect((await project(page)).scenarios[0].selected).toBe(selectedName);
  await page.getByRole("link", { name: "이전 설계", exact: true }).click();
  await select(page, "역할 필터", "DB");
  await page
    .getByRole("button", { name: "검색 결과 8개 전체 선택", exact: true })
    .click();
  await page
    .getByRole("button", { name: "공통 조건 적용", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "연간 성장률 (%)", exact: true })
    .fill("50");
  await page
    .getByRole("button", { name: "선택 자산에 적용", exact: true })
    .click();
  await expect(page.getByText("재산정 필요", { exact: true })).toHaveCount(8);
  p = await project(page);
  expect(
    p.migrationDrafts.filter((d: any) => d.plan.growth_percent === "50"),
  ).toHaveLength(8);
  expect(
    p.migrationDrafts.filter((d: any) => d.plan.growth_percent === "20"),
  ).toHaveLength(40);
  await calculateAll(page, 8);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "목록 CSV", exact: true }).click();
  const csv = await downloading;
  const csvPath = info.outputPath("portfolio.csv");
  await csv.saveAs(csvPath);
  expect(
    (await fs.readFile(csvPath, "utf8")).trim().split(/\r?\n/),
  ).toHaveLength(9);
  p = await project(page);
  const expected = p.migrationDrafts[0].result.candidates[0].cost.total_monthly;
  p.migrationDrafts[0].result.candidates[0].cost.total_monthly = "999999";
  await page.getByLabel("프로젝트 JSON 파일", { exact: true }).setInputFiles({
    name: "portfolio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole("button", { name: "계속", exact: true }).click();
  await expect(
    page.getByText(
      "프로젝트를 가져오고 계산 결과를 현재 엔진으로 검증했습니다.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    (await project(page)).migrationDrafts[0].result.candidates[0].cost
      .total_monthly,
  ).toBe(expected);
  expect(errors).toEqual([]);
});

test("batch isolates invalid inputs, no candidates and transport errors across 48 assets", async ({
  page,
}) => {
  const data = structuredClone(fixture);
  data.assets[0].iops = "";
  data.assets[1].network_gbps = "999";
  await page.route("**/api/migrate", async (route) => {
    if (route.request().postDataJSON().asset.id === "sample-003")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "테스트 통신 실패" }),
      });
    else await route.continue();
  });
  await start(page, data);
  await calculateAll(page);
  const p = await project(page);
  expect(
    p.migrationDrafts.filter((d: any) => d.result?.status === "complete"),
  ).toHaveLength(45);
  expect(
    p.migrationDrafts.find((d: any) => d.assetId === "sample-001").result
      .status,
  ).toBe("invalid");
  expect(
    p.migrationDrafts.find((d: any) => d.assetId === "sample-002").result
      .status,
  ).toBe("no_candidates");
  expect(
    p.migrationDrafts.find((d: any) => d.assetId === "sample-003").failure,
  ).toBe("테스트 통신 실패");
  await select(page, "산정 상태 필터", "입력 확인");
  await expect(
    page.getByRole("link", { name: "app-001-web", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "app-001-web", exact: true }).click();
  await expect(
    page.getByText("이 자산의 입력을 확인하세요", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "이전 대상 목록", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^산정 상태 필터 입력 확인/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "app-002-was", exact: true }),
  ).toHaveCount(0);
});

test("changed original and individual plan invalidate totals; detail back retains list state", async ({
  page,
}) => {
  await start(page);
  await calculateAll(page);
  await page
    .getByRole("button", { name: "다음 자산 페이지", exact: true })
    .click();
  await page.getByRole("link", { name: "app-034-batch", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "검토 후 저장", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "이전 조건 편집", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "연간 성장률 (%)", exact: true })
    .fill("60");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("재산정 필요", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "이전 대상 목록", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "app-034-batch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "app-001-web", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("47/48개 현재 결과만 포함 · USD", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "On-Prem", exact: true }).click();
  await page.getByRole("link", { name: "서버 자산", exact: true }).click();
  await page.getByRole("button", { name: "app-001-web", exact: true }).click();
  await page
    .getByRole("textbox", { name: "CPU 피크 사용률 (%)", exact: true })
    .fill("70");
  await page
    .getByRole("button", { name: "견적 검토 정보 (선택)", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "자산 유형", exact: true })
    .fill("가상 서버");
  await page
    .getByRole("textbox", { name: "OS 버전", exact: true })
    .fill("Linux 테스트 버전");
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await page.getByRole("tab", { name: "AWS", exact: true }).click();
  await expect(
    page.getByText("46/48개 현재 결과만 포함 · USD", { exact: true }),
  ).toBeVisible();
  expect((await project(page)).assets[0].asset_type).toBe("가상 서버");
});

test("cancelled batch and late responses cannot replace project or write new results", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  await page.route("**/api/migrate", async (route) => {
    count++;
    await held;
    try {
      await route.continue();
    } catch {
      /* cancelled request */
    }
  });
  await start(page);
  await page
    .getByRole("button", { name: "검색 결과 48개 전체 선택", exact: true })
    .click();
  await page
    .getByRole("button", { name: "선택 48개 산정", exact: true })
    .click();
  await expect.poll(() => count).toBe(4);
  await page.getByRole("button", { name: "산정 중지", exact: true }).click();
  await expect(
    page.getByText("산정 중지 · 완료 건 유지", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "새 프로젝트", exact: true }).click();
  await page.getByRole("button", { name: "계속", exact: true }).click();
  release();
  await page.unrouteAll({ behavior: "wait" });
  expect((await project(page)).assets).toHaveLength(0);
  expect((await project(page)).migrationDrafts ?? []).toHaveLength(0);
});

test("portfolio and detail accessibility, mobile containment and official calculator evidence", async ({
  page,
}, info) => {
  await start(page);
  await audit(page);
  await page.getByRole("link", { name: "app-001-web", exact: true }).click();
  await audit(page);
  await page
    .getByRole("button", { name: "이 자산 재산정", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "검토 후 저장", exact: true }),
  ).toBeEnabled();
  await audit(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "이전 대상 목록", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("portfolio-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/#calculator");
  await expect(page.locator(".calc-nav")).toHaveCount(8);
  await page
    .locator(".calc-nav")
    .filter({ hasText: "시스템 디스크" })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: "OS 영역 (MB(원문 표기))", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "적용 옵션·단위·입력 출처", exact: true })
    .click();
  await expect(
    page
      .getByRole("link", { name: /정보시스템 하드웨어 규모산정 지침/ })
      .first(),
  ).toHaveAttribute("href", /committee.tta.or.kr\/data\/standard_view.jsp.*R3/);
  await expect(
    page.getByText("tta-r3 appendix, physical PDF pp.43-48", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^D4 단위 배율/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  const before = await page.locator(".calculation-value").innerText();
  await page
    .getByRole("tab", { name: "JSON 가져오기·편집", exact: true })
    .click();
  const json = await page
    .getByRole("textbox", { name: /산정 입력 JSON/ })
    .inputValue();
  expect(json).toContain('"MB-as-labeled-in-source"');
  expect(json).toContain('"factor"');
  await page.getByRole("tab", { name: "입력과 계산", exact: true }).click();
  expect(await page.locator(".calculation-value").innerText()).toBe(before);
});

test("200-asset upper bound remains complete and fits the project import limit", async ({
  page,
}) => {
  const data = structuredClone(fixture);
  data.assets = Array.from({ length: 200 }, (_, i) => ({
    ...fixture.assets[i % 48],
    id: `stress-${i}`,
    name: `stress-${String(i).padStart(3, "0")}`,
  }));
  await start(page, data);
  await calculateAll(page, 200);
  const saved = await project(page);
  expect(saved.migrationDrafts).toHaveLength(200);
  expect(
    saved.migrationDrafts.filter((d: any) => d.result?.status === "complete"),
  ).toHaveLength(200);
  expect(Buffer.byteLength(JSON.stringify(saved))).toBeLessThan(
    5 * 1024 * 1024,
  );
  await page.reload();
  await expect(
    page.getByText("200/200개 현재 결과만 포함 · USD", { exact: true }),
  ).toBeVisible();
});
