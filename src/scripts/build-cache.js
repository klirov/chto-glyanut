import fs from "fs";
import path from "path";

// Безопасно загружаем .env локально. На GitHub Actions этого файла нет,
// ошибка проигнорируется, так как ключ прилетит из секретов репозитория.
try {
  process.loadEnvFile();
} catch (error) {
  // Файла .env нет (мы в GitHub Actions), это нормально, работаем на сервере
}

const API_KEY = process.env.KINOPOISK_API_KEY;
const OUTPUT_PATH = path.resolve("src/data/movies.json");

if (!API_KEY) {
  console.error("❌ Ошибка: KINOPOISK_API_KEY не найден в переменных окружения!");
  process.exit(1);
}

// 1. Черный список жанров (убираем стендапы, лекции, обзоры и концерты)
const EXCLUDED_GENRES = ["концерт", "документальный", "короткометражка", "ток-шоу", "реальное тв", "музыка"];

// 2. Стоп-слова в названиях (для отсечения блогов Кинопоиска и бэкстейджей)
const STOP_WORDS = [
  "о чём на самом деле",
  "как устроен",
  "фильм о фильме",
  "история создания",
  "мастерство, стоящее за",
  "стендап",
  "stand-up",
  "видеоэссе",
  "спецвыпуск",
  "бэкстейдж",
];

async function fetchTopMovies() {
  const rawMovies = [];

  console.log("🚀 Начинаем сбор базы фильмов от Кинопоиска...");

  for (let page = 1; page <= 10; page++) {
    console.log(`📡 Запрос страницы ${page} из 10...`);

    // Добавили selectFields=type, чтобы точно знать формат контента
    const url = `https://api.kinopoisk.dev/v1.4/movie?page=${page}&limit=100&selectFields=id&selectFields=name&selectFields=alternativeName&selectFields=year&selectFields=rating&selectFields=genres&selectFields=poster&selectFields=description&selectFields=type&notNullFields=poster.url&type=movie&rating.kp=7-10`;

    try {
      const response = await fetch(url, {
        headers: { "X-API-KEY": API_KEY },
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();

      if (data.docs && data.docs.length > 0) {
        rawMovies.push(...data.docs);
      } else {
        console.log("⚠️ Больше фильмов не найдено на этой странице.");
        break;
      }
    } catch (error) {
      console.error(`❌ Сбой при загрузке страницы ${page}:`, error.message);
      break;
    }
  }

  console.log(`🧹 Фильтрация мусора и оптимизация структуры данных... (Получено из API: ${rawMovies.length})`);

  // Магия очистки
  const cleanMovies = rawMovies
    .filter((movie) => {
      // Отсекаем всё, что не является полнометражным фильмом, мультиком или аниме
      if (movie.type && !["movie", "cartoon", "anime"].includes(movie.type)) {
        return false;
      }

      // Фильтруем по нежелательным жанрам
      const hasBadGenre = movie.genres?.some((genre) => EXCLUDED_GENRES.includes(genre.name.toLowerCase()));
      if (hasBadGenre) return false;

      // Отсекаем видеоэссе и промо-ролики Кинопоиска по ключевым словам в названии
      const nameLower = (movie.name || movie.alternativeName || "").toLowerCase();
      if (STOP_WORDS.some((word) => nameLower.includes(word))) {
        return false;
      }

      // На всякий случай проверяем, чтобы точно был постер и рейтинг не слетел ниже 7.0
      if (!movie.poster?.url) return false;
      if (!movie.rating?.kp || movie.rating.kp < 7) return false;

      return true;
    })
    .map((movie) => {
      // Выбрасываем гигабайты пустых полей от API Кинопоиска.
      // Оставляем только то, что реально рендерится у нас на фронтенде.
      return {
        id: movie.id,
        name: movie.name || movie.alternativeName || "Без названия",
        description: movie.description || "Описание к этому фильму еще не завезли.",
        year: movie.year,
        // Структура массива объектов сохранена [{ name: 'Драма' }], чтобы не сломать Astro фронтенд
        genres: movie.genres?.map((g) => ({ name: g.name })) || [],
        rating: {
          kp: movie.rating?.kp ? Number(movie.rating.kp.toFixed(1)) : 0,
        },
        poster: {
          url: movie.poster?.url || "",
        },
      };
    });

  // Записываем готовый чистый массив в файл src/data/movies.json
  try {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleanMovies, null, 2));
    console.log(`✅ База успешно обновлена! Сохранено реальных художественных фильмов: ${cleanMovies.length}`);
  } catch (err) {
    console.error("❌ Не удалось сохранить JSON-файл:", err);
  }
}

fetchTopMovies();
