const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-5517015894265969'
const DEFAULT_ADSENSE_SLOT_IDS = {
  homeAfterRails: '',
  categoryAfterFirstBlock: '',
  watchAfterRelated: '',
  searchAfterResults: '',
}

const AD_SLOT_ENV_KEYS = {
  homeAfterRails: 'NEXT_PUBLIC_ADSENSE_SLOT_HOME_AFTER_RAILS',
  categoryAfterFirstBlock: 'NEXT_PUBLIC_ADSENSE_SLOT_CATEGORY_AFTER_FIRST_BLOCK',
  watchAfterRelated: 'NEXT_PUBLIC_ADSENSE_SLOT_WATCH_AFTER_RELATED',
  searchAfterResults: 'NEXT_PUBLIC_ADSENSE_SLOT_SEARCH_AFTER_RESULTS',
}

function readEnvValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getAdsenseClientId() {
  return readEnvValue(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) || DEFAULT_ADSENSE_CLIENT_ID
}

export function getAdsenseSlotId(placement) {
  const envKey = AD_SLOT_ENV_KEYS[placement]
  if (!envKey) return DEFAULT_ADSENSE_SLOT_IDS[placement] || ''

  return readEnvValue(process.env[envKey]) || DEFAULT_ADSENSE_SLOT_IDS[placement] || ''
}

export function getAdsenseScriptUrl() {
  const clientId = getAdsenseClientId()
  if (!clientId) return ''

  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
}

export function isAdsenseEnabled() {
  return Boolean(getAdsenseClientId())
}

export function isAdsensePlacementEnabled(placement) {
  return Boolean(getAdsenseClientId() && getAdsenseSlotId(placement))
}

export function hasAnyAdsensePlacementEnabled() {
  return Object.keys(AD_SLOT_ENV_KEYS).some(placement => isAdsensePlacementEnabled(placement))
}
