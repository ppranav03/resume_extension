# Referral Finder

A Chrome extension plus a small website for job hunting. It does two things:

- **Referrals (one site at a time).** Open a job posting, enter your university, and click **Scan**. The extension lists LinkedIn profiles of people who work at that company in a similar role and went to your school. Every scan is saved.
- **Clusters (many sites at once).** Tick several open job postings in the extension and add them together. The website groups every job you've added by role, day-to-day duties, or technical skills, so you can see which kinds of jobs you keep looking at.

The website has two tabs: **Contacts** (each scanned job with its saved contacts) and **Clusters** (a map and cards of grouped jobs).

## How it works

```
Chrome extension ──► Flask API (backend/) ──► SQLite (backend/data.db)
                          ▲
React website (web/) ─────┘
```

**Referral scan** (`POST /scan`)
1. The extension sends the current tab's URL and your university.
2. The backend reads the page's title and `og:description`, and Gemini extracts the company and role.
3. Serper runs a Google search for `site:linkedin.com/in <company> <role> <university>`.
4. The top 10 results are saved and shown.

**Add to clusters** (`POST /cluster/add`)
1. The extension reads the text of each ticked tab (your logged-in view, so it works on pages a server couldn't fetch).
2. Gemini extracts company, role, duties and skills. Postings are sent five to a call, because the free tier allows very few requests per minute.
3. Each job is embedded three times (role, duties, skills) with the Gemini embedding model and saved.

**Clusters view** (`GET /cluster?by=role|duties|skills`)
1. The backend runs KMeans on the embeddings for the chosen dimension. The number of clusters is picked by silhouette score, or set by you (2 to 8).
2. The vectors are flattened to 2D (PCA) for the map, and Gemini names each cluster.

```
frontend/   Chrome extension (popup with Referrals and Clusters tabs)
backend/
  api.py         Flask routes
  ai.py          Gemini calls: extraction, embeddings, cluster names
  clustering.py  KMeans + 2D projection
  db.py          SQLite storage
  models.py      Schemas for Gemini's structured output
web/        React website (Vite)
```

## Setup

### 1. Get API keys

| Variable     | Where to get it                                                  | Used for                         |
| ------------ | ---------------------------------------------------------------- | -------------------------------- |
| `GEMINI_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Extraction, embeddings, naming   |
| `SERPER_KEY` | [serper.dev](https://serper.dev)                                 | Searching for LinkedIn profiles  |

Both have free tiers that are enough for personal use. Create a `.env` file in the project root:

```
GEMINI_KEY=your_gemini_key
SERPER_KEY=your_serper_key
```

`.env` is gitignored. Never commit it. Optionally set `GEMINI_MODEL` to use a different Gemini model (the default is `gemini-flash-lite-latest`, which has the most free-tier headroom).

### 2. Backend

```
python -m venv venv
venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cd backend
python -m flask --app api run
```

The API listens on `http://127.0.0.1:5000`. Data is stored in `backend/data.db`, which is created on first run.

### 3. Website

```
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. You can link straight to a tab with `#contacts` or `#clusters`.

### 4. Extension

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `frontend` folder.

The extension asks for access to all sites so it can read the text of the tabs you tick. It only reads tabs you select, when you press the button.

## Usage

**Referrals:** open a specific job posting, click the extension, stay on the **Referrals** tab, enter your university and click **Scan this page**.

**Clusters:** open several job postings in one window, click the extension, switch to **Clusters**, tick the postings and click **Add to clusters**. Adding the same page again updates it instead of duplicating it. You need at least 3 jobs before clusters appear on the website.

After changing extension files, reload the extension in `chrome://extensions`. After changing `.env` or backend code, restart Flask.

## Reading the Clusters tab

- Use **Role / Duties / Skills** to regroup the same jobs. Skills usually gives the cleanest groups.
- The **map** places similar jobs close together. The axes are a flattened view of many dimensions, so only the distances mean anything.
- With 3 or fewer clusters, the map colors points by cluster. With more, the map stays one color, because more hues than that can't be told apart reliably on a scatter plot. Click a cluster in the legend, on a card, or on a dot to highlight it. Each card also shows its own small map.
- Use the **×** on a job in a cluster card to remove it from your saved jobs.

## Troubleshooting

| Symptom                              | Likely cause                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| "Invalid URL" on Scan                | The page couldn't be fetched (expired posting, login wall, or a site that blocks scrapers).     |
| "Contact search failed"              | Bad or missing `SERPER_KEY`, or the quota is used up. The Flask terminal shows Serper's error.  |
| "Gemini rate limit reached"          | Free-tier limit. Wait a minute and add fewer postings at once, or set a different `GEMINI_MODEL`. |
| Wrong company or role on a scan      | The page is a listing or search page, not a single posting. Open the individual job.            |
| Website says it can't reach backend  | Flask isn't running, or it isn't on port 5000.                                                  |
| A tab can't be added to clusters     | Browser-internal pages (`chrome://`) and the Chrome Web Store can't be read.                    |
| Gemini "model not found" (404)       | Google retired the model. Set `GEMINI_MODEL` to a current one.                                  |

## Limitations

- Referral results are Google search results for public LinkedIn profiles. LinkedIn itself is never scraped, so results depend on what Google has indexed.
- A scan fetches the page from the server, so it only works on pages that load without a login or heavy JavaScript. Clusters read the page from your browser, so they work on more sites.
- Local development setup only. `CORS` is open to all origins and Flask runs in debug mode, so don't expose it to a network.
