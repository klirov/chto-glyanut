import fs from "fs";
import path from "path";

try {
  process.loadEnvFile();
} catch (error) {}

const API_KEY = process.env.KINOPOISK_API_KEY || "";
const API_URL = "https://api.poiskkino.dev/v1.4/movie";

console.log("🔑 Отладочный лог ключа:", API_KEY ? `${API_KEY.slice(0, 4)}...` : "КЛЮЧ ПУСТОЙ");

async function fetchFromKP(contentType, limit = 250) {
  const url = `${API_URL}?page=1&limit=${limit}&type=${contentType}&rating.kp=6-10&votes.kp=5000-10000000`;

  const response = await fetch(url, {
    headers: {
      "X-API-KEY": API_KEY,
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Ошибка при запросе ${contentType}: ${response.statusText} (Статус: ${response.status})`);
  }

  const data = await response.json();
  return data.docs || [];
}

async function buildCache() {
  try {
    console.log("⏳ Начало сборки единого кэша...");

    console.log("🎬 Загрузка фильмов...");
    const rawMovies = await fetchFromKP("movie", 250);

    console.log("🍿 Загрузка сериалов...");
    const rawSeries = await fetchFromKP("tv-series", 250);

    const allItems = [...rawMovies, ...rawSeries];
    console.log(`📦 Всего сырых элементов получено: ${allItems.length}. Начинаем маппинг...`);

    const processed = allItems
      .map((item) => {
        const genres = item.genres?.map((g) => g.name) || [];
        const countries = item.countries?.map((c) => c.name) || [];

        let ageRatingStr = null;
        if (item.ageRating !== null && item.ageRating !== undefined) {
          ageRatingStr = `${item.ageRating}+`;
        }

        return {
          id: item.id,
          name: item.name || item.alternativeName,
          alternativeName: item.alternativeName || null,
          movieLength: item.movieLength || item.seriesLength || null,
          shortDescription: item.shortDescription || item.description || "",
          genres,
          countries,
          type: item.type,
          rating: {
            kp: item.rating?.kp ? Number(item.rating.kp.toFixed(1)) : 0,
            imdb: item.rating?.imdb ? Number(item.rating.imdb.toFixed(1)) : 0,
          },
          votes: {
            kp: item.votes?.kp || 0,
            imdb: item.votes?.imdb || 0,
          },
          poster: {
            url: item.poster?.url || "",
            previewUrl: item.poster?.previewUrl || "",
          },
          logo: item.logo?.url || null,
          year: item.year || null,
          ageRating: ageRatingStr,
          top250: item.top250 || null,
        };
      })
      .filter((item) => {
        if (!item.name) return false;

        const isAnime = item.genres.some((g) => g.toLowerCase() === "аниме");
        return !isAnime;
      });

    const dataDir = path.join(process.cwd(), "src", "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, "movies.json");
    fs.writeFileSync(filePath, JSON.stringify(processed, null, 2), "utf-8");

    console.log("✅ Кэш успешно обновлен! Чистых элементов записано: " + processed.length);
  } catch (error) {
    console.error("❌ Сборка кэша завершилась ошибкой:", error);
    process.exit(1);
  }
}

buildCache();
