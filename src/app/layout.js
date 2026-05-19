import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header/Header'
import GlobalDismissOverlay from '@/components/GlobalDismissOverlay/GlobalDismissOverlay'
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from '@/lib/seo'
import Script from 'next/script'
import { getAdsenseScriptUrl, hasAnyAdsensePlacementEnabled } from '@/lib/adsense'
import { getCategoryMenu } from '@/lib/data'

const inter = Inter({ subsets: ['latin', 'vietnamese'], weight: ['300', '400', '600', '700'] })
const vignetteScript = "(function(s){s.dataset.zone='11026819',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))"
const inpagePushScript = "(function(s){s.dataset.zone='11026815',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))"
export const metadata = {
  applicationName: SITE_NAME,
  verification: {
    google: "zieNpzEc3xrUuTTUxE3IjuupFlQ48hj-xM9HhJi8-GA",
  },
  metadataBase: new URL(getSiteUrl()),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/icon.svg',
  },
  other: {
    'google-adsense-account': 'ca-pub-5517015894265969',
  },
}

export default async function RootLayout({ children }) {
  const categoryMenu = await getCategoryMenu()
  const adsenseScriptUrl = getAdsenseScriptUrl()

  return (
    <html lang="vi">
      <head>
        <meta name="monetag" content="a583331237e4e8666b6962c573ceb86c" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.youtube-nocookie.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
        <link rel="preconnect" href="https://s.ytimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://s.ytimg.com" />
      </head>
      <body className={inter.className}>
        {hasAnyAdsensePlacementEnabled() && adsenseScriptUrl ? (
          <Script src={adsenseScriptUrl} strategy="afterInteractive" crossOrigin="anonymous" />
        ) : null}
        <Script id="vignette-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: vignetteScript }} />
        <Script id="inpage-push-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: inpagePushScript }} />
        <Header initialCategoryMenu={categoryMenu} />
        <GlobalDismissOverlay />
        <div>{children}</div>
      </body>
    </html>
  )
}
