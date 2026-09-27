import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fixture from "../../examples/migration-portfolio-48.json" with { type: "json" };
import { seed, project, storedProjects, legacy } from "./helpers";
async function nav(page: Page, name: string) {
  await page.getByRole("link", { name, exact: true }).click();
  if (name === "프로젝트 목록")
    await expect(
      page.getByRole("heading", { name: "프로젝트", exact: true }),
    ).toBeVisible();
}
async function choice(page: Page, name: string, value: string) {
  await page.getByRole("button", { name: new RegExp(`^${name}( |$)`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
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
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
async function optimizeAndSave(page: Page, name: string) {
  await page
    .getByRole("button", { name: "최적화 제안 계산", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "필요 용량과 현재 할당량", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "최적화 시나리오 이름", exact: true })
    .fill(name);
  await page.getByRole("checkbox", { name: /측정값·가정·후보/ }).check();
  await page
    .getByRole("button", { name: "최적화 시나리오 저장", exact: true })
    .click();
  await expect(page.locator("#root article.report h1")).toHaveText(name);
}

test("project hierarchy, legacy preservation, creation, switching and per-project import", async ({
  page,
}) => {
  await seed(page, fixture);
  expect(
    await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).id, legacy),
  ).toBe(fixture.id);
  const first = await project(page);
  await nav(page, "프로젝트 목록");
  await expect(
    page.getByRole("heading", { name: "프로젝트", exact: true }),
  ).toBeVisible();
  await audit(page);
  await page
    .getByRole("button", { name: "프로젝트 생성", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "프로젝트 이름", exact: true })
    .fill("독립 프로젝트 B");
  await page.getByRole("button", { name: "생성 후 열기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  const second = await project(page);
  expect(second.id).not.toBe(first.id);
  expect(second.assets).toEqual([]);
  await nav(page, "용량산정");
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "산정 시나리오 이름", exact: true })
    .fill("신규 주문 서비스");
  await expect(
    page.getByRole("button", { name: "산정 결과 저장", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "산정 결과 저장", exact: true })
    .click();
  await expect(page.locator("#root article.report h1")).toContainText(
    "신규 주문 서비스",
  );
  await nav(page, "프로젝트 목록");
  await page.getByRole("button", { name: first.name, exact: true }).click();
  expect((await project(page)).assets).toHaveLength(48);
  expect((await project(page)).calculations).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  await audit(page);
  await nav(page, "프로젝트 목록");
  await page.getByLabel("프로젝트 JSON 파일", { exact: true }).setInputFiles({
    name: "copy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...first, name: "사본 C" })),
  });
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  expect((await project(page)).id).not.toBe(first.id);
  expect(await storedProjects(page)).toHaveLength(3);
  const b = (await storedProjects(page)).find((r) => r.id === second.id);
  expect(b.project.calculations).toHaveLength(1);
  await page.goto(
    `/#project/${encodeURIComponent(second.id)}/assets/sample-001`,
  );
  await expect(
    page.getByText("자산을 찾을 수 없습니다", { exact: true }),
  ).toBeVisible();
});

test("On-Prem asset details, percentage input, optimization snapshots, comparison, report and reload", async ({
  page,
}, info) => {
  await seed(page, fixture, "assets");
  await page.getByRole("button", { name: "app-001-web", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/sample-001$/);
  await page.getByRole("button", { name: "자산 수정", exact: true }).click();
  await page
    .getByRole("textbox", { name: "논리 디스크 할당량 (GiB)", exact: true })
    .fill("500");
  await choice(page, "메모리 사용량 입력 방식", "사용률 (%)");
  await page
    .getByRole("textbox", { name: "메모리 피크 사용률 (%)", exact: true })
    .fill("50");
  await choice(page, "디스크 사용량 입력 방식", "사용률 (%)");
  await page
    .getByRole("textbox", { name: "디스크 사용률 (%)", exact: true })
    .fill("60");
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await page.getByRole("tab", { name: "실사용 최적화", exact: true }).click();
  await optimizeAndSave(page, "기준 최적화");
  let p = await project(page);
  const first = p.optimizations[0];
  expect(first.result.requirements.disk_gib.value).toBe("450");
  expect(first.result.measurements.memory_gib.value).toBe(
    String(Number(p.assets[0].memory_gib) / 2),
  );
  await nav(page, "서버 자산");
  await page.getByRole("button", { name: "app-001-web", exact: true }).click();
  await page.getByRole("tab", { name: "실사용 최적화", exact: true }).click();
  await page
    .getByRole("textbox", { name: "연간 성장률 (%)", exact: true })
    .fill("50");
  await optimizeAndSave(page, "성장 50% 최적화");
  await nav(page, "산정 시나리오");
  await page
    .getByRole("checkbox", { name: "기준 최적화 선택", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "성장 50% 최적화 선택", exact: true })
    .check();
  await expect(
    page.getByRole("heading", {
      name: "기준 최적화 ↔ 성장 50% 최적화",
      exact: true,
    }),
  ).toBeVisible();
  await audit(page);
  await page.screenshot({
    path: info.outputPath("onprem-comparison.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "기준 최적화", exact: true }).click();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page
    .getByRole("button", { name: "인쇄 / PDF 저장", exact: true })
    .click();
  await expect(page.locator("#print-root article")).toContainText(
    "utilization-planning-1.0.0",
  );
  await page.reload();
  await expect(page.locator("#root article.report")).toBeVisible();
  p = await project(page);
  expect(p.optimizations[0]).toEqual(first);
});

test("AWS optimization proposes utilization-based EC2 and gp3 with bounded savings and stale guards", async ({
  page,
}, info) => {
  await seed(page, fixture, "aws-optimize");
  await page
    .getByRole("button", { name: "aws-portal-01", exact: true })
    .click();
  await expect(page).toHaveURL(/\/aws-optimize\/aws-demo-web$/);
  await page.getByRole("button", { name: "자산 수정", exact: true }).click();
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "고정 메모리 (GiB)", exact: true })
    .fill("4");
  await page
    .getByRole("button", { name: "최적화 제안 계산", exact: true })
    .click();
  await expect(page.getByText("$4.56", { exact: true })).toBeVisible();
  await audit(page);
  await page.screenshot({
    path: info.outputPath("aws-optimization.png"),
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "연간 성장률 (%)", exact: true })
    .fill("30");
  await expect(
    page.getByText(
      "입력 또는 자산이 변경되었습니다. 다시 계산한 뒤 저장하세요.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "최적화 시나리오 저장", exact: true }),
  ).toHaveCount(0);
  await optimizeAndSave(page, "AWS 사용률 검토안");
  const p = await project(page);
  expect(p.optimizations[0].request.environment).toBe("aws");
  expect(p.scenarios).toHaveLength(0);
  expect(p.optimizations[0].result.migration.requirements.vcpu.value).toBe(
    "10.4",
  );
  await nav(page, "최적화 시나리오");
  await expect(
    page.getByRole("button", { name: "AWS 사용률 검토안", exact: true }),
  ).toBeVisible();
  await nav(page, "산정 시나리오");
  await expect(
    page.getByRole("button", { name: "AWS 사용률 검토안", exact: true }),
  ).toHaveCount(0);
});

test("bulk reviewed migration saves selected assets atomically and refuses pending, stale, duplicate and capacity overflow", async ({
  page,
}) => {
  await seed(
    page,
    { ...fixture, assets: fixture.assets.slice(0, 3) },
    "migrate",
  );
  await page
    .getByRole("button", { name: "검색 결과 3개 전체 선택", exact: true })
    .click();
  await page
    .getByRole("button", { name: "선택 3개 검토 후 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "이전안 3개 저장", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page
    .getByRole("button", { name: "선택 3개 산정", exact: true })
    .click();
  await expect(page.getByText("일괄 산정 완료", { exact: true })).toBeVisible();
  expect((await project(page)).scenarios).toHaveLength(0);
  await page
    .getByRole("button", { name: "선택 3개 검토 후 저장", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /선택한 각 자산/ }).check();
  await page
    .getByRole("button", { name: "이전안 3개 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "이전안·시나리오 비교", exact: true }),
  ).toBeVisible();
  expect((await project(page)).scenarios).toHaveLength(3);
  await nav(page, "AWS 마이그레이션");
  await page
    .getByRole("button", { name: "선택 3개 검토 후 저장", exact: true })
    .click();
  await expect(
    page.getByText("동일 이전안 저장됨", { exact: true }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "이전안 3개 저장", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("link", { name: "app-001-web", exact: true }).click();
  await page
    .getByRole("button", { name: "이전 조건 편집", exact: true })
    .click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("textbox", { name: "연간 성장률 (%)", exact: true })
    .fill("30");
  await page
    .getByRole("button", { name: "상세로 돌아가기", exact: true })
    .click();
  await expect(page.getByText("재산정 필요", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "이전 대상 목록", exact: true })
    .click();
  await page
    .getByRole("button", { name: "선택 3개 검토 후 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "이전안 3개 저장", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("link", { name: "app-001-web", exact: true }).click();
  await page
    .getByRole("button", { name: "이 자산 재산정", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "검토 후 저장", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "이전 대상 목록", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "AWS 마이그레이션", exact: true }),
  ).toBeVisible();
  const p = await project(page);
  expect(
    p.migrationDrafts.find((d: any) => d.assetId === "sample-001").request.plan
      .growth_percent,
  ).toBe("30");
  expect(
    p.migrationDrafts.find((d: any) => d.assetId === "sample-001").result
      .requirements.vcpu.value,
  ).toBe("6.24");
  const full = {
    ...p,
    id: "capacity-test",
    name: "한도 검증",
    scenarios: Array.from({ length: 199 }, (_, i) => ({
      ...p.scenarios[0],
      id: `saved-${i}`,
    })),
  };
  const context = await page.context().browser()!.newContext();
  const overflow = await context.newPage();
  await seed(overflow, full, "migrate");
  await overflow
    .getByRole("button", { name: "검색 결과 3개 전체 선택", exact: true })
    .click();
  await overflow
    .getByRole("button", { name: "선택 3개 검토 후 저장", exact: true })
    .click();
  await expect(
    overflow.getByRole("button", { name: "이전안 3개 저장", exact: true }),
  ).toBeDisabled();
  expect((await project(overflow)).scenarios).toHaveLength(199);
  await context.close();
});

test("concurrent browser tabs do not overwrite a newer project revision", async ({
  page,
}) => {
  await seed(page, fixture);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(
    other.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  async function rename(p: Page, name: string) {
    await p.getByRole("button", { name: "프로젝트 설정", exact: true }).click();
    await p
      .getByRole("textbox", { name: "프로젝트 이름", exact: true })
      .fill(name);
    await p.getByRole("button", { name: "저장", exact: true }).click();
  }
  await rename(page, "첫 탭의 최신 프로젝트");
  expect((await project(page)).name).toBe("첫 탭의 최신 프로젝트");
  await rename(other, "오래된 탭 편집");
  await expect(
    other.getByText(/다른 탭에서 이 프로젝트가 변경되었습니다/).first(),
  ).toBeVisible();
  expect((await storedProjects(other))[0].project.name).toBe(
    "첫 탭의 최신 프로젝트",
  );
  await other.close();
});

test("AWS manual inventory and optimization import recalculate instead of trusting saved outputs", async ({
  page,
}) => {
  await seed(page, { ...fixture, awsAssets: [] }, "aws-assets");
  await page
    .getByRole("button", { name: "서버 추가", exact: true })
    .first()
    .click();
  await choice(page, "현재 EC2 유형", "m8i.4xlarge · 16 vCPU / 64 GiB");
  await page
    .getByRole("textbox", { name: "서버 이름", exact: true })
    .fill("검증 EC2");
  for (const [name, value] of [
    ["논리 디스크 할당량 (GiB)", "500"],
    ["논리 디스크 사용량 (GiB)", "300"],
    ["CPU 피크 사용률 (%)", "35"],
    ["메모리 피크 실사용 (GiB)", "32"],
    ["지속 IOPS (IOPS)", "6000"],
    ["스토리지 지속 처리량 (MiB/s)", "200"],
    ["네트워크 지속 요구량 (Gbps)", "0.5"],
    ["측정·사양 근거", "합성 검수 예제 · 14일 피크"],
  ])
    await page.getByRole("textbox", { name, exact: true }).fill(value);
  await page.getByRole("button", { name: "서버 저장", exact: true }).click();
  await page.getByRole("button", { name: "검증 EC2", exact: true }).click();
  await page
    .getByRole("button", { name: "사용률 기반 최적화", exact: true })
    .click();
  await optimizeAndSave(page, "비용 근거 미입력 검토안");
  const before = await project(page);
  expect(before.awsAssets).toHaveLength(1);
  expect(before.assets).toHaveLength(48);
  expect(before.optimizations[0].result.monthly_difference).toBeNull();
  before.optimizations[0].result.requirements.vcpu.value = "9999";
  await page.getByLabel("프로젝트 JSON 파일", { exact: true }).setInputFiles({
    name: "optimization.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(before)),
  });
  await page.getByRole("button", { name: "계속", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "통합 대시보드", exact: true }),
  ).toBeVisible();
  const after = await project(page);
  expect(after.id).not.toBe(before.id);
  expect(after.optimizations[0].result.requirements.vcpu.value).toBe("9.6");
  expect(after.optimizations[0].result.migration.candidates).toHaveLength(1);
  expect(await storedProjects(page)).toHaveLength(2);
});
