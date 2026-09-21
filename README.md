# Referral Finder

A Chrome extension that finds people to ask for a referral. Open a job posting, enter your university, and click **Scan**. The extension lists LinkedIn profiles of people who work at that company in a similar role and went to your school.

## How it works

1. The popup sends the current tab's URL and your university to the local Flask backend (`POST /scan`).
2. The backend fetches the page and reads its title and `og:description`.
3. Gemini extracts the **company** and **role** from that text as structured JSON.
4. The backend runs a Google search through [Serper](https://serper.dev) for `site:linkedin.com/in <company> <role> <university>`.
5. The top 10 results come back to the popup as clickable links. Each opens in a background tab.

```
frontend/  Chrome extension (popup UI)
backend/
  api.py     Flask API: scrapes the page, calls Gemini and Serper
  models.py  Job schema used for Gemini's structured output
```

## Setup

### 1. Get API keys

| Variable     | Where to get it                                    | Used for                            |
| ------------ | -------------------------------------------------- | ----------------------------------- |
| `GEMINI_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Extracting company and role |
| `SERPER_KEY` | [serper.dev](https://serper.dev)                   | Searching for LinkedIn profiles     |

Both have free tiers that are enough for personal use.

Create a `.env` file in the project root:

```
GEMINI_KEY=your_gemini_key
SERPER_KEY=your_serper_key
```

`.env` is gitignored. Never commit it.

### 2. Install the backend

```
python -m venv venv
venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the backend

```
cd backend
python -m flask --app api run
```

The API listens on `http://127.0.0.1:5000`. The extension expects this address.

### 4. Load the extension

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `frontend` folder.

## Usage

1. Make sure the backend is running.
2. Open a specific job posting in Chrome.
3. Click the extension icon, enter your university, and click **Scan**.

After changing extension files, click the reload icon on the extension's card in `chrome://extensions`. After changing `.env` or backend code, restart Flask.

## Troubleshooting

| Symptom                              | Likely cause                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Popup shows "Invalid URL"            | The page couldn't be fetched (expired posting, login wall, or a site that blocks scrapers).    |
| "Contact search failed"              | Bad or missing `SERPER_KEY`, or the quota is used up. The Flask terminal shows Serper's error. |
| "No contacts found."                 | The search returned nothing. Try a different university or a more specific posting.            |
| Wrong company or role                | The page is a job listing or search page, not a single posting. Open the individual job.       |
| Gemini "model not found" (404)       | Google retired the model. Update the model name in `backend/api.py`.                           |
| Popup can't reach the backend        | Flask isn't running, or it isn't on port 5000.                                                 |

## Limitations

- Results are Google search results for public LinkedIn profiles. LinkedIn itself is never scraped, so results depend on what Google has indexed and may include people who have since moved on.
- It only works on pages that return their content without login or heavy JavaScript rendering.
- Local development setup only. `CORS` is open to all origins and Flask runs in debug mode, so don't expose it to a network.
