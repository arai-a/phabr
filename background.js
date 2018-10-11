const phabURL = "https://phabricator.services.mozilla.com";
const tokenPattern = /api-.*/;
const phidPattern = /PHID-USER-.*/;

const CACHE_TIMEOUT = 60 * 1000;

let cachedQueryTime = 0;
let cachedRevs = null;

let running = false;
const tabIdQueue = [];

// Perform Conduit API and return result JSON object.
async function ConduitAPI(name, params=[]) {
  const query = params
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
  const uri = `${phabURL}/api/${name}?${query}`;
  const init = {
    credentials: "omit",
  };
  const response = await fetch(uri, init);
  return response.json();
}

// Load API token from preference.
async function loadToken() {
  try {
    const { token } = await browser.storage.local.get("token");
    if (tokenPattern.test(token)) {
      return token;
    }
  } catch (e) {
  }
  return "";
}

// Save retrieved API token to preference.
async function savePhid(phid) {
  try {
    await browser.storage.local.set({
      "phid": phid
    });
  } catch (e) {
  }
}

// Load PHID from preference if exists,
// get from server if not.
async function loadOrGetPhid(token) {
  try {
    const { phid } = await browser.storage.local.get("phid");
    if (phidPattern.test(phid)) {
      return phid;
    }
  } catch (e) {
  }

  const whoami = await ConduitAPI("user.whoami", [
    ["api.token", token],
  ]);
  const phid = whoami.result.phid;
  if (phidPattern.test(phid)) {
    savePhid(phid);
    return phid;
  }

  return "";
}

// Get the list of pending reviews.
async function getPendingReviews(token, phid) {
  const response = await ConduitAPI("differential.query", [
    ["api.token", token],
    ["reviewers[0]", phid],
    ["status", "status-needs-review"],
    ["order", "order-modified"],
    ["limit", "10"],
  ]);
  return response.result;
}

// Get the map from PHID to user name, for each author in revs.
async function getAuthorNamesForRevs(token, revs) {
  const ids = new Set();
  for (const rev of revs) {
    ids.add(rev.authorPHID);
  }

  if (ids.size === 0) {
    return new Map();
  }

  const response = await ConduitAPI("phid.query", [
    ["api.token", token],
    ...[...ids].map((value, i) => [`phids[${i}]`, value]),
  ]);

  const names = new Map();
  for (const [phid, data] of Object.entries(response.result)) {
    names.set(phid, data.fullName);
  }
  return names;
}

// Get the list of pending reviews and return simplified struct for passing
// as message.
async function getSimpleRevs() {
  const token = await loadToken();
  if (!token) {
    return null;
  }

  const phid = await loadOrGetPhid(token);
  if (!phid) {
    return null;
  }

  const revs = await getPendingReviews(token, phid);

  const names = await getAuthorNamesForRevs(token, revs);

  const simpleRevs = [];
  for (const rev of revs) {
    simpleRevs.push({
      title: rev.title,
      author: names.get(rev.authorPHID),
      bugnumber: rev.auxiliary ? rev.auxiliary["bugzilla.bug-id"] : 0,
      dateModified: rev.dateModified,
    });
  }
  return simpleRevs;
}

// Get the simplified list of pending reviews, and send it as message to tabs.
async function query() {
  const revs = await getSimpleRevs();
  if (!revs) {
    return;
  }

  running = false;
  for (const tabId of tabIdQueue) {
    browser.tabs.sendMessage(tabId, {
      topic: "revs",
      revs,
    });
  }
  cachedRevs = revs;
  cachedQueryTime = Date.now();
}

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.topic) {
    case "query": {
      const tabId = sender.tab.id;

      if (Date.now() < cachedQueryTime + CACHE_TIMEOUT) {
        browser.tabs.sendMessage(tabId, {
          topic: "revs",
          revs: cachedRevs,
        });
        return;
      }

      tabIdQueue.push(tabId);
      if (!running) {
        running = true;
        query();
      }
      break;
    }
  }
});
