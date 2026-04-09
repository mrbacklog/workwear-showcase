'use client';

import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';
import { FeedbackDrawer } from './FeedbackDrawer';

export function FeedbackDrawerAuth() {
  const { isUnlocked } = useShowcaseAuth();
  if (!isUnlocked) return null;
  return <FeedbackDrawer />;
}
