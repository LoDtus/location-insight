export const SEED_TOPICS = [
  {
    slug: 'ho-tay',
    name: 'Hồ Tây',
    summary: 'Ngõ, kè và tiện ích quanh hồ.',
  },
  {
    slug: 'gia-nha',
    name: 'Giá nhà',
    summary: 'Cách đọc khung giá, không phải giá chào.',
  },
  {
    slug: 'ngo-cu',
    name: 'Ngõ cũ',
    summary: 'Chủ đề đã khóa, chỉ còn để đọc.',
    status: 'locked' as const,
  },
] as const;

export const SEED_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=',
  'base64',
);
