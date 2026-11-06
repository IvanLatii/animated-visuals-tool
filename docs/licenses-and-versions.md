# Ліцензії й версії (перевірено 2026-10-21)

| Бібліотека | Версія (npm) | Ліцензія | Остання активність | Висновок |
|---|---|---|---|---|
| gif.js | 0.2.0 (npm: червень 2022) | MIT (npm + GitHub, файл LICENSE є) | репо: останній пуш жовтень 2023, код — 2019; 94 відкритих issue | 🟡 працює, але покинута. Для нас ок (маленька, без залежностей), але виправлень чекати не варто |
| @types/gif.js | 0.2.5 | MIT | — | типи для TypeScript (потрібні, бо strict) |
| Mediabunny | 1.62.0 (npm: 2026-10-20, вчора) | MPL-2.0 (npm + GitHub) | активна, 7.3k зірок | 🟢 живий проєкт |

## MPL-2.0 простими словами
Можна вільно використовувати в своєму коді, у тому числі закритому. Якщо правити сам код Mediabunny, ці правки треба лишати відкритими. Ми його не правимо, тож нічого не змінюється.

## gif.js: воркер
У пакеті є окремий файл `dist/gif.worker.js`. Його треба віддавати як окремий статичний файл і вказати шлях у налаштуваннях `workerScript`. У Vite це перевіряємо в тест-прототипі.

## Mediabunny: як віддати кадри з canvas (за mediabunny.dev)
Схема: `Output` + `Mp4OutputFormat` + `BufferTarget`, потім `CanvasSource(canvas, {codec:'avc', quality})`, `output.addVideoTrack(source, {frameRate})`, `await output.start()`, у циклі `await source.add(timestamp, duration)` (секунди), `await output.finalize()`, готовий файл у `output.target.buffer`.
❌ Ще не перевірено на практиці: точний тип `buffer`, значення `fastStart` для звичайного MP4 (не fragmented). Дивимось у тесті.

## Шрифт Mozilla Text (додано 2026-11-06)
Лежить у `public/fonts/` (woff2 з Google Fonts, latin і latin-ext), підключений через @font-face, тож працює офлайн. Ліцензія SIL Open Font License 1.1 (за даними Google Fonts; 🟡 окремий файл ліцензії шрифту в репозиторій не додавав). Кирилиці в шрифті немає, її малює системний шрифт.
