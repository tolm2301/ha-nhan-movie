import moviesData from './movies.json';

// Split the crawled data into buckets
export const allMovies = moviesData;
export const trendingMovies = moviesData.slice(0, 15);

export const tienHiepMovies = moviesData.filter(m => m.tags === 'Tiên Hiệp 3D');
export const tauHaiMovies = moviesData.filter(m => m.tags === 'Tấu Hài');
export const xuyenKhongMovies = moviesData.filter(m => m.tags === 'Xuyên Không');
export const heThongMovies = moviesData.filter(m => m.tags === 'Hệ Thống');
