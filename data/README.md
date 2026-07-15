# Local Data Schema

All production data is JSON and is fetched only from this repository.

## fixed-calendar.json

```json
{
  "entries": {
    "MM-DD": {
      "display": "Principal commemoration text",
      "martyrs": ["Name"],
      "status": "curated"
    }
  }
}
```

Use `"jurisdictional"` for dates that intentionally direct the reader to a local Orthodox calendar.

## history.json

```json
{
  "spotlights": {
    "MM-DD": {
      "title": "Entry title",
      "text": "Concise original historical summary."
    }
  }
}
```

## prayers.json

Each prayer requires `id`, `title`, `category`, and `text`.

## years/YYYY.json

Each file requires `year`, `pascha`, and a `days` object containing every ISO date in that year.
