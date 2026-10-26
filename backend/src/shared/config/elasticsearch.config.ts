import type { estypes } from '@elastic/elasticsearch';

export const ElasticsearchConfig = {
  indices: {} as Record<string, string>,
  aliases: {} as Record<string, string>,
  defaultSettings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    refresh_interval: '10s',
  } satisfies estypes.IndicesIndexSettings,
  commonMappings: {
    properties: {
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      deletedAt: { type: 'date' },
    },
  } satisfies estypes.MappingTypeMapping,
};
