import { useMfaStatus } from '@/hooks/useMfaStatus';
import { isStaffRole } from '@/lib/admin-access';

export function useStaffToolsAccess(role: string | undefined | null): {
  isStaff: boolean;
  canUseStaffTools: boolean;
  mfaLoading: boolean;
  needsStepUp: boolean;
  needsEnrollment: boolean;
} {
  const isStaff = isStaffRole(role);
  const { data: mfaStatus, isLoading: mfaLoading } = useMfaStatus();
  const currentLevel = mfaStatus?.currentLevel ?? null;
  const hasVerifiedFactor = !!mfaStatus?.verifiedFactor;

  return {
    isStaff,
    canUseStaffTools: isStaff && currentLevel === 'aal2',
    mfaLoading: isStaff && mfaLoading,
    needsStepUp: isStaff && hasVerifiedFactor && currentLevel !== 'aal2',
    needsEnrollment: isStaff && !mfaLoading && !hasVerifiedFactor,
  };
}
