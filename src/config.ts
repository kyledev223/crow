/**
 * Single source of truth for everything that is a placeholder today.
 *
 * While `contractAddress`, `buyUrl` and `explorerUrl` are `null`, every
 * control that depends on them renders greyed out with a "Coming soon" tag
 * and does nothing on click. Fill a value in and the matching controls turn
 * active on their own: the address becomes copy-to-clipboard, the buttons
 * become real links.
 */
export interface SiteConfig {
  name: string
  ticker: string
  /** Full contract address, e.g. "0xAbc…". `null` = disabled placeholder. */
  contractAddress: string | null
  /** Where "Buy $CAW" goes. `null` = disabled placeholder. */
  buyUrl: string | null
  /** Where "Explorer" goes. `null` = disabled placeholder. */
  explorerUrl: string | null
  /** "Join the flock" links. "#" is an inert placeholder. */
  communityUrl: string
  followUrl: string
  stats: { label: string; value: string }[]
}

export const config: SiteConfig = {
  name: 'Coupon Crows',
  ticker: '$CAW',
  contractAddress: null,
  buyUrl: null,
  explorerUrl: null,
  communityUrl: '#',
  followUrl: '#',
  stats: [
    { label: 'Token', value: 'Coupon Crows · $CAW' },
    { label: 'Supply', value: '1,000,000,000' },
    { label: 'Chain', value: 'TBA' },
    { label: 'Rewards', value: 'TBA' },
  ],
}

/** Shown in place of the address while `contractAddress` is null. */
export const PLACEHOLDER_ADDRESS = '0x0000…0000'
