"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { categoryMenu } from '@/lib/data';
import styles from './Header.module.css';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
              Hà Nhân <span className="comic-text-red">Cartoon</span>
            </Link>
            <nav className={`${styles.nav} ${isMobileOpen ? styles.navOpen : ''}`}>
               {isMobileOpen && (
                 <button className={styles.closeMenu} onClick={() => setIsMobileOpen(false)}>×</button>
               )}
              <Link href="/" className={styles.active} onClick={() => setIsMobileOpen(false)}>Trang Chủ</Link>
              {categoryMenu.slice(0, 5).map(category => (
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
                placeholder="Tìm phim bựa..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
              <button className={styles.searchBtn} onClick={() => handleSearch({key: 'Enter'})}>🔍</button>
            </div>
            <button className={styles.loginBtn} onClick={() => setIsLoginOpen(true)}>Đăng nhập</button>
          </div>
        </div>
      </header>

      {/* Login Modal Mock */}
      {isLoginOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsLoginOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setIsLoginOpen(false)}>×</button>
            <h2 className="comic-text-yellow" style={{fontSize: '2rem', marginBottom: '20px'}}>ĐĂNG NHẬP VÀO HỆ THỐNG</h2>
            <p style={{marginBottom: '24px', color: '#ccc'}}>Vì bạn quá làm biếng nên hệ thống ép bạn phải đăng nhập!</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <input type="text" placeholder="Tên Đạo Hữu" style={{padding: '12px', borderRadius: '4px', border: '3px solid #000', background: '#333', color: '#fff'}} />
              <input type="password" placeholder="Mật Khẩu Phá Án" style={{padding: '12px', borderRadius: '4px', border: '3px solid #000', background: '#333', color: '#fff'}} />
              <button className="btn-primary" onClick={() => setIsLoginOpen(false)}>VÀO TRUYỆN MỚI</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
