const phabURL = "https://phabricator.services.mozilla.com";
const tokenPattern = /api-.*/;
const phidPattern = /PHID-USER-.*/;

const CACHE_TIMEOUT = 60 * 1000;

let cachedQueryTime = 0;
let cachedRevs = null;

let running = false;
const tabIdQueue = [];

// Performs Conduit API and returns result JSON object.
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

async function savePhid(phid) {
  try {
    await browser.storage.local.set({
      "phid": phid
    });
  } catch (e) {
  }
}

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

  console.log(JSON.stringify(response));
  const names = new Map();
  for (const [phid, data] of Object.entries(response.result)) {
    names.set(phid, data.fullName);
  }
  return names;
}

async function query() {
  const token = await loadToken();
  if (!token) {
    return;
  }

  const phid = await loadOrGetPhid(token);
  if (!phid) {
    return;
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

  running = false;
  for (const tabId of tabIdQueue) {
    console.log("query result");
    browser.tabs.sendMessage(tabId, {
      topic: "revs",
      revs: simpleRevs,
    });
  }
  cachedRevs = simpleRevs;
  cachedQueryTime = Date.now();
}

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.topic) {
    case "query": {
      const tabId = sender.tab.id;

      if (Date.now() < cachedQueryTime + CACHE_TIMEOUT) {
        console.log("cached");
        browser.tabs.sendMessage(tabId, {
          topic: "revs",
          revs: cachedRevs,
        });
        return;
      }

      console.log("queue");
      tabIdQueue.push(tabId);
      if (!running) {
        running = true;
        console.log("query");
        query();
      }
      break;
    }
  }
});
