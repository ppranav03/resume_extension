// Popup for the extension. Two features share this file:
//   Referrals - find LinkedIn contacts for the ONE job posting in the current tab.
//   Clusters  - send SEVERAL open job postings to the backend at once, to be grouped on the website.
// Both talk to the local Flask backend; the website (DASHBOARD) reads the same data.

const API = "http://127.0.0.1:5000";
const DASHBOARD = "http://localhost:5173";
// Cap on the page text sent per tab, so a huge page doesn't bloat the request.
// The backend trims further before sending it to Gemini.
const MAX_PAGE_CHARS = 20000;

// Resolves with the URL of the tab the user is looking at.
function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (tabs.length === 0) {
        reject("No active tab found");
      } else {
        resolve(tabs[0].url);
      }
    });
  });
}

// POSTs JSON to the backend and returns the parsed response.
// Throws an Error with a readable message on any failure (backend down, or an error
// status), so callers can show e.message directly.
async function postJson(path, body) {
  let response;
  try {
    response = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    // fetch only rejects when it can't connect at all.
    throw new Error("Can't reach the backend. Is Flask running?");
  }
  // An error response might not be JSON, so don't let that hide the status check below.
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

// ---- Tabs -------------------------------------------------------------

const panels = {
  referral: document.getElementById("panel-referral"),
  cluster: document.getElementById("panel-cluster")
};

// Shows one panel and hides the other; aria-selected keeps the tab buttons in sync
// for both styling and screen readers.
function showPanel(name) {
  for (const [key, panel] of Object.entries(panels)) {
    panel.hidden = key !== name;
    document.getElementById(`tab-${key}`).setAttribute("aria-selected", String(key === name));
  }
  // Refresh the checklist each time, since the user's open tabs change between visits.
  if (name === "cluster") {
    loadOpenTabs();
  }
}

document.getElementById("tab-referral").addEventListener("click", () => showPanel("referral"));
document.getElementById("tab-cluster").addEventListener("click", () => showPanel("cluster"));

document.getElementById("dashboardLink").addEventListener("click", (e) => {
  // A plain link would open inside the popup, which closes as soon as focus moves.
  e.preventDefault();
  chrome.tabs.create({ url: DASHBOARD });
});

// ---- Referrals: one site at a time ------------------------------------

document.getElementById("scanButton").addEventListener("click", async () => {
  const universityInput = document.getElementById("universityInput").value;
  if (!universityInput) {
    alert("Please enter a university");
    return;
  }

  const currentUrl = await getCurrentTab();
  const result = document.getElementById('scan_result');
  const button = document.getElementById("scanButton");
  // A scan takes several seconds (scrape, Gemini, search), so show progress and
  // block double-clicks.
  result.textContent = 'Searching...';
  button.disabled = true;

  try {
    if (currentUrl) {
      // The backend fetches this page itself, works out the company and role, and
      // searches for matching LinkedIn profiles. It also saves the job and contacts.
      const data = await postJson("/scan", { url: currentUrl, university: universityInput });
      result.textContent = '';
      if (data.contacts.length === 0) {
        result.textContent = "No contacts found.";
        return;
      }
      // contacts[i] is the profile's title, and links[i] is its URL.
      const contactsList = document.createElement('ul');
      data.contacts.forEach((contact, index) => {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = data.links[index];
        link.target = "_blank"
        link.textContent = contact;
        link.style.cursor = "pointer";
        link.addEventListener('click', (e) => {
          // Open in a background tab so the popup isn't dismissed and the user can
          // keep working through the list.
          e.preventDefault();
          chrome.tabs.create({ url: data.links[index], active: false });
        });
        listItem.appendChild(link);
        contactsList.appendChild(listItem);
      });
      result.appendChild(contactsList);
    }
  } catch (e) {
    result.textContent = e.message;
  } finally {
    // Runs on every path, including the early "No contacts found" return.
    button.disabled = false;
  }
});

// ---- Clusters: several open tabs at once ------------------------------

const tabList = document.getElementById("tabList");
const clusterResult = document.getElementById("cluster_result");
const addButton = document.getElementById("addButton");

// Only ordinary web pages are worth listing. Extensions can't read chrome:// pages, and
// our own backend and dashboard tabs are never job postings.
function isPostingCandidate(tab) {
  return /^https?:/.test(tab.url || "")
    && !tab.url.startsWith(API)
    && !tab.url.startsWith(DASHBOARD);
}

// Fills the checklist with the open tabs in this window.
async function loadOpenTabs() {
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(isPostingCandidate);
  tabList.textContent = "";
  clusterResult.textContent = "";

  if (tabs.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No web pages open in this window.";
    tabList.appendChild(empty);
  }
  for (const tab of tabs) {
    // Titles come from web pages, so they are set with textContent (never innerHTML).
    const item = document.createElement("li");
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    // The tab id and title ride on the checkbox so the Add handler can read them back.
    box.dataset.tabId = tab.id;
    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || tab.url;
    title.title = tab.url;
    box.dataset.title = tab.title || tab.url;
    label.append(box, title);
    item.appendChild(label);
    tabList.appendChild(item);
  }
  addButton.disabled = tabs.length === 0;
}

// Reads the visible text of a tab. Unlike the Referrals scan (where the backend downloads
// the page), this runs inside the user's browser, so it sees pages behind a login and
// pages built by JavaScript.
async function readTab(tabId) {
  // chrome.scripting only exists once the extension has been reloaded with the
  // "scripting" permission, so give a specific hint instead of a cryptic TypeError.
  if (!chrome.scripting) {
    throw new Error("Reload the extension in chrome://extensions to grant its new permissions.");
  }
  const tab = await chrome.tabs.get(tabId);
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (document.body ? document.body.innerText : "")
  });
  return { url: tab.url, title: tab.title, text: (injection.result || "").slice(0, MAX_PAGE_CHARS) };
}

