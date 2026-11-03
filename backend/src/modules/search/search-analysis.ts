import type { estypes } from '@elastic/elasticsearch';
import type { SearchProfile } from './search.types.js';

export const SYNONYM_SET_ID = 'vi-common';

/**
 * Bộ phân tích tiếng Việt dùng chung, không cần plugin (BR-04).
 * Đã kiểm chứng trên ES 9.2.0, xem workspace/features/017-search-elasticsearch/analysis-and-queries.md.
 * Index tham chiếu bộ `vi-common` nên bộ này phải tồn tại TRƯỚC khi tạo index.
 */
export const VI_ANALYSIS: estypes.IndicesIndexSettingsAnalysis = {
  char_filter: {
    strip_combining: {
      type: 'pattern_replace',
      pattern: '[\\u0300-\\u036f]',
      replacement: '',
    },
  },
  filter: {
    shingle_compact: {
      type: 'shingle',
      min_shingle_size: 2,
      max_shingle_size: 3,
      token_separator: '',
      output_unigrams: true,
    },
    synonym_vi: {
      type: 'synonym_graph',
      synonyms_set: SYNONYM_SET_ID,
      updateable: true,
    },
  },
  analyzer: {
    vi_exact: {
      type: 'custom',
      tokenizer: 'standard',
      filter: ['lowercase'],
    },
    vi_fold: {
      type: 'custom',
      char_filter: ['strip_combining'],
      tokenizer: 'standard',
      filter: ['lowercase', 'asciifolding'],
    },
    vi_compact: {
      type: 'custom',
      char_filter: ['strip_combining'],
      tokenizer: 'standard',
      filter: ['lowercase', 'asciifolding', 'shingle_compact'],
    },
    vi_fold_synonym: {
      type: 'custom',
      char_filter: ['strip_combining'],
      tokenizer: 'standard',
      filter: ['lowercase', 'asciifolding', 'synonym_vi'],
    },
  },
};

const DEFAULT_REFRESH_INTERVAL = '5s';

export interface IndexDefinition {
  settings: estypes.IndicesIndexSettings;
  mappings: estypes.MappingTypeMapping;
}

type AnyProfile = Pick<
  SearchProfile<unknown, unknown>,
  'fields' | 'filters' | 'refreshInterval'
>;

/** Mapping `dynamic: strict` + trường văn bản ngắn/dài + trường lọc + `docId` (FR-15, BR-05). */
export function buildIndexDefinition(profile: AnyProfile): IndexDefinition {
  const properties: Record<string, estypes.MappingProperty> = {
    docId: { type: 'keyword' },
  };

  for (const field of profile.fields) {
    properties[field.name] = field.short
      ? {
          type: 'text',
          analyzer: 'vi_exact',
          fields: {
            fold: {
              type: 'text',
              analyzer: 'vi_fold',
              search_analyzer: 'vi_fold_synonym',
            },
            compact: {
              type: 'text',
              analyzer: 'vi_compact',
              search_analyzer: 'vi_fold',
            },
            sayt: { type: 'search_as_you_type', analyzer: 'vi_fold' },
          },
        }
      : {
          type: 'text',
          analyzer: 'vi_exact',
          fields: {
            fold: {
              type: 'text',
              analyzer: 'vi_fold',
              search_analyzer: 'vi_fold_synonym',
            },
          },
        };
  }

  for (const filter of profile.filters) {
    properties[filter.name] = { type: filter.type };
  }

  return {
    settings: {
      analysis: VI_ANALYSIS,
      refresh_interval: profile.refreshInterval ?? DEFAULT_REFRESH_INTERVAL,
    },
    mappings: { dynamic: 'strict', properties },
  };
}
