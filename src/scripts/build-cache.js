import fs from "fs";
import path from "path";

// process.env автоматически подтянет ключ из .env благодаря настройке запуска (см. Шаг 4)
const API_KEY = process.env.KINOPOISK_API_KEY;
const OUTPUT_PATH = path.resolve("src/data/movies.json");

if (!API_KEY) {
  console.error("❌ Ошибка: KINOPOISK_API_KEY не найден в переменных окружения!");
  process.exit(1);
}

async function fetchTopMovies() {
  const allMovies = [];

  console.log("🚀 Начинаем сбор базы фильмов от Кинопоиска...");

  // Делаем цикл на 10 страниц. Каждая страница вернет по 100 фильмов. В сумме = 1000.
  for (let page = 1; page <= 10; page++) {
    console.log(`📡 Запрос страницы ${page} из 10...`);

    // Формируем URL с фильтрами, чтобы не качать шлак: рейтинг КП от 7 до 10, только фильмы, наличие постера обязательна
    const url = `https://api.kinopoisk.dev/v1.4/movie?page=${page}&limit=100&selectFields=id&selectFields=name&selectFields=year&selectFields=rating&selectFields=genres&selectFields=poster&selectFields=description&notNullFields=poster.url&type=movie&rating.kp=7-10`;

    try {
      const response = await fetch(url, {
        headers: { "X-API-KEY": API_KEY },
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();

      if (data.docs && data.docs.length > 0) {
        allMovies.push(...data.docs);
      } else {
        console.log("⚠️ Больше фильмов не найдено на этой странице.");
        break;
      }
    } catch (error) {
      console.error(`❌ Сбой при загрузке страницы ${page}:`, error.message);
      break; // Прерываем цикл, чтобы сохранить то, что уже успели выкачать
    }
  }

  // Записываем собранный массив в файл src/data/movies.json
  try {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allMovies, null, 2));
    console.log(`✅ База успешно обновлена! Сохранено фильмов: ${allMovies.length}`);
  } catch (err) {
    console.error("❌ Не удалось сохранить JSON-файл:", err);
  }
}

fetchTopMovies();
