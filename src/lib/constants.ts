export type Category =
  | 'Product'
  | 'Design'
  | 'Startup'
  | 'Healthcare'
  | 'Tech'
  | 'Creative';

export const CATEGORIES: Category[] = [
  'Product',
  'Design',
  'Startup',
  'HealthCare',
  'Tech',
  'Creative',
];

export const CATEGORY_STYLES: Record<
  Category,
  { bg: string; text: string; ring: string; dot: string }
> = {
  Product: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    ring: 'ring-sky-200',
    dot: 'bg-sky-500',
  },
  Design: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    dot: 'bg-rose-500',
  },
  Startup: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  HealthCare: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
  },
  Tech: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    ring: 'ring-violet-200',
    dot: 'bg-violet-500',
  },
  Creative: {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    ring: 'ring-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
};

export type SortMode = 'top' | 'new' | 'hot';