// Appends one line to the results list under the Add button.
function showResult(text) {
  const item = document.createElement("li");
  item.textContent = text;
  clusterResult.appendChild(item);
}

addButton.addEventListener("click", async () => {
  const chosen = [...tabList.querySelectorAll("input:checked")].map((box) => ({
    id: Number(box.dataset.tabId),
    title: box.dataset.title
  }));
  if (chosen.length === 0) {
    alert("Tick at least one job posting");
    return;
  }

  addButton.disabled = true;
  clusterResult.textContent = "";
  showResult(`Reading ${chosen.length} page${chosen.length > 1 ? "s" : ""}... this can take a minute.`);

  try {
    // Read every ticked tab first. A tab that can't be read is reported but doesn't stop
    // the others, and everything readable goes to the backend in ONE request so it can
    // profile them together.
    const pages = [];
    const unreadable = [];
    for (const { id, title } of chosen) {
      try {
        pages.push(await readTab(id));
      } catch (e) {
        // Browser-internal pages, the web store and PDF tabs can't be read.
        unreadable.push({ title, reason: e.message });
      }
    }

    // Skip the request entirely if nothing was readable.
    const data = pages.length ? await postJson("/cluster/add", { pages }) : { results: [] };
    clusterResult.textContent = "";
    for (const r of data.results) {
      // The icon and the word both carry the status, so it never depends on color alone.
      const name = r.company ? `${r.company} · ${r.role}` : r.url;
      const icon = r.status === "failed" ? "✕ Failed" : r.status === "updated" ? "↻ Updated" : "✓ Added";
      showResult(`${icon}: ${name}${r.error ? ` (${r.error})` : ""}`);
    }
    for (const { title, reason } of unreadable) {
      showResult(`✕ Couldn't read ${title}: ${reason}`);
    }
  } catch (e) {
    clusterResult.textContent = "";
    showResult(e.message);
  } finally {
    addButton.disabled = false;
  }
});
