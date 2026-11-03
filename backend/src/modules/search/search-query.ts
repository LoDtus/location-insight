import type { estypes } from '@elastic/elasticsearch';
import type {
  SearchFieldSpec,
  SearchFilterClause,
  SearchProfile,
  SortSpec,
} from './search.types.js';

export const DEFAULT_SCORE_RATIO_MIN = 0.15;

/** Boost từng tầng xếp hạng: cụm đúng có dấu > không dấu > đủ từ đảo thứ tự > chữ dính > fuzzy > gõ dở > một phần. */
const TIER = {
  phraseExact: 10,
  phraseFolded: 6,
  allTerms: 4,
  compact: 3,
  fuzzy: 2,
  typing: 2,
  partial: 1,
} as const;

/**
 * Các mệnh đề `should` của một trường. `q` luôn đi vào ô `query` dạng chuỗi của match/match_phrase/multi_match,
 * không bao giờ ghép vào cấu trúc truy vấn và không dùng query_string (threat-model T1).
 */
export function buildFieldClauses(
  field: SearchFieldSpec,
  q: string,
): estypes.QueryDslQueryContainer[] {
  const name = field.name;
  const boost = (tier: number): number => tier * field.boost;

  const clauses: estypes.QueryDslQueryContainer[] = [
    { match_phrase: { [name]: { query: q, boost: boost(TIER.phraseExact) } } },
    {
      match_phrase: {
        [`${name}.fold`]: { query: q, boost: boost(TIER.phraseFolded) },
      },
    },
    {
      match: {
        [`${name}.fold`]: {
          query: q,
          operator: 'and',
          boost: boost(TIER.allTerms),
        },
      },
    },
    {
      match: {
        [`${name}.fold`]: {
          query: q,
          minimum_should_match: '60%',
          boost: boost(TIER.partial),
        },
      },
    },
  ];

  if (field.short) {
    clauses.push(
      {
        match: {
          [`${name}.compact`]: {
            query: q,
            operator: 'and',
            boost: boost(TIER.compact),
          },
        },
      },
      {
        match: {
          [`${name}.fold`]: {
            query: q,
            operator: 'and',
            fuzziness: 'AUTO',
            prefix_length: 1,
            max_expansions: 20,
            boost: boost(TIER.fuzzy),
          },
        },
      },
      {
        multi_match: {
          query: q,
          type: 'bool_prefix',
          fields: [
            `${name}.sayt`,
            `${name}.sayt._2gram`,
            `${name}.sayt._3gram`,
          ],
          boost: boost(TIER.typing),
        },
      },
    );
  }

  return clauses;
}

export function buildTextQuery(
  fields: readonly SearchFieldSpec[],
  q: string,
  filters: readonly SearchFilterClause[],
): estypes.QueryDslQueryContainer {
  return {
    bool: {
      filter: [...filters],
      should: fields.flatMap((field) => buildFieldClauses(field, q)),
      minimum_should_match: 1,
    },
  };
}

type SortProfile = Pick<
  SearchProfile<unknown, unknown>,
  'fields' | 'tieBreaker'
>;

export interface BuildRequestInput {
  index: string;
  profile: SortProfile;
  q: string;
  filters: readonly SearchFilterClause[];
  page: { size: number; from: number };
  sort?: SortSpec;
}

/** Yêu cầu `_search` hoàn chỉnh. Chỉ lấy `_id` và `_score` (`_source: false`) và không đếm tổng. */
export function buildSearchRequest(
  input: BuildRequestInput,
): estypes.SearchRequest {
  const tieBreak = input.profile.tieBreaker.map(toSort);
  const sort: estypes.Sort = input.sort
    ? [
        toSort(input.sort),
        { _score: { order: 'desc' } },
        ...tieBreak,
        { docId: { order: 'asc' } },
      ]
    : [{ _score: { order: 'desc' } }, ...tieBreak, { docId: { order: 'asc' } }];

  return {
    index: input.index,
    size: input.page.size,
    from: input.page.from,
    _source: false,
    track_total_hits: false,
    // Khi sắp xếp theo trường khác, vẫn cần điểm để cắt nhiễu (FR-06).
    track_scores: input.sort !== undefined,
    sort,
    query: buildTextQuery(input.profile.fields, input.q, input.filters),
  };
}

function toSort(spec: SortSpec): estypes.SortCombinations {
  return { [spec.field]: { order: spec.order } };
}

export interface ScoredHit {
  id: string;
  score: number | null;
}

/**
 * Loại kết quả có điểm dưới `ratio` × điểm cao nhất (FR-05). Dùng TỈ LỆ, không dùng `min_score` tuyệt đối:
 * điểm đúng nhưng thấp (ví dụ chữ dính) vẫn được giữ khi nó là kết quả tốt nhất.
 */
export function applyScoreCutoff(
  hits: readonly ScoredHit[],
  ratio: number = DEFAULT_SCORE_RATIO_MIN,
): ScoredHit[] {
  const scores = hits.flatMap((hit) => (hit.score === null ? [] : [hit.score]));
  if (scores.length === 0) return [...hits];
  const threshold = Math.max(...scores) * ratio;
  return hits.filter((hit) => hit.score === null || hit.score >= threshold);
}
