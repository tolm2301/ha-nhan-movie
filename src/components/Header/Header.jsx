"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';

export default function Header({ initialCategoryMenu = [] }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const categoryMenu = initialCategoryMenu;
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  return (
    <>
      <header className={`${styles.header} ${isScrolled ? styles.scrolled : 'glass'}`}>
        <div className={styles.container}>
          <div className={styles.left}>
            <button className={styles.mobileToggle} onClick={() => setIsMobileOpen(true)}>
              ☰
            </button>
            <Link href="/" className={styles.logo}>
              Hà Nhân <span className="comic-text-red">Movie</span>
            </Link>
            <nav className={`${styles.nav} ${isMobileOpen ? styles.navOpen : ''}`}>
               {isMobileOpen && (
                 <button className={styles.closeMenu} onClick={() => setIsMobileOpen(false)}>×</button>
               )}
              <Link href="/" className={styles.active} onClick={() => setIsMobileOpen(false)}>Trang Chủ</Link>
               {categoryMenu.map(category => (
                  <Link
                    key={category.slug}
                    href={`/category/${category.slug}`}
                  onClick={() => setIsMobileOpen(false)}
                >
                  🏷️ {category.tag}
                </Link>
              ))}
            </nav>
          </div>
          
          <div className={styles.right}>
            <div className={styles.search}>
              <input 
                type="text" 
                placeholder="Tìm phim..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
              <button className={styles.searchBtn} onClick={() => handleSearch({key: 'Enter'})}>🔍</button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
