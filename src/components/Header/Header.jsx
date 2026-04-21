import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={`${styles.header} glass`}>
      <div className={styles.container}>
        <div className={styles.left}>
          <Link href="/" className={styles.logo}>
            Hà Nhân <span className="jade-text">Movie</span>
          </Link>
          <nav className={styles.nav}>
            <Link href="/" className={styles.active}>Trang Chủ</Link>
            <Link href="/2d">Hoạt Hình 2D</Link>
            <Link href="/3d">Hoạt Hình 3D</Link>
            <Link href="/top">Bảng Xếp Hạng</Link>
          </nav>
        </div>

        <div className={styles.right}>
          <div className={styles.search}>
            <input type="text" placeholder="Tìm kiếm phim tu tiên..." className={styles.searchInput} />
            <button className={styles.searchBtn}>🔍</button>
          </div>
          <button className={styles.loginBtn}>Đăng nhập</button>
        </div>
      </div>
    </header>
  );
}
