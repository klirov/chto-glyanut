import fs from "fs";
import path from "path";

try {
  process.loadEnvFile();
} catch (error) {}

const API_KEY = process.env.KINOPOISK_API_KEY;
const OUTPUT_PATH = path.resolve("src/data/movies.json");

if (!API_KEY) {
  console.error("❌ KINOPOISK_API_KEY не найден!");
  process.exit(1);
}

const EXCLUDED_GENRES = ["концерт", "документальный", "короткометражка", "ток-шоу", "реальное тв", "музыка"];
const STOP_WORDS = [
  "о чём на самом деле",
  "как устроен",
  "фильм о фильме",
  "история создания",
  "стендап",
  "stand-up",
  "видеоэссе",
];

async function fetchTopMovies() {
  const rawMovies = [];

  for (let page = 1; page <= 10; page++) {
    // Добавили selectFields=countries в URL
    const url = `https://api.kinopoisk.dev/v1.4/movie?page=${page}&limit=100&selectFields=id&selectFields=name&selectFields=alternativeName&selectFields=year&selectFields=rating&selectFields=genres&selectFields=poster&selectFields=description&selectFields=type&selectFields=countries&notNullFields=poster.url&type=movie&rating.kp=7-10`;

    try {
      const response = await fetch(url, { headers: { "X-API-KEY": API_KEY } });
      if (!response.ok) throw new Error(`Ошибка: ${response.status}`);
      const data = await response.json();
      if (data.docs?.length > 0) rawMovies.push(...data.docs);
    } catch (error) {
      console.error(`❌ Ошибка на странице ${page}:`, error.message);
      break;
    }
  }

  const cleanMovies = rawMovies
    .filter((movie) => {
      if (movie.type && !["movie", "cartoon", "anime"].includes(movie.type)) return false;
      if (movie.genres?.some((g) => EXCLUDED_GENRES.includes(g.name.toLowerCase()))) return false;
      const nameLower = (movie.name || movie.alternativeName || "").toLowerCase();
      if (STOP_WORDS.some((word) => nameLower.includes(word))) return false;
      if (!movie.poster?.url) return false;
      return true;
    })
    .map((movie) => {
      return {
        id: movie.id,
        name: movie.name || movie.alternativeName || "Без названия",
        description: movie.description || "Описание отсутствует.",
        year: movie.year,
        genres: movie.genres?.map((g) => ({ name: g.name })) || [],
        countries: movie.countries?.map((c) => ({ name: c.name })) || [],
        rating: { kp: movie.rating?.kp ? Number(movie.rating.kp.toFixed(1)) : 0 },
        poster: { url: movie.poster?.url || "" },
      };
    });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleanMovies, null, 2));
  console.log(`✅ Успешно сохранено фильмов: ${cleanMovies.length}`);
}

fetchTopMovies();
