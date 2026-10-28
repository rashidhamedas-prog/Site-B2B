import { SetMetadata } from '@nestjs/common';
import type { OmnichannelRole } from '../omnichannel-rbac';

export const OMNICHANNEL_MIN_ROLE_KEY = 'omnichannel_min_role';
export const OMNICHANNEL_REQUIRES_GO_REF_KEY = 'omnichannel_requires_go_ref';
export const OMNICHANNEL_OWNER_WHEN_LIVE_KEY = 'omnichannel_owner_when_live';

/** Minimum omnichannel role when OMNICHANNEL_RBAC_ENABLED=true. */
export const OmnichannelMinRole = (role: OmnichannelRole) =>
  SetMetadata(OMNICHANNEL_MIN_ROLE_KEY, role);

/** Body must include non-empty goRef when RBAC is on (Owner-tier). */
export const RequiresGoRef = () => SetMetadata(OMNICHANNEL_REQUIRES_GO_REF_KEY, true);

/**
 * Route accepts PUBLISHER for dryRun=true; live (!dryRun) needs OWNER + goRef when RBAC on.
 * Use with @OmnichannelMinRole('PUBLISHER').
 */
export const OmnichannelOwnerWhenLive = () => SetMetadata(OMNICHANNEL_OWNER_WHEN_LIVE_KEY, true);
