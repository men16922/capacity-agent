import { project, seed, blank, storedProjects } from "./helpers";
import migrationFixture from "../../examples/migration.json" with { type: "json" };
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
const storage = "capacity-agent.workspace.v1";
async function demo(page: Page) {
  await seed(
    page,
    {
      schemaVersion: 1,
      id: "test-demo",
      name: "업무 시스템 클라우드 전환",
      demo: true,
      assets: [{ ...migrationFixture.asset, name: "고객 포털 WEB/WAS" }],
      scenarios: [],
      calculations: [],
    },
    "assets",
  );
  await expect(
    page.getByRole("button", { name: "고객 포털 WEB/WAS", exact: true }),
  ).toBeVisible();
}
async function saveMigration(page: Page, name: string) {
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "이전안 이름", exact: true })
    .fill(name);
  await page.getByRole("checkbox", { name: /입력 근거와 상대성능/ }).check();
  await page.getByRole("button", { name: "이전안 저장", exact: true }).click();
  await expect(page.locator("#root article.report h1")).toHaveText(name);
}

test("migration golden result, report, snapshot clone, comparison and JSON round trip", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await page.screenshot({
    path: info.outputPath("onprem.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "고객 포털 WEB/WAS", exact: true })
    .click();

  await page
    .getByRole("button", { name: "AWS 마이그레이션", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이전 조건 편집", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "노드별 고정 메모리 (GiB)", exact: true })
    .fill("4");
  await page.getByRole("button", { name: "후보 계산", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "계산된 요구량", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "m8i.4xlarge 선택", exact: true }),
  ).toBeChecked();
  await expect(page.getByText("$821.29", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "m8i.4xlarge", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "m8i.4xlarge", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "상세 패널 닫기", exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath("candidates.png"),
    fullPage: true,
  });
  await saveMigration(page, "기준 이전안");
  let p = await project(page);
  expect(p.scenarios[0].result.requirements.vcpu.value).toBe("9.6");
  expect(p.scenarios[0].result.requirements.memory_gib.value).toBe("47");
  expect(p.scenarios[0].result.storage.size_gib).toBe(450);
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page
    .getByRole("button", { name: "인쇄 / PDF 저장", exact: true })
    .click();
  await expect(page.locator("#print-root article")).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: info.outputPath("migration-report.pdf"),
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  if (
    await page
      .getByRole("button", { name: "탐색 메뉴 열기", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "탐색 메뉴 열기", exact: true })
      .click();
  // A stored scenario is immutable when the current source asset changes.
  await page.getByRole("link", { name: "서버 자산", exact: true }).click();
  await page
    .getByRole("button", { name: "고객 포털 WEB/WAS", exact: true })
    .click();
  await page.getByRole("button", { name: "자산 수정", exact: true }).click();
  await page
    .getByRole("textbox", { name: "CPU 피크 사용률 (%)", exact: true })
    .fill("80");
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await page
    .getByRole("link", { name: "이전안·시나리오", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "기준 이전안 선택", exact: true })
    .check();
  await page
    .getByRole("button", { name: "복제하여 수정", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "연간 성장률 (%)", exact: true })
    .fill("50");
  await page.getByRole("button", { name: "후보 계산", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "계산된 요구량", exact: true }),
  ).toBeVisible();
  await saveMigration(page, "성장 50% 이전안");
  p = await project(page);
  expect(p.scenarios[1].request.asset.peak_cpu_percent).toBe("35");
  expect(p.scenarios[1].result.requirements.vcpu.value).toBe("12");
  expect(p.assets[0].peak_cpu_percent).toBe("80");
  await page
    .getByRole("link", { name: "이전안·시나리오", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "기준 이전안 선택", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "성장 50% 이전안 선택", exact: true })
    .check();
  await expect(
    page.getByRole("heading", { name: "시나리오 차이", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("25 %", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("comparison.png"),
    fullPage: true,
  });
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "프로젝트 JSON", exact: true })
    .click();
  const download = await downloaded;
  const path = info.outputPath("roundtrip.json");
  await download.saveAs(path);
  const exported = JSON.parse(await fs.readFile(path, "utf8"));
  expect(exported.scenarios).toHaveLength(2);
  // Tampered saved totals are discarded and recomputed from inputs on import.
  exported.scenarios[0].result.requirements.vcpu.value = "999";
  await page.getByLabel("프로젝트 JSON 파일", { exact: true }).setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.getByRole("button", { name: "계속", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  expect(
    (await project(page)).scenarios[0].result.requirements.vcpu.value,
  ).toBe("9.6");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  expect((await project(page)).scenarios).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("asset CRUD and atomic CSV validation", async ({ page }) => {
  await blank(page);
  await page.getByRole("link", { name: "서버 자산", exact: true }).click();
  await page
    .getByRole("button", { name: "서버 추가", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await expect(
    page.getByText("필수 항목입니다. 200자 이내로 입력하세요.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "서버 이름", exact: true })
    .fill("검증 VM");
  for (const [name, value] of [
    ["할당 논리 CPU (개)", "8"],
    ["할당 메모리 (GiB)", "32"],
    ["논리 디스크 사용량 (GiB)", "100"],
  ])
    await page.getByRole("textbox", { name, exact: true }).fill(value);
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "검증 VM", exact: true }),
  ).toBeVisible();
  const csv = "name,vcpu,memory_gib,disk_gib\nCSV VM,4,16,50\n";
  await page.getByLabel("서버 CSV 파일", { exact: true }).setInputFiles({
    name: "assets.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("button", { name: "CSV VM", exact: true }),
  ).toBeVisible();
  const invalid =
    "name,vcpu,memory_gib,disk_gib\n유효,4,16,50\n무효,-1,16,50\n";
  await page.getByLabel("서버 CSV 파일", { exact: true }).setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(invalid),
  });
  await expect(
    page.getByText("3행: vcpu 값을 확인하세요.", { exact: true }),
  ).toBeVisible();
  expect((await project(page)).assets).toHaveLength(2);
  await page.getByRole("radio", { name: "검증 VM 선택", exact: true }).check();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  expect((await project(page)).assets).toHaveLength(1);
});

test("all 21 formulas, live recalculation, missing values, Wiki and benchmark links", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("link", { name: "용량산정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  const first = await page.locator(".calculation-value").innerText();
  await page.locator("#calc-S1").fill("1000");
  await expect(page.locator(".calculation-value")).not.toHaveText(first);
  await page
    .getByRole("button", { name: "예제 불러오기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "산정 결과 저장", exact: true })
    .click();
  await expect(page.locator("article.report")).toContainText("tta-r3-2023");
  await page.getByRole("link", { name: "용량산정", exact: true }).click();
  for (const [profile, count] of [
    ["2021 네트워크 가이드", 10],
    ["강의 · 네트워크", 4],
  ] as const) {
    await page.getByRole("button", { name: /^산정 기준 / }).click();
    await page.getByRole("option", { name: profile, exact: true }).click();
    await expect(page.locator(".calc-nav")).toHaveCount(count);
    await expect(
      page.getByRole("button", { name: "산정 결과 저장", exact: true }),
    ).toBeEnabled();
  }
  await page.getByRole("button", { name: "입력 비우기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("미입력:", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "산정 Wiki", exact: true }).click();
  await page.getByPlaceholder("용어·주제·본문 검색").fill("클라우드");
  await page
    .locator(".doc-nav")
    .filter({ hasText: "클라우드 보안" })
    .first()
    .click();
  await expect(page.locator(".markdown")).toContainText("2024.06");
  await page.getByRole("link", { name: "벤치마크 참고", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "TPC-C 공식 안내", exact: true }),
  ).toHaveAttribute("href", "https://www.tpc.org/tpcc/");
  await expect(
    page.getByRole("link", { name: "SPC 공식 벤치마크", exact: true }),
  ).toHaveAttribute("href", "https://storageperformance.org/benchmarks");
});

test("invalid migration, ARM confirmation and no-candidate state", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "고객 포털 WEB/WAS", exact: true })
    .click();
  await page
    .getByRole("button", { name: "AWS 마이그레이션", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이전 조건 편집", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "목표 CPU 활용률 (%)", exact: true })
    .fill("0");
  await page.getByRole("button", { name: "후보 계산", exact: true }).click();
  await expect(
    page.getByText("입력 확인이 필요합니다", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByText("유효한 후보를 먼저 선택하세요.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "조건 수정", exact: true }).click();
  await page
    .getByRole("textbox", { name: "목표 CPU 활용률 (%)", exact: true })
    .fill("70");
  await page.getByRole("button", { name: /^대상 CPU 아키텍처 / }).click();
  await page
    .getByRole("option", { name: "arm64 · AWS Graviton", exact: true })
    .click();
  await page.getByRole("button", { name: "후보 계산", exact: true }).click();
  await expect(
    page.getByText("입력 확인이 필요합니다", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "조건 수정", exact: true }).click();
  await page.getByRole("checkbox", { name: /Linux와 바이너리/ }).check();
  await page
    .getByRole("textbox", {
      name: "네트워크 지속 요구 (Gbps/노드)",
      exact: true,
    })
    .fill("999");
  await page.getByRole("button", { name: "후보 계산", exact: true }).click();
  await expect(
    page.getByText("현재 조건에 맞는 후보가 없습니다", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /선택/ })).toHaveCount(0);
});

test("mobile layout, keyboard navigation and dark mode", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await blank(page);
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  if (
    await page
      .getByRole("button", { name: "탐색 메뉴 열기", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "탐색 메뉴 열기", exact: true })
      .click();
  await page
    .getByRole("link", { name: "AWS 마이그레이션", exact: true })
    .focus();
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "다크 모드", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: info.outputPath("dark.png"), fullPage: true });
});

test("accessible dashboard, forms and migration choices", async ({ page }) => {
  await demo(page);
  async function audit() {
    await page.evaluate(async () => {
      await Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => {})),
      );
    });
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await audit();
  await page
    .getByRole("button", { name: "고객 포털 WEB/WAS", exact: true })
    .click();
  await page
    .getByRole("button", { name: "AWS 마이그레이션", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이전 조건 편집", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await audit();
  await page.getByRole("link", { name: "용량산정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  await audit();
});

test("corrupt local storage is preserved, invalid imported calculation does not replace project", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    (key) => localStorage.setItem(key, '{"invalid":true}'),
    storage,
  );
  // A new context is required to exercise first-run legacy migration.
  const context = await page.context().browser()!.newContext();
  const corrupt = await context.newPage();
  await corrupt.addInitScript(
    (key) => localStorage.setItem(key, '{"invalid":true}'),
    storage,
  );
  await corrupt.goto("http://127.0.0.1:8765/");
  await expect(
    corrupt.getByRole("button", { name: "기존 저장값 백업", exact: true }),
  ).toBeVisible();
  expect(
    await corrupt.evaluate((key) => localStorage.getItem(key), storage),
  ).toBe('{"invalid":true}');
  await context.close();
  await page.evaluate((key) => localStorage.removeItem(key), storage);
  await page
    .getByRole("button", { name: "프로젝트 생성", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "프로젝트 이름", exact: true })
    .fill("보존 프로젝트");
  await page.getByRole("button", { name: "생성 후 열기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  const before = await project(page);
  const imported = {
    ...before,
    name: "실패할 가져오기",
    calculations: [
      {
        id: "bad",
        name: "오류 산정",
        request: { schema_version: 999, calculations: [] },
        result: { results: [] },
      },
    ],
  };
  await page.getByLabel("프로젝트 JSON 파일", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.getByRole("button", { name: "계속", exact: true }).click();
  await expect(
    page.getByText("오류 산정: 용량산정 입력·규칙을 확인하세요.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await project(page)).name).toBe(before.name);
});

test("late calculator response cannot overwrite the latest input", async ({
  page,
}) => {
  await blank(page);
  await page.getByRole("link", { name: "용량산정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => (release = resolve));
  let oldStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => (oldStarted = resolve));
  await page.route("**/api/calculate", async (route) => {
    const body = route.request().postDataJSON();
    const response = await route.fetch();
    if (body.calculations[0].inputs.S1.value === "1000") {
      oldStarted();
      await delayed;
    }
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator("#calc-S1").fill("1000");
  await started;
  const next = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/calculate") &&
      r.request().postDataJSON().calculations[0].inputs.S1.value === "2000",
  );
  await page.locator("#calc-S1").fill("2000");
  const result = await (await next).json();
  const expected = result.results[0].raw_value;
  await expect(
    page.getByText(`산정 원값 ${expected}`, { exact: false }),
  ).toBeVisible();
  release();
  await page.waitForTimeout(200);
  await expect(
    page.getByText(`산정 원값 ${expected}`, { exact: false }),
  ).toBeVisible();
});
