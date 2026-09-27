import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { api, type Bootstrap } from "./domain";
import { Choice, PageHeading } from "./ui";

export function Knowledge({ bootstrap }: { bootstrap: Bootstrap }) {
  const [selected, setSelected] = useState("index.md");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("all");
  const [text, setText] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string; snippet: string }[]
  >([]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setFailure("");
    api<{ markdown: string }>(
      `/api/documents/${selected}`,
      undefined,
      controller.signal,
    )
      .then((r) => setText(r.markdown))
      .catch((e) => {
        if (!controller.signal.aborted) setFailure(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (filter.trim().length >= 2)
        api<{ results: typeof searchResults }>(
          `/api/search?q=${encodeURIComponent(filter)}`,
          undefined,
          controller.signal,
        )
          .then((r) => setSearchResults(r.results))
          .catch(() => {});
      else setSearchResults([]);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filter]);
  const documents = bootstrap.documents.filter(
    (d) =>
      (category === "all" || d.category === category) &&
      (!filter ||
        d.title.toLowerCase().includes(filter.toLowerCase()) ||
        searchResults.some((r) => r.id === d.id)),
  );
  function linked(href: string | undefined, children: React.ReactNode) {
    if (!href) return <>{children}</>;
    if (/^https?:\/\//.test(href))
      return (
        <Link external href={href}>
          {children}
        </Link>
      );
    if (href.startsWith("#")) return <a href={href}>{children}</a>;
    const target = decodeURIComponent(
      new URL(href, `http://wiki.local/wiki/${selected}`).pathname,
    ).slice(1);
    const wikiId = target.replace(/^wiki\//, "");
    if (bootstrap.documents.some((d) => d.id === wikiId))
      return (
        <Link
          href="#"
          onFollow={(e) => {
            e.preventDefault();
            setSelected(wikiId);
          }}
        >
          {children}
        </Link>
      );
    const source = bootstrap.sources.find(
      (s) => s.path.normalize("NFC") === target.normalize("NFC"),
    );
    if (source && !source.available)
      return (
        <span title="공개 저장소에는 원본이 포함되지 않습니다.">
          {children} (로컬 원본 별도)
        </span>
      );
    if (source)
      return (
        <Link external href={`/api/sources/${source.id}/original`}>
          {children}
        </Link>
      );
    return (
      <span title="로컬 원본 또는 개발 문서 참고">
        {children}
        <span className="secondary"> (로컬 참고)</span>
      </span>
    );
  }
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="KNOWLEDGE & PROVENANCE"
        title="산정 Wiki"
        description={`원본 ${bootstrap.source_count}개 출처에서 정리한 개념·계산식·검토 근거를 찾아보세요.`}
      />
      {bootstrap.sources.some((s) => !s.available) && (
        <Alert type="info">
          원본 PDF·엑셀과 전체 추출본은 공개 저장소에 포함되지 않습니다. 출처
          카드·요약·계산 규칙을 열람할 수 있으며 원본 링크는 해당 파일을
          reference 폴더에 추가하면 활성화됩니다.
        </Alert>
      )}
      <div className="knowledge-layout">
        <Container header={<Header variant="h2">문서 찾기</Header>}>
          <SpaceBetween size="m">
            <TextFilter
              filteringText={filter}
              onChange={(e) => setFilter(e.detail.filteringText)}
              filteringPlaceholder="용어·주제·본문 검색"
              filteringAriaLabel="Wiki 검색"
            />
            <Choice
              label="문서 분류"
              value={category}
              options={[
                { value: "all", label: "모든 문서" },
                { value: "concepts", label: "개념·업무 흐름" },
                { value: "sources", label: "출처 카드" },
                { value: "formulas", label: "계산식" },
                { value: "overview", label: "개요·벤치마크" },
              ]}
              onChange={setCategory}
            />
            <div className="knowledge-list">
              {documents.map((d) => (
                <button
                  key={d.id}
                  className={`doc-nav ${selected === d.id ? "active" : ""}`}
                  onClick={() => setSelected(d.id)}
                >
                  <span>{d.title}</span>
                  <small>{d.category}</small>
                </button>
              ))}
              {!documents.length && (
                <Box color="text-body-secondary">검색 결과가 없습니다.</Box>
              )}
            </div>
          </SpaceBetween>
        </Container>
        <Container>
          {busy ? (
            <Box textAlign="center" padding="xl">
              <Spinner /> 문서 불러오는 중
            </Box>
          ) : failure ? (
            <Alert type="error">{failure}</Alert>
          ) : (
            <div className="markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => linked(href, children),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          )}
        </Container>
      </div>
    </SpaceBetween>
  );
}

export function Benchmarks({ bootstrap }: { bootstrap: Bootstrap }) {
  const [filter, setFilter] = useState("");
  return (
    <SpaceBetween size="l">
      <PageHeading
        eyebrow="PERFORMANCE REFERENCES"
        title="벤치마크 참고"
        description="산정 요구량과 실제 시험 결과를 비교할 때 사용할 공식 출처입니다."
      />
      <ColumnLayout columns={3}>
        <Container header={<Header variant="h2">TPC-C · tpmC</Header>}>
          <p>
            시스템 구성 전체의 트랜잭션 처리 성능입니다. CPU 모델 단독 점수나
            업무 TPS와 구분합니다.
          </p>
          <Link external href="https://www.tpc.org/tpcc/">
            TPC-C 공식 안내
          </Link>
        </Container>
        <Container header={<Header variant="h2">SPC-1 / SPC-1C</Header>}>
          <p>
            스토리지 시스템과 구성요소 시험을 구분합니다. 지표·버전·FDR의 구성을
            함께 확인합니다.
          </p>
          <Link external href="https://storageperformance.org/benchmarks">
            SPC 공식 벤치마크
          </Link>
        </Container>
        <Container header={<Header variant="h2">SPECjbb · max-jOPS</Header>}>
          <p>
            Composite·MultiJVM 범주와 JVM·서버 구성을 확인합니다. 다른 범주의
            수치를 직접 섞지 않습니다.
          </p>
          <Link external href="https://www.spec.org/jbb2015/">
            SPECjbb 공식 안내
          </Link>
        </Container>
      </ColumnLayout>
      <Alert type="info" header="공식 링크와 성능 검증은 구분합니다">
        결과 버전·범주·시험 구성·상태·확인일이 일치해야 비교할 수 있습니다.
        tpmC/vCPU 또는 SPC IOPS/일반 디스크 IOPS의 임의 환산은 제공하지
        않습니다.
      </Alert>
      <Table
        items={bootstrap.benchmarks.filter((b) =>
          `${b.title} ${b.url}`.toLowerCase().includes(filter.toLowerCase()),
        )}
        header={<Header variant="h2">공식 사이트와 결과 목록</Header>}
        filter={
          <TextFilter
            filteringText={filter}
            onChange={(e) => setFilter(e.detail.filteringText)}
            filteringPlaceholder="TPC, SPC, SPEC 또는 제목 검색"
            filteringAriaLabel="벤치마크 링크 검색"
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: "출처",
            cell: (b) => (
              <Link external href={b.url}>
                {b.title}
              </Link>
            ),
          },
          {
            id: "url",
            header: "공식 URL",
            cell: (b) => <span className="url-text">{b.url}</span>,
          },
          { id: "date", header: "페이지 확인일", cell: (b) => b.checked_on },
        ]}
        empty={<Box>일치하는 공식 링크가 없습니다.</Box>}
      />
    </SpaceBetween>
  );
}
