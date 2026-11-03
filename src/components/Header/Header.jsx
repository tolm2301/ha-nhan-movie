"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Header.module.css';

export default function Header({ initialCategoryMenu = [] }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const categoryMenu = initialCategoryMenu;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  const submitSearch = (event) => {
    if (event) event.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      router.push('/search');
      setIsMobileOpen(false);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setIsMobileOpen(false);
  };

  return (
    <>
      <header className={`${styles.header} ${isScrolled ? styles.scrolled : 'glass'}`}>
        <div className={styles.container}>
          <div className={styles.left}>
            <button
              type="button"
              className={styles.mobileToggle}
              onClick={() => setIsMobileOpen(true)}
              aria-label="Mở danh mục điều hướng"
              aria-expanded={isMobileOpen}
            >
              ☰
            </button>
            <Link href="/" className={styles.logo} onClick={() => setIsMobileOpen(false)}>
              Hà Nhân <span className="comic-text-red">Movie</span>
            </Link>
            <nav
              className={`${styles.nav} ${isMobileOpen ? styles.navOpen : ''}`}
              aria-label="Danh mục phim chính"
            >
              {isMobileOpen && (
                <div className={styles.mobileNavHeader}>
                  <span className={styles.mobileNavTitle}>Danh Mục Phim</span>
                  <button
                    type="button"
                    className={styles.closeMenu}
                    onClick={() => setIsMobileOpen(false)}
                    aria-label="Đóng danh mục điều hướng"
                  >
                    ×
                  </button>
                </div>
              )}
              <Link
                href="/"
                className={pathname === '/' ? styles.active : ''}
                aria-current={pathname === '/' ? 'page' : undefined}
                onClick={() => setIsMobileOpen(false)}
              >
                Trang Chủ
              </Link>
              {categoryMenu.map((category) => {
                const categoryHref = `/category/${category.slug}`;
                const isActive = pathname === categoryHref;
                return (
                  <Link
                    key={category.slug}
                    href={categoryHref}
                    className={isActive ? styles.active : ''}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    {category.tag}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className={styles.right}>
            <form className={styles.search} onSubmit={submitSearch} role="search">
              <input
                type="search"
                placeholder="Tìm tên phim, thể loại..."
                aria-label="Tìm tên phim, thể loại"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className={styles.searchBtn}
                aria-label="Thực hiện tìm kiếm"
                title="Tìm kiếm"
              >
                ⌕
              </button>
            </form>
          </div>
        </div>
      </header>
      {isMobileOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}