import React from 'react';
import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.background}>
        <img src="/images/hero.png" alt="Phàm Nhân Tu Tiên" className={styles.bgImage} />
        <div className={styles.overlay}></div>
      </div>
      
      <div className={styles.content}>
        <span className={styles.badge}>Mới cập nhật Tập 85</span>
        <h1 className={styles.title}>
          Phàm Nhân <br/><span className="jade-text">Tu Tiên</span>
        </h1>
        <p className={styles.description}>
          Hàn Lập, một thiếu niên bình thường xưng bá tu tiên giới. Từ một phàm nhân vươn lên trở thành cường giả đỉnh cao, đạp phá hư không, phi thăng tiên giới. Bộ hoạt hình 3D tu tiên đỉnh cao không thể bỏ lỡ.
        </p>
        
        <div className={styles.actions}>
          <button className="btn-primary">▶ Xem Ngay</button>
          <button className="btn-secondary">+ Thêm vào danh sách</button>
        </div>
      </div>
    </section>
  );
}
