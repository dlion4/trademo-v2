const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const shell = read("src/components/investor/investor-shell.tsx");
const shellCss = read("src/styles/components/investor-shell.css");
const overview = read("src/components/investor/investor-overview-page.tsx");
const pools = read("src/components/investor/investor-pools-page.tsx");
const detail = read("src/components/investor/investor-pool-detail-page.tsx");

const routes = {
  overview: read("src/app/investor/page.tsx"),
  pools: read("src/app/investor/pools/page.tsx"),
  detail: read("src/app/investor/pools/[id]/page.tsx"),
};

test("the shell exposes the three investor pages as links, not buttons", () => {
  assert.match(shell, /import Link from "next\/link"/);
  assert.match(shell, /group: "Investor pages"/);
  const group = shell.slice(shell.indexOf('group: "Investor pages"'));
  const block = group.slice(0, group.indexOf('group: "Portfolio"'));
  assert.match(block, /key: "overview"[\s\S]*?href: "\/investor"/);
  assert.match(block, /key: "pools"[\s\S]*?href: "\/investor\/pools"/);
  assert.match(block, /key: "detail"[\s\S]*?code: "I-3"/);
  assert.match(block, /code: "I-1"/);
  assert.match(block, /code: "I-2"/);
});

test("page nav entries render as next/link anchors with the page modifier and code badge", () => {
  assert.match(shell, /return item\.href \? \(/);
  assert.match(shell, /<Link[\s\S]*?"op-nav-link",\s*"op-nav-link--page"/);
  assert.match(shell, /op-nav-code mono/);
  assert.match(
    shell,
    /aria-current=\{activeNav === item\.key \? "page" : undefined\}/,
  );
});

test("detailHref defaults to the pool register and overrides only the detail entry", () => {
  assert.match(shell, /detailHref = "\/investor\/pools",/);
  assert.match(shell, /detailHref\?: string;/);
  assert.match(shell, /item\.key === "detail"/);
  assert.match(shell, /href: detailHref/);
  assert.match(shell, /item\.key === "book"/);
  assert.match(shell, /href: bookHref/);
  assert.match(shell, /\[detailHref, bookHref\],/);
});

test("non-page nav entries stay in-page actions", () => {
  const group = shell.slice(shell.indexOf('group: "Portfolio"'));
  const block = group.slice(0, group.indexOf("];"));
  // "My investments" became its own route in I-6; every other Portfolio entry
  // must remain an in-page action with no href and no page code.
  const withoutPortfolio = block
    .split("\n")
    .filter((line) => !line.includes("href:") && !line.includes("code:"))
    .join("\n");
  assert.doesNotMatch(withoutPortfolio, /href:/);
  assert.doesNotMatch(withoutPortfolio, /code:/);
  assert.match(
    block,
    /key: "portfolio"[\s\S]*?href: "\/investor\/investments"/,
  );
  assert.match(shell, /onClick=\{\(\) => navigate\(item\.key\)\}/);
});

test("the command palette routes page entries with the app router", () => {
  assert.match(shell, /import \{ useRouter \} from "next\/navigation"/);
  assert.match(shell, /const router = useRouter\(\);/);
  assert.match(shell, /router\.push\(item\.href\)/);
});

test("the mobile bottom nav links the three routes and keeps in-page buttons", () => {
  const start = shell.indexOf("iv-mobile-nav d-lg-none");
  const block = shell.slice(start, start + 2600);
  assert.match(block, /label: "Overview"[\s\S]*?href: "\/investor"/);
  assert.match(block, /label: "Pools"[\s\S]*?href: "\/investor\/pools"/);
  assert.match(block, /label: "Detail"[\s\S]*?href: detailHref/);
  assert.match(block, /<Link[\s\S]*?aria-current=/);
  assert.match(
    block,
    /<button[\s\S]*?onClick=\{\(\) => navigate\(item\.key\)\}/,
  );
});

test("each page passes a resolvable detailHref and its own active key", () => {
  assert.match(
    detail,
    /activeNav="detail"|useState<InvestorNavKey>\("detail"\)/,
  );
  assert.match(
    detail,
    /detailHref=\{`\/investor\/pools\/\$\{overview\.id\}`\}/,
  );
  assert.match(
    overview,
    /detailHref=\{`\/investor\/pools\/\$\{data\.activePools\[0\]\?\.id \?\? data\.upcoming\[0\]\?\.id \?\? "pkg_01"\}`\}/,
  );
  assert.match(pools, /detailHref=\{`\/investor\/pools\/\$/);
  assert.match(
    pools,
    /modal\?\.kind === "poolDetail" \? modal\.id : undefined/,
  );
  assert.match(pools, /"pkg_01"/);
});

test("page modals stay owned by their page component, never the shell", () => {
  assert.doesNotMatch(shell, /desk-modal/);
  assert.doesNotMatch(shell, /DialogKind|ModalKind/);
  const dialogCount = (src) => (src.match(/\bkind === "[\w]+"/g) || []).length;
  for (const src of [overview, pools, detail]) {
    assert.ok(
      dialogCount(src) > 0,
      "each page keeps its own dialog kind switches",
    );
  }
  assert.notEqual(overview, pools);
  assert.notEqual(pools, detail);
});

test("shell links are styled as nav items in the stylesheet", () => {
  assert.match(shellCss, /a\.op-nav-link \{[\s\S]*?text-decoration: none;/);
  assert.match(shellCss, /\.op-nav-link--page \{/);
  assert.match(shellCss, /\.op-nav-code \{/);
  assert.match(
    shellCss,
    /\.op-investor-rail \.op-nav-code|op-nav-code[\s\S]*?display: none;/,
  );
  assert.match(shellCss, /\.iv-mobile-nav a \{/);
  assert.match(
    shellCss,
    /\.iv-mobile-nav button\.is-active,\s*\n\.iv-mobile-nav a\.is-active \{/,
  );
  assert.match(
    shellCss,
    /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/,
  );
});

test("the three routes are distinct entries with their own page components", () => {
  assert.match(routes.overview, /InvestorOverviewPage/);
  assert.match(routes.pools, /InvestorPoolsPage/);
  assert.match(routes.detail, /InvestorPoolDetailPage/);
  const set = new Set([routes.overview, routes.pools, routes.detail]);
  assert.equal(set.size, 3);
  for (const route of Object.values(routes)) {
    assert.match(route, /@/);
  }
});

test("page stylesheets stay separate per route", () => {
  const styles = [
    "src/styles/pages/investor-overview.css",
    "src/styles/pages/investor-pools.css",
    "src/styles/pages/investor-pool-detail.css",
  ];
  for (const file of styles) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", file)), file);
  }
  const globals = read("src/app/globals.css");
  assert.match(globals, /investor-overview\.css/);
  assert.match(globals, /investor-pools\.css/);
  assert.match(globals, /investor-pool-detail\.css/);
});
