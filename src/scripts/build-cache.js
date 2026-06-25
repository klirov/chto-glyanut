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

async function fetchAllMovies() {
  const rawMovies = [];
  const limit = 250;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `https://api.kinopoisk.dev/v1.4/movie?page=${page}&limit=${limit}&notNullFields=poster.url&rating.kp=7-10&sortField=votes.kp&sortType=-1&votes.kp=25000-10000000`;

    try {
      const response = await fetch(url, { headers: { "X-API-KEY": API_KEY } });
      if (!response.ok) throw new Error(`Ошибка: ${response.status}`);

      const data = await response.json();

      if (page === 1 && data.total) {
        totalPages = Math.min(Math.ceil(data.total / limit), 10);
      }

      if (data.docs?.length > 0) {
        rawMovies.push(...data.docs);
      }
    } catch (error) {
      console.error(`❌ Ошибка на странице ${page}:`, error.message);
      break;
    }
    page++;
  }

  const cleanMovies = rawMovies
    .filter((movie) => {
      if (movie.type && movie.type !== "movie") return false;
      if (movie.genres?.some((g) => EXCLUDED_GENRES.includes(g.name.toLowerCase()))) return false;
      const nameLower = (movie.name || movie.alternativeName || "").toLowerCase();
      if (STOP_WORDS.some((word) => nameLower.includes(word))) return false;
      if (!movie.poster?.url) return false;
      return true;
    })
    .map((movie) => ({
      id: movie.id,
      name: movie.name || movie.alternativeName || "Без названия",
      alternativeName: movie.alternativeName || null,
      movieLength: movie.movieLength || null,
      shortDescription: movie.shortDescription || movie.description || "Описание отсутствует.",
      genres: movie.genres?.map((g) => g.name.toLowerCase()) || [],
      countries: movie.countries?.map((c) => c.name) || [],
      rating: {
        kp: movie.rating?.kp ? Number(movie.rating.kp.toFixed(1)) : 0,
        imdb: movie.rating?.imdb ? Number(movie.rating.imdb.toFixed(1)) : 0,
      },
      votes: {
        kp: movie.votes?.kp || 0,
        imdb: movie.votes?.imdb || 0,
      },
      poster: {
        url: movie.poster?.url || "",
        previewUrl: movie.poster?.previewUrl || "",
      },
      logo: movie.logo?.url || null,
      year: movie.year || null,
      ageRating: movie.ageRating !== undefined && movie.ageRating !== null ? `${movie.ageRating}+` : null,
      top250: movie.top250 || null,
    }));

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleanMovies, null, 2));
  console.log(`✅ Успешно сохранено фильмов: ${cleanMovies.length}`);
}

fetchAllMovies();
