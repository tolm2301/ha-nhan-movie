import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header/Header'

const inter = Inter({ subsets: ['latin', 'vietnamese'], weight: ['300', '400', '600', '700'] })

export const metadata = {
  title: 'Hà Nhân Movie',
  description: 'Nền tảng xem phim giả tưởng, tu tiên, hoạt hình 2D/3D đỉnh cao.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  )
}
