export const SEGMENT_OPTIONS = ['platinum', 'gold', 'silver', 'bronze', 'inactive'] as const;
export type CustomerSegment = typeof SEGMENT_OPTIONS[number];

export const segmentConfig: Record<string, { label: string; description: string; color: string; badgeClass: string }> = {
  platinum: { 
    label: 'Platinum', 
    description: '₹25L+ annual potential',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    badgeClass: 'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-700 dark:bg-purple-900 dark:text-purple-200',
  },
  gold: { 
    label: 'Gold', 
    description: '₹15L+ annual potential',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    badgeClass: 'border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
  },
  silver: { 
    label: 'Silver', 
    description: '₹8L+ annual potential',
    color: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    badgeClass: 'border-gray-300 bg-gray-200 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
  },
  bronze: { 
    label: 'Bronze', 
    description: '₹3L+ annual potential',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    badgeClass: 'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900 dark:text-orange-200',
  },
  inactive: { 
    label: 'Inactive', 
    description: 'Below ₹3L, no recent activity',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    badgeClass: 'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900 dark:text-red-200',
  },
};

export function getSegmentConfig(segment: string | null | undefined) {
  return segmentConfig[segment || 'bronze'] || segmentConfig.bronze;
}
