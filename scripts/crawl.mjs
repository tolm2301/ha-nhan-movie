import ytSearch from 'yt-search';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

async function crawlYouTube() {
  console.log("Bat dau crawl du lieu tu Youtube (Che do Nho Giot)...");

  try {
    const outPath = path.resolve('src/lib/movies.json');
    let oldData = [];

    if (existsSync(outPath)) {
      try {
        const raw = readFileSync(outPath, 'utf8');
        oldData = JSON.parse(raw);
        console.log(`Phat hien list video cu: ${oldData.length} video.`);
      } catch (e) {
        console.log("File cu bi loi, se tao lai tu dau.");
      }
    }

    // ===================================================================
    // DANH SÁCH MỤC TIÊU - Thêm/xoá kênh hoặc từ khoá tại đây
    // Cột trái = target, cột phải = gợi ý tag ưu tiên
    // ===================================================================
    const channelTargets = [
      '@HaNhanCartoon',
      '@Hanhansubchannel',
      '@keodeovietsub',
      '@Banhbaoreview2026',
      '@CibiiSub-01',
      '@GauHaiHuoc',
      '@GauHaiHuocOfficial',
      '@HoatHinhTrungQuoc-3D',
      '@ReviewPhim3DAI',
      '@HoatHinhReview',
    ];

    // Từ khoá bổ sung để đánh sâu vào nhiều chủ đề -> tăng số lượng
    const keywordTargets = [
      'Ha Nhan xuyen khong full',
      'Ha Nhan he thong full',
      'Ha Nhan cartoon full',
      'Ha Nhan Sub full',
      'phim hoat hinh trung quoc 3D full 2024',
      'Pham Nhan Tu Tien full',
      'hoat hinh tu tien vietsub full',
      'tom tat xuyen khong hai',
      'xuyen khong full bo vietsub',
      'hoat hinh gau truc meme',
      'gau hai huoc trung quoc',
      'Ha Nhan panda cartoon',
      'hoat hinh co trang full vietsub',
      'phim he thong full bo',
      'xuyen khong trong sinh vietsub',
      'bua nhat trang full',
      'keodeo vietsub full',
      'Ha Nhan review phim full',
    ];

    const searchTargets = [...channelTargets, ...keywordTargets];

    // ===================================================================
    // Blacklist - video có các tag/từ này sẽ bị loại thẳng
    // ===================================================================
    const badWords = [
      '#marriage', 'tiktok', 'remix', 'music video', 'karaoke',
      'hàn quốc', 'nhạc', 'live stream', 'vlog', 'podcast',
      'kpop', 'k-pop', 'drama hàn', 'phim hàn', "#remembering", "#humor", "#xuhuongyoutube", "#mukbang"
    ];

    let fetchedResults = [];

    for (let target of searchTargets) {
      console.log(`Crawl: ${target}`);
      try {
        const r = await ytSearch(target);

        const filteredVideos = r.videos.filter(v => {
          if (!v.videoId) return false;
          if (v.seconds < 90) return false;  // Bỏ video ngắn < 1.5 phút
          const t = v.title.toLowerCase();
          for (let bw of badWords) {
            if (t.includes(bw)) return false;
          }
          return true;
        });

        const videos = filteredVideos.map(v => {
          const t = v.title.toLowerCase();
          // Phân loại tag thông minh dựa trên nhiều từ khoá
          let tag = 'Khác';
          if (t.includes('3d') || t.includes('hoạt hình 3') || t.includes('phàm nhân') || t.includes('tiên hiệp')) {
            tag = 'Tiên Hiệp 3D';
          } else if (t.includes('gấu') || t.includes('panda') || t.includes('bựa') || t.includes('hài hước')) {
            tag = 'Tấu Hài';
          } else if (t.includes('xuyên không') || t.includes('trọng sinh') || t.includes('chuyển sinh')) {
            tag = 'Xuyên Không';
          } else if (t.includes('hệ thống') || t.includes('tu tiên')) {
            tag = 'Hệ Thống';
          }

          return {
            id: v.videoId,
            title: v.title,
            episodes: v.timestamp || 'Full',
            views: v.views
              ? (v.views > 1000000 ? (v.views / 1000000).toFixed(1) + 'M views' : Math.floor(v.views / 1000) + 'K views')
              : '?? views',
            thumbnail: v.thumbnail,
            tags: tag,
          };
        });

        fetchedResults = [...fetchedResults, ...videos];
      } catch (e) {
        console.log(`  -> Loi khi crawl ${target}: ${e.message}`);
      }
    }

    // Dedup vs. old data
    const oldIds = new Set(oldData.map(v => v.id));
    const uniqueNewIds = new Set();
    const newVideos = [];

    for (let v of fetchedResults) {
      if (!oldIds.has(v.id) && !uniqueNewIds.has(v.id)) {
        uniqueNewIds.add(v.id);
        newVideos.push(v);
      }
    }

    console.log(`===> Thu duoc ${newVideos.length} VIDEO MOI.`);

    const finalData = [...newVideos, ...oldData].slice(0, 1000);

    await fs.writeFile(outPath, JSON.stringify(finalData, null, 2));
    console.log(`Xong! Tong he thong: ${finalData.length} video.`);

  } catch (err) {
    console.error("Loi:", err);
  }
}

crawlYouTube();
