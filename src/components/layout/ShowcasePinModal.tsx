'use client';

import { PinModal } from '@/components/change-request/PinModal';
import { useShowcaseAuth } from '@/contexts/ShowcaseAuthContext';

export function ShowcasePinModal() {
  const { showPinModal, isAuthenticating, errorMessage, unlock, closePinModal } = useShowcaseAuth();

  return (
    <PinModal
      isOpen={showPinModal}
      isLoading={isAuthenticating}
      errorMessage={errorMessage}
      onSubmit={unlock}
      onClose={closePinModal}
    />
  );
}
