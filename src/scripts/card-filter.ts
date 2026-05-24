/**
 * URL パラメータ解釈と階層ドロップダウン制御 (Task 6.4 / FR-004 / FR-005 / FR-006)。
 *
 * - 起動時に `?target=` を読み、leaf id または aliases にマッチすれば
 *   裏面起動 + 該当 tag でフィルタリング、マッチしなければ裏面 + All フォールバック
 * - ?target= 適用後は history.replaceState で URL を `/` に書き換える (FR-005)
 * - 3 段ドロップダウン (Category / Subcategory / Tag) は変更イベントで下位を
 *   動的に再構築し、Tag が選ばれたら .repo-card に .is-hidden を付替える
 * - 表示制御は完全に DOM クラスの付替のみ (NFR Offline)
 */
import { flipTo } from "./card-flip";

interface Leaf {
  id: string;
  label: string;
  aliases?: string[];
}
interface Subcategory {
  id: string;
  label: string;
  leaves: Leaf[];
}
interface HierarchyNode {
  id: string;
  label: string;
  children: Subcategory[];
}
interface RepoLite {
  id: string;
  tags: string[];
}
interface Embedded {
  hierarchy: HierarchyNode[];
  repos: RepoLite[];
}

const dataEl = document.getElementById("card-data");
if (dataEl?.textContent) {
  try {
    const data = JSON.parse(dataEl.textContent) as Embedded;
    init(data);
  } catch {
    // 何もしない: 親 layout が card-data を出力できない異常系
  }
}

interface Availability {
  /** repo がひとつでも持つ leaf id の集合 */
  leaves: Set<string>;
  /** 表示可能な subcategory id を持つ category id の集合 */
  categories: Set<string>;
  /** category id → 表示可能な subcategory id の集合 */
  subcategoriesByCategory: Map<string, Set<string>>;
}

function buildAvailability(
  hierarchy: HierarchyNode[],
  repos: RepoLite[],
): Availability {
  const leaves = new Set<string>();
  for (const r of repos) for (const t of r.tags) leaves.add(t);

  const subcategoriesByCategory = new Map<string, Set<string>>();
  const categories = new Set<string>();
  for (const cat of hierarchy) {
    const availSubs = new Set<string>();
    for (const sub of cat.children) {
      if (sub.leaves.some((l) => leaves.has(l.id))) availSubs.add(sub.id);
    }
    if (availSubs.size > 0) {
      subcategoriesByCategory.set(cat.id, availSubs);
      categories.add(cat.id);
    }
  }
  return { leaves, categories, subcategoriesByCategory };
}

function init(data: Embedded): void {
  const categorySelect = byId<HTMLSelectElement>("filter-category");
  const subcategorySelect = byId<HTMLSelectElement>("filter-subcategory");
  const tagSelect = byId<HTMLSelectElement>("filter-tag");
  if (!categorySelect || !subcategorySelect || !tagSelect) return;

  const avail = buildAvailability(data.hierarchy, data.repos);

  // Category dropdown を availability で再構築 (静的 HTML 側は全件入っている)
  populateCategories(categorySelect, data.hierarchy, avail);

  // 1. URL ?target= の初期処理 (FR-004 / FR-005)
  const params = new URLSearchParams(location.search);
  const target = params.get("target");

  if (target) {
    const resolved = resolveTarget(target, data.hierarchy);
    if (resolved && avail.leaves.has(resolved.leaf.id)) {
      // dropdown を該当パスに合わせる
      selectValue(categorySelect, resolved.category.id);
      populateSubcategories(subcategorySelect, resolved.category, avail);
      selectValue(subcategorySelect, resolved.subcategory.id);
      populateTags(tagSelect, resolved.subcategory, avail);
      selectValue(tagSelect, resolved.leaf.id);
      applyFilter(resolved.leaf.id);
    } else {
      applyFilter(null);
    }
    flipTo("back");
    history.replaceState(null, "", "/");
  } else {
    applyFilter(null);
  }

  // 2. dropdown 連動 (FR-006)
  categorySelect.addEventListener("change", () => {
    const catId = categorySelect.value;
    const cat = data.hierarchy.find((c) => c.id === catId);
    if (cat) {
      populateSubcategories(subcategorySelect, cat, avail);
    } else {
      resetSelect(subcategorySelect);
    }
    resetSelect(tagSelect);
    applyFilter(null);
  });

  subcategorySelect.addEventListener("change", () => {
    const subId = subcategorySelect.value;
    const catId = categorySelect.value;
    const cat = data.hierarchy.find((c) => c.id === catId);
    const sub = cat?.children.find((s) => s.id === subId);
    if (sub) {
      populateTags(tagSelect, sub, avail);
    } else {
      resetSelect(tagSelect);
    }
    applyFilter(null);
  });

  tagSelect.addEventListener("change", () => {
    const tagId = tagSelect.value;
    applyFilter(tagId || null);
  });
}

function resolveTarget(
  target: string,
  hierarchy: HierarchyNode[],
): { category: HierarchyNode; subcategory: Subcategory; leaf: Leaf } | null {
  for (const category of hierarchy) {
    for (const subcategory of category.children) {
      for (const leaf of subcategory.leaves) {
        if (leaf.id === target || (leaf.aliases?.includes(target) ?? false)) {
          return { category, subcategory, leaf };
        }
      }
    }
  }
  return null;
}

function applyFilter(leafId: string | null): void {
  const cards = document.querySelectorAll<HTMLElement>(".repo-card");
  let visible = 0;
  for (const card of cards) {
    let show: boolean;
    if (leafId === null) {
      show = true;
    } else {
      const tags = (card.dataset.tags ?? "").split(",").filter(Boolean);
      show = tags.includes(leafId);
    }
    card.classList.toggle("is-hidden", !show);
    if (show) visible += 1;
  }
  // ヒット 0 件のときは "該当なし" メッセージを表示
  const emptyEl = document.getElementById("filter-empty-state");
  if (emptyEl) {
    if (cards.length > 0 && visible === 0) {
      emptyEl.removeAttribute("hidden");
    } else {
      emptyEl.setAttribute("hidden", "");
    }
  }
}

function populateCategories(
  select: HTMLSelectElement,
  hierarchy: HierarchyNode[],
  avail: Availability,
): void {
  select.innerHTML = "";
  appendOption(select, "", "All");
  for (const cat of hierarchy) {
    if (avail.categories.has(cat.id)) {
      appendOption(select, cat.id, cat.label);
    }
  }
}

function populateSubcategories(
  select: HTMLSelectElement,
  category: HierarchyNode,
  avail: Availability,
): void {
  const availSubs = avail.subcategoriesByCategory.get(category.id);
  select.innerHTML = "";
  appendOption(select, "", "All");
  for (const sub of category.children) {
    if (!availSubs || availSubs.has(sub.id)) {
      appendOption(select, sub.id, sub.label);
    }
  }
  select.disabled = false;
}

function populateTags(
  select: HTMLSelectElement,
  subcategory: Subcategory,
  avail: Availability,
): void {
  select.innerHTML = "";
  appendOption(select, "", "All");
  for (const leaf of subcategory.leaves) {
    if (avail.leaves.has(leaf.id)) {
      appendOption(select, leaf.id, leaf.label);
    }
  }
  select.disabled = false;
}

function resetSelect(select: HTMLSelectElement): void {
  select.innerHTML = "";
  appendOption(select, "", "All");
  select.disabled = true;
}

function appendOption(
  select: HTMLSelectElement,
  value: string,
  label: string,
): void {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
}

function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
