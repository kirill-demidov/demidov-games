# Demidov Games

Портал: [demidov-games.com](https://demidov-games.com)  
Первая игра: [demidov-games.com/mines](https://demidov-games.com/mines/)

Код живёт в этом репозитории. Сайт отдаёт GitHub Pages.

## Структура

- `/` — каталог игр
- `/mines/` — сапёр
- следующие игры — отдельные папки рядом с `mines/`

## DNS (GoDaddy)

Домен сейчас на парковке GoDaddy. Чтобы портал открылся:

1. DNS → удали парковочные A-записи на `13.248.243.5` и `76.223.105.230`.
2. Добавь A для `@`:

   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`

3. Добавь CNAME `www` → `kirill-demidov.github.io`

HTTPS у GitHub Pages появится после того, как DNS дойдёт.

## Локально, с таблицей рекордов

```bash
docker compose up --build
```

Портал: [http://localhost:8090](http://localhost:8090)  
Сапёр: [http://localhost:8090/mines/](http://localhost:8090/mines/)
